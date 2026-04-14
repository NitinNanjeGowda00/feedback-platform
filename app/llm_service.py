from __future__ import annotations

import os
import json
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

    def generate_insights(self, feedback_texts: List[str]) -> Dict[str, Any]:
        """
        Generate structured insights using LLM
        """

        if not self.client:
            return {
                "summary": "LLM not configured.",
                "top_patterns": [],
                "recommendations": [],
            }

        if not feedback_texts:
            return {
                "summary": "No feedback available.",
                "top_patterns": [],
                "recommendations": [],
            }

        # Limit input size (important for cost + speed)
        combined = "\n".join(f"- {text}" for text in feedback_texts[:50])

        prompt = f"""
You are a senior AI product analyst.

Analyze the following employee feedback and return STRICT JSON.

IMPORTANT:
- Do NOT return text outside JSON
- Do NOT add explanations
- ONLY return valid JSON

Required format:
{{
  "summary": "1-2 sentence executive summary",
  "top_patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "recommendations": ["action 1", "action 2", "action 3"]
}}

Feedback:
{combined}
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a strict JSON generator."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
            )

            content = response.choices[0].message.content.strip()

            # 🔥 Try parsing JSON safely
            try:
                parsed = json.loads(content)
                return {
                    "summary": parsed.get("summary", ""),
                    "top_patterns": parsed.get("top_patterns", []),
                    "recommendations": parsed.get("recommendations", []),
                }
            except Exception:
                # fallback if model returns bad JSON
                return {
                    "summary": content,
                    "top_patterns": [],
                    "recommendations": [],
                }

        except Exception as e:
            return {
                "summary": f"LLM error: {str(e)}",
                "top_patterns": [],
                "recommendations": [],
            }