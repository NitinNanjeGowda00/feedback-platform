from __future__ import annotations

import os
import json
import re
from typing import List, Dict, Any

try:
    from openai import OpenAI
except Exception:
    OpenAI = None


class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        if self.api_key and OpenAI:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

        print("✅ LLM INIT:", "ENABLED" if self.client else "DISABLED")

    def is_available(self) -> bool:
        return self.client is not None

    # 🔐 SANITIZE INPUT (prevents data leakage)
    def _sanitize(self, text: str) -> str:
        if not text:
            return ""

        text = re.sub(r"\S+@\S+", "[EMAIL]", text)
        text = re.sub(r"\b\d{10,}\b", "[NUMBER]", text)
        return text.strip()

    # 🧠 SAFE JSON PARSER
    def _safe_parse_json(self, content: str) -> Dict[str, Any] | None:
        try:
            return json.loads(content)
        except Exception:
            # try extracting JSON block
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                try:
                    return json.loads(content[start:end + 1])
                except Exception:
                    return None
        return None

    def generate_insights(self, feedback_texts: List[str]) -> Dict[str, Any]:
        """
        Generate structured, grounded insights using LLM
        """

        if not feedback_texts:
            return {
                "summary": "No feedback available.",
                "top_patterns": [],
                "recommendations": [],
                "confidence": "low",
                "evidence": []
            }

        # sanitize + limit
        cleaned = [self._sanitize(t) for t in feedback_texts if t.strip()]
        cleaned = cleaned[:50]

        if not self.client:
            return {
                "summary": "LLM not configured. Showing basic pattern detection.",
                "top_patterns": ["Insufficient data"],
                "recommendations": ["Enable LLM for deeper insights"],
                "confidence": "low",
                "evidence": []
            }

        combined = "\n".join(f"- {text}" for text in cleaned)

        # 🚨 IMPROVED PROMPT (ANTI-HALLUCINATION)
        prompt = f"""
You are an AI product analyst.

STRICT RULES:
- ONLY use the feedback provided below
- DO NOT assume anything outside the data
- If unsure, say "insufficient data"
- EVERY pattern must include supporting evidence
- DO NOT hallucinate

Return STRICT JSON only:

{{
  "summary": "1-2 sentence summary",
  "top_patterns": [
    {{
      "pattern": "pattern name",
      "evidence": ["example 1", "example 2"]
    }}
  ],
  "recommendations": ["action 1", "action 2"],
  "confidence": "low | medium | high"
}}

Feedback:
{combined}
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Return ONLY valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
            )

            content = response.choices[0].message.content.strip()
            parsed = self._safe_parse_json(content)

            if not parsed:
                raise ValueError("Invalid JSON from model")

            # ✅ Normalize output
            patterns = []
            evidence_block = []

            for item in parsed.get("top_patterns", []):
                if isinstance(item, dict):
                    pattern = item.get("pattern", "").strip()
                    evidence = item.get("evidence", [])

                    if pattern:
                        patterns.append(pattern)
                        evidence_block.append({
                            "pattern": pattern,
                            "evidence": evidence[:3]
                        })

                elif isinstance(item, str):
                    patterns.append(item)
                    evidence_block.append({
                        "pattern": item,
                        "evidence": cleaned[:2]
                    })

            return {
                "summary": parsed.get("summary", ""),
                "top_patterns": patterns[:5],
                "recommendations": parsed.get("recommendations", [])[:5],
                "confidence": parsed.get("confidence", "medium"),
                "evidence": evidence_block
            }

        except Exception as e:
            # 🧠 fallback logic (VERY IMPORTANT)
            return {
                "summary": f"LLM error: {str(e)}",
                "top_patterns": ["Unable to extract patterns"],
                "recommendations": ["Check LLM configuration"],
                "confidence": "low",
                "evidence": []
            }