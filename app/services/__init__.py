"""
Service layer for AI Mentor backend.

The routes call these classes for business logic. This file intentionally keeps
all current service classes in one module to preserve existing imports.
"""

from __future__ import annotations

import os
import random
import re
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

        target_concept = self._resolve_target_concept(
            student_id=student_id,
            query=query,
            focus_concept=focus_concept,
        )
        weakness = self.weakness_service.get_or_create_weakness(student_id, target_concept)

        feedback_bias = self._recent_feedback_bias(student_id)
        explanation_style = self._determine_explanation_style(
            profile.confidence_level,
            weakness.weakness_score,
            profile.preferred_difficulty,
            feedback_bias,
        )

        response_text = self._generate_socratic_response(
            student_id=student_id,
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

    def _resolve_target_concept(
        self,
        student_id: int,
        query: str,
        focus_concept: Optional[str] = None,
    ) -> str:
        if focus_concept:
            return self._normalize_topic_alias(focus_concept)

        inferred = self._infer_concept(query)
        extracted_topic = self._extract_topic_from_query(query)
        query_l = (query or "").lower()
        continuation_tokens = [
            "current level",
            "timeline",
            "month",
            "months",
            "week",
            "weeks",
            "beginner",
            "intermediate",
            "advanced",
        ]
        is_continuation = any(token in query_l for token in continuation_tokens)
        continuation_topic_markers = {
            "beginner",
            "intermediate",
            "advanced",
            "your beginner",
            "your intermediate",
            "your advanced",
            "current level",
            "timeline",
        }
        extracted_is_meta = (
            extracted_topic in continuation_topic_markers
            or extracted_topic.startswith("your ")
        )
        has_explicit_topic = (
            inferred != "general"
            or (extracted_topic and extracted_topic != "general" and not extracted_is_meta)
        )

        if is_continuation and not has_explicit_topic:
            recent = (
                self.db.query(MentorResponse)
                .filter(MentorResponse.student_id == student_id)
                .order_by(desc(MentorResponse.created_at))
                .limit(3)
                .all()
            )

            for row in recent:
                previous_query = (row.query or "").lower()
                asked_roadmap = any(token in previous_query for token in ["roadmap", "plan", "path", "become", "career", "learn"])
                if asked_roadmap and row.target_concept and row.target_concept != "general":
                    return row.target_concept

        if extracted_topic and extracted_topic != "general":
            return self._normalize_topic_alias(extracted_topic)

        if inferred != "general":
            return inferred

        if extracted_topic and extracted_topic != "general":
            return self._normalize_topic_alias(extracted_topic)
        if not is_continuation:
            return inferred

        recent = (
            self.db.query(MentorResponse)
            .filter(MentorResponse.student_id == student_id)
            .order_by(desc(MentorResponse.created_at))
            .limit(3)
            .all()
        )

        for row in recent:
            previous_query = (row.query or "").lower()
            asked_roadmap = any(token in previous_query for token in ["roadmap", "plan", "path", "become", "career"])
            if asked_roadmap and row.target_concept and row.target_concept != "general":
                return row.target_concept

        return inferred

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
            "machine learning": [
                "machine learning",
                "ml",
                "supervised",
                "unsupervised",
                "model training",
                "feature engineering",
                "overfitting",
                "underfitting",
                "regularization",
                "classification",
                "regression",
            ],
            "statistics": ["probability", "variance", "mean", "hypothesis"],
            "linear algebra": ["matrix", "vector", "eigen", "determinant"],
            "python": ["python", "list", "dict", "function", "class"],
            "sql": ["sql", "join", "select", "where", "group by"],
            "data analysis": ["data analyst", "data analysis", "analysis", "dashboard", "kpi", "analytics", "bi"],
            "data structures": [
                "data structure",
                "array",
                "linked list",
                "stack",
                "queue",
                "tree",
                "graph",
                "hashmap",
                "hashing",
                "hash table",
            ],
            "algorithms": ["algorithm", "complexity", "big o", "recursion", "dynamic programming", "greedy", "sorting"],
            "system design": ["system design", "scalability", "load balancer", "caching", "distributed"],
            "api design": ["api", "rest", "endpoint", "request", "response", "http"],
        }

        best = "general"
        best_hits = 0
        for concept, words in keyword_map.items():
            hits = sum(1 for word in words if word in query_l)
            if hits > best_hits:
                best = concept
                best_hits = hits
        return best

    @staticmethod
    def _clean_topic_phrase(value: str) -> str:
        phrase = (value or "").strip().lower()
        phrase = re.sub(r"[^a-z0-9\s\-/+]", " ", phrase)
        phrase = re.sub(r"\s+", " ", phrase).strip()
        if not phrase:
            return "general"

        filler = {
            "please",
            "can",
            "you",
            "me",
            "give",
            "the",
            "a",
            "an",
            "to",
            "for",
            "of",
            "about",
            "in",
            "on",
            "is",
            "are",
            "do",
            "does",
            "how",
            "why",
            "what",
            "detailed",
            "important",
            "happen",
            "happens",
            "current",
            "level",
            "timeline",
            "learn",
            "study",
            "from",
            "scratch",
            "we",
            "use",
            "become",
            "month",
            "months",
        }
        words = [word for word in phrase.split() if word not in filler and not word.isdigit()]
        if not words:
            return "general"
        return " ".join(words[:5])

    @staticmethod
    def _normalize_topic_alias(topic: str) -> str:
        cleaned = MentorAIService._clean_topic_phrase(topic)
        alias_map = {
            "ml": "machine learning",
            "ai": "machine learning",
            "data analyst": "data analysis",
            "data analytics": "data analysis",
            "analytics": "data analysis",
            "sql query": "sql",
        }
        return alias_map.get(cleaned, cleaned)

    @staticmethod
    def _extract_topic_from_query(query: str) -> str:
        text = (query or "").strip().lower()
        if not text:
            return "general"

        cleaned = re.sub(r"[?!.,]", " ", text)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

        patterns = [
            r"^(?:what is|what are|define|explain)\s+(.+)$",
            r"^(?:why does|why do|why is|why are|why)\s+(.+)$",
            r"^(?:how does|how do|how can|how to|how)\s+(.+)$",
            r"(?:roadmap|plan|path)\s+(?:for|to become)\s+(.+)$",
            r"(?:learn|study)\s+(.+)$",
            r"(?:difference between|compare)\s+(.+?)\s+(?:and|vs)\s+(.+)$",
        ]

        for pattern in patterns:
            match = re.search(pattern, cleaned)
            if not match:
                continue

            if len(match.groups()) == 1:
                return MentorAIService._clean_topic_phrase(match.group(1))
            left = MentorAIService._clean_topic_phrase(match.group(1))
            right = MentorAIService._clean_topic_phrase(match.group(2))
            if left != "general" and right != "general":
                return f"{left} vs {right}"

        if "for " in cleaned:
            tail = cleaned.split("for ", 1)[1]
            return MentorAIService._clean_topic_phrase(tail)

        return "general"

    def _generate_socratic_response(self, student_id: int, query: str, concept: str, style: str, context: Dict) -> str:
        llm_text = self._try_llm_response(
            student_id=student_id,
            query=query,
            concept=concept,
            style=style,
            context=context,
        )
        if llm_text:
            return llm_text
        return self._local_socratic_response(query=query, concept=concept, style=style)

    def _select_model(self) -> str:
        configured = os.getenv("OPENAI_API_MODEL")
        if configured:
            return configured

        base_url = (os.getenv("OPENAI_API_BASE") or "").lower()
        if "openrouter" in base_url:
            return "openrouter/auto"
        return "gpt-4o-mini"

    def _model_candidates(self) -> List[str]:
        primary = self._select_model()
        base_url = (os.getenv("OPENAI_API_BASE") or "").lower()

        candidates = [primary]
        if "openrouter" in base_url:
            fallback_models = [
                "openrouter/auto",
                "openai/gpt-4o-mini",
                "anthropic/claude-3.5-haiku",
                "meta-llama/llama-3.1-8b-instruct:free",
            ]
            for model in fallback_models:
                if model not in candidates:
                    candidates.append(model)
        return candidates

    def _recent_context(self, student_id: int, limit: int = 3) -> str:
        rows = (
            self.db.query(MentorResponse.query, MentorResponse.response, MentorResponse.target_concept)
            .filter(MentorResponse.student_id == student_id)
            .order_by(desc(MentorResponse.created_at))
            .limit(limit)
            .all()
        )
        if not rows:
            return "No prior mentor interactions."

        lines = []
        for idx, row in enumerate(reversed(rows), start=1):
            q_text = row[0] if isinstance(row, tuple) or isinstance(row, list) else row.query
            r_text = row[1] if isinstance(row, tuple) or isinstance(row, list) else row.response
            c_text = row[2] if isinstance(row, tuple) or isinstance(row, list) else row.target_concept
            lines.append(f"{idx}) Query: {q_text}")
            lines.append(f"   Concept: {c_text}")
            lines.append(f"   Mentor summary: {(r_text or '')[:220]}")
        return "\n".join(lines)

    def _try_llm_response(self, student_id: int, query: str, concept: str, style: str, context: Dict) -> Optional[str]:
        api_key = os.getenv("OPENAI_API_KEY")
        api_base = os.getenv("OPENAI_API_BASE")
        if not api_key:
            return None

        candidate_models = self._model_candidates()
        style_instruction = {
            "simple": "Use beginner-friendly language, short steps, and one small concrete example.",
            "conceptual": "Give a structured conceptual explanation with intuition + practical example.",
            "deep": "Give rigorous explanation with equations/assumptions when useful.",
        }.get(style, "Give a clear structured explanation.")

        system_prompt = (
            "You are an expert AI mentor.\n"
            "Always answer the student's actual question directly first.\n"
            "Then add 1-2 Socratic follow-up questions.\n"
            "Do not give generic placeholders. Keep output practical and relevant."
        )
        user_prompt = (
            f"Student query: {query}\n"
            f"Target concept: {concept}\n"
            f"Style: {style}\n"
            f"Style guidance: {style_instruction}\n"
            f"Student context: {context}\n"
            f"Recent interaction context:\n{self._recent_context(student_id=student_id)}\n\n"
            "Response format:\n"
            "1) Direct answer (2-8 short paragraphs)\n"
            "2) If useful, bullet list of steps\n"
            "3) Two guiding questions\n"
            "4) Never label the topic as 'general' if the query clearly names a topic."
        )

        headers = None
        if api_base and "openrouter" in api_base.lower():
            headers = {
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost"),
                "X-Title": os.getenv("OPENROUTER_APP_NAME", "Mentor AI"),
            }

        errors: List[str] = []
        try:
            client = get_openai_client()
            for model in candidate_models:
                try:
                    completion = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        temperature=0.4,
                        max_tokens=700,
                        extra_headers=headers,
                        timeout=20,
                    )
                    content = completion.choices[0].message.content if completion.choices else None
                    if content:
                        return content.strip()
                except Exception as model_error:
                    model_error_text = str(model_error)
                    errors.append(f"{model}: {model_error_text}")
                    lower_error = model_error_text.lower()
                    if any(token in lower_error for token in ["connection error", "timed out", "unauthorized", "invalid api key"]):
                        break
        except Exception as e:
            print(f"[WARN] LLM client init failed; falling back to local templates. Error: {e}")
            return None

        if errors:
            print("[WARN] LLM response failed; falling back to local templates.")
            for item in errors:
                print(f"[WARN] model_error: {item}")

        return None

    @staticmethod
    def _concept_definition(concept: str) -> str:
        concept_l = (concept or "general").lower()
        definitions = {
            "machine learning": (
                "Machine learning is a method of building models that learn patterns from data "
                "to make predictions or decisions without writing explicit rules for every case."
            ),
            "gradient descent": (
                "Gradient descent is an optimization algorithm that updates parameters by moving "
                "in the negative gradient direction to reduce a loss function."
            ),
            "backpropagation": (
                "Backpropagation is the chain-rule based process used in neural networks to compute "
                "how each weight affects final loss, enabling targeted weight updates."
            ),
            "data analysis": (
                "Data analysis is the process of cleaning, exploring, and interpreting data "
                "to answer questions and support decisions."
            ),
            "sql": (
                "SQL is the standard language for querying and transforming structured data "
                "stored in relational databases."
            ),
            "python": (
                "Python is a high-level programming language widely used for automation, "
                "data analysis, machine learning, and backend development."
            ),
            "statistics": (
                "Statistics is the science of collecting, summarizing, and reasoning about data "
                "to make decisions under uncertainty."
            ),
            "linear algebra": (
                "Linear algebra studies vectors, matrices, and linear transformations; "
                "it is foundational for machine learning and optimization."
            ),
            "neural networks": (
                "Neural networks are layered function approximators that transform inputs through "
                "learned weights and nonlinear activations."
            ),
            "deep learning": (
                "Deep learning is a subset of machine learning that uses multi-layer neural networks "
                "to learn complex patterns from large datasets."
            ),
            "supervised learning": (
                "Supervised learning trains a model using labeled examples (input-output pairs) "
                "to predict known target variables."
            ),
            "unsupervised learning": (
                "Unsupervised learning finds structure or patterns in unlabeled data, "
                "such as clusters, latent factors, or anomalies."
            ),
            "overfitting": (
                "Overfitting happens when a model learns noise and dataset-specific quirks, "
                "performing well on training data but poorly on unseen data."
            ),
            "underfitting": (
                "Underfitting happens when a model is too simple to capture real signal, "
                "so it performs poorly on both training and test data."
            ),
            "regularization": (
                "Regularization controls model complexity to improve generalization, "
                "for example by penalizing large weights (L1/L2) or using dropout/early stopping."
            ),
            "system design": (
                "System design is the process of architecting scalable, reliable, and maintainable software systems "
                "by defining components, data flow, and trade-offs."
            ),
            "data structures": (
                "Data structures are ways to organize and store data efficiently, enabling faster operations "
                "like search, insert, delete, and traversal."
            ),
            "algorithms": (
                "Algorithms are step-by-step procedures to solve computational problems with measurable "
                "time and space complexity."
            ),
            "api design": (
                "API design defines how systems communicate through clear endpoints, request/response contracts, "
                "versioning, and error handling."
            ),
            "kubernetes": (
                "Kubernetes is a container orchestration platform that automates deployment, scaling, and management "
                "of containerized applications."
            ),
        }
        return definitions.get(
            concept_l,
            f"{concept} is a topic where you model the core idea, apply it on examples, and validate outcomes with measurable criteria.",
        )

    @staticmethod
    def _comparison_response(query_l: str) -> Optional[str]:
        pattern = r"(?:difference between|compare)\s+([a-z0-9\-\s]+?)\s+(?:and|vs)\s+([a-z0-9\-\s]+)"
        match = re.search(pattern, query_l)
        if not match:
            return None

        left = " ".join(match.group(1).split())
        right = " ".join(match.group(2).split())

        if "supervised" in left and "unsupervised" in right or "supervised" in right and "unsupervised" in left:
            return (
                "Supervised vs Unsupervised Learning:\n"
                "- Data: supervised uses labeled data; unsupervised uses unlabeled data.\n"
                "- Goal: supervised predicts targets; unsupervised discovers hidden structure.\n"
                "- Typical tasks: supervised -> classification/regression, unsupervised -> clustering/dimensionality reduction.\n"
                "- Evaluation: supervised has clear metrics against labels; unsupervised often needs proxy/business evaluation.\n"
                "- Use supervised when you have reliable labels; use unsupervised when labels are unavailable and exploration is needed."
            )

        return (
            f"Comparison: {left} vs {right}\n"
            f"- Purpose: What problem does each solve?\n"
            f"- Input/Output: How do inputs and outputs differ?\n"
            f"- Strengths: Where is {left} better, and where is {right} better?\n"
            f"- Trade-offs: Accuracy, speed, data requirement, interpretability.\n\n"
            f"To make this concrete, tell me your use case and I will recommend one with reasons."
        )

    @staticmethod
    def _local_socratic_response(query: str, concept: str, style: str) -> str:
        query_l = (query or "").lower()
        extracted_topic = MentorAIService._extract_topic_from_query(query)
        topic = concept if concept and concept != "general" else extracted_topic
        if not topic or topic == "general":
            topic = "the topic in your question"
        asks_definition = (
            query_l.startswith("what is ")
            or query_l.startswith("what are ")
            or query_l.startswith("define ")
            or " meaning of " in query_l
        )
        asks_why = query_l.startswith("why ") or " why " in query_l
        asks_how = query_l.startswith("how ") or " how " in query_l
        asks_compare = "difference between" in query_l or " compare " in query_l or " vs " in query_l
        asks_for_roadmap = any(token in query_l for token in ["roadmap", "plan", "path", "career", "become", "from scratch"])
        roadmap_continuation = any(
            token in query_l
            for token in ["current level", "timeline", "month", "months", "week", "weeks", "beginner", "intermediate", "advanced"]
        )
        asks_data_analyst = any(token in query_l for token in ["data analyst", "data analysis", "analytics"])
        asks_ml = any(token in query_l for token in ["machine learning", "ml"])
        if concept == "machine learning":
            asks_ml = True

        if asks_compare:
            compare = MentorAIService._comparison_response(query_l)
            if compare:
                return (
                    f"{compare}\n\n"
                    "Guiding questions:\n"
                    "1. What is your dataset size/type?\n"
                    "2. Is interpretability or raw accuracy more important?"
                )

        if (asks_for_roadmap or roadmap_continuation) and asks_data_analyst:
            return (
                "Great goal. Here is a practical 16-week roadmap to become a data analyst:\n\n"
                "Phase 1 (Weeks 1-4): Foundations\n"
                "- Excel: lookup functions, pivot tables, data cleaning\n"
                "- SQL basics: SELECT, WHERE, GROUP BY, JOIN\n"
                "- Statistics: mean/median, variance, distributions, hypothesis basics\n"
                "Output: 2 mini tasks solved in Excel + SQL\n\n"
                "Phase 2 (Weeks 5-8): Python for analysis\n"
                "- Python + pandas + numpy for cleaning and exploration\n"
                "- Matplotlib/Seaborn for visualization\n"
                "- EDA workflow: missing values, outliers, feature summaries\n"
                "Output: 2 EDA notebooks on public datasets\n\n"
                "Phase 3 (Weeks 9-12): BI + dashboards\n"
                "- Power BI or Tableau (pick one)\n"
                "- Build KPI dashboard with filters, drill-downs, and story flow\n"
                "- Learn metric design: conversion, retention, cohort views\n"
                "Output: 2 portfolio dashboards\n\n"
                "Phase 4 (Weeks 13-16): Portfolio + interview prep\n"
                "- 3 end-to-end projects (business problem -> analysis -> recommendation)\n"
                "- SQL interview practice: window functions, case expressions, joins\n"
                "- Communicate findings in 1-page business summary per project\n"
                "Output: GitHub portfolio + resume bullets + mock interview set\n\n"
                "Weekly routine (recommended):\n"
                "- 5 days x 2 hours learning, 1 day project building, 1 day revision\n\n"
                "Next Socratic step:\n"
                "1. Which tools do you already know today (Excel/SQL/Python/BI)?\n"
                "2. Can you commit to a realistic weekly hour target?"
            )

        if (asks_for_roadmap or roadmap_continuation) and asks_ml:
            return (
                "Great target. Here is a practical 5-month roadmap for machine learning (beginner-friendly):\n\n"
                "Month 1: Math + Python foundations\n"
                "- Python basics, numpy, pandas\n"
                "- Core math: linear algebra basics, derivatives, probability essentials\n"
                "Output: 2 notebooks (EDA + math intuition)\n\n"
                "Month 2: Classical ML core\n"
                "- Regression, classification, metrics (accuracy, precision/recall, ROC-AUC)\n"
                "- Train/validation/test split, cross-validation, bias-variance\n"
                "Output: 3 classical ML mini-projects\n\n"
                "Month 3: Feature engineering + model improvement\n"
                "- Missing values, encoding, scaling, leakage checks\n"
                "- Hyperparameter tuning (Grid/Random Search)\n"
                "Output: one polished end-to-end tabular ML project\n\n"
                "Month 4: Intro deep learning\n"
                "- Neural network basics, backprop intuition, optimization basics\n"
                "- Build simple models in TensorFlow/PyTorch\n"
                "Output: 1 DL project (image or text starter)\n\n"
                "Month 5: Portfolio + interview prep\n"
                "- 2 strong projects with clear problem, metrics, and business impact\n"
                "- SQL + ML interview prep and model explainability (SHAP/feature importance)\n"
                "Output: GitHub portfolio + resume bullets + mock interview answers\n\n"
                "Weekly plan:\n"
                "- 10-12 hours: 6 hours learning, 4 hours projects, 1-2 hours revision\n\n"
                "To personalize this to your level:\n"
                "1. Are you stronger in coding or math right now?\n"
                "2. Do you want job-ready Data Analyst -> ML path, or direct ML Engineer path?"
            )

        if asks_definition:
            normalized_topic = MentorAIService._normalize_topic_alias(topic)
            definition = MentorAIService._concept_definition(normalized_topic)
            return (
                f"{definition}\n\n"
                "Quick example:\n"
                f"- In {normalized_topic}, you define an objective, learn from data/examples, and evaluate with clear metrics.\n\n"
                "Check your understanding:\n"
                "1. Can you explain this in one sentence to a beginner?\n"
                "2. What is one real-world use case you care about?"
            )

        if "overfitting" in query_l:
            return (
                "Overfitting happens when model complexity is high relative to data signal, so the model memorizes training noise.\n"
                "Signs: very low training error but much higher validation/test error.\n"
                "Common causes: too many parameters, small dataset, weak regularization, data leakage.\n"
                "Fixes: cross-validation, simpler model, more data/augmentation, stronger regularization, early stopping.\n\n"
                "Guiding questions:\n"
                "1. What is your train vs validation performance gap?\n"
                "2. Which anti-overfitting method have you already tried?"
            )

        if "underfitting" in query_l:
            return (
                "Underfitting means the model is too simple or not trained enough to capture signal.\n"
                "Signs: both training and validation errors remain high.\n"
                "Fixes: richer features, higher-capacity model, better optimization, longer training, reduced regularization.\n\n"
                "Guiding questions:\n"
                "1. Is training error already high?\n"
                "2. Which part of your pipeline limits model capacity most?"
            )

        if "hashing" in query_l or "hash table" in query_l:
            return (
                "We use hashing because it gives near O(1) average-time lookup, insert, and delete by mapping keys to array indices.\n"
                "That makes dictionaries/maps fast for membership checks and key-value access.\n"
                "Trade-offs: collisions can degrade performance, and hash tables are usually unordered unless explicitly designed otherwise.\n\n"
                "Guiding questions:\n"
                "1. What collision strategy are you using (chaining or open addressing)?\n"
                "2. How does load factor affect performance in your implementation?"
            )

        if asks_for_roadmap or roadmap_continuation:
            return (
                f"Here is a practical roadmap for {topic}:\n"
                "Phase 1 (Weeks 1-2): Fundamentals\n"
                "- Learn core terminology and key principles\n"
                "- Solve 5 beginner exercises\n\n"
                "Phase 2 (Weeks 3-6): Applied practice\n"
                "- Work through guided tutorials and mini-projects\n"
                "- Build one end-to-end project you can explain\n\n"
                "Phase 3 (Weeks 7-10): Intermediate depth\n"
                "- Study common mistakes, edge cases, and trade-offs\n"
                "- Build a second project with better structure and documentation\n\n"
                "Phase 4 (Weeks 11-12): Portfolio and revision\n"
                "- Prepare summary notes and interview-style Q&A\n"
                "- Publish projects and track measurable improvement\n\n"
                "To personalize this roadmap:\n"
                "1. What is your current level?\n"
                "2. What timeline are you targeting?"
            )

        if asks_why:
            return (
                f"Great question. For '{query.strip()}', the core reason usually comes from how {topic} balances objective, constraints, and assumptions.\n"
                "A practical way to reason about it:\n"
                "1) Identify the goal,\n"
                "2) Identify what changes the result most,\n"
                "3) Check one case where the rule fails.\n\n"
                "Guiding questions:\n"
                "1. What assumption are you making implicitly?\n"
                "2. What breaks if that assumption fails?"
            )

        if asks_how:
            return (
                f"How to approach {topic} (practical view):\n"
                "- Step 1: define the objective and success metric\n"
                "- Step 2: break the task into smaller steps\n"
                "- Step 3: apply the method with one concrete example\n"
                "- Step 4: review result and improve the weak step\n\n"
                "Guiding questions:\n"
                "1. Which step is unclear for you right now?\n"
                "2. Want me to walk through a small worked example?"
            )

        # Concept-aware responses for common core questions so fallback mode
        # still produces useful mentoring output when no LLM key is configured.
        if concept == "gradient descent" and ("negative gradient" in query_l or "why" in query_l):
            if style == "simple":
                return (
                    "In gradient descent, the gradient points in the direction where loss increases fastest.\n"
                    "So we move in the *negative* gradient direction to make the loss go down.\n"
                    "Update rule: theta <- theta - alpha * grad(J(theta)).\n\n"
                    "Check your understanding:\n"
                    "1. If gradient is positive, should theta increase or decrease?\n"
                    "2. What happens if alpha (learning rate) is too large?\n"
                    "3. Can you picture this as walking downhill on a hill?"
                )

            if style == "deep":
                return (
                    "For differentiable J(theta), grad J(theta) gives steepest ascent under Euclidean norm.\n"
                    "Hence the steepest descent direction is -grad J(theta). A first-order step gives:\n"
                    "J(theta + d) ~ J(theta) + grad J(theta)^T d.\n"
                    "Choosing d = -alpha grad J(theta) yields\n"
                    "J(theta + d) ~ J(theta) - alpha ||grad J(theta)||^2, which decreases for alpha > 0 (locally).\n\n"
                    "Probe this further:\n"
                    "1. Which assumptions make this local decrease argument valid?\n"
                    "2. How does non-convexity change the guarantee?\n"
                    "3. Why do we often normalize or adapt the step size?"
                )

            return (
                "Great question. We use the negative gradient because the gradient points to fastest *increase* in loss,\n"
                "and training needs fastest *decrease*. So each step is:\n"
                "theta_new = theta_old - alpha * grad(J(theta)).\n"
                "Intuitively: gradient is an uphill arrow; putting a minus sign makes you walk downhill.\n\n"
                "Think through these:\n"
                "1. If grad(J)=0, what does that say about the point?\n"
                "2. How does alpha control stability vs speed?\n"
                "3. Why might momentum help compared with plain gradient descent?"
            )

        if concept == "backpropagation" and ("why" in query_l or "how" in query_l):
            return (
                "Backpropagation computes how each weight affects final loss using the chain rule,\n"
                "so updates are not random; they are targeted to reduce error.\n"
                "At each layer, we pass gradients backward and apply:\n"
                "w <- w - alpha * (dL/dw).\n\n"
                "Use this checklist:\n"
                "1. Where does the chain rule appear in one hidden-layer network?\n"
                "2. Why do activation derivatives matter for gradient flow?\n"
                "3. What failure do you get when gradients vanish?"
            )

        if style == "simple":
            return (
                f"Here's a simple explanation of {topic}:\n"
                f"- Start with the core idea behind {topic}.\n"
                "- Work one tiny example end-to-end.\n"
                "- Verify what changes the output most.\n\n"
                "Now reflect:\n"
                "1. Which single step is still unclear?\n"
                "2. Can you restate the idea in one sentence?\n"
                "3. What example would you try next?"
            )

        if style == "deep":
            return (
                f"For a deeper look at {topic}, start from definitions and derive the core relation.\n"
                "Then test assumptions and failure modes, not just the happy path.\n\n"
                "Challenge questions:\n"
                "1. Which theorem or property justifies each step?\n"
                "2. What edge case breaks the derivation?\n"
                "3. How would you modify the method for that edge case?"
            )

        return (
            f"Great question on {topic}. Here is a practical explanation:\n"
            f"- Objective: what {topic} is trying to optimize or explain.\n"
            "- Mechanism: the key step-by-step transformation.\n"
            "- Outcome: how you verify the method worked.\n\n"
            "Use these to self-check:\n"
            "1. What is the objective of this method?\n"
            "2. Which inputs control the output most strongly?\n"
            "3. Can you solve one small example without skipping steps?"
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
