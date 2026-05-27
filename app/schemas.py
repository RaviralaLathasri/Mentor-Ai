"""
schemas.py
----------
Canonical Pydantic contracts for the current FastAPI backend.
"""

from datetime import datetime
from enum import Enum
import re
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


class QuizQuestionResponse(BaseModel):
    question_id: str
    concept_name: str
    question: str
    reference_answer: str
    keywords: List[str] = Field(default_factory=list)


class QuizAttemptSubmit(BaseModel):
    student_id: int
    question_id: Optional[str] = None
    concept_name: str = Field(..., min_length=1, max_length=255)
    question: str = Field(..., min_length=1, max_length=2000)
    student_answer: str = Field(..., min_length=1, max_length=4000)
    reference_answer: str = Field(..., min_length=1, max_length=4000)
    keywords: List[str] = Field(default_factory=list)


class ResumeSectionAnalysis(BaseModel):
    section_name: str
    score: float = Field(..., ge=0.0, le=1.0)
    findings: List[str] = Field(default_factory=list)
    mentoring_questions: List[str] = Field(default_factory=list)


class ResumeIssue(BaseModel):
    issue_type: str
    severity: Literal["low", "medium", "high"]
    section_name: str
    evidence: str
    mentoring_question: str


class ResumeMentorResponse(BaseModel):
    file_name: str
    overall_assessment: str
    resume_score: int = Field(0, ge=0, le=100)
    detected_keywords: List[str] = Field(default_factory=list)
    missing_keywords: List[str] = Field(default_factory=list)
    detected_sections: List[str] = Field(default_factory=list)
    missing_sections: List[str] = Field(default_factory=list)
    improvement_suggestions: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    issues: List[ResumeIssue] = Field(default_factory=list)
    section_analysis: List[ResumeSectionAnalysis] = Field(default_factory=list)
    mentoring_advice: List[str] = Field(default_factory=list)


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


class StudyPlanRequest(BaseModel):
    student_id: int
    weeks: int = Field(default=2, ge=1, le=8)
    days_per_week: int = Field(default=5, ge=3, le=7)
    daily_minutes: int = Field(default=60, ge=30, le=240)


class StudyPlanDay(BaseModel):
    day_number: int
    focus_concept: str
    objective: str
    activities: List[str] = Field(default_factory=list)
    estimated_minutes: int


class StudyPlanWeek(BaseModel):
    week_number: int
    weekly_focus: str
    goal_alignment: str
    days: List[StudyPlanDay] = Field(default_factory=list)


class StudyPlanResponse(BaseModel):
    student_id: int
    goals: str
    confidence_level: float
    preferred_difficulty: str
    weeks: int
    days_per_week: int
    daily_minutes: int
    key_weaknesses: List[Dict[str, Any]] = Field(default_factory=list)
    weekly_roadmap: List[StudyPlanWeek] = Field(default_factory=list)
    guidance: List[str] = Field(default_factory=list)


class CareerLevelEnum(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


class CareerRoadmapGenerateRequest(BaseModel):
    role: str = Field(..., min_length=2, max_length=100)
    duration: str = Field(..., min_length=3, max_length=30)
    level: CareerLevelEnum

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("duration")
    @classmethod
    def validate_duration(cls, value: str) -> str:
        text = " ".join((value or "").lower().split())
        match = re.match(r"^(\d+)\s*(week|weeks|month|months)$", text)
        if not match:
            raise ValueError("Duration must be like '12 weeks' or '6 months'")

        amount = int(match.group(1))
        if amount <= 0:
            raise ValueError("Duration must be greater than zero")

        unit = match.group(2)
        if unit.startswith("week") and amount > 104:
            raise ValueError("Weeks duration is too large (max 104)")
        if unit.startswith("month") and amount > 24:
            raise ValueError("Months duration is too large (max 24)")

        normalized_unit = "weeks" if unit.startswith("week") else "months"
        return f"{amount} {normalized_unit}"


class CareerRoadmapPhase(BaseModel):
    phase_title: str
    duration_label: str
    learning_goals: List[str] = Field(default_factory=list)
    milestones: List[str] = Field(default_factory=list)


class CareerRoadmapResource(BaseModel):
    title: str
    platform: str
    link: str
    description: str


class CareerRoadmapProjects(BaseModel):
    beginner: List[str] = Field(default_factory=list)
    intermediate: List[str] = Field(default_factory=list)
    advanced: List[str] = Field(default_factory=list)


class CareerRoadmapInterviewPrep(BaseModel):
    important_topics: List[str] = Field(default_factory=list)
    practice_platforms: List[str] = Field(default_factory=list)
    sample_questions: List[str] = Field(default_factory=list)


class CareerRoadmapResponse(BaseModel):
    role: str
    level: CareerLevelEnum
    duration: str
    timeline: List[CareerRoadmapPhase] = Field(default_factory=list)
    skills_to_master: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    courses: List[CareerRoadmapResource] = Field(default_factory=list)
    youtube_resources: List[CareerRoadmapResource] = Field(default_factory=list)
    documentation: List[CareerRoadmapResource] = Field(default_factory=list)
    projects: CareerRoadmapProjects
    certifications: List[str] = Field(default_factory=list)
    interview_preparation: CareerRoadmapInterviewPrep
    portfolio_tips: List[str] = Field(default_factory=list)
    career_advice: List[str] = Field(default_factory=list)


class InterviewTypeEnum(str, Enum):
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    MIXED = "mixed"


class MockInterviewRequest(BaseModel):
    student_id: int
    role: str = Field(..., min_length=2, max_length=100)
    duration: Optional[str] = Field(default=None, max_length=30)
    level: CareerLevelEnum = CareerLevelEnum.BEGINNER
    interview_type: InterviewTypeEnum = InterviewTypeEnum.MIXED
    question_count: int = Field(default=5, ge=3, le=10)
    focus_topics: List[str] = Field(default_factory=list)
    candidate_summary: Optional[str] = Field(default=None, max_length=1000)
    answers: List[str] = Field(default_factory=list)

    @field_validator("role")
    @classmethod
    def normalize_role_for_interview(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("answers", mode="before")
    @classmethod
    def normalize_answers(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        return value


class MockInterviewTurn(BaseModel):
    question_number: int
    question_type: InterviewTypeEnum
    question: str
    focus_area: str
    candidate_answer: str
    score: float = Field(..., ge=0.0, le=100.0)
    feedback: str
    ideal_answer: str


class MockInterviewResponse(BaseModel):
    session_id: str
    student_id: int
    role: str
    level: CareerLevelEnum
    duration: Optional[str] = None
    interview_type: InterviewTypeEnum
    question_count: int
    overall_score: float = Field(..., ge=0.0, le=100.0)
    transcript: List[MockInterviewTurn] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    improvement_areas: List[str] = Field(default_factory=list)
    actionable_tips: List[str] = Field(default_factory=list)
    playback: Dict[str, str] = Field(default_factory=dict)
    created_at: datetime


class MockInterviewHistoryItem(BaseModel):
    session_id: str
    role: str
    level: CareerLevelEnum
    interview_type: InterviewTypeEnum
    overall_score: float = Field(..., ge=0.0, le=100.0)
    question_count: int
    created_at: datetime


class MockInterviewHistoryResponse(BaseModel):
    student_id: int
    sessions: List[MockInterviewHistoryItem] = Field(default_factory=list)


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
