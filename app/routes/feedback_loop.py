"""
routes/feedback_loop.py
----------------------
Human-in-the-loop feedback and difficulty adaptation endpoints.

Features:
- Submit feedback on mentor responses
- Automatic difficulty adjustment
- Learning pattern adaptation
- Confidence tracking
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import FeedbackSubmit, FeedbackResponse
from app.services import FeedbackService

router = APIRouter(prefix="/api/feedback", tags=["Feedback Loop"])
logger = logging.getLogger(__name__)


@router.post("/submit", response_model=FeedbackResponse)
def submit_feedback(
    feedback: FeedbackSubmit,
    db: Session = Depends(get_db)
):
    """
    Submit feedback on mentor response and trigger adaptations.
    
    Feedback types:
    - too_easy: Content was too easy, increase difficulty
    - too_hard: Content was too difficult, decrease difficulty
    - helpful: Was helpful, maintain current level
    - unclear: Was unclear, may adjust explanation style
    
    Rating (optional): 1-5 scale of satisfaction
    Comments (optional): Detailed feedback from student
    Focus concept: Topic the feedback is about
    
    Adaptations triggered:
    1. Difficulty level adjustment if extreme feedback
    2. Confidence level adjustment based on rating
    3. Explanation style update for future responses
    """
    try:
        service = FeedbackService(db)

        feedback_record, adaptation = service.submit_feedback(
            student_id=feedback.student_id,
            response_id=feedback.response_id,
            feedback_type=feedback.feedback_type,
            rating=feedback.rating,
            comments=feedback.comments,
            focus_concept=feedback.focus_concept
        )

        return FeedbackResponse(
            student_id=feedback.student_id,
            feedback_id=feedback_record.id,
            response_id=feedback.response_id,
            feedback_type=feedback.feedback_type,
            rating=feedback.rating,
            focus_concept=feedback.focus_concept,
            adaptation_made=adaptation is not None,
            adaptation_details=adaptation.model_dump() if adaptation else None,
            submitted_at=feedback_record.created_at
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("submit_feedback failed (student_id=%s)", feedback.student_id)
        raise HTTPException(status_code=500, detail="Error submitting feedback")


@router.post("/rate-response")
def rate_response(
    student_id: int,
    response_id: str,
    rating: float,
    db: Session = Depends(get_db)
):
    """
    Submit a simple rating for a mentor response (1-5 scale).
    
    This is a simpler alternative to full feedback submission.
    """
    if not (1.0 <= rating <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")

    try:
        service = FeedbackService(db)

        # Convert rating to feedback type
        feedback_type = "helpful"
        if rating <= 2.0:
            feedback_type = "unclear"
        elif rating >= 4.0:
            feedback_type = "helpful"

        feedback_record, adaptation = service.submit_feedback(
            student_id=student_id,
            response_id=response_id,
            feedback_type=feedback_type,
            rating=rating
        )

        return {
            "student_id": student_id,
            "feedback_id": feedback_record.id,
            "rating": rating,
            "adaptation_made": adaptation is not None
        }

    except Exception as e:
        logger.exception("rate_response failed (student_id=%s)", student_id)
        raise HTTPException(status_code=500, detail="Error rating response")
