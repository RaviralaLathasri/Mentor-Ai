"""
Service layer for AI Mentor backend.

The routes call these classes for business logic. This file intentionally keeps
all current service classes in one module to preserve existing imports.
"""

from __future__ import annotations

import os
import random
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.database import (
    AdaptiveSession,
    DifficultyLevel,
    Feedback,
    FeedbackType,
    MentorResponse,
    Student,
    StudentProfile,
    WeaknessScore,
)
from app.schemas import AdaptationUpdate, MistakeExplanation, StudentContextSnapshot, WeaknessAnalysisResult
from app.utils.openai_client import get_openai_client


def _coerce_difficulty(value: Optional[object], default: DifficultyLevel = DifficultyLevel.MEDIUM) -> DifficultyLevel:
    if value is None:
        return default
    if isinstance(value, DifficultyLevel):
        return value
    raw = value.value if hasattr(value, "value") else str(value)
    return DifficultyLevel(raw)


def _coerce_feedback_type(value: object) -> FeedbackType:
    if isinstance(value, FeedbackType):
        return value
    raw = value.value if hasattr(value, "value") else str(value)
    return FeedbackType(raw)


class StudentProfileService:
    """Create/read/update student profiles."""

    def __init__(self, db: Session):
        self.db = db

    def create_profile(
        self,
        student_id: int,
        skills: Optional[List[str]] = None,
        interests: Optional[List[str]] = None,
        goals: str = "",
        confidence_level: float = 0.5,
        preferred_difficulty: object = DifficultyLevel.MEDIUM,
    ) -> StudentProfile:
        student = self.db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"Student {student_id} not found")

        existing = self.get_profile(student_id)
        if existing:
            raise ValueError(f"Profile already exists for student {student_id}")

        if not (0.0 <= confidence_level <= 1.0):
            raise ValueError("Confidence must be between 0.0 and 1.0")

        profile = StudentProfile(
            student_id=student_id,
            skills=skills or [],
            interests=interests or [],
            goals=goals or "",
            confidence_level=confidence_level,
            preferred_difficulty=_coerce_difficulty(preferred_difficulty),
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_profile(self, student_id: int) -> Optional[StudentProfile]:
        return self.db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()

    def update_profile(
        self,
        student_id: int,
        skills: Optional[List[str]] = None,
        interests: Optional[List[str]] = None,
        goals: Optional[str] = None,
        confidence_level: Optional[float] = None,
        preferred_difficulty: Optional[object] = None,
    ) -> StudentProfile:
        profile = self.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        if skills is not None:
            profile.skills = skills
        if interests is not None:
            profile.interests = interests
        if goals is not None:
            profile.goals = goals
        if confidence_level is not None:
            if not (0.0 <= confidence_level <= 1.0):
                raise ValueError("Confidence must be between 0.0 and 1.0")
            profile.confidence_level = confidence_level
        if preferred_difficulty is not None:
            profile.preferred_difficulty = _coerce_difficulty(preferred_difficulty)

        profile.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_learning_context(self, student_id: int) -> Dict:
        profile = self.get_profile(student_id)
        if not profile:
            return {}
        return profile.learning_style_summary


class WeaknessAnalyzerService:
    """Weakness-first analyzer and explain-my-mistake logic."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _normalize_concept(concept_name: str) -> str:
        value = (concept_name or "general").strip().lower()
        return value or "general"

    def get_or_create_weakness(self, student_id: int, concept_name: str) -> WeaknessScore:
        concept_key = self._normalize_concept(concept_name)
        weakness = (
            self.db.query(WeaknessScore)
            .filter(WeaknessScore.student_id == student_id, WeaknessScore.concept_name == concept_key)
            .first()
        )

        if not weakness:
            weakness = WeaknessScore(
                student_id=student_id,
                concept_name=concept_key,
                weakness_score=0.0,
                times_seen=0,
                times_correct=0,
            )
            self.db.add(weakness)
            self.db.commit()
            self.db.refresh(weakness)

        return weakness

    def analyze_quiz_result(
        self,
        student_id: int,
        concept_name: str,
        is_correct: bool,
        student_answer: str = "",
        correct_answer: str = "",
    ) -> WeaknessAnalysisResult:
        student_exists = self.db.query(Student).filter(Student.id == student_id).first()
        if not student_exists:
            raise ValueError(f"Student {student_id} not found")

        weakness = self.get_or_create_weakness(student_id, concept_name)
        old_score = weakness.weakness_score

        weakness.update_from_quiz_result(is_correct)
        self.db.commit()

        misconception = None
        if not is_correct:
            misconception = self._detect_misconception(student_answer, correct_answer, concept_name)

        return WeaknessAnalysisResult(
            concept_name=weakness.concept_name,
            is_correct=is_correct,
            old_weakness_score=round(old_score, 3),
            new_weakness_score=round(weakness.weakness_score, 3),
            misconception_detected=misconception,
            learning_priority=self._calculate_learning_priority(weakness.weakness_score),
        )

    def get_weakest_concepts(self, student_id: int, limit: int = 5) -> List[WeaknessScore]:
        return (
            self.db.query(WeaknessScore)
            .filter(WeaknessScore.student_id == student_id)
            .order_by(desc(WeaknessScore.weakness_score), desc(WeaknessScore.times_seen))
            .limit(limit)
            .all()
        )

    def get_strength_areas(self, student_id: int, limit: int = 3) -> List[str]:
        rows = (
            self.db.query(WeaknessScore)
            .filter(WeaknessScore.student_id == student_id, WeaknessScore.times_seen >= 2)
            .order_by(WeaknessScore.weakness_score.asc(), WeaknessScore.times_correct.desc())
            .limit(limit)
            .all()
        )
        return [item.concept_name for item in rows if item.weakness_score <= 0.35]

    def _detect_misconception(self, student_answer: str, correct_answer: str, concept_name: str) -> Optional[str]:
        student = (student_answer or "").strip().lower()
        correct = (correct_answer or "").strip().lower()
        concept = self._normalize_concept(concept_name)

        if not student:
            return f"No reasoning provided for {concept}."
        if student == correct:
            return None
        if any(token in student for token in ["always", "never"]):
            return f"Over-generalization in {concept}."
        if any(token in student for token in ["random", "guess", "maybe"]):
            return f"Uncertain causal reasoning in {concept}."

        return f"Core concept mismatch in {concept}."

    @staticmethod
    def _calculate_learning_priority(weakness_score: float) -> str:
        if weakness_score >= 0.75:
            return "critical"
        if weakness_score >= 0.5:
            return "high"
        if weakness_score >= 0.25:
            return "medium"
        return "low"

    def explain_mistake(
        self,
        student_id: int,
        concept: str,
        student_answer: str,
        correct_answer: str,
        question: Optional[str] = None,
    ) -> MistakeExplanation:
        student_exists = self.db.query(Student).filter(Student.id == student_id).first()
        if not student_exists:
            raise ValueError(f"Student {student_id} not found")

        concept_key = self._normalize_concept(concept)
        misconception = self._detect_misconception(student_answer, correct_answer, concept_key) or f"Gap in {concept_key}."

        why_wrong = (
            f"Your answer focuses on '{student_answer}', but it misses the key idea needed in {concept_key}. "
            "The response does not align with the underlying principle used to solve this type of problem."
        )
        correct_explanation = (
            f"A stronger answer is '{correct_answer}'. The main idea is to reason from first principles in {concept_key} "
            "before applying formulas or shortcuts."
        )
        guiding_question = self._build_guiding_question(concept_key, question)

        return MistakeExplanation(
            student_id=student_id,
            concept=concept_key,
            misconception_identified=misconception,
            why_wrong=why_wrong,
            correct_explanation=correct_explanation,
            learning_tips=[
                "Restate the concept in your own words before solving.",
                "Identify what assumption your answer depends on.",
                "Test your reasoning on one simpler example first.",
            ],
            related_concept="prerequisite foundations",
            guiding_question=guiding_question,
        )

    @staticmethod
    def _build_guiding_question(concept: str, question: Optional[str]) -> str:
        if question:
            return f"In '{question}', which step in {concept} determines whether your approach is valid?"
        return f"What evidence would convince you that your current reasoning in {concept} is correct?"


class MentorAIService:
    """Generate adaptive Socratic mentor responses."""

    def __init__(self, db: Session):
        self.db = db
        self.profile_service = StudentProfileService(db)
        self.weakness_service = WeaknessAnalyzerService(db)

    def generate_response(
        self,
        student_id: int,
        query: str,
        focus_concept: Optional[str] = None,
        context: Optional[Dict] = None,
    ) -> Dict:
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        target_concept = focus_concept or self._infer_concept(query)
        weakness = self.weakness_service.get_or_create_weakness(student_id, target_concept)

        feedback_bias = self._recent_feedback_bias(student_id)
        explanation_style = self._determine_explanation_style(
            profile.confidence_level,
            weakness.weakness_score,
            profile.preferred_difficulty,
            feedback_bias,
        )

        response_text = self._generate_socratic_response(
            query=query,
            concept=target_concept,
            style=explanation_style,
            context=context or profile.learning_style_summary,
        )
        follow_up = self._generate_guiding_question(target_concept, explanation_style)

        response_id = self._store_response(
            student_id=student_id,
            query=query,
            response=response_text,
            style=explanation_style,
            concept=target_concept,
            confidence=profile.confidence_level,
        )

        return {
            "response_id": response_id,
            "response": response_text,
            "explanation_style": explanation_style,
            "target_concept": target_concept,
            "follow_up_question": follow_up,
        }

    def _recent_feedback_bias(self, student_id: int) -> str:
        rows = (
            self.db.query(Feedback.feedback_type)
            .filter(Feedback.student_id == student_id)
            .order_by(desc(Feedback.created_at))
            .limit(5)
            .all()
        )
        if not rows:
            return "neutral"

        hard_votes = sum(1 for row in rows if row.feedback_type in (FeedbackType.TOO_HARD, FeedbackType.UNCLEAR))
        easy_votes = sum(1 for row in rows if row.feedback_type == FeedbackType.TOO_EASY)

        if hard_votes > easy_votes:
            return "simplify"
        if easy_votes > hard_votes:
            return "deepen"
        return "neutral"

    @staticmethod
    def _determine_explanation_style(
        confidence: float,
        weakness: float,
        preferred_difficulty: DifficultyLevel,
        feedback_bias: str,
    ) -> str:
        if feedback_bias == "simplify":
            return "simple"
        if feedback_bias == "deepen":
            return "deep"

        if weakness >= 0.6 or confidence <= 0.35:
            return "simple"
        if weakness >= 0.3 or preferred_difficulty == DifficultyLevel.MEDIUM:
            return "conceptual"
        return "deep"

    @staticmethod
    def _infer_concept(query: str) -> str:
        query_l = (query or "").lower()
        keyword_map = {
            "gradient descent": ["gradient", "descent", "learning rate", "loss"],
            "backpropagation": ["backprop", "backward", "weights", "neural"],
            "statistics": ["probability", "variance", "mean", "hypothesis"],
            "linear algebra": ["matrix", "vector", "eigen", "determinant"],
            "python": ["python", "list", "dict", "function", "class"],
            "sql": ["sql", "join", "select", "where", "group by"],
            "data analysis": ["analysis", "dashboard", "kpi", "data"],
        }

        best = "general"
        best_hits = 0
        for concept, words in keyword_map.items():
            hits = sum(1 for word in words if word in query_l)
            if hits > best_hits:
                best = concept
                best_hits = hits
        return best

    def _generate_socratic_response(self, query: str, concept: str, style: str, context: Dict) -> str:
        llm_text = self._try_llm_response(query=query, concept=concept, style=style, context=context)
        if llm_text:
            return llm_text
        return self._local_socratic_response(query=query, concept=concept, style=style)

    def _try_llm_response(self, query: str, concept: str, style: str, context: Dict) -> Optional[str]:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None

        model = os.getenv("OPENAI_API_MODEL", "gpt-4o-mini")
        system_prompt = (
            "You are an AI mentor. Use Socratic questioning, avoid giving direct final answers, "
            "and adapt depth based on the requested style."
        )
        user_prompt = (
            f"Student query: {query}\n"
            f"Target concept: {concept}\n"
            f"Style: {style}\n"
            f"Student context: {context}\n"
            "Return a concise mentor response with 2-4 guiding questions."
        )

        try:
            client = get_openai_client()
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
                max_tokens=320,
            )
            content = completion.choices[0].message.content if completion.choices else None
            if content:
                return content.strip()
        except Exception:
            return None

        return None

    @staticmethod
    def _local_socratic_response(query: str, concept: str, style: str) -> str:
        if style == "simple":
            return (
                f"Let's unpack {concept} step by step.\n"
                "1. What does each key term in the question mean to you?\n"
                f"2. Which part of {concept} feels unclear right now?\n"
                "3. Can you test your idea with a tiny example before solving the full problem?"
            )

        if style == "deep":
            return (
                f"For a deeper look at {concept}, reason from definitions first.\n"
                "1. What assumptions are you making implicitly?\n"
                "2. Can you derive the next step from the formal rule rather than memory?\n"
                "3. How would your reasoning change under an edge case?"
            )

        return (
            f"Great question on {concept}. Let's structure your reasoning.\n"
            "1. What is the objective of this method?\n"
            "2. Which inputs control the output most strongly?\n"
            "3. How would you explain the same idea to a peer with one worked example?"
        )

    @staticmethod
    def _generate_guiding_question(concept: str, style: str) -> str:
        bank = {
            "simple": [
                f"What is the first principle behind {concept}?",
                f"Can you give a one-line definition of {concept} in your own words?",
            ],
            "conceptual": [
                f"How does {concept} connect to something you already understand?",
                f"Which variable in {concept} changes the outcome most?",
            ],
            "deep": [
                f"What assumptions make the standard derivation of {concept} valid?",
                f"How would you formally justify each step in {concept}?",
            ],
        }
        return random.choice(bank.get(style, bank["conceptual"]))

    def _store_response(
        self,
        student_id: int,
        query: str,
        response: str,
        style: str,
        concept: str,
        confidence: float,
    ) -> str:
        response_id = str(uuid.uuid4())

        snapshot_rows = (
            self.db.query(WeaknessScore)
            .filter(WeaknessScore.student_id == student_id)
            .order_by(desc(WeaknessScore.weakness_score))
            .limit(5)
            .all()
        )
        weakness_snapshot = {row.concept_name: round(row.weakness_score, 3) for row in snapshot_rows}

        entity = MentorResponse(
            response_id=response_id,
            student_id=student_id,
            student_weakness_state=weakness_snapshot,
            student_confidence=confidence,
            query=query,
            response=response,
            explanation_style=style,
            target_concept=concept,
        )
        self.db.add(entity)
        self.db.commit()
        return response_id


class FeedbackService:
    """Human-in-the-loop feedback processor."""

    def __init__(self, db: Session):
        self.db = db
        self.profile_service = StudentProfileService(db)
        self.weakness_service = WeaknessAnalyzerService(db)

    def submit_feedback(
        self,
        student_id: int,
        response_id: str,
        feedback_type: object,
        rating: Optional[float] = None,
        comments: Optional[str] = None,
        focus_concept: Optional[str] = None,
    ) -> Tuple[Feedback, Optional[AdaptationUpdate]]:
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        feedback_enum = _coerce_feedback_type(feedback_type)

        feedback = Feedback(
            student_id=student_id,
            response_id=response_id,
            feedback_type=feedback_enum,
            rating=rating,
            comments=comments,
            focus_concept=(focus_concept or None),
        )
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)

        adaptation = self._adapt_to_feedback(student_id, feedback_enum, rating)
        self._apply_feedback_to_weakness(student_id, feedback_enum, focus_concept)

        return feedback, adaptation

    def _adapt_to_feedback(
        self,
        student_id: int,
        feedback_type: FeedbackType,
        rating: Optional[float] = None,
    ) -> Optional[AdaptationUpdate]:
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            return None

        old_difficulty = profile.preferred_difficulty.value
        old_confidence = profile.confidence_level
        reasons: List[str] = []

        if feedback_type == FeedbackType.TOO_EASY:
            if profile.preferred_difficulty == DifficultyLevel.EASY:
                profile.preferred_difficulty = DifficultyLevel.MEDIUM
                reasons.append("Raised difficulty to medium after repeated easy feedback")
            elif profile.preferred_difficulty == DifficultyLevel.MEDIUM:
                profile.preferred_difficulty = DifficultyLevel.HARD
                reasons.append("Raised difficulty to hard after easy feedback")

        if feedback_type == FeedbackType.TOO_HARD:
            if profile.preferred_difficulty == DifficultyLevel.HARD:
                profile.preferred_difficulty = DifficultyLevel.MEDIUM
                reasons.append("Reduced difficulty to medium after hard feedback")
            elif profile.preferred_difficulty == DifficultyLevel.MEDIUM:
                profile.preferred_difficulty = DifficultyLevel.EASY
                reasons.append("Reduced difficulty to easy after hard feedback")

        if feedback_type == FeedbackType.UNCLEAR:
            profile.confidence_level = max(0.0, profile.confidence_level - 0.05)
            reasons.append("Reduced confidence slightly due to unclear feedback")

        if rating is not None:
            if rating <= 2.0:
                profile.confidence_level = max(0.0, profile.confidence_level - 0.1)
                reasons.append("Lowered confidence estimate from low rating")
            elif rating >= 4.0:
                profile.confidence_level = min(1.0, profile.confidence_level + 0.07)
                reasons.append("Raised confidence estimate from positive rating")

        profile.updated_at = datetime.utcnow()
        self.db.commit()

        new_difficulty = profile.preferred_difficulty.value
        if not reasons and new_difficulty == old_difficulty and profile.confidence_level == old_confidence:
            return None

        return AdaptationUpdate(
            previous_difficulty=old_difficulty,
            new_difficulty=new_difficulty,
            adjustment_reason="; ".join(reasons) if reasons else "No major adaptation required",
            confidence_change=round(profile.confidence_level, 3),
        )

    def _apply_feedback_to_weakness(
        self,
        student_id: int,
        feedback_type: FeedbackType,
        focus_concept: Optional[str],
    ) -> None:
        if not focus_concept:
            return

        weakness = self.weakness_service.get_or_create_weakness(student_id, focus_concept)

        delta_map = {
            FeedbackType.TOO_HARD: 0.08,
            FeedbackType.UNCLEAR: 0.05,
            FeedbackType.HELPFUL: -0.03,
            FeedbackType.TOO_EASY: -0.04,
        }
        delta = delta_map.get(feedback_type, 0.0)

        weakness.weakness_score = min(1.0, max(0.0, weakness.weakness_score + delta))
        weakness.last_updated = datetime.utcnow()
        self.db.commit()


class AdaptiveLearningService:
    """Adaptive learning orchestrator."""

    def __init__(self, db: Session):
        self.db = db
        self.profile_service = StudentProfileService(db)
        self.weakness_service = WeaknessAnalyzerService(db)

    def create_session(self, student_id: int, topic: str, difficulty_level: object) -> AdaptiveSession:
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        snapshot = self.get_student_context_snapshot(student_id)
        session = AdaptiveSession(
            student_id=student_id,
            topic=(topic or "general"),
            difficulty_level=_coerce_difficulty(difficulty_level, profile.preferred_difficulty).value,
            interaction_count=0,
            context_snapshot=snapshot.model_dump(),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_student_context_snapshot(self, student_id: int) -> StudentContextSnapshot:
        profile = self.profile_service.get_profile(student_id)
        if not profile:
            raise ValueError(f"Profile not found for student {student_id}")

        weaknesses = self.weakness_service.get_weakest_concepts(student_id, limit=5)
        strength_areas = self.weakness_service.get_strength_areas(student_id, limit=3)
        recent_feedback = (
            self.db.query(Feedback)
            .filter(Feedback.student_id == student_id)
            .order_by(desc(Feedback.created_at))
            .limit(10)
            .all()
        )

        return StudentContextSnapshot(
            confidence_level=round(profile.confidence_level, 3),
            primary_weakness_concepts=[row.concept_name for row in weaknesses],
            strength_areas=strength_areas,
            preferred_difficulty=profile.preferred_difficulty.value,
            recent_feedback_sentiment=self._analyze_feedback_sentiment(recent_feedback),
        )

    def generate_recommendations(self, student_id: int) -> List[Dict]:
        context = self.get_student_context_snapshot(student_id)
        profile = self.profile_service.get_profile(student_id)
        weaknesses = self.weakness_service.get_weakest_concepts(student_id, limit=3)
        recommendations: List[Dict] = []

        for row in weaknesses:
            if row.weakness_score >= 0.5:
                recommendations.append(
                    {
                        "priority": "high",
                        "recommendation_type": "Concept Review",
                        "suggested_action": f"Practice {row.concept_name} with 3 scaffolded questions",
                        "explanation": f"Weakness score is {row.weakness_score:.2f}, indicating repeated difficulty.",
                    }
                )

        if context.recent_feedback_sentiment == "negative":
            recommendations.append(
                {
                    "priority": "high",
                    "recommendation_type": "Difficulty Adjustment",
                    "suggested_action": "Use simpler explanations for next session and increase step-by-step prompts",
                    "explanation": "Recent feedback trend is negative (too_hard/unclear dominates).",
                }
            )

        if context.confidence_level < 0.45:
            focus = context.strength_areas[0] if context.strength_areas else "a familiar topic"
            recommendations.append(
                {
                    "priority": "medium",
                    "recommendation_type": "Confidence Boost",
                    "suggested_action": f"Start next session with a quick win in {focus}",
                    "explanation": "Confidence level is below 0.45; quick successes can improve learning momentum.",
                }
            )

        if profile and profile.preferred_difficulty == DifficultyLevel.HARD and context.recent_feedback_sentiment == "positive":
            recommendations.append(
                {
                    "priority": "low",
                    "recommendation_type": "Challenge Extension",
                    "suggested_action": "Add one transfer question connecting two concepts",
                    "explanation": "Positive feedback at high difficulty suggests readiness for integrative tasks.",
                }
            )

        if not recommendations:
            recommendations.append(
                {
                    "priority": "low",
                    "recommendation_type": "Steady Practice",
                    "suggested_action": "Continue current plan and review one recent concept",
                    "explanation": "No major risk signals detected from recent data.",
                }
            )

        return recommendations

    @staticmethod
    def _analyze_feedback_sentiment(feedbacks: List[Feedback]) -> str:
        if not feedbacks:
            return "neutral"

        score = 0
        for row in feedbacks:
            if row.feedback_type == FeedbackType.HELPFUL:
                score += 1
            elif row.feedback_type == FeedbackType.TOO_EASY:
                score += 0
            else:
                score -= 1

        if score > 0:
            return "positive"
        if score < 0:
            return "negative"
        return "neutral"


__all__ = [
    "StudentProfileService",
    "WeaknessAnalyzerService",
    "MentorAIService",
    "FeedbackService",
    "AdaptiveLearningService",
]
