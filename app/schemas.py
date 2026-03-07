"""
schemas.py
----------
Pydantic models for request/response validation and serialization.

Organized by feature:
- Student & Profile schemas
- Weakness analysis schemas
- Mentor AI schemas
- Feedback schemas
- Adaptive learning schemas
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ════════════════════════════════════════════════════════════════════════════════
# ENUMS
# ════════════════════════════════════════════════════════════════════════════════

class DifficultyLevelEnum(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class FeedbackTypeEnum(str, Enum):
    TOO_EASY = "too_easy"
    TOO_HARD = "too_hard"
    UNCLEAR = "unclear"
    HELPFUL = "helpful"


# ════════════════════════════════════════════════════════════════════════════════
# STUDENT & PROFILE SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class StudentCreate(BaseModel):
    """Create a new student."""
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class StudentUpdate(BaseModel):
    """Update student basic info."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class StudentResponse(BaseModel):
    """Student data returned from API."""
    id: int
    name: str
    email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileCreate(BaseModel):
    """Create or initialize student profile."""
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    goals: str = Field(default="", max_length=1000)
    confidence_level: float = Field(default=0.5, ge=0.0, le=1.0)
    preferred_difficulty: DifficultyLevelEnum = DifficultyLevelEnum.MEDIUM

    @field_validator("skills", "interests", mode="before")
    @classmethod
    def convert_to_list(cls, v):
        if isinstance(v, str):
            return [v]
        return v or []


class ProfileUpdate(BaseModel):
    """Update student profile."""
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    goals: Optional[str] = Field(None, max_length=1000)
    confidence_level: Optional[float] = Field(None, ge=0.0, le=1.0)
    preferred_difficulty: Optional[DifficultyLevelEnum] = None


class ProfileResponse(BaseModel):
    """Student profile returned from API."""
    id: int
    student_id: int
    skills: List[str]
    interests: List[str]
    goals: str
    confidence_level: float
    preferred_difficulty: DifficultyLevelEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════════════════════════════════
# WEAKNESS & ANALYSIS SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class WeaknessScoreResponse(BaseModel):
    """Weakness score for a single concept."""
    concept_name: str
    weakness_score: float = Field(..., ge=0.0, le=1.0)
    times_seen: int
    times_correct: int
    last_updated: datetime

    class Config:
        from_attributes = True


class QuizAnswerSubmit(BaseModel):
    """Student submits a quiz answer for weakness analysis."""
    concept_name: str = Field(..., min_length=1)
    is_correct: bool
    student_answer: str
    correct_answer: str
    explanation: Optional[str] = None


class WeaknessAnalysisResult(BaseModel):
    """Result of weakness analysis after quiz submission."""
    concept_name: str
    is_correct: bool
    old_weakness_score: float
    new_weakness_score: float
    misconception_detected: Optional[str] = None
    learning_priority: str  # "critical" | "high" | "medium" | "low"


# ════════════════════════════════════════════════════════════════════════════════
# MENTOR AI SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class MentorQueryRequest(BaseModel):
    """Student asks mentor a question."""
    student_id: int  # Student identifier
    query: str = Field(..., min_length=1, max_length=2000)
    focus_concept: Optional[str] = None  # What concept is this about?
    context: Optional[Dict[str, Any]] = None  # Additional context


class MentorResponseData(BaseModel):
    """Mentor response to student query."""
    response_id: str  # UUID for feedback tracking
    response: str  # The actual response
    explanation_style: str  # "simple" | "conceptual" | "deep"
    target_concept: str  # Concept being explained
    follow_up_question: Optional[str] = None  # Socratic follow-up


# ════════════════════════════════════════════════════════════════════════════════
# FEEDBACK SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class FeedbackSubmit(BaseModel):
    """Student provides feedback on mentor response."""
    response_id: str  # UUID of the response being rated
    feedback_type: FeedbackTypeEnum
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    comments: Optional[str] = Field(None, max_length=500)
    focus_concept: Optional[str] = None


class FeedbackResponse(BaseModel):
    """Feedback record returned from API."""
    id: int
    student_id: int
    response_id: str
    feedback_type: str
    rating: Optional[float]
    comments: Optional[str]
    focus_concept: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AdaptationUpdate(BaseModel):
    """Result of adaptation after feedback."""
    previous_difficulty: str
    new_difficulty: str
    adjustment_reason: str
    confidence_change: float


# ════════════════════════════════════════════════════════════════════════════════
# ADAPTIVE LEARNING SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class SessionCreate(BaseModel):
    """Create adaptive learning session."""
    topic: str = Field(default="general", max_length=255)
    difficulty_level: DifficultyLevelEnum = DifficultyLevelEnum.MEDIUM


class SessionResponse(BaseModel):
    """Adaptive session returned from API."""
    id: int
    student_id: int
    topic: str
    difficulty_level: str
    interaction_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentContextSnapshot(BaseModel):
    """Snapshot of student learning context."""
    confidence_level: float
    primary_weakness_concepts: List[str]
    strength_areas: List[str]
    preferred_difficulty: str
    recent_feedback_sentiment: str  # "positive" | "neutral" | "negative"


# ════════════════════════════════════════════════════════════════════════════════
# EXPLAIN MISTAKE SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class ExplainMistakeRequest(BaseModel):
    """Request explanation for a wrong answer."""
    concept_name: str
    student_answer: str
    correct_answer: str
    context: Optional[str] = None


class MistakeExplanation(BaseModel):
    """Detailed explanation of student's mistake."""
    misconception_identified: str  # What the student likely believes
    why_wrong: str  # Why the student answer is incorrect
    correct_explanation: str  # What's actually correct
    learning_opportunity: str  # Key insight to prevent future mistakes
    guiding_question: str  # Socratic follow-up question


# ════════════════════════════════════════════════════════════════════════════════
# ANALYTICS & REPORTING SCHEMAS
# ════════════════════════════════════════════════════════════════════════════════

class StudentProgressReport(BaseModel):
    """Overall progress report for a student."""
    student_id: int
    total_interactions: int
    average_confidence: float
    weakest_concepts: List[str]
    strongest_concepts: List[str]
    feedback_sentiment_trend: str
    recommended_next_topics: List[str]


class ConceptStrengthMetric(BaseModel):
    """Strength/weakness of a concept."""
    concept: str
    weakness_score: float
    proficiency_level: str  # "struggling" | "developing" | "proficient" | "expert"
    recommendation: str
