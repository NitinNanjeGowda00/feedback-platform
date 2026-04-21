from __future__ import annotations

import os
import re
from collections import Counter
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

try:
    from langchain_core.prompts import PromptTemplate
except Exception:  # pragma: no cover
    PromptTemplate = None

try:
    from transformers import pipeline as hf_pipeline
except Exception:  # pragma: no cover
    hf_pipeline = None

try:
    import mlflow
except Exception:  # pragma: no cover
    mlflow = None


CATEGORY_LABELS = [
    "Productivity",
    "UX",
    "Management",
    "Healthcare",
    "Finance",
    "Other",
]

RULES = {
    "Productivity": [
        "manual",
        "repetitive",
        "slow",
        "delay",
        "time consuming",
        "copy",
        "paste",
        "approval",
        "chasing",
        "follow up",
        "spreadsheet",
        "double entry",
        "routine",
        "click",
        "workflow",
        "handoff",
        "status update",
        "switching context",
    ],
    "UX": [
        "confusing",
        "ui",
        "ux",
        "layout",
        "design",
        "broken",
        "bug",
        "error",
        "not intuitive",
        "hard to use",
        "navigation",
        "search",
        "slow loading",
        "mobile",
        "cluttered",
        "unclear",
        "difficult to find",
    ],
    "Management": [
        "manager",
        "leadership",
        "policy",
        "priority",
        "expectation",
        "communication",
        "misalignment",
        "deadline",
        "unclear goals",
        "approval chain",
        "team conflict",
        "review",
        "feedback loop",
        "planning",
        "task allocation",
        "workload",
    ],
    "Healthcare": [
        "patient",
        "hospital",
        "clinic",
        "medical",
        "doctor",
        "nurse",
        "treatment",
        "records",
        "chart",
        "lab",
        "pharmacy",
    ],
    "Finance": [
        "loan",
        "bank",
        "finance",
        "billing",
        "invoice",
        "payment",
        "underwriting",
        "audit",
        "compliance",
        "approval",
    ],
    "Other": [],
}

PRODUCT_PATTERNS = {
    "Jira": [r"\bjira\b", r"\batlassian\b"],
    "Slack": [r"\bslack\b"],
    "Excel": [r"\bexcel\b"],
    "Salesforce": [r"\bsalesforce\b"],
    "Notion": [r"\bnotion\b"],
    "Asana": [r"\basana\b"],
    "Trello": [r"\btrello\b"],
    "Zendesk": [r"\bzendesk\b"],
    "HubSpot": [r"\bhubspot\b"],
    "Google Workspace": [
        r"\bgoogle workspace\b",
        r"\bg suite\b",
        r"\bgsuite\b",
        r"\bgmail\b",
        r"\bdocs\b",
        r"\bsheets\b",
    ],
    "Microsoft 365": [
        r"\boffice 365\b",
        r"\bmicrosoft 365\b",
        r"\boutlook\b",
        r"\bteams\b",
    ],
}

SECTOR_PATTERNS = {
    "Healthcare": [r"\bhospital\b", r"\bclinic\b", r"\bpatient\b", r"\bmedical\b", r"\bdoctor\b", r"\bnurse\b"],
    "Finance": [r"\bbank\b", r"\bfinance\b", r"\bloan\b", r"\btrading\b", r"\binsurance\b", r"\bcompliance\b"],
    "Retail": [r"\bstore\b", r"\bretail\b", r"\binventory\b", r"\bcheckout\b", r"\bsales floor\b"],
    "Education": [r"\bschool\b", r"\bcollege\b", r"\bstudent\b", r"\bteacher\b", r"\bclassroom\b"],
    "Manufacturing": [r"\bfactory\b", r"\bproduction\b", r"\bplant\b", r"\bsupply chain\b", r"\blogistics\b"],
    "Technology": [r"\bapi\b", r"\bsoftware\b", r"\bdeploy\b", r"\bdeveloper\b", r"\bengineering\b"],
    "SaaS": [r"\bsaas\b", r"\bproduct team\b", r"\bproductivity\b", r"\bworkflow\b"],
}

POSITIVE_WORDS = {
    "helpful",
    "easy",
    "faster",
    "smooth",
    "clear",
    "great",
    "good",
    "simple",
    "productive",
    "useful",
    "efficient",
    "best",
    "favorable",
    "clean",
    "better",
}

