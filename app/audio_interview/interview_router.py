from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.audio_interview.evaluation_engine import EvaluationEngine
from app.audio_interview.interview_engine import InterviewEngine
from app.audio_interview.memory_store import MEMORY_INTERVIEW_STORE
from app.audio_interview.redis_manager import RedisInterviewStore
from app.audio_interview.stt_service import GroqWhisperSTTService, pcm16le_to_wav_bytes
from app.audio_interview.tts_service import ElevenLabsTTSService


router = APIRouter(prefix="/api/audio-interview", tags=["Audio Interview"])
logger = logging.getLogger(__name__)

_STORE_MODE: Optional[str] = None  # "redis" | "memory"
_STORE_WARNING: Optional[str] = None
_STORE_LOCK = asyncio.Lock()


def _redis_url() -> str:
    return (os.getenv("REDIS_URL") or "redis://127.0.0.1:6379/0").strip()


async def _redis_client():
    try:
        import redis.asyncio as redis_async  # type: ignore
    except Exception as e:
        raise RuntimeError("Redis client not installed. Add `redis` to requirements.txt.") from e

    return redis_async.from_url(
        _redis_url(),
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=float(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "1.0")),
        socket_timeout=float(os.getenv("REDIS_SOCKET_TIMEOUT", "2.0")),
    )


def _tts_url(session_id: str) -> str:
    return f"/api/audio-interview/{session_id}/question/audio"


