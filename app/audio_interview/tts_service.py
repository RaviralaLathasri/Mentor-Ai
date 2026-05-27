from __future__ import annotations

import os
from typing import AsyncIterator, Dict, Optional

import httpx


class ElevenLabsTTSService:
    """
    ElevenLabs TTS streaming client.

    Audio is streamed to the frontend; no audio is stored on disk.
    """

    def __init__(self) -> None:
        self._api_key = (os.getenv("ELEVENLABS_API_KEY") or "").strip()
        self._base_url = (os.getenv("ELEVENLABS_API_BASE") or "https://api.elevenlabs.io/v1").rstrip("/")
        self._voice_id = (os.getenv("ELEVENLABS_VOICE_ID") or "").strip()
        self._model_id = (os.getenv("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2").strip()

    def enabled(self) -> bool:
        return bool(self._api_key and self._voice_id)

    async def stream_speech(self, text: str) -> AsyncIterator[bytes]:
        if not self.enabled():
            raise RuntimeError("TTS is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.")

        url = f"{self._base_url}/text-to-speech/{self._voice_id}/stream"
        headers = {
            "xi-api-key": self._api_key,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        }

        payload: Dict[str, object] = {
            "text": (text or "").strip(),
            "model_id": self._model_id,
            "voice_settings": {
                "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.5")),
                "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY_BOOST", "0.75")),
            },
        }

        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    if chunk:
                        yield chunk

