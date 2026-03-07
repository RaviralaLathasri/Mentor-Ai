"""
routes/adaptive.py
------------------
Adaptive learning session control and monitoring endpoints.

Features:
- Create learning sessions
- View adaptive learning status
- Get student context snapshots
- Monitor adaptation progress
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SessionCreate, SessionResponse, StudentContextSnapshot
from app.services import AdaptiveLearningService

router = APIRouter(prefix="/api/adaptive", tags=["Adaptive Learning"])


@router.post("/session", response_model=SessionResponse)
def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db)
):
    """
    Create new adaptive learning session.
    
    A session groups related learning interactions:
    - Topic: What is being learned
    - Difficulty: Starting difficulty level
    - Context: Learning environment metadata
    """
    try:
        service = AdaptiveLearningService(db)
        session = service.create_session(
            student_id=session_data.student_id,
            topic=session_data.topic,
            difficulty_level=session_data.difficulty_level
        )
        return SessionResponse.model_validate(session)

    except ValueError as e:
        print(f"[ERROR] create_session: {str(e)} | student_id={session_data.student_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] create_session: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating session")


@router.get("/status/{student_id}", response_model=StudentContextSnapshot)
def get_adaptive_status(
    student_id: int,
    db: Session = Depends(get_db)
):
    """
    Get current adaptive learning status for student.
    
    Returns:
    - Current confidence level
    - Weakest concepts
    - Strongest areas
    - Current difficulty setting
    - Recent learning sentiment
    """
    try:
        service = AdaptiveLearningService(db)
        context = service.get_student_context_snapshot(student_id)

        return context

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] get_adaptive_status: {str(e)} | student_id={student_id}")
        raise HTTPException(status_code=500, detail="Error retrieving adaptive status")


@router.get("/recommendations/{student_id}")
def get_learning_recommendations(
    student_id: int,
    db: Session = Depends(get_db)
):
    """
    Get personalized learning recommendations based on current status.
    
    Recommendations consider:
    - Weakest concepts (prioritize)
    - Confidence level (encourage if low)
    - Recent feedback (maintain momentum)
    - Preferred difficulty
    """
    try:
        service = AdaptiveLearningService(db)
        context = service.get_student_context_snapshot(student_id)
        recommendations = service.generate_recommendations(student_id)

        return {
            "student_id": student_id,
            "context": context.model_dump(),
            "recommendations": recommendations
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] get_learning_recommendations: {str(e)} | student_id={student_id}")
        raise HTTPException(status_code=500, detail="Error generating recommendations")
