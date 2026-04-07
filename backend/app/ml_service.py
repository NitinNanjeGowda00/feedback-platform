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


CATEGORY_LABELS = ["Productivity", "UX", "Management", "Other"]

RULES = {
    "Productivity": [
        "manual", "repetitive", "slow", "delay", "time consuming", "copy", "paste",
        "approval", "chasing", "follow up", "spreadsheet", "double entry", "routine",
        "click", "workflow", "handoff", "status update", "switching context",
    ],
    "UX": [
        "confusing", "ui", "ux", "layout", "design", "broken", "bug", "error",
        "not intuitive", "hard to use", "navigation", "search", "slow loading",
        "mobile", "cluttered", "unclear", "difficult to find",
    ],
    "Management": [
        "manager", "leadership", "policy", "priority", "expectation", "communication",
        "misalignment", "deadline", "unclear goals", "approval chain", "team conflict",
        "review", "feedback loop", "planning", "task allocation", "workload",
    ],
    "Other": [],
}

POSITIVE_WORDS = {
    "helpful", "easy", "faster", "smooth", "clear", "great", "good", "simple",
    "productive", "useful", "efficient", "best", "favorable", "clean", "better",
}

NEGATIVE_WORDS = {
    "frustrating", "slow", "confusing", "hard", "buggy", "annoying", "repetitive",
    "painful", "messy", "broken", "waste", "delayed", "tedious", "unusable",
    "complicated", "stressful", "chaotic", "clunky",
}


class IntelligenceEngine:
    def __init__(self):
        self.artifacts_dir = Path(os.getenv("AI_ARTIFACTS_DIR", "./artifacts"))
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

        self.model_path = self.artifacts_dir / "category_model.joblib"
        self.generator_model = os.getenv("HF_TEXT2TEXT_MODEL", "google/flan-t5-small")
        self.enable_generator = os.getenv("ENABLE_HF_GENERATOR", "1") == "1"
        self.model_version = os.getenv("AI_MODEL_VERSION", "rules-v1")

        self.classifier = self._load_or_train_classifier()
        self.generator = self._load_generator() if self.enable_generator else None

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
                return joblib.load(self.model_path)
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

    def _keyword_rule(self, text: str) -> str | None:
        lower = text.lower()
        for label, keywords in RULES.items():
            if label == "Other":
                continue
            if any(keyword in lower for keyword in keywords):
                return label
        return None

    def classify(self, text: str) -> tuple[str, float]:
        cleaned = " ".join((text or "").split())
        if not cleaned:
            return "Other", 0.0

        rule = self._keyword_rule(cleaned)
        if rule:
            return rule, 0.95

        try:
            probs = self.classifier.predict_proba([cleaned])[0]
            idx = int(np.argmax(probs))
            label = str(self.classifier.classes_[idx])
            score = float(probs[idx])
            if score < 0.35:
                return "Other", score
            return label, score
        except Exception:
            return "Other", 0.0

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
                "sample_highlights": [],
            }

        categories = Counter(
            (getattr(getattr(row, "latest_analysis", None), "category", None) or "Other").strip() or "Other"
            for row in feedback_rows
        )
        top_categories = [{"label": label, "count": count} for label, count in categories.most_common()]
        samples = feedback_rows[:8]

        combined_text = "\n".join(
            f"- {getattr(getattr(row, 'respondent', None), 'role', '')} at {getattr(getattr(row, 'respondent', None), 'company', '')}: "
            f"{self._normalize_feedback_text(getattr(row, 'pain_points', None), getattr(row, 'new_tool', None))[:220]}"
            for row in samples
        ).strip()

        prompt_template = (
            "You are an AI product analyst. Based on the following feedback themes and examples, "
            "write a short executive summary and list the most important improvements.\n\n"
            "Theme counts:\n{theme_counts}\n\n"
            "Feedback examples:\n{examples}\n\n"
            "Return a concise executive summary."
        )

        prompt = (
            PromptTemplate.from_template(prompt_template).format(
                theme_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_categories),
                examples=combined_text or "No examples available.",
            )
            if PromptTemplate
            else prompt_template.format(
                theme_counts="\n".join(f"{c['label']}: {c['count']}" for c in top_categories),
                examples=combined_text or "No examples available.",
            )
        )

        generated = self._generate(prompt, max_new_tokens=160)
        summary = generated or self._fallback_summary(top_categories, feedback_rows)

        recommendations = self._recommendations_from_categories(top_categories)
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

        return {
            "summary": summary,
            "recommendations": recommendations,
            "top_categories": top_categories,
            "sample_highlights": sample_highlights,
        }

    def _fallback_summary(self, top_categories, feedback_rows) -> str:
        if not top_categories:
            return "Feedback volume is low, so pattern detection is still limited."

        lead = top_categories[0]
        total = len(feedback_rows)
        return (
            f"The strongest signal is {lead['label']} feedback ({lead['count']} of {total} submissions). "
            f"Use this to prioritize the next product improvement cycle."
        )

    def _recommendations_from_categories(self, top_categories) -> list[str]:
        recommendations = []
        labels = [c["label"] for c in top_categories[:3]]

        if "Productivity" in labels:
            recommendations.append("Automate repetitive workflows and reduce manual handoffs.")
        if "UX" in labels:
            recommendations.append("Simplify the interface and remove confusing or hidden actions.")
        if "Management" in labels:
            recommendations.append("Clarify ownership, approvals, and expectations across teams.")
        if "Other" in labels:
            recommendations.append("Capture edge cases in a backlog so unusual needs are not lost.")

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
            mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI"))
            mlflow.set_experiment(os.getenv("MLFLOW_EXPERIMENT_NAME", "feedback-intelligence"))
            with mlflow.start_run(run_name=f"feedback-{submission.id}"):
                mlflow.log_param("submission_id", getattr(submission, "submission_id", submission.id))
                mlflow.log_param("category", category)
                mlflow.log_param("sentiment_label", sentiment_label)
                mlflow.log_param("model_version", self.model_version)
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
                mlflow.log_text(getattr(submission, "pain_points", "") or "", "pain_points.txt")
        except Exception:
            pass
