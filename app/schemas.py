"""
schemas.py
----------
Canonical Pydantic contracts for the current FastAPI backend.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class DifficultyLevelEnum(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class FeedbackTypeEnum(str, Enum):
    TOO_EASY = "too_easy"
    TOO_HARD = "too_hard"
    UNCLEAR = "unclear"
    HELPFUL = "helpful"


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class StudentResponse(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileCreate(BaseModel):
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    goals: str = Field(default="", max_length=2000)
    confidence_level: float = Field(default=0.5, ge=0.0, le=1.0)
    preferred_difficulty: DifficultyLevelEnum = DifficultyLevelEnum.MEDIUM

    @field_validator("skills", "interests", mode="before")
    @classmethod
    def normalize_lists(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            parts = [item.strip() for item in value.split(",")]
            return [item for item in parts if item]
        return value


class ProfileUpdate(BaseModel):
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    goals: Optional[str] = Field(None, max_length=2000)
    confidence_level: Optional[float] = Field(None, ge=0.0, le=1.0)
    preferred_difficulty: Optional[DifficultyLevelEnum] = None

    @field_validator("skills", "interests", mode="before")
    @classmethod
    def normalize_optional_lists(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            parts = [item.strip() for item in value.split(",")]
            return [item for item in parts if item]
        return value


class ProfileResponse(BaseModel):
    id: int
    student_id: int
    skills: List[str]
    interests: List[str]
    goals: str
    confidence_level: float
    preferred_difficulty: DifficultyLevelEnum
    created_at: datetime
    updated_at: datetime
    student_name: Optional[str] = None
    student_email: Optional[str] = None

    class Config:
        from_attributes = True


class QuizAnswerSubmit(BaseModel):
    student_id: int
    concept_name: str = Field(..., min_length=1, max_length=255)
    is_correct: bool
    student_answer: str = ""
    correct_answer: str = ""
    explanation: Optional[str] = None


class WeaknessAnalysisResult(BaseModel):
    concept_name: str
    is_correct: bool
    old_weakness_score: float
    new_weakness_score: float
    misconception_detected: Optional[str] = None
    learning_priority: str


class MentorQueryRequest(BaseModel):
    student_id: int
    query: str = Field(..., min_length=1, max_length=2000)
    focus_concept: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class MentorResponseData(BaseModel):
    response_id: str
    response: str
    explanation_style: str
    target_concept: str
    follow_up_question: Optional[str] = None


class FeedbackSubmit(BaseModel):
    student_id: int
    response_id: str = Field(..., min_length=1)
    feedback_type: FeedbackTypeEnum
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    comments: Optional[str] = Field(None, max_length=1000)
    focus_concept: Optional[str] = Field(default=None, max_length=255)


class AdaptationUpdate(BaseModel):
    previous_difficulty: str
    new_difficulty: str
    adjustment_reason: str
    confidence_change: float


class FeedbackResponse(BaseModel):
    student_id: int
    feedback_id: int
    response_id: str
    feedback_type: FeedbackTypeEnum
    rating: Optional[float] = None
    focus_concept: Optional[str] = None
    adaptation_made: bool
    adaptation_details: Optional[Dict[str, Any]] = None
    submitted_at: datetime


class SessionCreate(BaseModel):
    student_id: int
    topic: str = Field(default="general", max_length=255)
    difficulty_level: DifficultyLevelEnum = DifficultyLevelEnum.MEDIUM


class SessionResponse(BaseModel):
    id: int
    student_id: int
    topic: str
    difficulty_level: str
    interaction_count: int
    created_at: datetime
    updated_at: datetime
    context_snapshot: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class StudentContextSnapshot(BaseModel):
    confidence_level: float
    primary_weakness_concepts: List[str]
    strength_areas: List[str]
    preferred_difficulty: str
    recent_feedback_sentiment: str


class ExplainMistakeRequest(BaseModel):
    student_id: int
    concept: str = Field(..., min_length=1, max_length=255)
    student_answer: str = Field(..., min_length=1)
    correct_answer: str = Field(..., min_length=1)
    question: Optional[str] = None


class MistakeExplanation(BaseModel):
    student_id: int
    concept: str
    misconception_identified: str
    why_wrong: str
    correct_explanation: str
    learning_tips: List[str]
    related_concept: str
    guiding_question: str


# Legacy compatibility models for optional legacy routes.
FeedbackTag = Literal["helpful", "too_easy", "too_hard", "unclear"]


class ChatRequest(BaseModel):
    student_id: int
    session_id: Optional[int] = None
    message: str
    topic: str = "general"


class ChatResponse(BaseModel):
    session_id: int
    message_id: str
    response: str
    difficulty_used: float
    focus_concept: str


class FeedbackResult(BaseModel):
    message: str
    old_difficulty: str
    new_difficulty: str
    adjustment_reason: str


class StudentProgressReport(BaseModel):
    student_id: int
    total_interactions: int
    average_confidence: float
    weakest_concepts: List[str]
    strongest_concepts: List[str]
    feedback_sentiment_trend: str
    recommended_next_topics: List[str]


class ConceptStrengthMetric(BaseModel):
    concept: str
    weakness_score: float
    proficiency_level: str
    recommendation: str
