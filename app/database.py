"""
database.py
-----------
Central database configuration and ORM models for the AI Mentor System.

Uses SQLAlchemy with SQLite for development (easily upgradeable to PostgreSQL).
All models are declared here following clean architecture principles.

Models included:
1. Student - Core student record
2. StudentProfile - Extended student profile with learning preferences
3. WeaknessScore - Per-concept weakness tracking
4. Feedback - Human-in-the-loop feedback from student
5. MentorResponse - AI mentor responses to student queries
6. AdaptiveSession - Tracks adaptive learning session context
"""

import os
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Text,
    DateTime, ForeignKey, JSON, Enum, text, Boolean, CheckConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
from dotenv import load_dotenv
from enum import Enum as PyEnum

load_dotenv()

# ── Database Configuration ────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./mentor_ai.db"
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Enums ─────────────────────────────────────────────────────────────────────

class DifficultyLevel(str, PyEnum):
    """Difficulty preference levels for student learning."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class FeedbackType(str, PyEnum):
    """Types of feedback a student can provide."""
    TOO_EASY = "too_easy"
    TOO_HARD = "too_hard"
    UNCLEAR = "unclear"
    HELPFUL = "helpful"


# ── Model 1: Student ──────────────────────────────────────────────────────────

class Student(Base):
    """
    Core student record.
    
    Represents a student user in the system. Primary entity for all
    learning data, profiles, and interactions.
    """
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    profile = relationship("StudentProfile", back_populates="student", uselist=False)
    weakness_scores = relationship("WeaknessScore", back_populates="student")
    feedbacks = relationship("Feedback", back_populates="student")
    mentor_responses = relationship("MentorResponse", back_populates="student")
    adaptive_sessions = relationship("AdaptiveSession", back_populates="student")
    mock_interviews = relationship("MockInterviewSession", back_populates="student")


# ── Model 2: StudentProfile ───────────────────────────────────────────────────

class StudentProfile(Base):
    """
    Extended student profile with learning preferences and metadata.
    
    One-to-one relationship with Student.
    Stores learning preferences, goals, and confidence metrics.
    """
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    
    # Learning profile
    skills = Column(JSON, default=list)  # e.g., ["Python", "Statistics"]
    interests = Column(JSON, default=list)  # e.g., ["ML", "NLP"]
    goals = Column(Text, default="")  # Free-text learning goals
    
    # Learning preferences
    confidence_level = Column(Float, default=0.5)  # 0.0 (low) to 1.0 (high)
    preferred_difficulty = Column(
        Enum(DifficultyLevel),
        default=DifficultyLevel.MEDIUM
    )
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    student = relationship("Student", back_populates="profile")

    @hybrid_property
    def learning_style_summary(self):
        """Generate a summary of learner profile for LLM context."""
        return {
            "confidence": self.confidence_level,
            "preferred_difficulty": self.preferred_difficulty.value,
            "skills": self.skills,
            "interests": self.interests
        }


# ── Model 3: WeaknessScore ───────────────────────────────────────────────────

class WeaknessScore(Base):
    """
    Per-concept weakness tracking for adaptive learning.
    
    Maintains a weakness score (0-1) for each concept the student encounters.
    - 0.0 = strong understanding
    - 1.0 = very weak/struggling
    
    Updated when:
    - Quiz answer is incorrect (increases weakness)
    - Quiz answer is correct (decreases weakness)
    - Feedback indicates confusion (increases weakness)
    """
    __tablename__ = "weakness_scores"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    concept_name = Column(String, nullable=False)  # e.g., "backpropagation"
    weakness_score = Column(Float, default=0.0)  # Range: 0 (strong) to 1 (weak)
    
    # Metadata
    times_seen = Column(Integer, default=0)  # How many times student encountered concept
    times_correct = Column(Integer, default=0)  # How many correct attempts
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('weakness_score >= 0 AND weakness_score <= 1', name='constraint_weakness_range'),
    )

    # Relationship
    student = relationship("Student", back_populates="weakness_scores")

    def update_from_quiz_result(self, is_correct: bool):
        """
        Update weakness score based on quiz result.
        
        Correct answers: reduce weakness by 0.1 (min 0)
        Wrong answers: increase weakness by 0.15 (max 1)
        """
        self.times_seen += 1
        
        if is_correct:
            self.times_correct += 1
            self.weakness_score = max(0.0, self.weakness_score - 0.1)
        else:
            self.weakness_score = min(1.0, self.weakness_score + 0.15)
        
        self.last_updated = datetime.utcnow()


# ── Model 4: Feedback ─────────────────────────────────────────────────────────

class Feedback(Base):
    """
    Human-in-the-loop feedback from student about AI mentor responses.
    
    Captures student reactions to AI responses and drives the adaptive loop.
    Used to adjust difficulty and personalize future responses.
    """
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    response_id = Column(String, nullable=False)  # UUID of the AI response being rated
    
    feedback_type = Column(
        Enum(FeedbackType),
        nullable=False
    )
    
    # Optional context
    comments = Column(Text, nullable=True)  # Student's written feedback
    rating = Column(Float, nullable=True)  # 1-5 satisfaction score
    focus_concept = Column(String, nullable=True)  # What concept was being discussed
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationship
    student = relationship("Student", back_populates="feedbacks")


# ── Model 5: MentorResponse ───────────────────────────────────────────────────

class MentorResponse(Base):
    """
    Stores AI mentor responses for auditing and learning loop.
    
    Each response from the mentor is logged with:
    - Student context at time of response
    - The response content
    - Difficulty level used
    - Explanation style applied
    """
    __tablename__ = "mentor_responses"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(String, unique=True, nullable=False)  # UUID
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    # Student context at time of response
    student_weakness_state = Column(JSON, default=dict)  # Weakness scores snapshot
    student_confidence = Column(Float, nullable=False)
    
    # Response content and style
    query = Column(Text, nullable=False)  # The student's question/query
    response = Column(Text, nullable=False)  # The AI's response
    explanation_style = Column(String)  # "simple" | "conceptual" | "deep"
    target_concept = Column(String)  # Concept the response targets
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationship
    student = relationship("Student", back_populates="mentor_responses")


# ── Model 6: AdaptiveSession ─────────────────────────────────────────────────

class AdaptiveSession(Base):
    """
    Tracks an adaptive learning session.
    
    A session is a collection of interactions (queries, responses, feedback)
    with a single student. Used to maintain context and track adaptation.
    """
    __tablename__ = "adaptive_sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    # Session context
    topic = Column(String, default="general")  # What topic is this session about?
    difficulty_level = Column(String, default="medium")  # Current difficulty
    
    # Session metadata
    interaction_count = Column(Integer, default=0)  # How many Q&A in session?
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Session snapshot for audit trail
    context_snapshot = Column(JSON, default=dict)  # Student state at session start

    # Relationship
    student = relationship("Student", back_populates="adaptive_sessions")


# ── Database Initialization ───────────────────────────────────────────────────

class CareerRoadmap(Base):
    """
    Stores generated career roadmaps keyed by role.

    The GET roadmap endpoint returns the latest generated roadmap for a role.
    """
    __tablename__ = "career_roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False, index=True)
    level = Column(String, nullable=False)
    duration = Column(String, nullable=False)
    roadmap_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MockInterviewSession(Base):
    """
    Stores one complete mock interview attempt including transcript and scoring.

    Transcript is persisted as JSON so playback is deterministic and auditable.
    """
    __tablename__ = "mock_interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    role = Column(String, nullable=False, index=True)
    duration = Column(String, nullable=True)
    level = Column(String, nullable=False)
    interview_type = Column(String, nullable=False, default="mixed")
    question_count = Column(Integer, nullable=False, default=5)
    transcript_json = Column(JSON, default=list, nullable=False)
    overall_score = Column(Float, default=0.0)
    strengths = Column(JSON, default=list, nullable=False)
    improvement_areas = Column(JSON, default=list, nullable=False)
    actionable_tips = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="mock_interviews")


def init_db():
    """
    Initialize database: create all tables and apply schema upgrades.
    
    Safe to call multiple times - only creates tables if they don't exist.
    Also handles schema migrations for existing databases.
    """
    Base.metadata.create_all(bind=engine)
    
    # Schema upgrade: add any missing columns to existing tables
    with engine.connect() as conn:
        # Check and add missing columns to feedback table
        result = conn.execute(text("PRAGMA table_info(feedbacks)"))
        existing_cols = {row[1] for row in result.fetchall()}
        
        missing_cols = [
            ("comments", "TEXT"),
            ("rating", "FLOAT"),
            ("focus_concept", "VARCHAR")
        ]
        
        for col_name, col_type in missing_cols:
            if col_name not in existing_cols:
                conn.execute(text(f"ALTER TABLE feedbacks ADD COLUMN {col_name} {col_type}"))

        # Backward compatibility: if mock interview table exists from an older
        # version, ensure the optional duration column is present.
        mock_cols_result = conn.execute(text("PRAGMA table_info(mock_interview_sessions)"))
        mock_cols = {row[1] for row in mock_cols_result.fetchall()}
        if mock_cols and "duration" not in mock_cols:
            conn.execute(text("ALTER TABLE mock_interview_sessions ADD COLUMN duration VARCHAR"))
        
        conn.commit()


def get_db():
    """
    FastAPI dependency for database session.
    
    Usage:
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
