from __future__ import annotations

import json
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


class RedisInterviewStore:
    """
    Redis-backed session store for the audio interview system.

    Note: Only text data is stored in Redis (questions, transcripts, progress, evaluations).
    Audio is processed in-memory and discarded after transcription.
    """

    def __init__(self, redis):
        self._redis = redis
        self._ttl_seconds = int(os.getenv("INTERVIEW_SESSION_TTL_SECONDS", "7200"))  # 2 hours

    @staticmethod
    def _key(session_id: str) -> str:
        return f"session:{session_id}"

    @staticmethod
    def _key_question(session_id: str) -> str:
        return f"session:{session_id}:question"

    @staticmethod
    def _key_transcript(session_id: str) -> str:
        return f"session:{session_id}:transcript"

    @staticmethod
    def _key_progress(session_id: str) -> str:
        return f"session:{session_id}:progress"

    @staticmethod
    def _key_evaluations(session_id: str) -> str:
        return f"session:{session_id}:evaluations"

    @staticmethod
    def _key_questions(session_id: str) -> str:
        return f"session:{session_id}:questions"

    @staticmethod
    def _key_report(session_id: str) -> str:
        return f"session:{session_id}:report"

    async def create_session(
        self,
        *,
        student_id: int,
        role: str,
        difficulty: str,
        question_count: int,
    ) -> InterviewSessionMeta:
        session_id = str(uuid.uuid4())
        meta = {
            "session_id": session_id,
            "student_id": int(student_id),
            "role": (role or "").strip(),
            "difficulty": (difficulty or "").strip(),
            "question_count": int(question_count),
            "created_at": _now_iso(),
        }
        await self._set_json(self._key(session_id), meta)
        await self._set_json(
            self._key_progress(session_id),
            {"current_index": 0, "total": int(question_count), "status": "active"},
        )
        return InterviewSessionMeta(**meta)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return await self._get_json(self._key(session_id))

    async def set_questions(self, session_id: str, questions: List[str]) -> None:
        cleaned = [str(q).strip() for q in (questions or []) if str(q).strip()]
        await self._set_json(self._key_questions(session_id), {"questions": cleaned})

    async def get_questions(self, session_id: str) -> List[str]:
        payload = await self._get_json(self._key_questions(session_id)) or {}
        items = payload.get("questions", [])
        if not isinstance(items, list):
            return []
        return [str(q).strip() for q in items if str(q).strip()]

    async def set_current_question(self, session_id: str, question: str) -> None:
        await self._set_json(self._key_question(session_id), {"text": (question or "").strip()})

    async def get_current_question(self, session_id: str) -> str:
        payload = await self._get_json(self._key_question(session_id)) or {}
        return str(payload.get("text", "")).strip()

    async def set_progress(self, session_id: str, *, current_index: int, total: int, status: str) -> None:
        await self._set_json(
            self._key_progress(session_id),
            {"current_index": int(current_index), "total": int(total), "status": str(status)},
        )

    async def get_progress(self, session_id: str) -> Dict[str, Any]:
        return await self._get_json(self._key_progress(session_id)) or {"current_index": 0, "total": 0, "status": "unknown"}

    async def append_transcript(
        self,
        session_id: str,
        *,
        question_index: int,
        question: str,
        transcript: str,
    ) -> None:
        # Stored as an append-only JSON list.
        item = {
            "question_index": int(question_index),
            "question": (question or "").strip(),
            "transcript": (transcript or "").strip(),
        }
        await self._list_rpush_json(self._key_transcript(session_id), item)

    async def get_transcript(self, session_id: str) -> List[Dict[str, Any]]:
        return await self._list_get_json(self._key_transcript(session_id))

    async def append_evaluation(self, session_id: str, evaluation: Dict[str, Any]) -> None:
        await self._list_rpush_json(self._key_evaluations(session_id), evaluation or {})

    async def get_evaluations(self, session_id: str) -> List[Dict[str, Any]]:
        return await self._list_get_json(self._key_evaluations(session_id))

    async def set_report(self, session_id: str, report: Dict[str, Any]) -> None:
        await self._set_json(self._key_report(session_id), report or {})

    async def get_report(self, session_id: str) -> Dict[str, Any]:
        return await self._get_json(self._key_report(session_id)) or {}

    async def end_session(self, session_id: str) -> None:
        progress = await self.get_progress(session_id)
        total = int(progress.get("total", 0) or 0)
        idx = int(progress.get("current_index", 0) or 0)
        await self.set_progress(session_id, current_index=idx, total=total, status="completed")

    async def _set_json(self, key: str, payload: Dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=True)
        await self._redis.set(key, raw, ex=self._ttl_seconds)

    async def _get_json(self, key: str) -> Optional[Dict[str, Any]]:
        raw = await self._redis.get(key)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def _list_rpush_json(self, key: str, payload: Dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=True)
        pipe = self._redis.pipeline()
        pipe.rpush(key, raw)
        pipe.expire(key, self._ttl_seconds)
        await pipe.execute()

    async def _list_get_json(self, key: str) -> List[Dict[str, Any]]:
        items = await self._redis.lrange(key, 0, -1)
        result: List[Dict[str, Any]] = []
        for raw in items or []:
            try:
                result.append(json.loads(raw))
            except Exception:
                continue
        return result

