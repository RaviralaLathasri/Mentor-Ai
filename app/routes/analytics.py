"""
analytics.py
-----------
Read-only analytics endpoints for the Mentor AI system.

These endpoints aggregate feedback and performance data without modifying
any database records. They provide insights into student progress, learning
patterns, and areas of struggle.

All queries use SQLAlchemy ORM with proper error handling and graceful
handling of missing data.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.store import get_db, FeedbackLog, StudentProfile
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Response Models
# ─────────────────────────────────────────────────────────────────────────────

class FeedbackDistribution(BaseModel):
    """Counts of each feedback tag type."""
    too_easy: int
    too_hard: int
    helpful: int
    unclear: int
    total: int


class PerformanceRecord(BaseModel):
    """Single point in performance progression."""
    date: str
    feedback_id: int
    feedback_tag: str


class WeakestConcept(BaseModel):
    """A concept with weakness count."""
    concept: str
    too_hard_count: int


class ConfidencePoint(BaseModel):
    """Single data point in confidence trend."""
    date: str
    rating: Optional[float]
    feedback_tag: str


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 1: Feedback Distribution
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/feedback-distribution/{student_id}")
def get_feedback_distribution(
    student_id: int,
    db: Session = Depends(get_db)
) -> Dict:
    """
    Count occurrences of each feedback tag for a student.
    
    Returns the distribution of how the student has tagged AI responses:
    - too_easy: content was too simple
    - too_hard: content was too difficult
    - helpful: response was helpful
    - unclear: response lacked clarity
    
    If no feedback exists, all counts return 0.
    """
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # Verify student exists
        # ─────────────────────────────────────────────────────────────────
        
        student = db.query(StudentProfile).filter(
            StudentProfile.id == student_id
        ).first()
        
        if not student:
            return {
                "student_id": student_id,
                "error": "Student not found",
                "too_easy": 0,
                "too_hard": 0,
                "helpful": 0,
                "unclear": 0,
                "total": 0
            }
        
        # ─────────────────────────────────────────────────────────────────
        # Query feedback grouped by tag
        # ─────────────────────────────────────────────────────────────────
        
        feedback_counts = (
            db.query(
                FeedbackLog.feedback_tag,
                func.count(FeedbackLog.id).label("count")
            )
            .filter(FeedbackLog.student_id == student_id)
            .group_by(FeedbackLog.feedback_tag)
            .all()
        )
        
        # Initialize counts with zeros
        distribution = {
            "too_easy": 0,
            "too_hard": 0,
            "helpful": 0,
            "unclear": 0
        }
        
        # Populate counts from query results
        for tag, count in feedback_counts:
            if tag in distribution:
                distribution[tag] = count
        
        # Calculate total
        total = sum(distribution.values())
        
        return {
            "student_id": student_id,
            **distribution,
            "total": total
        }
    
    except Exception as e:
        print(f"❌ Error in /api/analytics/feedback-distribution: {str(e)}")
        return {
            "student_id": student_id,
            "error": str(e),
            "too_easy": 0,
            "too_hard": 0,
            "helpful": 0,
            "unclear": 0,
            "total": 0
        }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 2: Performance Over Time (Difficulty Progression)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/performance-over-time/{student_id}")
def get_performance_over_time(
    student_id: int,
    db: Session = Depends(get_db)
) -> Dict:
    """
    Return the student's feedback timeline, ordered by date.
    
    Shows how the student's difficulty level has evolved over time based
    on feedback. Each record includes the date and the feedback tag that
    would have influenced difficulty adjustment.
    
    Ordered chronologically (oldest to newest).
    Returns empty array if no feedback exists.
    """
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # Verify student exists
        # ─────────────────────────────────────────────────────────────────
        
        student = db.query(StudentProfile).filter(
            StudentProfile.id == student_id
        ).first()
        
        if not student:
            return {
                "student_id": student_id,
                "error": "Student not found",
                "timeline": []
            }
        
        # ─────────────────────────────────────────────────────────────────
        # Query feedback ordered by submission date
        # ─────────────────────────────────────────────────────────────────
        
        feedback_timeline = (
            db.query(
                FeedbackLog.id,
                FeedbackLog.feedback_tag,
                FeedbackLog.submitted_at
            )
            .filter(FeedbackLog.student_id == student_id)
            .order_by(FeedbackLog.submitted_at.asc())
            .all()
        )
        
        # Format results
        timeline = [
            {
                "feedback_id": fb.id,
                "date": fb.submitted_at.isoformat() if fb.submitted_at else None,
                "feedback_tag": fb.feedback_tag
            }
            for fb in feedback_timeline
        ]
        
        return {
            "student_id": student_id,
            "feedback_count": len(timeline),
            "timeline": timeline
        }
    
    except Exception as e:
        print(f"❌ Error in /api/analytics/performance-over-time: {str(e)}")
        return {
            "student_id": student_id,
            "error": str(e),
            "timeline": []
        }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 3: Weakest Concepts (Graph-Ready)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/weakest-concepts/{student_id}")
def get_weakest_concepts(
    student_id: int,
    limit: int = 5,
    db: Session = Depends(get_db)
) -> Dict:
    """
    Return the top N concepts where the student tagged "too_hard" most often.
    
    A concept is considered "weak" when the student consistently struggles
    with explanations (tags "too_hard"). This helps identify priority areas
    for future learning sessions.
    
    Parameters:
    - student_id: the target student
    - limit: max number of concepts to return (default 5)
    
    Results ordered by difficulty count (descending).
    Returns empty array if no "too_hard" feedback exists.
    """
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # Verify student exists
        # ─────────────────────────────────────────────────────────────────
        
        student = db.query(StudentProfile).filter(
            StudentProfile.id == student_id
        ).first()
        
        if not student:
            return {
                "student_id": student_id,
                "error": "Student not found",
                "weakest_concepts": []
            }
        
        # ─────────────────────────────────────────────────────────────────
        # Query concepts grouped by "too_hard" feedback count
        # ─────────────────────────────────────────────────────────────────
        
        weak_concepts = (
            db.query(
                FeedbackLog.focus_concept,
                func.count(FeedbackLog.id).label("too_hard_count")
            )
            .filter(
                FeedbackLog.student_id == student_id,
                FeedbackLog.feedback_tag == "too_hard"
            )
            .group_by(FeedbackLog.focus_concept)
            .order_by(func.count(FeedbackLog.id).desc())
            .limit(limit)
            .all()
        )
        
        # Format results
        concepts = [
            {
                "concept": concept,
                "too_hard_count": count
            }
            for concept, count in weak_concepts
        ]
        
        return {
            "student_id": student_id,
            "limit": limit,
            "concepts_found": len(concepts),
            "weakest_concepts": concepts
        }
    
    except Exception as e:
        print(f"❌ Error in /api/analytics/weakest-concepts: {str(e)}")
        return {
            "student_id": student_id,
            "error": str(e),
            "weakest_concepts": []
        }


@router.get("/weakest-concepts-graph/{student_id}")
def get_weakest_concepts_graph(
    student_id: int,
    limit: int = 5,
    db: Session = Depends(get_db)
) -> Dict:
    """
    Return weakest concepts data in graph-ready format.
    
    Perfect for Bar Charts, Pie Charts, and other visualizations.
    Each concept shows how many times the student tagged explanations as "too_hard".
    
    Response format:
    {
        "student_id": 1,
        "graph": {
            "labels": ["Backpropagation", "Gradient Descent"],
            "values": [5, 3]
        }
    }
    
    Where:
    - labels: concept names (x-axis for bar chart)
    - values: count of "too_hard" feedback (y-axis for bar chart)
    
    Parameters:
    - student_id: target student
    - limit: max concepts to return (default 5)
    
    Ordered by difficulty count (descending).
    Returns empty graph if no "too_hard" feedback exists.
    """
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # Verify student exists
        # ─────────────────────────────────────────────────────────────────
        
        student = db.query(StudentProfile).filter(
            StudentProfile.id == student_id
        ).first()
        
        if not student:
            return {
                "student_id": student_id,
                "error": "Student not found",
                "graph": {
                    "labels": [],
                    "values": []
                }
            }
        
        # ─────────────────────────────────────────────────────────────────
        # Step 1: Query concepts with "too_hard" feedback
        # ─────────────────────────────────────────────────────────────────
        
        weak_concepts = (
            db.query(
                FeedbackLog.focus_concept,
                func.count(FeedbackLog.id).label("too_hard_count")
            )
            .filter(
                FeedbackLog.student_id == student_id,
                FeedbackLog.feedback_tag == "too_hard"
            )
            .group_by(FeedbackLog.focus_concept)
            .order_by(func.count(FeedbackLog.id).desc())
            .limit(limit)
            .all()
        )
        
        # ─────────────────────────────────────────────────────────────────
        # Step 2: Extract labels and values for graph
        # ─────────────────────────────────────────────────────────────────
        
        labels = [concept for concept, _ in weak_concepts]
        values = [count for _, count in weak_concepts]
        
        return {
            "student_id": student_id,
            "graph": {
                "labels": labels,
                "values": values
            }
        }
    
    except Exception as e:
        print(f"❌ Error in /api/analytics/weakest-concepts-graph: {str(e)}")
        return {
            "student_id": student_id,
            "error": str(e),
            "graph": {
                "labels": [],
                "values": []
            }
        }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 4: Confidence Trend
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/confidence-trend/{student_id}")
def get_confidence_trend(
    student_id: int,
    db: Session = Depends(get_db)
) -> Dict:
    """
    Return the student's confidence (rating) trend over time.
    
    Each feedback record can include a rating (1-5 scale) representing
    the student's satisfaction/confidence with the AI response. This
    endpoint shows how confidence has evolved chronologically.
    
    Includes both rating and feedback_tag for context.
    Ordered chronologically (oldest to newest).
    Returns empty array if no rated feedback exists.
    """
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # Verify student exists
        # ─────────────────────────────────────────────────────────────────
        
        student = db.query(StudentProfile).filter(
            StudentProfile.id == student_id
        ).first()
        
        if not student:
            return {
                "student_id": student_id,
                "error": "Student not found",
                "confidence_data": []
            }
        
        # ─────────────────────────────────────────────────────────────────
        # Query feedback with ratings, ordered chronologically
        # ─────────────────────────────────────────────────────────────────
        
        confidence_data = (
            db.query(
                FeedbackLog.id,
                FeedbackLog.rating,
                FeedbackLog.feedback_tag,
                FeedbackLog.submitted_at
            )
            .filter(FeedbackLog.student_id == student_id)
            .order_by(FeedbackLog.submitted_at.asc())
            .all()
        )
        
        # Format results, filter to only include entries with ratings
        trend = [
            {
                "feedback_id": fb.id,
                "date": fb.submitted_at.isoformat() if fb.submitted_at else None,
                "rating": fb.rating,
                "feedback_tag": fb.feedback_tag
            }
            for fb in confidence_data
            if fb.rating is not None  # Only include rated entries
        ]
        
        # Calculate statistics if data exists
        if trend:
            ratings = [t["rating"] for t in trend]
            avg_rating = sum(ratings) / len(ratings)
            min_rating = min(ratings)
            max_rating = max(ratings)
        else:
            avg_rating = None
            min_rating = None
            max_rating = None
        
        return {
            "student_id": student_id,
            "data_points": len(trend),
            "average_rating": round(avg_rating, 2) if avg_rating else None,
            "min_rating": min_rating,
            "max_rating": max_rating,
            "confidence_data": trend
        }
    
    except Exception as e:
        print(f"❌ Error in /api/analytics/confidence-trend: {str(e)}")
        return {
            "student_id": student_id,
            "error": str(e),
            "confidence_data": []
        }


# ─────────────────────────────────────────────────────────────────────────────
# Summary Endpoint (Bonus)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary/{student_id}")
def get_student_analytics_summary(
    student_id: int,
    db: Session = Depends(get_db)
) -> Dict:
    """
    Return a comprehensive analytics summary for a student.
    
    Combines:
    - Feedback distribution
    - Total feedback count
    - Average confidence rating
    - Weakest concept
    - Current difficulty level
    
    Useful for dashboards and quick overviews.
    """
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # Fetch student record
        # ─────────────────────────────────────────────────────────────────
        
        student = db.query(StudentProfile).filter(
            StudentProfile.id == student_id
        ).first()
        
        if not student:
            return {
                "student_id": student_id,
                "error": "Student not found"
            }
        
        # ─────────────────────────────────────────────────────────────────
        # Aggregate feedback statistics
        # ─────────────────────────────────────────────────────────────────
        
        feedback_stats = (
            db.query(
                FeedbackLog.feedback_tag,
                func.count(FeedbackLog.id).label("count")
            )
            .filter(FeedbackLog.student_id == student_id)
            .group_by(FeedbackLog.feedback_tag)
            .all()
        )
        
        distribution = {tag: 0 for tag in ["too_easy", "too_hard", "helpful", "unclear"]}
        for tag, count in feedback_stats:
            if tag in distribution:
                distribution[tag] = count
        
        total_feedback = sum(distribution.values())
        
        # ─────────────────────────────────────────────────────────────────
        # Calculate average confidence
        # ─────────────────────────────────────────────────────────────────
        
        avg_confidence = (
            db.query(func.avg(FeedbackLog.rating))
            .filter(
                FeedbackLog.student_id == student_id,
                FeedbackLog.rating.isnot(None)
            )
            .scalar()
        )
        
        # ─────────────────────────────────────────────────────────────────
        # Find weakest concept
        # ─────────────────────────────────────────────────────────────────
        
        weakest = (
            db.query(
                FeedbackLog.focus_concept,
                func.count(FeedbackLog.id).label("count")
            )
            .filter(
                FeedbackLog.student_id == student_id,
                FeedbackLog.feedback_tag == "too_hard"
            )
            .group_by(FeedbackLog.focus_concept)
            .order_by(func.count(FeedbackLog.id).desc())
            .first()
        )
        
        return {
            "student_id": student_id,
            "student_name": student.name,
            "current_difficulty": student.difficulty_level,
            "total_feedback": total_feedback,
            "feedback_distribution": distribution,
            "average_confidence_rating": round(avg_confidence, 2) if avg_confidence else None,
            "weakest_concept": weakest[0] if weakest else "general",
            "weakest_concept_difficulty_count": weakest[1] if weakest else 0
        }
    
    except Exception as e:
        print(f"❌ Error in /api/analytics/summary: {str(e)}")
        return {
            "student_id": student_id,
            "error": str(e)
        }
