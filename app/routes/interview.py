"""Mock interview endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    MockInterviewHistoryResponse,
    MockInterviewRequest,
    MockInterviewResponse,
)
from app.services.interview import MockInterviewService

router = APIRouter(prefix="/api/interview", tags=["Mock Interview"])
logger = logging.getLogger(__name__)


@router.post("/mock", response_model=MockInterviewResponse)
def run_mock_interview(
    request: MockInterviewRequest,
    db: Session = Depends(get_db),
):
    """
    Run a mock interview, score answers, and store transcript for playback.
    """
    try:
        service = MockInterviewService(db)
        payload = service.run_mock_interview(request)
        return MockInterviewResponse.model_validate(payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("run_mock_interview failed (student_id=%s)", request.student_id)
        raise HTTPException(status_code=500, detail="Error running mock interview")


@router.get("/mock/student/{student_id}", response_model=MockInterviewHistoryResponse)
def get_student_mock_interview_history(
    student_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    Retrieve recent mock interview sessions for one student.
    """
    try:
        service = MockInterviewService(db)
        payload = service.get_student_mock_interviews(student_id=student_id, limit=limit)
        return MockInterviewHistoryResponse.model_validate(payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("get_student_mock_interview_history failed (student_id=%s)", student_id)
        raise HTTPException(status_code=500, detail="Error retrieving mock interview history")


@router.get("/mock/{session_id}", response_model=MockInterviewResponse)
def get_mock_interview_playback(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve one stored mock interview session for transcript playback.
    """
    try:
        service = MockInterviewService(db)
        payload = service.get_mock_interview_session(session_id)
        return MockInterviewResponse.model_validate(payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("get_mock_interview_playback failed (session_id=%s)", session_id)
        raise HTTPException(status_code=500, detail="Error retrieving mock interview playback")
