"""
models/schemas.py
-----------------
Pydantic schemas for request validation and response serialization.
These are SEPARATE from SQLAlchemy ORM models — Pydantic handles the
HTTP layer (what goes in/out of the API), SQLAlchemy handles the DB layer.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal
from datetime import datetime


# ── Student Profile ───────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    """Used when registering a new student."""
    name:       str
    email:      str                          # EmailStr needs email-validator pkg
    skills:     List[str]   = []
    interests:  List[str]   = []
    goals:      str         = ""
    confidence: float       = Field(3.0, ge=1.0, le=5.0)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Arjun Sharma",
                "email": "arjun@example.com",
                "skills": ["Python", "basic ML"],
                "interests": ["NLP", "Computer Vision"],
                "goals": "Build an end-to-end ML project for final year",
                "confidence": 3.0
            }
        }


class StudentUpdate(BaseModel):
    """Partial updates — all fields optional."""
    skills:         Optional[List[str]]     = None
    interests:      Optional[List[str]]     = None
    goals:          Optional[str]           = None
    confidence:     Optional[float]         = Field(None, ge=1.0, le=5.0)
    difficulty_level: Optional[float]       = Field(None, ge=1.0, le=5.0)


class StudentResponse(BaseModel):
    """What the API returns when querying a student."""
    id:               int
    name:             str
    email:            str
    skills:           List[str]
    interests:        List[str]
    goals:            str
    confidence:       float
    difficulty_level: float
    created_at:       datetime

    class Config:
        from_attributes = True   # allows building from SQLAlchemy ORM objects


# ── Quiz ──────────────────────────────────────────────────────────────────────

class QuizSubmit(BaseModel):
    """Student submits an answer to a question."""
    student_id:     int
    question_text:  str
    student_answer: str
    correct_answer: str
    concept_tag:    str = "general"

    class Config:
        json_schema_extra = {
            "example": {
                "student_id": 1,
                "question_text": "What is the base case in recursion?",
                "student_answer": "The loop that runs forever",
                "correct_answer": "The condition that stops the recursive calls",
                "concept_tag": "recursion"
            }
        }


class QuizResult(BaseModel):
    """Returned after evaluating a quiz answer."""
    attempt_id:     int
    is_correct:     bool
    concept_tag:    str
    misconception:  str         # AI-generated explanation of what went wrong
    explanation:    str         # Socratic follow-up or correction
    weakness_score: float       # Updated weakness score for this concept (0–1)


# ── Chat / Mentor ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Student sends a message to the Mentor AI."""
    student_id: int
    session_id: Optional[int]   = None   # None = start new session
    message:    str
    topic:      str             = "general"

    class Config:
        json_schema_extra = {
            "example": {
                "student_id": 1,
                "session_id": None,
                "message": "I don't understand how backpropagation works",
                "topic": "neural_networks"
            }
        }


class ChatResponse(BaseModel):
    """AI mentor reply."""
    session_id:     int
    message_id:     str          # UUID — used when submitting feedback
    response:       str          # AI's Socratic/adaptive reply
    difficulty_used: float       # What difficulty level the AI used
    focus_concept:  str          # Which weak concept the AI is targeting


# ── Feedback ──────────────────────────────────────────────────────────────────

# Strict literal type — only these 4 tags are valid
FeedbackTag = Literal["helpful", "too_easy", "too_hard", "unclear"]

class FeedbackSubmit(BaseModel):
    """Student tags an AI response after reading it."""
    student_id:     int
    session_id:     Optional[int] = None
    ai_response_id: str           # message_id from ChatResponse
    feedback_tag:   FeedbackTag
    rating:         Optional[float] = None  # 1-5 confidence/satisfaction score
    focus_concept:  str = "general"  # concept being learned

    class Config:
        json_schema_extra = {
            "example": {
                "student_id": 1,
                "session_id": 3,
                "ai_response_id": "uuid-abc-123",
                "feedback_tag": "too_hard",
                "rating": 3.5,
                "focus_concept": "backpropagation"
            }
        }


class FeedbackResult(BaseModel):
    """Returned after processing feedback — shows how difficulty changed."""
    message:            str
    old_difficulty:     float
    new_difficulty:     float
    adjustment_reason:  str


# ── Weakness ──────────────────────────────────────────────────────────────────

class WeaknessReport(BaseModel):
    """Summary of a student's weak concepts."""
    student_id:     int
    weaknesses:     List[dict]   # [{concept, score, attempts}] sorted worst-first
    top_weak_concept: str