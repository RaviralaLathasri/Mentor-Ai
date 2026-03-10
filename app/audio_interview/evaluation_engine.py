from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from app.utils.openai_client import get_openai_client


class EvaluationEngine:
    """
    Evaluates an answer transcript against the question and role.

    Returns structured feedback:
    - score (0-10)
    - strengths / weaknesses / suggestions
    - sub-scores for reporting
    """

    @staticmethod
    def _llm_enabled() -> bool:
        return bool(os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY"))

    @staticmethod
    def _model_name() -> str:
        return os.getenv("OPENAI_API_MODEL", "openrouter/auto")

    def evaluate(
        self,
        *,
        role: str,
        difficulty: str,
        question: str,
        answer: str,
    ) -> Dict[str, Any]:
        if self._llm_enabled():
            llm_eval = self._evaluate_with_llm(role=role, difficulty=difficulty, question=question, answer=answer)
            if llm_eval:
                return llm_eval
        return self._evaluate_fallback(role=role, difficulty=difficulty, question=question, answer=answer)

    def _evaluate_with_llm(
        self,
        *,
        role: str,
        difficulty: str,
        question: str,
        answer: str,
    ) -> Optional[Dict[str, Any]]:
        client = get_openai_client()
        prompt = (
            "Evaluate this spoken interview answer.\n"
            "Return strict JSON with keys:\n"
            "score (0-10 number), technical_correctness (0-10), communication_clarity (0-10), "
            "relevance (0-10), completeness (0-10), strengths (array), weaknesses (array), suggestions (array).\n"
            "Keep arrays short (max 3 each). No extra keys.\n"
            f"Role: {role}\n"
            f"Difficulty: {difficulty}\n"
            f"Question: {question}\n"
            f"Answer transcript: {answer}\n"
        )
        try:
            response = client.chat.completions.create(
                model=self._model_name(),
                temperature=0.2,
                messages=[
                    {"role": "system", "content": "You are an interview evaluator. Output valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
            )
            content = response.choices[0].message.content if response.choices else ""
            parsed = self._extract_json(content or "")
            if not parsed:
                return None

            def _score(key: str) -> float:
                try:
                    value = float(parsed.get(key, 0.0))
                except Exception:
                    value = 0.0
                return max(0.0, min(10.0, value))

            strengths = [str(x).strip() for x in parsed.get("strengths", []) if str(x).strip()]
            weaknesses = [str(x).strip() for x in parsed.get("weaknesses", []) if str(x).strip()]
            suggestions = [str(x).strip() for x in parsed.get("suggestions", []) if str(x).strip()]
            return {
                "score": round(_score("score"), 2),
                "technical_correctness": round(_score("technical_correctness"), 2),
                "communication_clarity": round(_score("communication_clarity"), 2),
                "relevance": round(_score("relevance"), 2),
                "completeness": round(_score("completeness"), 2),
                "strengths": strengths[:3],
                "weaknesses": weaknesses[:3],
                "suggestions": suggestions[:3],
            }
        except Exception:
            return None

    @staticmethod
    def _extract_json(text: str) -> Optional[Dict[str, Any]]:
        import json

        text = (text or "").strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}")
            if start < 0 or end <= start:
                return None
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                return None

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return [t.lower() for t in re.findall(r"[a-zA-Z0-9]+", text or "") if len(t) > 2]

    def _evaluate_fallback(
        self,
        *,
        role: str,
        difficulty: str,
        question: str,
        answer: str,
    ) -> Dict[str, Any]:
        del role, difficulty
        ans = (answer or "").strip()
        if not ans:
            return {
                "score": 0.0,
                "technical_correctness": 0.0,
                "communication_clarity": 0.0,
                "relevance": 0.0,
                "completeness": 0.0,
                "strengths": [],
                "weaknesses": ["No answer detected in transcript."],
                "suggestions": ["Speak your reasoning out loud and give at least one concrete example."],
            }

        q_tokens = set(self._tokenize(question))
        a_tokens = self._tokenize(ans)
        a_set = set(a_tokens)
        overlap = len(q_tokens & a_set) / max(1, len(q_tokens)) if q_tokens else 0.0

        word_count = len(a_tokens)
        length = min(1.0, word_count / 140.0)
        structure_markers = ["first", "second", "because", "for example", "result", "impact", "tradeoff", "however"]
        structure = 1.0 if any(m in ans.lower() for m in structure_markers) else 0.5

        relevance = max(0.0, min(1.0, overlap))
        completeness = max(0.0, min(1.0, length))
        communication = max(0.0, min(1.0, (structure * 0.6 + length * 0.4)))
        technical = max(0.0, min(1.0, (relevance * 0.6 + completeness * 0.4)))

        score = (technical * 0.35 + communication * 0.25 + relevance * 0.2 + completeness * 0.2) * 10.0

        strengths: List[str] = []
        weaknesses: List[str] = []
        suggestions: List[str] = []

        if overlap >= 0.25:
            strengths.append("Answer mentions several terms relevant to the question.")
        else:
            weaknesses.append("Answer may be drifting away from the question focus.")
            suggestions.append("Start by restating the question in your own words, then answer directly.")

        if word_count >= 90:
            strengths.append("Answer has reasonable detail.")
        else:
            weaknesses.append("Answer is short; it may lack enough detail.")
            suggestions.append("Add 1-2 concrete details and one measurable outcome or example.")

        if structure >= 0.9:
            strengths.append("Answer sounds structured.")
        else:
            suggestions.append("Use a clear structure: context -> approach -> result.")

        return {
            "score": round(max(0.0, min(10.0, score)), 2),
            "technical_correctness": round(technical * 10.0, 2),
            "communication_clarity": round(communication * 10.0, 2),
            "relevance": round(relevance * 10.0, 2),
            "completeness": round(completeness * 10.0, 2),
            "strengths": strengths[:3],
            "weaknesses": weaknesses[:3],
            "suggestions": suggestions[:3],
        }

