from __future__ import annotations

import os
import random
import re
from typing import Dict, List, Optional

from app.utils.openai_client import get_openai_client


class InterviewEngine:
    """
    Generates interview questions based on role + difficulty.

    Uses an LLM if configured; falls back to deterministic question banks.
    """

    _FALLBACK_BANK: Dict[str, Dict[str, List[str]]] = {
        "data analyst": {
            "beginner": [
                "Explain the difference between INNER JOIN and LEFT JOIN in SQL.",
                "What is a KPI? Give two examples for an e-commerce business.",
                "How do you handle missing values in a dataset?",
            ],
            "medium": [
                "How would you design an A/B test to evaluate a new checkout flow?",
                "Write a SQL approach to find the top 3 products by monthly revenue.",
                "How do you choose the right chart for a dashboard metric?",
            ],
            "advanced": [
                "How would you detect and mitigate data leakage in an analytics pipeline?",
                "Design a churn analysis: data sources, features, and evaluation metrics.",
                "Explain how you would monitor metric drift for a core KPI over time.",
            ],
        },
        "ai engineer": {
            "beginner": [
                "What is overfitting and how can you reduce it?",
                "Explain train/validation/test splits and why they matter.",
                "What is the difference between supervised and unsupervised learning?",
            ],
            "medium": [
                "How would you evaluate a classification model beyond accuracy?",
                "Explain the bias-variance tradeoff with an example.",
                "How would you deploy an ML model behind an API safely?",
            ],
            "advanced": [
                "Design an LLM-powered system: how do you reduce hallucinations and evaluate quality?",
                "How would you monitor model drift and decide when to retrain?",
                "Explain tradeoffs between latency, cost, and quality in an ML inference service.",
            ],
        },
        "web developer": {
            "beginner": [
                "Explain the difference between REST and GraphQL at a high level.",
                "What is CORS and why does it matter?",
                "How do you debug a slow web page load?",
            ],
            "medium": [
                "How would you implement authentication and authorization for a web app?",
                "Explain how you would design an API pagination strategy.",
                "What is an XSS attack and how do you prevent it?",
            ],
            "advanced": [
                "Design a scalable real-time system (WebSockets): what bottlenecks and failure modes do you handle?",
                "How do you implement zero-downtime deployments for a frontend + backend system?",
                "Explain tradeoffs of micro-frontends vs a monolith frontend.",
            ],
        },
    }

    @staticmethod
    def _normalize_role(role: str) -> str:
        raw = (role or "").strip().lower()
        raw = re.sub(r"\s+", " ", raw)
        aliases = {
            "ai": "ai engineer",
            "ml engineer": "ai engineer",
            "machine learning engineer": "ai engineer",
            "developer": "web developer",
            "web": "web developer",
            "data analytics": "data analyst",
            "analyst": "data analyst",
        }
        return aliases.get(raw, raw) or "data analyst"

    @staticmethod
    def _normalize_difficulty(difficulty: str) -> str:
        raw = (difficulty or "").strip().lower()
        if raw in {"beginner", "easy"}:
            return "beginner"
        if raw in {"medium", "intermediate"}:
            return "medium"
        if raw in {"advanced", "hard"}:
            return "advanced"
        return "medium"

    @staticmethod
    def _llm_enabled() -> bool:
        return bool(os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY"))

    @staticmethod
    def _model_name() -> str:
        return os.getenv("OPENAI_API_MODEL", "openrouter/auto")

    def _fallback_questions(self, role: str, difficulty: str, count: int) -> List[str]:
        role_key = self._normalize_role(role)
        diff_key = self._normalize_difficulty(difficulty)
        bank = self._FALLBACK_BANK.get(role_key) or self._FALLBACK_BANK["data analyst"]
        pool = list(bank.get(diff_key) or bank["medium"])
        random.shuffle(pool)
        # If count > pool size, cycle.
        out: List[str] = []
        while pool and len(out) < count:
            out.append(pool[len(out) % len(pool)])
        return out[:count]

    def generate_questions(self, *, role: str, difficulty: str, count: int) -> List[str]:
        if count <= 0:
            return []

        if not self._llm_enabled():
            return self._fallback_questions(role, difficulty, count)

        client = get_openai_client()
        role_norm = self._normalize_role(role)
        diff_norm = self._normalize_difficulty(difficulty)
        prompt = (
            "Generate interview questions as strict JSON.\n"
            "Return a JSON object with key `questions` as an array of strings.\n"
            f"Role: {role_norm}\n"
            f"Difficulty: {diff_norm}\n"
            f"Question count: {count}\n"
            "Constraints:\n"
            "- Questions should be realistic for hiring interviews.\n"
            "- Mix conceptual + practical questions.\n"
            "- Keep each question concise.\n"
        )

        try:
            response = client.chat.completions.create(
                model=self._model_name(),
                temperature=0.6,
                messages=[
                    {"role": "system", "content": "You output valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
            )
            content = response.choices[0].message.content if response.choices else ""
            items = self._extract_questions(content or "")
            if len(items) >= count:
                return items[:count]
        except Exception:
            pass

        return self._fallback_questions(role, difficulty, count)

    @staticmethod
    def _extract_questions(text: str) -> List[str]:
        """
        Very small JSON extractor: expects {"questions":[...]}.
        Keeps dependencies low; avoids lenient parsing.
        """
        import json

        text = (text or "").strip()
        if not text:
            return []

        # Try direct JSON first.
        try:
            payload = json.loads(text)
        except Exception:
            # Best-effort: extract first {...} block.
            start = text.find("{")
            end = text.rfind("}")
            if start < 0 or end <= start:
                return []
            try:
                payload = json.loads(text[start : end + 1])
            except Exception:
                return []

        questions = payload.get("questions", []) if isinstance(payload, dict) else []
        if not isinstance(questions, list):
            return []
        cleaned: List[str] = []
        for item in questions:
            q = str(item).strip()
            if q:
                cleaned.append(q)
        return cleaned

