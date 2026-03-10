"""Mock interview generation, scoring, and playback service."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
import json
import os
import random
import re
import uuid
from typing import Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import MockInterviewSession, Student
from app.schemas import (
    CareerLevelEnum,
    InterviewTypeEnum,
    MockInterviewRequest,
)
from app.utils.openai_client import get_openai_client


class MockInterviewService:
    _ROLE_ALIASES = {
        "analyst": "data analyst",
        "data analytics": "data analyst",
        "data science": "data scientist",
        "ml engineer": "ai engineer",
        "machine learning engineer": "ai engineer",
        "backend engineer": "backend developer",
        "back end developer": "backend developer",
    }

    _QUESTION_BANK: Dict[str, Dict[str, List[Dict[str, str]]]] = {
        "data analyst": {
            "technical": [
                {"focus_area": "SQL", "question": "Write a SQL approach to find the top 3 products by monthly revenue."},
                {"focus_area": "Statistics", "question": "How would you explain p-value to a non-technical stakeholder?"},
                {"focus_area": "Dashboarding", "question": "How do you decide which KPIs to place on an executive dashboard?"},
                {"focus_area": "Data Cleaning", "question": "How would you handle missing values in a churn dataset?"},
            ],
            "behavioral": [
                {"focus_area": "Communication", "question": "Describe a time you changed a recommendation after stakeholder feedback."},
                {"focus_area": "Prioritization", "question": "How do you handle multiple urgent data requests?"},
                {"focus_area": "Ownership", "question": "Tell me about a project where your analysis influenced a decision."},
            ],
        },
        "data scientist": {
            "technical": [
                {"focus_area": "Model Evaluation", "question": "When would you prefer recall over precision?"},
                {"focus_area": "Feature Engineering", "question": "How do you decide which features to keep or remove?"},
                {"focus_area": "Experimentation", "question": "How would you design an A/B test for a recommendation model?"},
                {"focus_area": "ML Debugging", "question": "Model accuracy dropped after deployment. What would you check first?"},
            ],
            "behavioral": [
                {"focus_area": "Stakeholder Management", "question": "Describe a time you had to explain a complex model simply."},
                {"focus_area": "Collaboration", "question": "How do you work with engineers when model assumptions break?"},
                {"focus_area": "Decision Making", "question": "Tell me about a tradeoff decision you made between speed and rigor."},
            ],
        },
        "backend developer": {
            "technical": [
                {"focus_area": "API Design", "question": "How would you version a public API without breaking existing clients?"},
                {"focus_area": "Database", "question": "How do you diagnose and fix an N+1 query issue?"},
                {"focus_area": "Scalability", "question": "How would you design rate limiting for high-traffic endpoints?"},
                {"focus_area": "Reliability", "question": "How do you design retries and idempotency for payment APIs?"},
            ],
            "behavioral": [
                {"focus_area": "Ownership", "question": "Describe a time you fixed a production incident under pressure."},
                {"focus_area": "Code Quality", "question": "How do you handle disagreement in code reviews?"},
                {"focus_area": "Prioritization", "question": "Tell me about balancing technical debt with feature delivery."},
            ],
        },
        "ai engineer": {
            "technical": [
                {"focus_area": "Prompting", "question": "How do you evaluate prompt quality beyond subjective judgment?"},
                {"focus_area": "RAG", "question": "How would you reduce hallucinations in a RAG chatbot?"},
                {"focus_area": "Deployment", "question": "How do you balance latency, quality, and cost in an LLM service?"},
                {"focus_area": "Monitoring", "question": "What signals would you monitor for LLM quality drift?"},
            ],
            "behavioral": [
                {"focus_area": "Cross-Functional Work", "question": "Describe working with product teams to scope an AI feature."},
                {"focus_area": "Risk Management", "question": "How do you communicate AI risks to leadership?"},
                {"focus_area": "Execution", "question": "Tell me about shipping an AI feature from idea to production."},
            ],
        },
        "general": {
            "technical": [
                {"focus_area": "Problem Solving", "question": "Walk through your approach to solve a new technical problem."},
                {"focus_area": "Architecture", "question": "How do you evaluate tradeoffs between speed and maintainability?"},
            ],
            "behavioral": [
                {"focus_area": "Teamwork", "question": "Tell me about a challenging collaboration and what you learned."},
                {"focus_area": "Growth", "question": "Describe a recent failure and how you responded."},
            ],
        },
    }

    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def _normalize_role(cls, role: str) -> str:
        base = " ".join((role or "").strip().lower().split())
        return cls._ROLE_ALIASES.get(base, base)

    @staticmethod
    def _extract_json(text: str) -> Optional[Dict]:
        if not text:
            return None
        text = text.strip()
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        snippet = text[start : end + 1]
        try:
            data = json.loads(snippet)
            if isinstance(data, dict):
                return data
        except Exception:
            return None
        return None

    @staticmethod
    def _get_model_name() -> str:
        return os.getenv("OPENAI_API_MODEL", "openrouter/auto")

    @staticmethod
    def _llm_enabled() -> bool:
        return bool((os.getenv("OPENAI_API_KEY") or "").strip())

    @staticmethod
    def _allocate_question_types(question_count: int, interview_type: InterviewTypeEnum) -> List[InterviewTypeEnum]:
        if interview_type == InterviewTypeEnum.TECHNICAL:
            return [InterviewTypeEnum.TECHNICAL] * question_count
        if interview_type == InterviewTypeEnum.BEHAVIORAL:
            return [InterviewTypeEnum.BEHAVIORAL] * question_count

        # Mixed: alternate to keep balanced.
        result: List[InterviewTypeEnum] = []
        for idx in range(question_count):
            result.append(InterviewTypeEnum.TECHNICAL if idx % 2 == 0 else InterviewTypeEnum.BEHAVIORAL)
        return result

    def _resolve_bank(self, role: str) -> Dict[str, List[Dict[str, str]]]:
        normalized = self._normalize_role(role)
        if normalized in self._QUESTION_BANK:
            return self._QUESTION_BANK[normalized]
        return self._QUESTION_BANK["general"]

    def _generate_questions_with_llm(
        self,
        role: str,
        level: CareerLevelEnum,
        interview_type: InterviewTypeEnum,
        question_count: int,
        focus_topics: List[str],
        candidate_summary: Optional[str],
    ) -> List[Dict[str, str]]:
        if not self._llm_enabled():
            return []

        client = get_openai_client()
        prompt = (
            "Generate mock interview questions as strict JSON object with key `questions`.\n"
            "Each question item must include: `question_type`, `focus_area`, `question`.\n"
            f"Role: {role}\n"
            f"Level: {level.value}\n"
            f"Interview type: {interview_type.value}\n"
            f"Question count: {question_count}\n"
            f"Focus topics: {focus_topics}\n"
            f"Candidate summary: {candidate_summary or 'n/a'}\n"
            "Question type must be one of: technical, behavioral.\n"
            "Keep each question realistic and specific to hiring interviews."
        )
        try:
            response = client.chat.completions.create(
                model=self._get_model_name(),
                temperature=0.6,
                messages=[
                    {"role": "system", "content": "You create interview questions in valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
            )
            content = response.choices[0].message.content if response.choices else ""
            parsed = self._extract_json(content or "")
            items = parsed.get("questions", []) if parsed else []
            if not isinstance(items, list):
                return []

            normalized: List[Dict[str, str]] = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                question = str(item.get("question", "")).strip()
                focus_area = str(item.get("focus_area", "general")).strip() or "general"
                qtype = str(item.get("question_type", "technical")).strip().lower()
                if qtype not in {"technical", "behavioral"}:
                    qtype = "technical"
                if question:
                    normalized.append(
                        {
                            "question_type": qtype,
                            "focus_area": focus_area,
                            "question": question,
                        }
                    )
                if len(normalized) >= question_count:
                    break
            return normalized
        except Exception:
            return []

    def _generate_questions_fallback(
        self,
        role: str,
        interview_type: InterviewTypeEnum,
        question_count: int,
        focus_topics: List[str],
    ) -> List[Dict[str, str]]:
        bank = self._resolve_bank(role)
        types = self._allocate_question_types(question_count, interview_type)

        technical_pool = list(bank.get("technical", []))
        behavioral_pool = list(bank.get("behavioral", []))
        random.shuffle(technical_pool)
        random.shuffle(behavioral_pool)

        questions: List[Dict[str, str]] = []
        tech_index = 0
        beh_index = 0

        for idx, qtype in enumerate(types):
            if qtype == InterviewTypeEnum.BEHAVIORAL:
                if beh_index >= len(behavioral_pool):
                    beh_index = 0
                    random.shuffle(behavioral_pool)
                selected = behavioral_pool[beh_index] if behavioral_pool else {"focus_area": "behavioral", "question": "Tell me about your biggest professional challenge and what you learned."}
                beh_index += 1
            else:
                if tech_index >= len(technical_pool):
                    tech_index = 0
                    random.shuffle(technical_pool)
                selected = technical_pool[tech_index] if technical_pool else {"focus_area": "technical", "question": "Walk me through a recent technical problem you solved."}
                tech_index += 1

            focus_area = selected.get("focus_area", "general")
            if focus_topics:
                focus_area = focus_topics[idx % len(focus_topics)]

            questions.append(
                {
                    "question_type": qtype.value,
                    "focus_area": focus_area,
                    "question": selected.get("question", "").strip(),
                }
            )

        return questions

    @staticmethod
    def _keyword_overlap(question: str, answer: str) -> float:
        q_tokens = set(
            token
            for token in re.findall(r"[a-zA-Z0-9]+", question.lower())
            if len(token) > 3 and token not in {"what", "would", "about", "which", "where", "their", "there"}
        )
        a_tokens = set(token for token in re.findall(r"[a-zA-Z0-9]+", answer.lower()) if len(token) > 3)
        if not q_tokens or not a_tokens:
            return 0.0
        return len(q_tokens & a_tokens) / len(q_tokens)

    def _evaluate_answer_with_llm(
        self,
        role: str,
        level: CareerLevelEnum,
        question_type: InterviewTypeEnum,
        question: str,
        answer: str,
    ) -> Optional[Dict]:
        if not self._llm_enabled():
            return None

        client = get_openai_client()
        prompt = (
            "Evaluate this interview answer and return strict JSON object with keys:\n"
            "score (0-100), feedback, ideal_answer, strengths (array), improvements (array).\n"
            "Keep feedback concise and practical.\n"
            f"Role: {role}\n"
            f"Level: {level.value}\n"
            f"Question type: {question_type.value}\n"
            f"Question: {question}\n"
            f"Candidate answer: {answer}\n"
        )
        try:
            response = client.chat.completions.create(
                model=self._get_model_name(),
                temperature=0.2,
                messages=[
                    {"role": "system", "content": "You are an interview evaluator that returns valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
            )
            content = response.choices[0].message.content if response.choices else ""
            parsed = self._extract_json(content or "")
            if not parsed:
                return None

            score = float(parsed.get("score", 0.0))
            score = max(0.0, min(100.0, score))
            feedback = str(parsed.get("feedback", "")).strip()
            ideal_answer = str(parsed.get("ideal_answer", "")).strip()
            strengths = [str(item).strip() for item in parsed.get("strengths", []) if str(item).strip()]
            improvements = [str(item).strip() for item in parsed.get("improvements", []) if str(item).strip()]
            if not feedback:
                return None
            return {
                "score": round(score, 2),
                "feedback": feedback,
                "ideal_answer": ideal_answer or "Use a structured answer with context, approach, and measurable outcome.",
                "strengths": strengths[:3],
                "improvements": improvements[:3],
            }
        except Exception:
            return None

    @staticmethod
    def _behavioral_ideal_answer() -> str:
        return "Use STAR format: Situation, Task, Action, Result with clear metrics and your ownership."

    @staticmethod
    def _technical_ideal_answer() -> str:
        return "Define the problem, explain tradeoffs, describe implementation steps, and mention validation/monitoring."

    def _evaluate_answer_fallback(
        self,
        question_type: InterviewTypeEnum,
        question: str,
        answer: str,
    ) -> Dict:
        clean_answer = (answer or "").strip()
        if not clean_answer:
            return {
                "score": 0.0,
                "feedback": "No answer provided. In interview settings, speak your thought process even if unsure.",
                "ideal_answer": self._behavioral_ideal_answer() if question_type == InterviewTypeEnum.BEHAVIORAL else self._technical_ideal_answer(),
                "strengths": [],
                "improvements": ["Give a complete response with structure and examples."],
            }

        words = re.findall(r"[a-zA-Z0-9]+", clean_answer)
        word_count = len(words)
        length_score = min(45.0, (word_count / 160.0) * 45.0)
        overlap_score = min(30.0, self._keyword_overlap(question, clean_answer) * 30.0)
        structure_markers = ["first", "second", "because", "for example", "result", "impact", "therefore", "however"]
        structure_score = 15.0 if any(marker in clean_answer.lower() for marker in structure_markers) else 6.0
        sentence_score = 10.0 if clean_answer.count(".") >= 1 else 4.0
        score = max(0.0, min(100.0, round(length_score + overlap_score + structure_score + sentence_score, 2)))

        strengths: List[str] = []
        improvements: List[str] = []
        if word_count >= 60:
            strengths.append("Provided sufficient detail to assess thinking process.")
        if overlap_score >= 15:
            strengths.append("Answer stayed aligned with the question focus.")
        if structure_score >= 12:
            strengths.append("Used a structured explanation format.")

        if word_count < 40:
            improvements.append("Add more depth and concrete details.")
        if overlap_score < 10:
            improvements.append("Address the exact question and key terms directly.")
        if structure_score < 10:
            improvements.append("Use a clearer structure (STAR or step-by-step reasoning).")

        if score >= 80:
            feedback = "Strong answer with good structure and relevance. Add one quantified outcome for extra impact."
        elif score >= 60:
            feedback = "Good baseline answer. Improve by adding sharper structure and measurable outcomes."
        else:
            feedback = "Answer needs improvement in clarity and depth. Use a structured approach and concrete examples."

        return {
            "score": score,
            "feedback": feedback,
            "ideal_answer": self._behavioral_ideal_answer() if question_type == InterviewTypeEnum.BEHAVIORAL else self._technical_ideal_answer(),
            "strengths": strengths[:3],
            "improvements": improvements[:3] or ["Strengthen answer structure and include an example."],
        }

    def _evaluate_answer(
        self,
        role: str,
        level: CareerLevelEnum,
        question_type: InterviewTypeEnum,
        question: str,
        answer: str,
    ) -> Dict:
        llm_eval = self._evaluate_answer_with_llm(
            role=role,
            level=level,
            question_type=question_type,
            question=question,
            answer=answer,
        )
        if llm_eval:
            return llm_eval
        return self._evaluate_answer_fallback(question_type=question_type, question=question, answer=answer)

    @staticmethod
    def _tip_from_improvement(item: str) -> str:
        text = item.lower()
        if "structure" in text or "star" in text:
            return "Practice 5 behavioral answers using STAR and keep each to 90-120 seconds."
        if "depth" in text or "detail" in text:
            return "Before answering, list 2 specific details and 1 measurable outcome to mention."
        if "question" in text or "focus" in text:
            return "Start each answer by restating the problem in one line before diving into details."
        return "Record your answers, review clarity gaps, and iterate with one targeted improvement daily."

    def _aggregate_interview_feedback(self, evaluations: List[Dict]) -> Dict[str, List[str]]:
        strengths_counter: Counter = Counter()
        improvements_counter: Counter = Counter()
        for item in evaluations:
            for s in item.get("strengths", []):
                if s:
                    strengths_counter[s] += 1
            for m in item.get("improvements", []):
                if m:
                    improvements_counter[m] += 1

        strengths = [text for text, _ in strengths_counter.most_common(3)]
        improvements = [text for text, _ in improvements_counter.most_common(3)]
        if not strengths:
            strengths = ["Consistent participation across the mock interview."]
        if not improvements:
            improvements = ["Increase specificity and measurable outcomes in each answer."]

        tips: List[str] = []
        for improvement in improvements:
            tip = self._tip_from_improvement(improvement)
            if tip not in tips:
                tips.append(tip)
        return {
            "strengths": strengths,
            "improvements": improvements,
            "tips": tips[:5],
        }

    def _build_response_payload(self, entity: MockInterviewSession) -> Dict:
        return {
            "session_id": entity.session_id,
            "student_id": entity.student_id,
            "role": entity.role,
            "level": entity.level,
            "duration": entity.duration,
            "interview_type": entity.interview_type,
            "question_count": entity.question_count,
            "overall_score": round(float(entity.overall_score or 0.0), 2),
            "transcript": entity.transcript_json or [],
            "strengths": entity.strengths or [],
            "improvement_areas": entity.improvement_areas or [],
            "actionable_tips": entity.actionable_tips or [],
            "playback": {
                "session": f"/api/interview/mock/{entity.session_id}",
                "student_history": f"/api/interview/mock/student/{entity.student_id}",
            },
            "created_at": entity.created_at,
        }

    def run_mock_interview(self, request: MockInterviewRequest) -> Dict:
        student = self.db.query(Student).filter(Student.id == request.student_id).first()
        if not student:
            raise ValueError(f"Student {request.student_id} not found")

        llm_questions = self._generate_questions_with_llm(
            role=request.role,
            level=request.level,
            interview_type=request.interview_type,
            question_count=request.question_count,
            focus_topics=request.focus_topics,
            candidate_summary=request.candidate_summary,
        )
        if len(llm_questions) < request.question_count:
            llm_questions = self._generate_questions_fallback(
                role=request.role,
                interview_type=request.interview_type,
                question_count=request.question_count,
                focus_topics=request.focus_topics,
            )

        transcript: List[Dict] = []
        evaluations: List[Dict] = []
        scores: List[float] = []

        for idx in range(request.question_count):
            current = llm_questions[idx]
            qtype = InterviewTypeEnum(current["question_type"])
            answer = request.answers[idx].strip() if idx < len(request.answers) else ""
            evaluation = self._evaluate_answer(
                role=request.role,
                level=request.level,
                question_type=qtype,
                question=current["question"],
                answer=answer,
            )
            evaluations.append(evaluation)
            scores.append(float(evaluation["score"]))
            transcript.append(
                {
                    "question_number": idx + 1,
                    "question_type": qtype.value,
                    "question": current["question"],
                    "focus_area": current["focus_area"],
                    "candidate_answer": answer,
                    "score": round(float(evaluation["score"]), 2),
                    "feedback": evaluation["feedback"],
                    "ideal_answer": evaluation["ideal_answer"],
                }
            )

        overall_score = round(sum(scores) / len(scores), 2) if scores else 0.0
        summary = self._aggregate_interview_feedback(evaluations)
        session_id = str(uuid.uuid4())

        entity = MockInterviewSession(
            session_id=session_id,
            student_id=request.student_id,
            role=request.role,
            duration=request.duration,
            level=request.level.value,
            interview_type=request.interview_type.value,
            question_count=request.question_count,
            transcript_json=transcript,
            overall_score=overall_score,
            strengths=summary["strengths"],
            improvement_areas=summary["improvements"],
            actionable_tips=summary["tips"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(entity)
        self.db.commit()
        self.db.refresh(entity)

        return self._build_response_payload(entity)

    def get_mock_interview_session(self, session_id: str) -> Dict:
        entity = (
            self.db.query(MockInterviewSession)
            .filter(MockInterviewSession.session_id == session_id)
            .first()
        )
        if not entity:
            raise ValueError(f"Mock interview session {session_id} not found")
        return self._build_response_payload(entity)

    def get_student_mock_interviews(self, student_id: int, limit: int = 20) -> Dict:
        student = self.db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"Student {student_id} not found")

        rows = (
            self.db.query(MockInterviewSession)
            .filter(MockInterviewSession.student_id == student_id)
            .order_by(desc(MockInterviewSession.created_at))
            .limit(limit)
            .all()
        )
        sessions = [
            {
                "session_id": row.session_id,
                "role": row.role,
                "level": row.level,
                "interview_type": row.interview_type,
                "overall_score": round(float(row.overall_score or 0.0), 2),
                "question_count": row.question_count,
                "created_at": row.created_at,
            }
            for row in rows
        ]
        return {"student_id": student_id, "sessions": sessions}
