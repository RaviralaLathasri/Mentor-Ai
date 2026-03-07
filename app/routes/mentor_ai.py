"""
routes/mentor_ai.py
-------------------
AI Mentor interaction endpoints.

Features:
- Adaptive question answering
- Socratic guidance
- Context-aware explanations
- Follow-up guiding questions
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import MentorQueryRequest, MentorResponseData
from app.services import MentorAIService

router = APIRouter(prefix="/api/mentor", tags=["AI Mentor"])


@router.post("/respond", response_model=MentorResponseData)
def get_mentor_response(
    query: MentorQueryRequest,
    db: Session = Depends(get_db)
):
    """
    Get adaptive mentor response to student query.
    
    Process:
    1. Analyzes student's learning profile
    2. Considers weakness on topic
    3. Generates Socratic response (guiding questions, not answers)
    4. Provides follow-up guiding question
    5. Stores response for learning analytics
    
    Request:
    - student_id: Student identifier
    - query: Student's question
    - focus_concept: Topic to focus on (optional, inferred if not provided)
    - context: Learning context snapshot (optional)
    
    Response:
    - response_id: Unique response identifier
    - response: Socratic guidance text
    - explanation_style: Level of detail (simple/conceptual/deep)
    - target_concept: Inferred or provided concept
    - follow_up_question: Guiding question to deepen understanding
    """
    try:
        service = MentorAIService(db)

        result = service.generate_response(
            student_id=query.student_id,
            query=query.query,
            focus_concept=query.focus_concept,
            context=query.context
        )

        return MentorResponseData(
            response_id=result["response_id"],
            response=result["response"],
            explanation_style=result["explanation_style"],
            target_concept=result["target_concept"],
            follow_up_question=result["follow_up_question"]
        )

    except ValueError as e:
        print(f"[ERROR] get_mentor_response: {str(e)} | student_id={query.student_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] get_mentor_response: {str(e)} | student_id={query.student_id}")
        raise HTTPException(status_code=500, detail="Error generating mentor response")
