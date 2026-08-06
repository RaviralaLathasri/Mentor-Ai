import os
import json
import logging
import re
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db, User, PomodoroSession, ActiveRecallCard, WeaknessScore
from app.utils.auth import get_current_user
from app.utils.openai_client import get_openai_client

router = APIRouter(prefix="/api/focus", tags=["Socratic Focus & Active Recall"])
logger = logging.getLogger(__name__)

# ── Pydantic Request/Response Schemas ─────────────────────────────────────────

class PomodoroLogRequest(BaseModel):
    focus_concept: Optional[str] = ""
    completed: bool = False
    summary: Optional[str] = ""

class PomodoroStatsResponse(BaseModel):
    total_focus_minutes: int
    completed_sessions_count: int
    streak_days: int
    sessions: List[dict]

class RecallCardResponse(BaseModel):
    id: int
    concept: str
    question: str
    ideal_answer: str
    next_review: datetime
    repetitions: int

class RecallReviewRequest(BaseModel):
    student_answer: str

class RecallReviewResponse(BaseModel):
    score: int
    feedback: str
    ideal_explanation: str
    next_review: datetime
    interval_days: int

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/pomodoro", response_model=dict)
def log_pomodoro_session(
    payload: PomodoroLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Log a completed Pomodoro session and get Socratic feedback on the break summary.
    """
    mentor_feedback = ""
    if payload.summary and payload.summary.strip():
        try:
            client = get_openai_client()
            model_name = os.getenv("OPENAI_API_MODEL") or "gpt-4o-mini"
            
            prompt = (
                f"The student just finished a 25-minute Pomodoro study block on the concept: '{payload.focus_concept}'.\n"
                f"They provided this summary of what they learned/studied during the session:\n"
                f"\"\"\"\n{payload.summary}\n\"\"\"\n\n"
                f"Evaluate their summary as Socrates, their learning guide. In a conversational, encouraging, and brief manner (max 4-5 sentences):\n"
                f"1. Acknowledge what they correctly highlighted.\n"
                f"2. Gently nudge them on any missing details or potential misunderstandings.\n"
                f"3. Leave them with one quick, reflective Socratic question to think about during their break."
            )
            
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are Socrates, a helpful and insightful study mentor. Speak directly to the student in a warm, encouraging tone."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=250
            )
            mentor_feedback = response.choices[0].message.content.strip()
        except Exception as e:
            logger.exception("Failed to get Pomodoro summary feedback from LLM")
            mentor_feedback = "Great job finishing your study block! Keep reflecting on your core concepts during the break."

    session = PomodoroSession(
        user_id=current_user.id,
        focus_concept=payload.focus_concept or "General Study",
        completed=payload.completed,
        summary=payload.summary or "",
        mentor_feedback=mentor_feedback,
        created_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "status": "success",
        "session_id": session.id,
        "mentor_feedback": mentor_feedback
    }

@router.get("/pomodoro/stats", response_model=PomodoroStatsResponse)
def get_pomodoro_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get study stats including streak metrics and historical sessions.
    """
    sessions = db.query(PomodoroSession).filter(PomodoroSession.user_id == current_user.id).order_by(desc(PomodoroSession.created_at)).all()
    
    completed_sessions = [s for s in sessions if s.completed]
    total_minutes = len(completed_sessions) * 25

    # Calculate streak (consecutive days of completed sessions)
    streak = 0
    if completed_sessions:
        unique_dates = sorted(list({s.created_at.date() for s in completed_sessions}), reverse=True)
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        # Check if the streak is active (completed today or yesterday)
        if unique_dates[0] in (today, yesterday):
            streak = 1
            for i in range(1, len(unique_dates)):
                if unique_dates[i-1] - unique_dates[i] == timedelta(days=1):
                    streak += 1
                else:
                    break
        else:
            streak = 0

    serialized_sessions = [
        {
            "id": s.id,
            "focus_concept": s.focus_concept,
            "completed": s.completed,
            "summary": s.summary,
            "mentor_feedback": s.mentor_feedback,
            "created_at": s.created_at
        }
        for s in sessions[:15]
    ]

    return PomodoroStatsResponse(
        total_focus_minutes=total_minutes,
        completed_sessions_count=len(completed_sessions),
        streak_days=streak,
        sessions=serialized_sessions
    )

@router.get("/recall/cards", response_model=List[RecallCardResponse])
def get_due_recall_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get active recall cards that are due for review.
    """
    now = datetime.utcnow()
    cards = db.query(ActiveRecallCard).filter(
        ActiveRecallCard.user_id == current_user.id,
        ActiveRecallCard.next_review <= now
    ).order_by(ActiveRecallCard.next_review).all()
    
    # Fallback: if no cards are due, return up to 5 cards due soonest
    if not cards:
        cards = db.query(ActiveRecallCard).filter(
            ActiveRecallCard.user_id == current_user.id
        ).order_by(ActiveRecallCard.next_review).limit(5).all()

    return [
        RecallCardResponse(
            id=c.id,
            concept=c.concept,
            question=c.question,
            ideal_answer=c.ideal_answer,
            next_review=c.next_review,
            repetitions=c.repetitions
        )
        for c in cards
    ]

@router.post("/recall/cards/{card_id}/review", response_model=RecallReviewResponse)
def review_recall_card(
    card_id: int,
    payload: RecallReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Grade a student recall response, generate Socratic feedback, and update spacing parameters (SM-2).
    """
    card = db.query(ActiveRecallCard).filter(
        ActiveRecallCard.id == card_id,
        ActiveRecallCard.user_id == current_user.id
    ).first()

    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    score = 3
    feedback = "Good effort! Take time to compare with the reference definition."
    ideal_explanation = card.ideal_answer

    try:
        client = get_openai_client()
        model_name = os.getenv("OPENAI_API_MODEL") or "gpt-4o-mini"
        
        prompt = (
            f"Active Recall Evaluation.\n"
            f"Concept: '{card.concept}'\n"
            f"Question/Prompt: '{card.question}'\n"
            f"Reference Ideal Answer: '{card.ideal_answer}'\n"
            f"Student's Recall Response: '{payload.student_answer}'\n\n"
            f"Grade their recall response on a scale of 0 to 5:\n"
            f"- 5: Perfect, clear, has complete conceptual understanding.\n"
            f"- 4: Very good, covers almost everything with minor phrasing details missing.\n"
            f"- 3: Good/Fair, captures the main gist but vague on details.\n"
            f"- 2: Incorrect, contains major conceptual errors or missing information.\n"
            f"- 1: Very poor, barely related to the ideal explanation.\n"
            f"- 0: Empty response or complete nonsense.\n\n"
            f"Respond ONLY with a valid JSON object matching this schema. Do not output markdown wraps or quotes:\n"
            f"{{\n"
            f"  \"score\": int,\n"
            f"  \"feedback\": \"Socratic feedback speaking to the student, highlighting what they missed, and asking a quick prompt question.\",\n"
            f"  \"ideal_explanation\": \"A concise, clear definition of the concept for their learning.\"\n"
            f"}}"
        )
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are Socrates, a supportive conceptual learning grader. Your responses must be strict JSON containing score, feedback, and ideal_explanation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300
        )
        raw_text = response.choices[0].message.content.strip()
        
        # Clean markdown wrappers if any
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\n", "", raw_text)
            raw_text = re.sub(r"\n```$", "", raw_text)
            raw_text = raw_text.strip()
            
        data = json.loads(raw_text)
        score = int(data.get("score", 3))
        feedback = data.get("feedback", feedback)
        ideal_explanation = data.get("ideal_explanation", ideal_explanation)
    except Exception as e:
        logger.exception("Failed to grade recall attempt. Using fallbacks.")
        # Simple heuristic fallback if JSON parse fails
        if len(payload.student_answer.strip()) < 10:
            score = 1

    # Apply SuperMemo-2 Spaced Repetition Algorithm
    q = score
    if q >= 3:
        if card.repetitions == 0:
            card.interval_days = 1
        elif card.repetitions == 1:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round(card.interval_days * card.ease_factor))
        card.repetitions += 1
    else:
        card.repetitions = 0
        card.interval_days = 1

    # Update ease factor
    card.ease_factor = card.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if card.ease_factor < 1.3:
        card.ease_factor = 1.3

    card.last_reviewed = datetime.utcnow()
    card.next_review = datetime.utcnow() + timedelta(days=card.interval_days)
    
    db.commit()
    db.refresh(card)

    return RecallReviewResponse(
        score=score,
        feedback=feedback,
        ideal_explanation=ideal_explanation,
        next_review=card.next_review,
        interval_days=card.interval_days
    )

