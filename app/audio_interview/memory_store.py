from __future__ import annotations

import asyncio
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


def _now_iso() -> str:
    # Use epoch seconds for compactness; ISO can be derived if needed.
    return str(int(time.time()))


@dataclass(frozen=True)
class InterviewSessionMeta:
    session_id: str
    student_id: int
    role: str
    difficulty: str
    question_count: int
    created_at: str


class InMemoryInterviewStore:
    """
    In-memory session store (development fallback).

    This allows running the audio interview system without a Redis server for local/dev testing.
    For production, set INTERVIEW_STORE_BACKEND=redis and provide a reachable REDIS_URL.
    """

    def __init__(self) -> None:
        self._ttl_seconds = int(os.getenv("INTERVIEW_SESSION_TTL_SECONDS", "7200"))  # 2 hours
        self._lock = asyncio.Lock()
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._expiry: Dict[str, float] = {}

    def _touch_locked(self, session_id: str) -> None:
        self._expiry[session_id] = time.time() + self._ttl_seconds

    def _purge_expired_locked(self) -> None:
        now = time.time()
        expired = [sid for sid, exp in self._expiry.items() if exp <= now]
        for sid in expired:
            self._sessions.pop(sid, None)
            self._expiry.pop(sid, None)

    async def create_session(
        self,
        *,
        student_id: int,
        role: str,
        difficulty: str,
        question_count: int,
    ) -> InterviewSessionMeta:
        async with self._lock:
            self._purge_expired_locked()

            session_id = str(uuid.uuid4())
            meta = {
                "session_id": session_id,
                "student_id": int(student_id),
                "role": (role or "").strip(),
                "difficulty": (difficulty or "").strip(),
                "question_count": int(question_count),
                "created_at": _now_iso(),
            }
            self._sessions[session_id] = {
                "meta": meta,
                "questions": [],
                "current_question": "",
                "progress": {"current_index": 0, "total": int(question_count), "status": "active"},
                "transcript": [],
                "evaluations": [],
                "report": {},
            }
            self._touch_locked(session_id)
            return InterviewSessionMeta(**meta)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return None
            self._touch_locked(session_id)
            return dict(session.get("meta") or {})

    async def set_questions(self, session_id: str, questions: List[str]) -> None:
        cleaned = [str(q).strip() for q in (questions or []) if str(q).strip()]
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return
            session["questions"] = cleaned
            self._touch_locked(session_id)

    async def get_questions(self, session_id: str) -> List[str]:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return []
            self._touch_locked(session_id)
            return list(session.get("questions") or [])

    async def set_current_question(self, session_id: str, question: str) -> None:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return
            session["current_question"] = (question or "").strip()
            self._touch_locked(session_id)

    async def get_current_question(self, session_id: str) -> str:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return ""
            self._touch_locked(session_id)
            return str(session.get("current_question") or "").strip()

    async def set_progress(self, session_id: str, *, current_index: int, total: int, status: str) -> None:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return
            session["progress"] = {"current_index": int(current_index), "total": int(total), "status": str(status)}
            self._touch_locked(session_id)

    async def get_progress(self, session_id: str) -> Dict[str, Any]:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return {"current_index": 0, "total": 0, "status": "unknown"}
            self._touch_locked(session_id)
            return dict(session.get("progress") or {"current_index": 0, "total": 0, "status": "unknown"})

    async def append_transcript(
        self,
        session_id: str,
        *,
        question_index: int,
        question: str,
        transcript: str,
    ) -> None:
        item = {
            "question_index": int(question_index),
            "question": (question or "").strip(),
            "transcript": (transcript or "").strip(),
        }
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return
            session.setdefault("transcript", []).append(item)
            self._touch_locked(session_id)

    async def get_transcript(self, session_id: str) -> List[Dict[str, Any]]:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return []
            self._touch_locked(session_id)
            items = session.get("transcript") or []
            return list(items) if isinstance(items, list) else []

    async def append_evaluation(self, session_id: str, evaluation: Dict[str, Any]) -> None:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return
            session.setdefault("evaluations", []).append(evaluation or {})
            self._touch_locked(session_id)

    async def get_evaluations(self, session_id: str) -> List[Dict[str, Any]]:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return []
            self._touch_locked(session_id)
            items = session.get("evaluations") or []
            return list(items) if isinstance(items, list) else []

    async def set_report(self, session_id: str, report: Dict[str, Any]) -> None:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return
            session["report"] = report or {}
            self._touch_locked(session_id)

    async def get_report(self, session_id: str) -> Dict[str, Any]:
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return {}
            self._touch_locked(session_id)
            report = session.get("report") or {}
            return dict(report) if isinstance(report, dict) else {}

    async def end_session(self, session_id: str) -> None:
        progress = await self.get_progress(session_id)
        total = int(progress.get("total", 0) or 0)
        idx = int(progress.get("current_index", 0) or 0)
        await self.set_progress(session_id, current_index=idx, total=total, status="completed")


# Singleton used by the router (process-local).
MEMORY_INTERVIEW_STORE = InMemoryInterviewStore()