def _safe_json(obj: Dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=True)


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _aggregate_report(evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not evaluations:
        return {
            "total_score": 0.0,
            "technical_knowledge_score": 0.0,
            "communication_score": 0.0,
            "strengths": [],
            "weaknesses": ["No evaluations available."],
            "improvement_suggestions": ["Complete at least one question to generate a report."],
        }

    def _avg(key: str) -> float:
        values: List[float] = []
        for item in evaluations:
            try:
                values.append(float(item.get(key, 0.0)))
            except Exception:
                continue
        return sum(values) / max(1, len(values))

    total = _avg("score")
    technical = _avg("technical_correctness")
    communication = _avg("communication_clarity")

    strengths: List[str] = []
    weaknesses: List[str] = []
    suggestions: List[str] = []

    # Aggregate top items (simple frequency-based).
    from collections import Counter

    s_counter: Counter = Counter()
    w_counter: Counter = Counter()
    sug_counter: Counter = Counter()

    for item in evaluations:
        for s in item.get("strengths", []) or []:
            if s:
                s_counter[str(s)] += 1
        for w in item.get("weaknesses", []) or []:
            if w:
                w_counter[str(w)] += 1
        for s in item.get("suggestions", []) or []:
            if s:
                sug_counter[str(s)] += 1

    strengths = [text for text, _ in s_counter.most_common(5)]
    weaknesses = [text for text, _ in w_counter.most_common(5)]
    suggestions = [text for text, _ in sug_counter.most_common(5)]

    return {
        "total_score": round(_clamp(total, 0.0, 10.0), 2),
        "technical_knowledge_score": round(_clamp(technical, 0.0, 10.0), 2),
        "communication_score": round(_clamp(communication, 0.0, 10.0), 2),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "improvement_suggestions": suggestions,
    }


async def _probe_redis() -> Tuple[bool, str]:
    try:
        redis = await _redis_client()
        try:
            await redis.ping()
        finally:
            try:
                await redis.close()
            except Exception:
                pass
        return True, ""
    except Exception as e:
        return False, str(e)


async def _resolve_store_mode() -> Tuple[str, Optional[str]]:
    """
    Resolve the session store backend once per process:

    - If INTERVIEW_STORE_BACKEND is set:
      - "redis": require Redis to be reachable.
      - "memory": use in-memory store (dev only).
    - Otherwise: auto-detect Redis, and fall back to memory if Redis is unavailable.
    """
    global _STORE_MODE, _STORE_WARNING
    if _STORE_MODE:
        return _STORE_MODE, _STORE_WARNING

    async with _STORE_LOCK:
        if _STORE_MODE:
            return _STORE_MODE, _STORE_WARNING

        requested = (os.getenv("INTERVIEW_STORE_BACKEND") or "").strip().lower()
        if requested and requested not in ("redis", "memory", "auto"):
            logger.warning("Unknown INTERVIEW_STORE_BACKEND=%r; falling back to auto.", requested)
            requested = "auto"

        if requested == "memory":
            _STORE_MODE = "memory"
            # Explicit choice: don't warn in the UI, but keep behavior predictable.
            _STORE_WARNING = None
            return _STORE_MODE, _STORE_WARNING

        if requested == "redis":
            ok, err = await _probe_redis()
            if not ok:
                raise RuntimeError(f"Redis store required but unavailable at {_redis_url()}: {err}")
            _STORE_MODE = "redis"
            _STORE_WARNING = None
            return _STORE_MODE, _STORE_WARNING

        # auto (default)
        ok, err = await _probe_redis()
        if ok:
            _STORE_MODE = "redis"
            _STORE_WARNING = None
            return _STORE_MODE, _STORE_WARNING

        _STORE_MODE = "memory"
        _STORE_WARNING = (
            f"Redis is unavailable at {_redis_url()} ({err}). "
            "Falling back to in-memory session store for this process. "
            "To start local Redis (Windows): powershell -ExecutionPolicy Bypass -File scripts\\dev_redis.ps1. "
            "For production, run Redis and set INTERVIEW_STORE_BACKEND=redis."
        )
        logger.warning(_STORE_WARNING)
        return _STORE_MODE, _STORE_WARNING


async def _get_store():
    """
    Returns: (store, redis_client, store_backend, warning)

    redis_client is only present when store_backend == "redis" and should be closed by the caller.
    """
    mode, warning = await _resolve_store_mode()
    if mode == "memory":
        return MEMORY_INTERVIEW_STORE, None, "memory", warning

    redis = await _redis_client()
    try:
        await redis.ping()
    except Exception as e:
        try:
            await redis.close()
        except Exception:
            pass
        raise RuntimeError(f"Redis is not reachable at {_redis_url()}: {str(e)}") from e

    return RedisInterviewStore(redis), redis, "redis", warning


@dataclass
class _STTStreamProcessor:
    """
    In-memory audio accumulator for near-real-time STT.

    - Accepts PCM16LE mono 16kHz frames over WebSocket.
    - Buffers a few seconds, transcribes, emits transcript updates, and clears the audio buffer.
    - No audio is written to disk.
    """

    websocket: WebSocket
    stt: GroqWhisperSTTService
    # 16kHz mono PCM16 => 32000 bytes/sec. Default to ~2.5s.
    segment_bytes: int = 80000

    _queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=120))
    _task: Optional[asyncio.Task] = None
    _buffer: bytearray = field(default_factory=bytearray)
    _parts: List[str] = field(default_factory=list)

    async def start(self) -> None:
        if self._task:
            return
        self._task = asyncio.create_task(self._run())

    async def push_audio(self, chunk: bytes) -> None:
        # Keep this tiny: just enqueue to avoid blocking the receive loop.
        await self._queue.put(("audio", chunk))

    async def flush_answer(self) -> str:
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        await self._queue.put(("flush", fut))
        return await fut

    async def stop(self) -> None:
        await self._queue.put(("close", None))
        if self._task:
            try:
                await self._task
            except Exception:
                pass
        self._task = None

    async def _run(self) -> None:
        while True:
            kind, payload = await self._queue.get()
            if kind == "close":
                # Drop any buffered audio.
                self._buffer.clear()
                return

            if kind == "audio":
                data = payload or b""
                if data:
                    self._buffer.extend(data)
                if len(self._buffer) >= self.segment_bytes:
                    await self._transcribe_and_emit(final=False)
                continue

            if kind == "flush":
                fut = payload
                # Transcribe remaining audio (if any) and return full answer transcript.
                await self._transcribe_and_emit(final=True)
                full = " ".join([p for p in self._parts if p]).strip()
                self._parts.clear()
                if fut and not fut.done():
                    fut.set_result(full)
                continue

    async def _transcribe_and_emit(self, *, final: bool) -> None:
        if not self._buffer:
            # Still emit a final marker so the UI can transition.
            if final:
                await self.websocket.send_text(_safe_json({"type": "transcript", "text": "", "final": True}))
            return

        pcm = bytes(self._buffer)
        self._buffer.clear()  # discard audio buffer immediately after copying

        try:
            wav = pcm16le_to_wav_bytes(pcm, sample_rate=16000, channels=1)
            text = (await self.stt.transcribe_wav(wav)) if self.stt.enabled() else ""
        except Exception as e:
            await self.websocket.send_text(_safe_json({"type": "error", "message": f"STT failed: {str(e)}"}))
            text = ""

        if text:
            self._parts.append(text)

        await self.websocket.send_text(_safe_json({"type": "transcript", "text": text, "final": final}))


