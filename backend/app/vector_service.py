from __future__ import annotations

import os
import re
from typing import Any

import numpy as np

try:
    import faiss
except Exception:  # pragma: no cover
    faiss = None

try:
    import torch
    from transformers import AutoModel, AutoTokenizer
except Exception:  # pragma: no cover
    torch = None
    AutoModel = None
    AutoTokenizer = None


class FeedbackVectorStore:
    def __init__(self):
        self.model_name = os.getenv(
            "HF_EMBED_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2",
        )
        self.dim = 384
        self.index = None
        self.items: list[dict[str, Any]] = []
        self.vectors = np.zeros((0, self.dim), dtype="float32")

        self.tokenizer = None
        self.model = None
        self.device = "cpu"
        self._load_embedder()

    def _load_embedder(self) -> None:
        if AutoTokenizer is None or AutoModel is None or torch is None:
            return

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModel.from_pretrained(self.model_name)
            self.model.eval()
        except Exception:
            self.tokenizer = None
            self.model = None

    def _clean_text(self, submission) -> str:
        respondent = getattr(submission, "respondent", None)
        latest_analysis = getattr(submission, "latest_analysis", None)
        parts = [
            getattr(respondent, "name", None),
            getattr(respondent, "role", None),
            getattr(respondent, "company", None),
            submission.tools_used,
            submission.pain_points,
            submission.new_tool,
            getattr(latest_analysis, "category", None) or "",
            getattr(latest_analysis, "summary", None) or "",
            submission.status,
            submission.priority,
            submission.tags or "",
        ]
        return " ".join([p for p in parts if p]).strip()

    def _fallback_embed(self, texts: list[str]) -> np.ndarray:
        vectors = np.zeros((len(texts), self.dim), dtype="float32")
        for i, text in enumerate(texts):
            tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
            for token in tokens:
                vectors[i, hash(token) % self.dim] += 1.0

        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vectors / norms

    def _hf_embed(self, texts: list[str]) -> np.ndarray:
        if self.model is None or self.tokenizer is None or torch is None:
            return self._fallback_embed(texts)

        with torch.no_grad():
            encoded = self.tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=256,
                return_tensors="pt",
            )
            outputs = self.model(**encoded)
            token_embeddings = outputs.last_hidden_state
            attention_mask = encoded["attention_mask"].unsqueeze(-1).expand(token_embeddings.size()).float()
            summed = (token_embeddings * attention_mask).sum(dim=1)
            counts = attention_mask.sum(dim=1).clamp(min=1e-9)
            embeddings = (summed / counts).cpu().numpy().astype("float32")

        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return embeddings / norms

    def embed(self, texts: list[str]) -> np.ndarray:
        try:
            return self._hf_embed(texts)
        except Exception:
            return self._fallback_embed(texts)

    def rebuild(self, submissions) -> None:
        self.items = []
        texts = []

        for submission in submissions:
            latest_analysis = getattr(submission, "latest_analysis", None)
            respondent = getattr(submission, "respondent", None)
            texts.append(self._clean_text(submission))
            self.items.append(
                {
                    "id": submission.id,
                    "submission_id": submission.submission_id,
                    "category": getattr(latest_analysis, "category", None),
                    "summary": getattr(latest_analysis, "summary", None),
                    "created_at": submission.created_at,
                    "tools_used": submission.tools_used,
                    "pain_points": submission.pain_points,
                    "new_tool": submission.new_tool,
                    "name": getattr(respondent, "name", None),
                    "role": getattr(respondent, "role", None),
                    "company": getattr(respondent, "company", None),
                }
            )

        if not texts:
            self.vectors = np.zeros((0, self.dim), dtype="float32")
            self.index = None
            return

        self.vectors = self.embed(texts)
        if faiss is not None:
            self.index = faiss.IndexFlatIP(self.vectors.shape[1])
            self.index.add(self.vectors)
        else:
            self.index = None

    def add_feedback(self, submission) -> None:
        latest_analysis = getattr(submission, "latest_analysis", None)
        respondent = getattr(submission, "respondent", None)
        item = {
            "id": submission.id,
            "submission_id": submission.submission_id,
            "category": getattr(latest_analysis, "category", None),
            "summary": getattr(latest_analysis, "summary", None),
            "created_at": submission.created_at,
            "tools_used": submission.tools_used,
            "pain_points": submission.pain_points,
            "new_tool": submission.new_tool,
            "name": getattr(respondent, "name", None),
            "role": getattr(respondent, "role", None),
            "company": getattr(respondent, "company", None),
        }
        vector = self.embed([self._clean_text(submission)])

        if self.index is not None and faiss is not None and len(self.items) > 0:
            self.index.add(vector)
            self.vectors = np.vstack([self.vectors, vector])
            self.items.append(item)
            return

        self.items.append(item)
        self.vectors = np.vstack([self.vectors, vector]) if len(self.vectors) else vector

        if faiss is not None:
            self.index = faiss.IndexFlatIP(self.vectors.shape[1])
            self.index.add(self.vectors)

    def search(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        if not self.items:
            return []

        k = max(1, min(k, len(self.items)))
        query_vector = self.embed([query])

        if self.index is not None and faiss is not None:
            scores, indices = self.index.search(query_vector, k)
            pairs = [(int(idx), float(score)) for idx, score in zip(indices[0], scores[0]) if idx != -1]
        else:
            scores = (self.vectors @ query_vector[0]).astype("float32")
            top_indices = np.argsort(-scores)[:k]
            pairs = [(int(idx), float(scores[idx])) for idx in top_indices]

        results = []
        for idx, score in pairs:
            item = self.items[idx]
            snippet_source = item["summary"] or item["pain_points"] or item["new_tool"] or item["tools_used"] or ""
            snippet = snippet_source[:220].strip()
            results.append(
                {
                    "id": item["id"],
                    "submission_id": item.get("submission_id"),
                    "score": round(score, 4),
                    "category": item["category"],
                    "summary": item["summary"],
                    "snippet": snippet,
                    "created_at": item["created_at"],
                    "name": item["name"],
                    "role": item["role"],
                    "company": item["company"],
                }
            )
        return results
