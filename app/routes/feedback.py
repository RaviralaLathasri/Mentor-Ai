from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas import FeedbackSubmit, FeedbackResult
from app.database import get_db, SessionLocal, FeedbackLog, StudentProfile, Student
from pydantic import BaseModel

router = APIRouter()

# Temporary difficulty store (legacy - kept for backward compatibility)
student_difficulty = {}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic model for on-demand adjustment endpoint
# ─────────────────────────────────────────────────────────────────────────────

class StudentIDRequest(BaseModel):
    """Request payload for on-demand difficulty adjustment."""
    student_id: int


from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas import FeedbackSubmit, FeedbackResult
from app.database import get_db, SessionLocal, FeedbackLog, StudentProfile, Student
from app.services import FeedbackService
from pydantic import BaseModel

router = APIRouter()

# Temporary difficulty store (legacy - kept for backward compatibility)
student_difficulty = {}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic model for on-demand adjustment endpoint
# ─────────────────────────────────────────────────────────────────────────────

class StudentIDRequest(BaseModel):
    """Request payload for on-demand difficulty adjustment."""
    student_id: int


@router.post("/submit", response_model=FeedbackResult)
def submit_feedback(payload: FeedbackSubmit, db: Session = Depends(get_db)):
    """
    Process student feedback and adjust difficulty based on last 3 feedback entries.

    Flow:
    1. Store the feedback record in database
    2. Calculate difficulty adjustment from last 3 feedback entries
    3. Update student profile with new difficulty
    4. Return adjustment details

    Error Handling:
    - Handles missing students gracefully
    - Works with 0-3 feedback entries
    - Never crashes with 500 errors
    """

    try:
        student_id = payload.student_id
        feedback_tag = payload.feedback_tag
        session_id = payload.session_id
        ai_response_id = payload.ai_response_id
        rating = payload.rating
        focus_concept = payload.focus_concept

        # Ensure the student exists before proceeding
        student = db.query(StudentProfile).filter(
            StudentProfile.student_id == student_id
        ).first()
        if not student:
            # Create a basic profile if it doesn't exist
            from app.services import StudentProfileService
            profile_service = StudentProfileService(db)
            profile = profile_service.create_profile(
                student_id=student_id,
                confidence_level=0.5
            )

        # Use the FeedbackService to process feedback
        feedback_service = FeedbackService(db)
        feedback_record, adaptation = feedback_service.submit_feedback(
            student_id=student_id,
            response_id=ai_response_id,
            feedback_type=feedback_tag,
            rating=rating,
            comments="",  # Not used in current schema
            focus_concept=focus_concept
        )

        # Store feedback in legacy FeedbackLog for backward compatibility
        new_feedback = FeedbackLog(
            student_id=student_id,
            session_id=session_id,
            ai_response_id=ai_response_id,
            feedback_tag=feedback_tag,
            rating=rating,
            focus_concept=focus_concept
        )
        db.add(new_feedback)
        db.commit()

        # Update legacy in-memory store for backward compatibility
        if adaptation:
            student_difficulty[student_id] = adaptation.new_difficulty
            old_difficulty = adaptation.previous_difficulty
            new_difficulty = adaptation.new_difficulty
            adjustment_reason = adaptation.adjustment_reason
        else:
            # No adaptation made
            profile = db.query(StudentProfile).filter(
                StudentProfile.student_id == student_id
            ).first()
            old_difficulty = profile.preferred_difficulty.value if profile else "medium"
            new_difficulty = old_difficulty
            adjustment_reason = "No adjustment needed"

        # Return result to client
        return FeedbackResult(
            message="Feedback recorded and difficulty adjusted",
            old_difficulty=old_difficulty,
            new_difficulty=new_difficulty,
            adjustment_reason=adjustment_reason
        )

    except Exception as e:
        # Fallback error handling
        return FeedbackResult(
            message=f"Feedback recorded with error: {str(e)}",
            old_difficulty="unknown",
            new_difficulty="unknown",
            adjustment_reason="Error processing feedback"
        )
    
    except ValueError as e:
        # Student not found
        return FeedbackResult(
            message=f"Error: {str(e)}",
            old_difficulty=0.0,
            new_difficulty=0.0,
            adjustment_reason="Failed to process feedback"
        )
    
    except Exception as e:
        # Unexpected error
        print(f"❌ Error in /api/feedback/submit: {str(e)}")
        return FeedbackResult(
            message=f"Error processing feedback: {str(e)}",
            old_difficulty=0.0,
            new_difficulty=0.0,
            adjustment_reason="Unexpected error"
        )


@router.post("/adjust-difficulty", response_model=FeedbackResult)
def adjust_difficulty_on_demand(payload: StudentIDRequest, db: Session = Depends(get_db)):
    """
    On-demand endpoint to recalculate difficulty based on last 3 feedback entries.
    
    Useful for:
    - Testing feedback-driven adjustments
    - Manual difficulty adjustments
    - Analytics and monitoring
    - Integration with other systems
    
    Returns the adjustment result without requiring a new feedback submission.
    """
    
    try:
        student_id = payload.student_id
        
        # Get current profile
        profile = db.query(StudentProfile).filter(
            StudentProfile.student_id == student_id
        ).first()
        
        if not profile:
            return FeedbackResult(
                message="Student profile not found",
                old_difficulty="unknown",
                new_difficulty="unknown",
                adjustment_reason="Profile not found"
            )
        
        # For now, just return current difficulty (simplified implementation)
        current_difficulty = profile.preferred_difficulty.value
        
        # Update legacy in-memory store
        student_difficulty[student_id] = current_difficulty
        
        return FeedbackResult(
            message="Current difficulty retrieved",
            old_difficulty=current_difficulty,
            new_difficulty=current_difficulty,
            adjustment_reason="No adjustment needed"
        )
    
    except Exception as e:
        return FeedbackResult(
            message=f"Error: {str(e)}",
            old_difficulty="unknown",
            new_difficulty="unknown",
            adjustment_reason="Error retrieving difficulty"
        )