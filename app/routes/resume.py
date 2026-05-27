"""
routes/resume.py
----------------
Resume upload and AI mentoring endpoints.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ResumeMentorResponse
from app.services import ResumeMentorService

router = APIRouter(prefix="/api/resume", tags=["Resume Mentor"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=ResumeMentorResponse)
async def analyze_resume(
    resume: UploadFile = File(...),
    student_id: Optional[int] = Form(default=None),
    db: Session = Depends(get_db),
):
    """
    Upload a resume file and receive Socratic mentoring guidance.

    Supported formats: .pdf, .docx, .txt, .md
    """
    del student_id  # Reserved for future personalization using profile/weakness context.

    try:
        file_name = resume.filename or "resume.txt"
        raw_bytes = await resume.read()
        service = ResumeMentorService(db)
        return service.analyze_resume(file_name=file_name, raw_bytes=raw_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("analyze_resume failed")
        raise HTTPException(status_code=500, detail="Error analyzing resume")
