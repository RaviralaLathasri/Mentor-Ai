"""
routes/wellness.py
------------------
Quiz performance tracking and weakness analysis endpoints.

Student learning wellness monitoring:
- Submit quiz answers
- Analyze performance
- Track concept weaknesses
- Get learning recommendations
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    QuizAnswerSubmit,
    QuizAttemptSubmit,
    QuizQuestionResponse,
    WeaknessAnalysisResult,
)
from app.services import WeaknessAnalyzerService

router = APIRouter(prefix="/api/analyze", tags=["Learning Wellness"])


@router.get("/quiz-question", response_model=QuizQuestionResponse)
def get_quiz_question(
    student_id: int,
    concept_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Generate one quiz question for a concept.

    If concept_name is omitted, the service picks from the student's weak areas.
    """
    try:
        service = WeaknessAnalyzerService(db)
        return service.generate_quiz_question(student_id=student_id, concept_name=concept_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] get_quiz_question: {str(e)} | student_id={student_id}")
        raise HTTPException(status_code=500, detail="Error generating quiz question")


@router.post("/quiz", response_model=WeaknessAnalysisResult)
def analyze_quiz_result(
    answer: QuizAnswerSubmit,
    db: Session = Depends(get_db)
):
    """
    Analyze quiz answer and update weakness tracking.
    
    Returns:
    - Whether answer was correct
    - Updated weakness score for concept
    - Learning priority for the concept
    - Any detected misconceptions
    """
    try:
        service = WeaknessAnalyzerService(db)

        result = service.analyze_quiz_result(
            student_id=answer.student_id,
            concept_name=answer.concept_name,
            is_correct=answer.is_correct,
            student_answer=answer.student_answer or "",
            correct_answer=answer.correct_answer or ""
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] analyze_quiz_result: {str(e)} | student_id={answer.student_id}")
        raise HTTPException(status_code=500, detail="Error analyzing quiz result")


@router.post("/quiz-attempt", response_model=WeaknessAnalysisResult)
def analyze_quiz_attempt(
    attempt: QuizAttemptSubmit,
    db: Session = Depends(get_db),
):
    """
    Evaluate a quiz answer automatically and update weakness tracking.
    """
    try:
        service = WeaknessAnalyzerService(db)
        return service.analyze_generated_quiz_attempt(
            student_id=attempt.student_id,
            concept_name=attempt.concept_name,
            question=attempt.question,
            student_answer=attempt.student_answer,
            reference_answer=attempt.reference_answer,
            keywords=attempt.keywords,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[ERROR] analyze_quiz_attempt: {str(e)} | student_id={attempt.student_id}")
        raise HTTPException(status_code=500, detail="Error analyzing quiz attempt")


@router.get("/weakest-concepts/{student_id}")
def get_weakest_concepts(
    student_id: int,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    Get student's weakest concepts.
    
    Returns top N concepts where student struggles most.
    Useful for targeted practice recommendations.
    """
    try:
        service = WeaknessAnalyzerService(db)
        weaknesses = service.get_weakest_concepts(student_id, limit=limit)

        return {
            "student_id": student_id,
            "weakest_concepts": [
                {
                    "concept": w.concept_name,
                    "weakness_score": round(w.weakness_score, 3),
                    "learning_priority": WeaknessAnalyzerService._calculate_learning_priority(
                        w.weakness_score
                    )
                }
                for w in weaknesses
            ]
        }

    except Exception as e:
        print(f"[ERROR] get_weakest_concepts: {str(e)} | student_id={student_id}")
        raise HTTPException(status_code=500, detail="Error retrieving weakest concepts")
