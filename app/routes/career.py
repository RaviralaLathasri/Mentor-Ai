"""Career roadmap generation endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    CareerLevelEnum,
    CareerRoadmapGenerateRequest,
    CareerRoadmapResponse,
)
from app.services.career_roadmap import CareerRoadmapService

router = APIRouter(prefix="/api/career", tags=["Career Roadmap"])


@router.post("/roadmap/generate", response_model=CareerRoadmapResponse)
def generate_career_roadmap(
    request: CareerRoadmapGenerateRequest,
    db: Session = Depends(get_db),
):
    try:
        service = CareerRoadmapService(db)
        roadmap = service.generate_roadmap(
            role=request.role,
            duration=request.duration,
            level=request.level,
            save=True,
        )
        return CareerRoadmapResponse.model_validate(roadmap)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] generate_career_roadmap: {str(e)} | role={request.role}")
        raise HTTPException(status_code=500, detail="Error generating career roadmap")


@router.get("/roadmap/{role}", response_model=CareerRoadmapResponse)
def get_career_roadmap(
    role: str,
    duration: str = "3 months",
    level: CareerLevelEnum = CareerLevelEnum.BEGINNER,
    db: Session = Depends(get_db),
):
    """
    Return the latest stored roadmap for role.

    If no roadmap exists yet, this endpoint generates a default roadmap first.
    """
    try:
        service = CareerRoadmapService(db)
        existing = service.get_latest_roadmap(role)
        # Default GET behavior: return last generated roadmap for role.
        # If caller provides specific duration/level (non-default), regenerate to match inputs.
        if existing and duration == "3 months" and level == CareerLevelEnum.BEGINNER:
            return CareerRoadmapResponse.model_validate(existing)

        generated = service.generate_roadmap(
            role=role,
            duration=duration,
            level=level,
            save=True,
        )
        return CareerRoadmapResponse.model_validate(generated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] get_career_roadmap: {str(e)} | role={role}")
        raise HTTPException(status_code=500, detail="Error retrieving career roadmap")
