"""
database.py
-----------
Central database configuration using SQLAlchemy with SQLite.
SQLite is chosen for simplicity and portability (no server needed).
All ORM models are declared here and imported by other modules.
"""

import os
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    DateTime, ForeignKey, Text, JSON, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ── Engine & Session ──────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mentor_ai.db")

# connect_args is SQLite-specific: allows use across threads (needed for FastAPI)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Table 1: Student Profile ──────────────────────────────────────────────────
class StudentProfile(Base):
    """
    Stores a student's background, goals, and current AI-adapted difficulty level.
    The `difficulty_level` (1–5) is the key adaptive parameter — it changes
    automatically based on quiz performance and feedback tags.
    """
    __tablename__ = "student_profiles"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, nullable=False)
    skills          = Column(JSON, default=list)       # e.g. ["Python", "ML"]
    interests       = Column(JSON, default=list)       # e.g. ["NLP", "Robotics"]
    goals           = Column(String, default="")       # free-text learning goal
    confidence      = Column(Float, default=3.0)       # self-rated 1–5
    difficulty_level= Column(Float, default=3.0)       # AI-managed 1–5; default starts at midpoint (3)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    quiz_attempts   = relationship("QuizAttempt",   back_populates="student")
    feedback_logs   = relationship("FeedbackLog",   back_populates="student")
    chat_sessions   = relationship("ChatSession",   back_populates="student")


# ── Table 2: Quiz Attempt ─────────────────────────────────────────────────────
class QuizAttempt(Base):
    """
    Records each answer a student submits.
    `is_correct` and `concept_tag` allow the weakness analyzer to compute
    per-concept weakness scores (e.g., 'loops' weakness = 0.8).
    """
    __tablename__ = "quiz_attempts"

    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("student_profiles.id"))
    question_text   = Column(Text, nullable=False)
    student_answer  = Column(Text, nullable=False)
    correct_answer  = Column(Text, nullable=False)
    is_correct      = Column(Integer, default=0)   # 0=wrong, 1=correct
    concept_tag     = Column(String, default="general")  # e.g. "recursion"
    misconception   = Column(Text, default="")     # filled by AI explainer
    attempted_at    = Column(DateTime, default=datetime.utcnow)

    student         = relationship("StudentProfile", back_populates="quiz_attempts")


# ── Table 3: Feedback Log ─────────────────────────────────────────────────────
class FeedbackLog(Base):
    """
    Human-in-the-Loop core table.
    Every time a student tags an AI response, it's stored here.
    The feedback_tag directly drives difficulty adjustments in the adaptive loop.
    Tags: 'helpful' | 'too_easy' | 'too_hard' | 'unclear'
    
    Additional fields for analytics:
    - rating: student's confidence/satisfaction (1-5 scale)
    - focus_concept: the concept the AI was helping with (e.g., "recursion")
    """
    __tablename__ = "feedback_logs"

    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("student_profiles.id"))
    session_id      = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    ai_response_id  = Column(String, nullable=False)   # unique ID of the AI message
    feedback_tag    = Column(String, nullable=False)   # too_easy | too_hard | unclear | helpful
    rating          = Column(Float, nullable=True)     # 1-5 confidence/satisfaction score
    focus_concept   = Column(String, default="general")  # concept being learned
    submitted_at    = Column(DateTime, default=datetime.utcnow)

    student         = relationship("StudentProfile", back_populates="feedback_logs")



# ── Table 4: Chat Session ─────────────────────────────────────────────────────
class ChatSession(Base):
    """
    Groups messages in a conversation.
    `context_snapshot` stores the student's difficulty + weakness at session start
    so we can later audit how the AI adapted during the session.
    """
    __tablename__ = "chat_sessions"

    id                  = Column(Integer, primary_key=True, index=True)
    student_id          = Column(Integer, ForeignKey("student_profiles.id"))
    topic               = Column(String, default="general")
    context_snapshot    = Column(JSON, default=dict)   # difficulty, top weaknesses at start
    messages            = Column(JSON, default=list)   # [{role, content, msg_id, ts}]
    created_at          = Column(DateTime, default=datetime.utcnow)

    student             = relationship("StudentProfile", back_populates="chat_sessions")


# ── Table 5: Weakness Score ───────────────────────────────────────────────────
class WeaknessScore(Base):
    """
    Per-student, per-concept weakness score (0.0 = strong, 1.0 = very weak).
    Recomputed by the WeaknessAnalyzer service after every quiz attempt.
    Used by the Mentor AI to prioritize which concepts to address first.
    """
    __tablename__ = "weakness_scores"

    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("student_profiles.id"))
    concept         = Column(String, nullable=False)   # e.g. "recursion"
    score           = Column(Float, default=0.0)       # 0=strong, 1=very weak
    attempts        = Column(Integer, default=0)
    last_updated    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Student helper utilities ───────────────────────────────────────────────────

def create_student(
    name: str,
    email: str,
    difficulty_level: float = 3.0,
    **kwargs
) -> StudentProfile:
    """
    Create a new student record if one does not already exist.

    - `email` is treated as a unique key; attempting to insert a duplicate
      will return the existing instance instead of raising an error.
    - Difficulty level defaults to 3.0 when not provided.
    - Additional fields may be passed via ``kwargs`` (skills, interests, etc.).

    Returns the ``StudentProfile`` instance for the given email.

    Usage example:
    ```python
    from app.store import create_student, SessionLocal

    student = create_student(
        name="Arjun Sharma",
        email="arjun@example.com",
        skills=["Python"],
        interests=["NLP"],
        goals="Learn ML",
    )
    print(student.id, student.difficulty_level)
    ```
    """
    db = SessionLocal()
    try:
        # check existence by unique email
        existing = db.query(StudentProfile).filter(StudentProfile.email == email).first()
        if existing:
            return existing

        new_student = StudentProfile(
            name=name,
            email=email,
            difficulty_level=difficulty_level,
            **kwargs
        )
        db.add(new_student)
        db.commit()
        db.refresh(new_student)  # populate autogenerated fields
        return new_student
    finally:
        db.close()


# ── Create all tables ─────────────────────────────────────────────────────────
def init_db():
    """Call this at startup to create all tables if they don't exist.

    SQLite's ``create_all`` will NOT alter existing tables, so after the
    initial creation we run a lightweight upgrade routine to add any new
    columns required by updated models (rating/focus_concept on feedback_logs).
    This keeps the development database in sync without full migrations.
    """
    Base.metadata.create_all(bind=engine)

    # ensure any new columns exist for feedback_logs
    with engine.connect() as conn:
        # query existing columns using text() for SQLAlchemy 2.0+
        result = conn.execute(text("PRAGMA table_info(feedback_logs)"))
        existing = {row[1] for row in result.fetchall()}  # second column is name

        # list of (column, type, default)
        extras = [
            ("rating", "FLOAT", None),
            ("focus_concept", "VARCHAR", "'general'")
        ]
        for col, coltype, default in extras:
            if col not in existing:
                sql = f"ALTER TABLE feedback_logs ADD COLUMN {col} {coltype}"
                if default is not None:
                    sql += f" DEFAULT {default}"
                conn.execute(text(sql))
        
        conn.commit()  # commit the schema changes


# ── Dependency for FastAPI routes ─────────────────────────────────────────────
def get_db():
    """
    FastAPI dependency injection pattern.
    Yields a DB session, then closes it after the request is done.
    Usage in routes: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()