@router.get("/{session_id}/question/audio")
async def stream_current_question_audio(session_id: str):
    """
    Stream the current interview question as speech (ElevenLabs).

    Audio is streamed and discarded; no audio is stored on disk.
    """
    store, redis, _, _ = await _get_store()
    try:
        question = await store.get_current_question(session_id)
        if not question:
            raise HTTPException(status_code=404, detail="No current question for session")

        tts = ElevenLabsTTSService()
        if not tts.enabled():
            raise HTTPException(status_code=500, detail="TTS not configured (set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID)")

        async def _iter_audio():
            async for chunk in tts.stream_speech(question):
                yield chunk

        return StreamingResponse(_iter_audio(), media_type="audio/mpeg")
    finally:
        try:
            if redis:
                await redis.close()
        except Exception:
            pass


@router.get("/report/{session_id}")
async def get_interview_report(session_id: str) -> Dict[str, Any]:
    store, redis, _, _ = await _get_store()
    try:
        report = await store.get_report(session_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report
    finally:
        try:
            if redis:
                await redis.close()
        except Exception:
            pass


@router.websocket("/ws")
async def audio_interview_ws(websocket: WebSocket):
    """
    WebSocket protocol:

    Client text messages (JSON):
    - { "type": "start", "student_id": 1, "role": "Data Analyst", "difficulty": "Beginner", "question_count": 5 }
    - { "type": "stop_answer" }  # flush STT, evaluate, advance question
    - { "type": "end" }          # end session

    Client binary messages:
    - raw PCM16LE mono 16kHz audio frames (in-memory only)
    """
    await websocket.accept()

    redis = None
    store_backend = "unknown"
    store_warning: Optional[str] = None
    try:
        store, redis, store_backend, store_warning = await _get_store()
    except Exception as e:
        try:
            await websocket.send_text(_safe_json({"type": "error", "message": f"Interview store init failed: {str(e)}"}))
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
        return

    engine = InterviewEngine()
    evaluator = EvaluationEngine()
    stt = GroqWhisperSTTService()
    tts_enabled = ElevenLabsTTSService().enabled()

    session_id: Optional[str] = None
    role = ""
    difficulty = ""
    question_count = 5
    questions: List[str] = []
    current_index = 0

    stt_stream = _STTStreamProcessor(websocket=websocket, stt=stt)
    await stt_stream.start()

    async def _send_question() -> None:
        nonlocal current_index
        question = questions[current_index] if 0 <= current_index < len(questions) else ""
        if session_id:
            await store.set_current_question(session_id, question)
            await store.set_progress(session_id, current_index=current_index, total=len(questions), status="active")
        await websocket.send_text(
            _safe_json(
                {
                    "type": "question",
                    "session_id": session_id,
                    "question": question,
                    "question_index": current_index + 1,
                    "total_questions": len(questions),
                    "tts_url": _tts_url(session_id) if (session_id and tts_enabled) else None,
                }
            )
        )

    try:
        while True:
            message = await websocket.receive()
            mtype = message.get("type")

            if mtype == "websocket.disconnect":
                break

            if mtype != "websocket.receive":
                continue

            if "bytes" in message and message["bytes"] is not None:
                if not session_id:
                    await websocket.send_text(_safe_json({"type": "error", "message": "Session not started"}))
                    continue
                # Audio chunk: process in-memory only.
                await stt_stream.push_audio(message["bytes"])
                continue

            raw_text = message.get("text")
            if not raw_text:
                continue

            try:
                payload = json.loads(raw_text)
            except Exception:
                await websocket.send_text(_safe_json({"type": "error", "message": "Invalid JSON message"}))
                continue

            msg_type = str(payload.get("type", "")).strip()

            if msg_type == "start":
                student_id = int(payload.get("student_id") or 0)
                role = str(payload.get("role") or "Data Analyst").strip()
                difficulty = str(payload.get("difficulty") or "Medium").strip()
                question_count = int(payload.get("question_count") or 5)
                question_count = max(1, min(10, question_count))

                meta = await store.create_session(
                    student_id=student_id,
                    role=role,
                    difficulty=difficulty,
                    question_count=question_count,
                )
                session_id = meta.session_id

                questions = engine.generate_questions(role=role, difficulty=difficulty, count=question_count)
                if not questions:
                    questions = ["Tell me about yourself and your recent work."] * question_count
                await store.set_questions(session_id, questions)

                current_index = 0
                await websocket.send_text(
                    _safe_json(
                        {
                            "type": "session_started",
                            "session_id": session_id,
                            "role": role,
                            "difficulty": difficulty,
                            "total_questions": len(questions),
                            "stt_enabled": stt.enabled(),
                            "tts_enabled": tts_enabled,
                            "store_backend": store_backend,
                            "warnings": [store_warning] if store_warning else [],
                        }
                    )
                )
                await _send_question()
                continue

            if msg_type == "stop_answer":
                if not session_id:
                    await websocket.send_text(_safe_json({"type": "error", "message": "Session not started"}))
                    continue

                question = questions[current_index] if 0 <= current_index < len(questions) else ""
                answer_text = await stt_stream.flush_answer()
                await store.append_transcript(
                    session_id,
                    question_index=current_index,
                    question=question,
                    transcript=answer_text,
                )

                evaluation = evaluator.evaluate(
                    role=role,
                    difficulty=difficulty,
                    question=question,
                    answer=answer_text,
                )
                evaluation_payload = {
                    "question_index": current_index + 1,
                    "question": question,
                    "answer_transcript": answer_text,
                    "evaluation": evaluation,
                }
                await store.append_evaluation(session_id, evaluation_payload)
                await websocket.send_text(_safe_json({"type": "evaluation", **evaluation_payload}))

                # Advance or finish
                if current_index + 1 >= len(questions):
                    evaluations = await store.get_evaluations(session_id)
                    report = _aggregate_report([item.get("evaluation", {}) for item in evaluations if isinstance(item, dict)])
                    await store.set_report(session_id, report)
                    await store.end_session(session_id)
                    await websocket.send_text(_safe_json({"type": "final_report", "session_id": session_id, "report": report}))
                else:
                    current_index += 1
                    await _send_question()

                continue

            if msg_type == "end":
                if session_id:
                    await store.end_session(session_id)
                await websocket.send_text(_safe_json({"type": "ended", "session_id": session_id}))
                break

            if msg_type == "ping":
                await websocket.send_text(_safe_json({"type": "pong"}))
                continue

            await websocket.send_text(_safe_json({"type": "error", "message": f"Unknown message type: {msg_type}"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(_safe_json({"type": "error", "message": f"Server error: {str(e)}"}))
        except Exception:
            pass
    finally:
        try:
            await stt_stream.stop()
        except Exception:
            pass
        try:
            if redis:
                await redis.close()
        except Exception:
            pass
