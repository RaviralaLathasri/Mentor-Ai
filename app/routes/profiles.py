"""
routes/profiles.py
------------------
Student profile management endpoints.

Allows students to:
- Create their learning profile
- Update profile info
- View their learning context
- Track confidence levels
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db, Student
from app.schemas import (
    StudentCreate, StudentResponse, ProfileCreate, ProfileUpdate, ProfileResponse
)
from app.services import StudentProfileService

router = APIRouter(prefix="/api/profile", tags=["Profile Management"])


def _to_profile_response(profile) -> ProfileResponse:
    data = ProfileResponse.model_validate(profile).model_dump()
    if getattr(profile, "student", None):
        data["student_name"] = profile.student.name
        data["student_email"] = profile.student.email
    return ProfileResponse(**data)


@router.post("/create", response_model=StudentResponse)
def create_student(
    student: StudentCreate,
    db: Session = Depends(get_db)
):
    """Create a new student record and initialize profile."""
    # Check if student already exists
    existing = db.query(Student).filter(Student.email == student.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student with this email already exists")

    # Create student record
    new_student = Student(
        name=student.name,
        email=student.email,
        created_at=datetime.utcnow()
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    # Initialize profile
    profile_service = StudentProfileService(db)
    profile = profile_service.create_profile(
        student_id=new_student.id,
        confidence_level=0.5
    )

    return StudentResponse(
        id=new_student.id,
        name=new_student.name,
        email=new_student.email,
        is_active=new_student.is_active,
        created_at=new_student.created_at
    )


@router.post("/{student_id}/profile", response_model=ProfileResponse)
def create_profile(
    student_id: int,
    profile_data: ProfileCreate,
    db: Session = Depends(get_db)
):
    """Create or update student's learning profile."""
    service = StudentProfileService(db)

    # Check if profile exists
    existing_profile = service.get_profile(student_id)
    if existing_profile:
        # Update existing
        updated = service.update_profile(
            student_id=student_id,
            skills=profile_data.skills,
            interests=profile_data.interests,
            goals=profile_data.goals,
            confidence_level=profile_data.confidence_level,
            preferred_difficulty=profile_data.preferred_difficulty
        )
        return _to_profile_response(updated)
    else:
        # Create new
        profile = service.create_profile(
            student_id=student_id,
            skills=profile_data.skills,
            interests=profile_data.interests,
            goals=profile_data.goals,
            confidence_level=profile_data.confidence_level,
            preferred_difficulty=profile_data.preferred_difficulty
        )
        return _to_profile_response(profile)


@router.get("/{student_id}", response_model=ProfileResponse)
def get_profile(
    student_id: int,
    db: Session = Depends(get_db)
):
    """Get student's learning profile."""
    service = StudentProfileService(db)
    profile = service.get_profile(student_id)

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return _to_profile_response(profile)


@router.put("/{student_id}", response_model=ProfileResponse)
def update_profile(
    student_id: int,
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db)
):
    """Update student's learning profile."""
    service = StudentProfileService(db)

    profile = service.update_profile(
        student_id=student_id,
        skills=profile_data.skills,
        interests=profile_data.interests,
        goals=profile_data.goals,
        confidence_level=profile_data.confidence_level,
        preferred_difficulty=profile_data.preferred_difficulty
    )

    return _to_profile_response(profile)


@router.get("/student/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentResponse.model_validate(student)
