from fastapi import APIRouter
from uuid import uuid4
from app.models.schemas import QuizSubmit, QuizResult
from app.services.adaptive_engine import calculate_weakness

router = APIRouter()

# Temporary in-memory storage (later move to DB)
student_performance = {}


@router.post("/submit", response_model=QuizResult)
def submit_quiz(payload: QuizSubmit):
    """
    Handles quiz submission, evaluates correctness,
    updates weakness score per concept.
    """

    student_id = payload.student_id
    concept = payload.concept_tag

    is_correct = (
        payload.student_answer.strip().lower()
        == payload.correct_answer.strip().lower()
    )

    # Initialize student if not present
    if student_id not in student_performance:
        student_performance[student_id] = {}

    if concept not in student_performance[student_id]:
        student_performance[student_id][concept] = {
            "correct": 0,
            "total": 0
        }

    # Update stats
    student_performance[student_id][concept]["total"] += 1

    if is_correct:
        student_performance[student_id][concept]["correct"] += 1

    correct = student_performance[student_id][concept]["correct"]
    total = student_performance[student_id][concept]["total"]

    # Calculate weakness using adaptive engine
    weakness_score = calculate_weakness(correct, total)

    return QuizResult(
        attempt_id=uuid4().hex,
        is_correct=is_correct,
        concept_tag=concept,
        misconception="Incorrect reasoning detected." if not is_correct else "",
        explanation="Review the concept carefully." if not is_correct else "Good job!",
        weakness_score=weakness_score
    )