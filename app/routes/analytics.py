"""Analytics endpoints backed by the current database models."""

from collections import defaultdict
from datetime import date
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import Feedback, MentorResponse, Student, WeaknessScore, get_db
from app.services import AdaptiveLearningService

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def _ensure_student_exists(db: Session, student_id: int) -> None:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")


def _feedback_distribution(db: Session, student_id: int) -> Dict:
    rows = db.query(Feedback).filter(Feedback.student_id == student_id).all()

    distribution = {
        "helpful": 0,
        "too_easy": 0,
        "too_hard": 0,
        "unclear": 0,
    }
    for row in rows:
        key = row.feedback_type.value if hasattr(row.feedback_type, "value") else str(row.feedback_type)
        if key in distribution:
            distribution[key] += 1

    distribution["total"] = sum(distribution.values())
    distribution["student_id"] = student_id
    return distribution


def _performance_over_time(db: Session, student_id: int) -> Dict:
    feedback_rows = (
        db.query(Feedback)
        .filter(Feedback.student_id == student_id)
        .order_by(Feedback.created_at.asc())
        .all()
    )
    mentor_rows = (
        db.query(MentorResponse)
        .filter(MentorResponse.student_id == student_id)
        .order_by(MentorResponse.created_at.asc())
        .all()
    )

    trend: Dict[date, Dict] = defaultdict(lambda: {
        "date": None,
        "feedback_count": 0,
        "helpful": 0,
        "too_hard": 0,
        "too_easy": 0,
        "unclear": 0,
        "mentor_responses": 0,
        "rating_sum": 0.0,
        "rating_count": 0,
    })

    for row in feedback_rows:
        d = row.created_at.date() if row.created_at else date.today()
        item = trend[d]
        item["date"] = d.isoformat()
        item["feedback_count"] += 1
        key = row.feedback_type.value if hasattr(row.feedback_type, "value") else str(row.feedback_type)
        if key in item:
            item[key] += 1
        if row.rating is not None:
            item["rating_sum"] += float(row.rating)
            item["rating_count"] += 1

    for row in mentor_rows:
        d = row.created_at.date() if row.created_at else date.today()
        item = trend[d]
        item["date"] = d.isoformat()
        item["mentor_responses"] += 1

    points: List[Dict] = []
    for day in sorted(trend.keys()):
        item = trend[day]
        feedback_count = item["feedback_count"]
        helpful_rate = (item["helpful"] / feedback_count) if feedback_count else 0.0
        avg_rating = (item["rating_sum"] / item["rating_count"]) if item["rating_count"] else None
        points.append(
            {
                "date": item["date"],
                "feedback_count": feedback_count,
                "mentor_responses": item["mentor_responses"],
                "helpful_rate": round(helpful_rate, 3),
                "average_rating": round(avg_rating, 2) if avg_rating is not None else None,
            }
        )

    return {
        "student_id": student_id,
        "timeline": points,
    }


def _weakest_concepts(db: Session, student_id: int, limit: int = 8) -> List[Dict]:
    rows = (
        db.query(WeaknessScore)
        .filter(WeaknessScore.student_id == student_id)
        .order_by(WeaknessScore.weakness_score.desc(), WeaknessScore.times_seen.desc())
        .limit(limit)
        .all()
    )
    result = []
    for row in rows:
        result.append(
            {
                "concept": row.concept_name,
                "weakness_score": round(float(row.weakness_score), 3),
                "times_seen": row.times_seen,
                "times_correct": row.times_correct,
            }
        )
    return result


@router.get("/feedback-distribution/{student_id}")
def get_feedback_distribution(student_id: int, db: Session = Depends(get_db)) -> Dict:
    _ensure_student_exists(db, student_id)
    return _feedback_distribution(db, student_id)


@router.get("/performance-over-time/{student_id}")
def get_performance_over_time(student_id: int, db: Session = Depends(get_db)) -> Dict:
    _ensure_student_exists(db, student_id)
    return _performance_over_time(db, student_id)


@router.get("/weakest-concepts/{student_id}")
def get_weakest_concepts(student_id: int, limit: int = 8, db: Session = Depends(get_db)) -> Dict:
    _ensure_student_exists(db, student_id)
    weakest = _weakest_concepts(db, student_id, limit)
    return {
        "student_id": student_id,
        "weakest_concepts": weakest,
    }


@router.get("/weakest-concepts-graph/{student_id}")
def get_weakest_concepts_graph(student_id: int, limit: int = 8, db: Session = Depends(get_db)) -> Dict:
    _ensure_student_exists(db, student_id)
    weakest = _weakest_concepts(db, student_id, limit)
    return {
        "student_id": student_id,
        "graph": {
            "labels": [item["concept"] for item in weakest],
            "values": [item["weakness_score"] for item in weakest],
        },
    }


@router.get("/summary/{student_id}")
def get_student_analytics_summary(student_id: int, db: Session = Depends(get_db)) -> Dict:
    _ensure_student_exists(db, student_id)
    adaptive = AdaptiveLearningService(db)
    context = adaptive.get_student_context_snapshot(student_id)
    feedback_dist = _feedback_distribution(db, student_id)
    weakest = _weakest_concepts(db, student_id, limit=1)

    return {
        "student_id": student_id,
        "feedback_distribution": feedback_dist,
        "current_confidence": context.confidence_level,
        "preferred_difficulty": context.preferred_difficulty,
        "recent_feedback_sentiment": context.recent_feedback_sentiment,
        "top_weakest_concept": weakest[0]["concept"] if weakest else "general",
    }


@router.get("/dashboard/{student_id}")
def get_dashboard_bundle(student_id: int, db: Session = Depends(get_db)) -> Dict:
    _ensure_student_exists(db, student_id)
    adaptive = AdaptiveLearningService(db)

    context = adaptive.get_student_context_snapshot(student_id)
    recommendations = adaptive.generate_recommendations(student_id)

    return {
        "student_id": student_id,
        "context": context.model_dump(),
        "feedback_distribution": _feedback_distribution(db, student_id),
        "performance_over_time": _performance_over_time(db, student_id)["timeline"],
        "weakest_concepts": _weakest_concepts(db, student_id, limit=8),
        "recommendations": recommendations,
    }
