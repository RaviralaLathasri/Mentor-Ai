"""
routes/profiles.py
------------------
Student profile management endpoints.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db, User, Profile
from app.schemas import (
    StudentCreate, StudentResponse, ProfileCreate, ProfileUpdate, ProfileResponse
)
from app.services import StudentProfileService
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/profile", tags=["Profile Management"])


def _to_profile_response(profile) -> ProfileResponse:
    data = ProfileResponse.model_validate(profile).model_dump()
    if getattr(profile, "user", None):
        data["student_name"] = profile.user.name
        data["student_email"] = profile.user.email
    return ProfileResponse(**data)


# ── Secure Me Endpoints ────────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve the current logged-in user's profile."""
    service = StudentProfileService(db)
    profile = service.get_profile(current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    return _to_profile_response(profile)


@router.post("/me", response_model=ProfileResponse)
def create_or_update_my_profile(
    profile_data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update the current logged-in user's profile."""
    service = StudentProfileService(db)
    existing_profile = service.get_profile(current_user.id)
    if existing_profile:
        updated = service.update_profile(
            student_id=current_user.id,
            skills=profile_data.skills,
            interests=profile_data.interests,
            goals=profile_data.goals,
            confidence_level=profile_data.confidence_level,
            preferred_difficulty=profile_data.preferred_difficulty
        )
        return _to_profile_response(updated)
    else:
        profile = service.create_profile(
            student_id=current_user.id,
            skills=profile_data.skills,
            interests=profile_data.interests,
            goals=profile_data.goals,
            confidence_level=profile_data.confidence_level,
            preferred_difficulty=profile_data.preferred_difficulty
        )
        return _to_profile_response(profile)


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current logged-in user's profile."""
    service = StudentProfileService(db)
    profile = service.update_profile(
        student_id=current_user.id,
        skills=profile_data.skills,
        interests=profile_data.interests,
        goals=profile_data.goals,
        confidence_level=profile_data.confidence_level,
        preferred_difficulty=profile_data.preferred_difficulty
    )
    return _to_profile_response(profile)


# ── Classic Endpoints (for backward compatibility) ────────────────────────────

@router.post("/create", response_model=StudentResponse)
def create_student(
    student: StudentCreate,
    db: Session = Depends(get_db)
):
    """Create a new user record and initialize profile."""
    existing = db.query(User).filter(User.email == student.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        name=student.name,
        email=student.email,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Initialize profile
    profile_service = StudentProfileService(db)
    profile_service.create_profile(
        student_id=new_user.id,
        confidence_level=0.5
    )

    return StudentResponse(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )


@router.post("/{student_id}/profile", response_model=ProfileResponse)
def create_profile(
    student_id: int,
    profile_data: ProfileCreate,
    db: Session = Depends(get_db)
):
    """Create or update student's learning profile."""
    service = StudentProfileService(db)
    existing_profile = service.get_profile(student_id)
    if existing_profile:
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
    user = db.query(User).filter(User.id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return StudentResponse.model_validate(user)
