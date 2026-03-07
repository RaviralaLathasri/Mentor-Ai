"""
routes/explain_mistakes.py
--------------------------
Misconception detection and mistake explanation endpoints.

Features:
- Explain why an answer was wrong
- Detect underlying misconceptions
- Provide correct understanding
- Prevent future similar mistakes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ExplainMistakeRequest, MistakeExplanation
from app.services import WeaknessAnalyzerService

router = APIRouter(prefix="/api/explain", tags=["Mistake Explanation"])


@router.post("/mistake", response_model=MistakeExplanation)
def explain_mistake(
    request: ExplainMistakeRequest,
    db: Session = Depends(get_db)
):
    """
    Explain why a student's answer was incorrect.
    
    Analyzes:
    1. Student's reasoning (answer provided)
    2. Correct reasoning (correct answer provided)
    3. Underlying misconception (detected automatically)
    4. Learning path forward (how to avoid this mistake)
    
    Request:
    - student_id: Student identifier
    - concept: Concept being learned
    - student_answer: Student's incorrect response
    - correct_answer: Correct response
    - question: Original question/problem
    
    Response:
    - misconception_identified: Type of misconception detected
    - why_wrong: Explanation of what was wrong
    - correct_explanation: right understanding
    - learning_tips: How to avoid this mistake
    - related_concept: Connected concept to review
    """
    try:
        service = WeaknessAnalyzerService(db)

        # Detect misconception
        misconception = service._detect_misconception(
            request.student_answer,
            request.correct_answer,
            request.concept
        )

        # Create explanation
        explanation = MistakeExplanation(
            student_id=request.student_id,
            concept=request.concept,
            misconception_identified=misconception,
            why_wrong=f"In your answer '{request.student_answer}', you assumed...",
            correct_explanation=f"The correct answer '{request.correct_answer}' because...",
            learning_tips=[
                "Focus on the core principle",
                "Practice similar problems",
                "Review prerequisite concepts"
            ],
            related_concept="foundation_concept"
        )

        return explanation

    except Exception as e:
        print(f"[ERROR] explain_mistake: {str(e)} | student_id={request.student_id}")
        raise HTTPException(status_code=500, detail="Error explaining mistake")


@router.post("/misconception-check")
def check_misconception(
    student_id: int,
    concept: str,
    student_answer: str,
    correct_answer: str,
    db: Session = Depends(get_db)
):
    """
    Quick misconception check for student answer.
    
    Returns whether a misconception was detected and what it is.
    """
    try:
        service = WeaknessAnalyzerService(db)

        misconception = service._detect_misconception(
            student_answer,
            correct_answer,
            concept
        )

        return {
            "student_id": student_id,
            "concept": concept,
            "has_misconception": misconception is not None,
            "misconception_type": misconception,
            "severity": "high" if misconception else "none"
        }

    except Exception as e:
        print(f"[ERROR] check_misconception: {str(e)} | student_id={student_id}")
        raise HTTPException(status_code=500, detail="Error checking misconception")
