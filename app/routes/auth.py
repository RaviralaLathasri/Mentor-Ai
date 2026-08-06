from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db, User, Profile
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    email: EmailStr
    name: str
    google_id: str
    avatar_url: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: int
    name: str
    email: str
    has_profile: bool
    is_active: bool


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user and return JWT tokens."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create user
    new_user = User(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate tokens
    access_token = create_access_token(data={"sub": new_user.email})
    refresh_token = create_refresh_token(data={"sub": new_user.email})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user via email/password and return JWT tokens."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated.",
        )

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/google", response_model=TokenResponse)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticate or auto-register a user via Google OAuth details."""
    user = db.query(User).filter(User.email == req.email).first()

    if not user:
        # Create user automatically
        user = User(
            name=req.name,
            email=req.email,
            google_id=req.google_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Link google_id if not already linked
        if not user.google_id:
            user.google_id = req.google_id
            db.commit()
            db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated.",
        )

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token_endpoint(req: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh an access token using a refresh token."""
    payload = verify_token(req.refresh_token, "refresh")
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch details of the current authenticated user."""
    has_profile = current_user.profile is not None
    return UserMeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        has_profile=has_profile,
        is_active=current_user.is_active,
    )