NEGATIVE_WORDS = {
    "frustrating",
    "slow",
    "confusing",
    "hard",
    "buggy",
    "annoying",
    "repetitive",
    "painful",
    "messy",
    "broken",
    "waste",
    "delayed",
    "tedious",
    "unusable",
    "complicated",
    "stressful",
    "chaotic",
    "clunky",
}


def is_low_quality(text: str) -> bool:
    """
    Basic garbage-text detection to keep obvious junk out of the pipeline.
    """
    cleaned = re.sub(r"\s+", " ", (text or "")).strip().lower()
    if not cleaned:
        return True

    if cleaned in {"test", "string", "asdf", "qwerty", "demo", "lorem", "ipsum"}:
        return True

    words = cleaned.split()
    if len(words) < 3:
        return True

    alpha_len = len(re.sub(r"[^a-z0-9]+", "", cleaned))
    if alpha_len < 8:
        return True

    return False


class IntelligenceEngine:
    def __init__(self):
        self.artifacts_dir = Path(os.getenv("AI_ARTIFACTS_DIR", "./artifacts"))
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

        self.model_path = self.artifacts_dir / "category_model_v3.joblib"

        self.generator_model = os.getenv("HF_TEXT2TEXT_MODEL", "google/flan-t5-small")
        self.enable_generator = os.getenv("ENABLE_HF_GENERATOR", "1") == "1"

        self.enable_llm_classifier = os.getenv("ENABLE_LLM_CLASSIFIER", "1") == "1"
        self.llm_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.model_version = os.getenv("AI_MODEL_VERSION", "llm-hybrid-v3")
        self.last_model_version = self.model_version

        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.llm_client = None

        if self.enable_llm_classifier and self.openai_api_key and OpenAI is not None:
            try:
                self.llm_client = OpenAI(api_key=self.openai_api_key)
            except Exception:
                self.llm_client = None

        self.classifier = self._load_or_train_classifier()
        self.generator = self._load_generator() if self.enable_generator else None

        print(
            "✅ Intelligence INIT:",
            f"LLM_CLASSIFIER={'ENABLED' if self.llm_client else 'DISABLED'}",
            f"GENERATOR={'ENABLED' if self.generator else 'DISABLED'}",
        )

    def _training_samples(self) -> tuple[list[str], list[str]]:
        samples = {
            "Productivity": [
                "Too many manual steps slow me down",
                "I keep copying the same data across tools",
                "Approvals take too long and block my work",
                "We waste time on repetitive status updates",
                "Switching between tools breaks my flow",
                "I need automation for repetitive tasks",
                "The process requires too many clicks",
                "I spend a lot of time chasing follow ups",
                "Spreadsheet updates are repeated in multiple places",
                "A lot of my day is spent on routine work",
            ],
            "UX": [
                "The interface is confusing and cluttered",
                "It is hard to find what I need in the app",
                "The design feels broken on mobile",
                "Navigation is not intuitive",
                "The search is slow and unreliable",
                "The UI has too many errors and bugs",
                "Important actions are hidden in the layout",
                "The page loads slowly and feels clunky",
                "The form is difficult to use",
                "Labels are unclear and confusing",
            ],
            "Management": [
                "Our priorities change too often",
                "Communication from leadership is unclear",
                "Approval chains slow everything down",
                "The manager gives vague expectations",
                "Workload is not distributed fairly",
                "We have too many meetings and no alignment",
                "The team needs better planning",
                "Feedback loops are too slow",
                "The process depends on management approvals",
                "There is misalignment between teams",
            ],
            "Healthcare": [
                "Patient records are manually updated and cause delays in treatment",
                "Hospital staff waste time on repetitive paperwork",
                "Clinic scheduling is slow and confusing",
                "Doctors need a better system for patient data",
                "Nurses spend too much time entering manual updates",
            ],
            "Finance": [
                "Loan approvals are slow due to multiple manual checks",
                "Billing and invoice approvals take too long",
                "Bank compliance reviews require repetitive manual steps",
                "Finance teams need better automation for approval workflows",
                "Payment processing has too many handoffs",
            ],
            "Other": [
                "I need a better way to archive documents",
                "There is no simple tool for our use case",
                "The problem is mostly about external systems",
                "We need a custom report for operations",
                "I want more flexible access permissions",
                "The issue is related to compliance tracking",
                "We need a better notification system",
                "The problem does not fit the current workflow categories",
                "We need better data export options",
                "The request is about a niche internal process",
            ],
        }

        texts, labels = [], []
        for label, items in samples.items():
            texts.extend(items)
            labels.extend([label] * len(items))
        return texts, labels

    def _load_or_train_classifier(self):
        if self.model_path.exists():
            try:
                model = joblib.load(self.model_path)
                model_classes = set(getattr(model, "classes_", []))
                required_classes = set(CATEGORY_LABELS)
                if required_classes.issubset(model_classes):
                    return model
            except Exception:
                pass

        X, y = self._training_samples()
        model = Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), stop_words="english")),
                ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
            ]
        )
        model.fit(X, y)

        try:
            joblib.dump(model, self.model_path)
        except Exception:
            pass

        return model

    def _load_generator(self):
        if hf_pipeline is None:
            return None

        try:
            return hf_pipeline(
                "text2text-generation",
                model=self.generator_model,
                tokenizer=self.generator_model,
            )
        except Exception:
            return None

    def _normalize_category_label(self, value: str | None) -> str:
        normalized = re.sub(r"[^a-z]+", "", (value or "").strip().lower())

        mapping = {
            "productivity": "Productivity",
            "ux": "UX",
            "userexperience": "UX",
            "management": "Management",
            "healthcare": "Healthcare",
            "health": "Healthcare",
            "finance": "Finance",
            "financial": "Finance",
            "other": "Other",
        }

        return mapping.get(normalized, "Other")

    def _keyword_rule(self, text: str) -> str | None:
        """
        Weighted keyword fallback. This is still a fallback only.
        """
        lower = text.lower()
        best_label = None
        best_score = 0

        for label, keywords in RULES.items():
            if label == "Other":
                continue

            score = 0
            for keyword in keywords:
                if re.search(r"\b" + re.escape(keyword) + r"\b", lower):
                    score += 1

            if score > best_score:
                best_score = score
                best_label = label

        return best_label if best_score > 0 else None

    def _match_labels(self, text: str, mapping: dict[str, list[str]]) -> list[str]:
        lower = re.sub(r"\s+", " ", (text or "").lower())
        matches: list[str] = []

        for label, patterns in mapping.items():
            if any(re.search(pattern, lower) for pattern in patterns):
                matches.append(label)

        return list(dict.fromkeys(matches))

    def extract_products(self, text: str) -> list[str]:
        return self._match_labels(text, PRODUCT_PATTERNS)

    def extract_sectors(self, text: str) -> list[str]:
        return self._match_labels(text, SECTOR_PATTERNS)

    def detect_sector(self, text: str) -> str:
        sectors = self.extract_sectors(text)
        return sectors[0] if sectors else "Unknown"

    def analyze_text(self, text: str) -> dict[str, Any]:
        cleaned = self._normalize_feedback_text(text)

        category, confidence, model_version = self.classify(cleaned)
        sentiment_label, sentiment_score = self.sentiment(cleaned)

        return {
            "category": category,
            "confidence": confidence,
            "model_version": model_version,
            "sentiment_label": sentiment_label,
            "sentiment_score": sentiment_score,
            "is_low_quality": is_low_quality(cleaned),
            "products": self.extract_products(cleaned),
            "sector": self.detect_sector(cleaned),
        }

    def _parse_llm_category_response(self, content: str) -> tuple[str | None, float]:
        raw = (content or "").strip()
        if not raw:
            return None, 0.0

        for label in CATEGORY_LABELS:
            if re.search(r"\b" + re.escape(label.lower()) + r"\b", raw.lower()):
                return label, 0.9

        first_line = raw.splitlines()[0].strip().strip('"').strip("'")
        category = self._normalize_category_label(first_line)
        if category in CATEGORY_LABELS:
            return category, 0.9

        return None, 0.0

    def _classify_with_llm(self, text: str) -> tuple[str | None, float]:
        if not self.llm_client:
            return None, 0.0

        prompt = f"""
Classify the feedback into exactly one category:
Productivity, UX, Management, Healthcare, Finance, Other.

Rules:
- Prefer a domain category like Healthcare or Finance over generic Productivity when the domain is clearly present.
- Return ONLY the category name.
- No explanation.

Examples:
- "Loan approvals are slow" -> Finance
- "Patient records are manual" -> Healthcare
- "Too many repetitive tasks" -> Productivity

Feedback:
{text}
""".strip()

        try:
            response = self.llm_client.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
            )

            content = (response.choices[0].message.content or "").strip()
            print("LLM RAW:", content)

            return self._parse_llm_category_response(content)

        except Exception as e:
            print("LLM ERROR:", str(e))
            return None, 0.0

    def classify(self, text: str) -> tuple[str, float, str]:
        cleaned = " ".join((text or "").split())

        if not cleaned:
            self.last_model_version = "empty"
            return "Other", 0.0, "empty"

        if is_low_quality(cleaned):
            self.last_model_version = "low-quality"
            return "Other", 0.1, "low-quality"

        sector = self.detect_sector(cleaned)

        llm_label, llm_score = self._classify_with_llm(cleaned)

        print("\n=== LLM CALLED ===")
        print("TEXT:", cleaned)
        print("LLM RESULT:", llm_label, llm_score)

        # Strong domain override for Healthcare/Finance when the sector is obvious.
        if sector in {"Healthcare", "Finance"}:
            if llm_label in {None, "Other", "Productivity"} or llm_score < 0.75:
                self.last_model_version = "sector-override"
                return sector, 0.95, "sector-override"

        if llm_label and llm_score >= 0.6:
            self.last_model_version = "llm-v1"
            return llm_label, llm_score, "llm-v1"

        rule_label = self._keyword_rule(cleaned)

        try:
            probs = self.classifier.predict_proba([cleaned])[0]
            idx = int(np.argmax(probs))
            ml_label = str(self.classifier.classes_[idx])
            ml_score = float(probs[idx])
        except Exception:
            fallback_label = llm_label or "Other"
            fallback_score = llm_score or 0.0
            self.last_model_version = "fallback-error"
            return fallback_label, fallback_score, "fallback-error"

        if rule_label and ml_score < 0.7:
            self.last_model_version = "rule-based"
            return rule_label, 0.85, "rule-based"

        if ml_score < 0.4:
            self.last_model_version = "low-confidence-ml"
            return "Other", ml_score, "low-confidence-ml"

        self.last_model_version = "ml-model"
        return ml_label, ml_score, "ml-model"

    def sentiment(self, text: str) -> tuple[str, float]:
        tokens = re.findall(r"[a-zA-Z']+", (text or "").lower())
        if not tokens:
            return "neutral", 0.0

        pos = sum(token in POSITIVE_WORDS for token in tokens)
        neg = sum(token in NEGATIVE_WORDS for token in tokens)
        score = (pos - neg) / max(len(tokens), 1)

        if score > 0.02:
            return "positive", float(score)
        if score < -0.02:
            return "negative", float(score)
        return "neutral", float(score)

    def _generate(self, prompt: str, max_new_tokens: int = 160) -> str | None:
        if self.generator is None:
            return None

        try:
            result = self.generator(
                prompt,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                truncation=True,
            )
            if result and isinstance(result, list):
                text = result[0].get("generated_text", "").strip()
                return text or None
        except Exception:
            return None

        return None

    def _normalize_feedback_text(self, *parts: str | None) -> str:
        joined = " ".join(part.strip() for part in parts if part and part.strip())
        return re.sub(r"\s+", " ", joined).strip()

    def summarize_feedback(self, feedback_text: str) -> str:
        feedback_text = self._normalize_feedback_text(feedback_text)
        if not feedback_text:
            return "No feedback supplied."

        template = (
            "Summarize this employee feedback in one concise sentence for a product team:\n"
            "{text}\n"
            "Summary:"
        )
        prompt = (
            PromptTemplate.from_template(template).format(text=feedback_text)
            if PromptTemplate
            else template.format(text=feedback_text)
        )

        generated = self._generate(prompt, max_new_tokens=80)
        if generated:
            return generated

        sentences = re.split(r"(?<=[.!?])\s+", feedback_text)
        return (sentences[0] if sentences else feedback_text)[:220]

    def build_insights(self, feedback_rows) -> dict[str, Any]:
        if not feedback_rows:
            return {
                "summary": "No feedback collected yet.",
                "recommendations": [
                    "Promote the link to get the first responses.",
                    "Use the analytics dashboard to monitor visitors and submissions.",
                ],
                "top_categories": [],
                "top_products": [],
                "top_sectors": [],
                "sample_highlights": [],
                "sample_products": [],
                "sample_sectors": [],
            }

        categories = Counter(
            (getattr(getattr(row, "latest_analysis", None), "category", None) or "Other").strip() or "Other"
            for row in feedback_rows
        )
        top_categories = [{"label": label, "count": count} for label, count in categories.most_common()]

        product_counter: Counter[str] = Counter()
        sector_counter: Counter[str] = Counter()

        samples = feedback_rows[:8]
        for row in feedback_rows:
            feedback_text = self._normalize_feedback_text(
                getattr(row, "tools_used", None),
                getattr(row, "pain_points", None),
                getattr(row, "new_tool", None),
                getattr(getattr(row, "latest_analysis", None), "summary", None),
            )
            for product in self.extract_products(feedback_text):
                product_counter[product] += 1
            sector = self.detect_sector(feedback_text)
            if sector != "Unknown":
                sector_counter[sector] += 1

        top_products = [{"label": label, "count": count} for label, count in product_counter.most_common()]
        top_sectors = [{"label": label, "count": count} for label, count in sector_counter.most_common()]

        combined_text = "\n".join(
            f"- {getattr(getattr(row, 'respondent', None), 'role', '')} at {getattr(getattr(row, 'respondent', None), 'company', '')}: "
            f"{self._normalize_feedback_text(getattr(row, 'pain_points', None), getattr(row, 'new_tool', None))[:220]}"
            for row in samples
        ).strip()

        prompt_template = (
            "You are an AI product analyst. Based on the feedback themes, products, sectors, and examples below, "
            "write a short executive summary and list the most important improvements.\n\n"
            "Theme counts:\n{theme_counts}\n\n"
            "Top products:\n{product_counts}\n\n"
            "Top sectors:\n{sector_counts}\n\n"
            "Feedback examples:\n{examples}\n\n"
            "Return a concise executive summary with practical recommendations. "
            "Prefer specific patterns over generic statements."
        )

        prompt = (
            PromptTemplate.from_template(prompt_template).format(
                theme_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_categories) or "No themes available.",
                product_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_products) or "No products detected.",
                sector_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_sectors) or "No sectors detected.",
                examples=combined_text or "No examples available.",
            )
            if PromptTemplate
            else prompt_template.format(
                theme_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_categories) or "No themes available.",
                product_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_products) or "No products detected.",
                sector_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_sectors) or "No sectors detected.",
                examples=combined_text or "No examples available.",
            )
        )

        generated = self._generate(prompt, max_new_tokens=160)
        summary = generated or self._fallback_summary(top_categories, top_products, top_sectors, feedback_rows)

        recommendations = self._recommendations_from_categories(top_categories, top_products, top_sectors)

        sample_highlights = [
            self._normalize_feedback_text(
                getattr(getattr(row, "latest_analysis", None), "summary", None),
                getattr(row, "pain_points", None),
                getattr(row, "new_tool", None),
            )[:220]
            for row in samples[:5]
            if self._normalize_feedback_text(
                getattr(getattr(row, "latest_analysis", None), "summary", None),
                getattr(row, "pain_points", None),
                getattr(row, "new_tool", None),
            )
        ]

        sample_products = []
        sample_sectors = []
        for row in samples[:5]:
            text = self._normalize_feedback_text(
                getattr(row, "tools_used", None),
                getattr(row, "pain_points", None),
                getattr(row, "new_tool", None),
                getattr(getattr(row, "latest_analysis", None), "summary", None),
            )
            sample_products.append(self.extract_products(text))
            sample_sectors.append(self.detect_sector(text))

        return {
            "summary": summary,
            "recommendations": recommendations,
            "top_categories": top_categories,
            "top_products": top_products,
            "top_sectors": top_sectors,
            "sample_highlights": sample_highlights,
            "sample_products": sample_products,
            "sample_sectors": sample_sectors,
        }

    def _fallback_summary(
        self,
        top_categories,
        top_products,
        top_sectors,
        feedback_rows,
    ) -> str:
        if not top_categories:
            return "Feedback volume is low, so pattern detection is still limited."

        lead = top_categories[0]
        total = len(feedback_rows)

        parts = [
            f"The strongest signal is {lead['label']} feedback ({lead['count']} of {total} submissions)."
        ]

        if top_products:
            parts.append(f"The most mentioned product is {top_products[0]['label']}.")
        if top_sectors:
            parts.append(f"The strongest sector signal is {top_sectors[0]['label']}.")

        parts.append("Use these signals to prioritize the next product improvement cycle.")
        return " ".join(parts)

    def _recommendations_from_categories(self, top_categories, top_products=None, top_sectors=None) -> list[str]:
        recommendations = []
        labels = [c["label"] for c in top_categories[:3]]

        if "Productivity" in labels:
            recommendations.append("Automate repetitive workflows and reduce manual handoffs.")
        if "UX" in labels:
            recommendations.append("Simplify the interface and remove confusing or hidden actions.")
        if "Management" in labels:
            recommendations.append("Clarify ownership, approvals, and expectations across teams.")
        if "Healthcare" in labels:
            recommendations.append("Streamline patient data workflows and reduce manual record updates.")
        if "Finance" in labels:
            recommendations.append("Automate approvals and reduce checks in finance workflows.")
        if "Other" in labels:
            recommendations.append("Capture edge cases in a backlog so unusual needs are not lost.")

        if top_products:
            recommendations.append(f"Review friction points in {top_products[0]['label']} workflows first.")
        if top_sectors:
            recommendations.append(f"Prioritize improvements for {top_sectors[0]['label']} teams, where the signal is strongest.")

        if not recommendations:
            recommendations.append("Continue collecting feedback to identify the strongest pain points.")

        return recommendations[:5]

    def build_rag_answer(self, query: str, matches: list[dict[str, Any]]) -> str:
        if not matches:
            return "No closely matching feedback was found yet."

        context = "\n".join(
            f"- [{m.get('category') or 'Other'}] {m.get('snippet')}"
            for m in matches[:5]
            if m.get("snippet")
        )

        template = (
            "You are an AI analyst helping a product team.\n"
            "Question: {query}\n"
            "Relevant feedback:\n{context}\n\n"
            "Write a short answer with clear business language."
        )
        prompt = (
            PromptTemplate.from_template(template).format(query=query, context=context or "No context available.")
            if PromptTemplate
            else template.format(query=query, context=context or "No context available.")
        )

        generated = self._generate(prompt, max_new_tokens=160)
        if generated:
            return generated

        top = matches[0]
        return (
            f"The strongest related theme is {top.get('category') or 'Other'} feedback. "
            f"Most matching responses mention: {top.get('snippet')}"
        )

    def log_mlflow(
        self,
        submission,
        category: str,
        confidence: float,
        sentiment_label: str,
        sentiment_score: float,
    ) -> None:
        if mlflow is None or not os.getenv("MLFLOW_TRACKING_URI"):
            return

        try:
            products = self.extract_products(
                self._normalize_feedback_text(
                    getattr(submission, "tools_used", None),
                    getattr(submission, "pain_points", None),
                    getattr(submission, "new_tool", None),
                )
            )
            sector = self.detect_sector(
                self._normalize_feedback_text(
                    getattr(submission, "tools_used", None),
                    getattr(submission, "pain_points", None),
                    getattr(submission, "new_tool", None),
                )
            )

            mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI"))
            mlflow.set_experiment(os.getenv("MLFLOW_EXPERIMENT_NAME", "feedback-intelligence"))
            with mlflow.start_run(run_name=f"feedback-{submission.id}"):
                mlflow.log_param("submission_id", getattr(submission, "submission_id", submission.id))
                mlflow.log_param("category", category)
                mlflow.log_param("sentiment_label", sentiment_label)
                mlflow.log_param("model_version", self.last_model_version)
                mlflow.log_metric("confidence", confidence)
                mlflow.log_metric("sentiment_score", sentiment_score)
                mlflow.log_metric(
                    "text_length",
                    len(
                        self._normalize_feedback_text(
                            getattr(submission, "tools_used", None),
                            getattr(submission, "pain_points", None),
                            getattr(submission, "new_tool", None),
                        )
                    ),
                )
                if products:
                    mlflow.log_param("products", ",".join(products[:5]))
                if sector != "Unknown":
                    mlflow.log_param("sector", sector)
                mlflow.log_text(getattr(submission, "pain_points", "") or "", "pain_points.txt")
        except Exception:
            pass