@router.post("/recall/cards/generate", response_model=dict)
def generate_recall_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Look up user's weakest concepts (highest weakness scores) and auto-generate 3-5 recall flashcards.
    """
    weak_concepts = db.query(WeaknessScore).filter(
        WeaknessScore.student_id == current_user.id
    ).order_by(desc(WeaknessScore.weakness_score)).limit(5).all()

    concepts_list = [w.concept_name for w in weak_concepts]
    
    # If they have no recorded weaknesses, fallback to skills/interests from profile
    if not concepts_list and current_user.profile:
        concepts_list = current_user.profile.skills[:3] + current_user.profile.interests[:2]

    # Defaults if still empty
    if not concepts_list:
        concepts_list = ["Machine Learning", "Python Programming", "Data Structures"]

    concepts_str = ", ".join(concepts_list)
    cards_created = 0

    try:
        client = get_openai_client()
        model_name = os.getenv("OPENAI_API_MODEL") or "gpt-4o-mini"
        
        prompt = (
            f"Generate active recall flashcards for the following topics: {concepts_str}.\n"
            f"For each topic, provide one clear review question and the ideal answer explanation.\n\n"
            f"Respond ONLY with a valid JSON array of objects, matching this schema. Do not wrap in markdown or quotes:\n"
            f"[\n"
            f"  {{\n"
            f"    \"concept\": \"Name of the concept\",\n"
            f"    \"question\": \"An active recall question testing the fundamental principle. E.g. 'How does gradient descent use the learning rate to update weights?'\",\n"
            f"    \"ideal_answer\": \"The ideal, concise, textbook definition/explanation of the concept.\"\n"
            f"  }}\n"
            f"]"
        )
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a learning content designer. Generate high quality flashcards. Output raw JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=600
        )
        raw_text = response.choices[0].message.content.strip()
        
        # Clean markdown wraps if any
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\n", "", raw_text)
            raw_text = re.sub(r"\n```$", "", raw_text)
            raw_text = raw_text.strip()
            
        card_items = json.loads(raw_text)
        
        for item in card_items:
            concept = item.get("concept", "").strip()
            question = item.get("question", "").strip()
            ideal_answer = item.get("ideal_answer", "").strip()
            
            if not concept or not question or not ideal_answer:
                continue

            # Check if card already exists for this user/concept
            exists = db.query(ActiveRecallCard).filter(
                ActiveRecallCard.user_id == current_user.id,
                ActiveRecallCard.concept == concept
            ).first()
            
            if not exists:
                card = ActiveRecallCard(
                    user_id=current_user.id,
                    concept=concept,
                    question=question,
                    ideal_answer=ideal_answer,
                    next_review=datetime.utcnow()
                )
                db.add(card)
                cards_created += 1
        
        db.commit()
    except Exception as e:
        logger.exception("Failed to auto-generate active recall cards via LLM")
        # Fallback card creation
        for topic in concepts_list[:3]:
            exists = db.query(ActiveRecallCard).filter(
                ActiveRecallCard.user_id == current_user.id,
                ActiveRecallCard.concept == topic
            ).first()
            if not exists:
                card = ActiveRecallCard(
                    user_id=current_user.id,
                    concept=topic,
                    question=f"Explain the core mechanism and theoretical principles behind {topic}.",
                    ideal_answer=f"{topic} represents a fundamental pillar of modern technology. Explanations focus on its functional pipelines, algorithms, and practical application vectors.",
                    next_review=datetime.utcnow()
                )
                db.add(card)
                cards_created += 1
        db.commit()

    return {
        "status": "success",
        "cards_created": cards_created,
        "message": f"Generated {cards_created} flashcards based on your target concepts."
    }
