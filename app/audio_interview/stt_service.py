from __future__ import annotations

import os
import struct
from typing import Optional

import httpx


def pcm16le_to_wav_bytes(pcm16le: bytes, *, sample_rate: int = 16000, channels: int = 1) -> bytes:
    """
    Build a minimal WAV container in-memory for PCM16LE audio.

    No audio is written to disk.
    """
    if channels <= 0:
        channels = 1
    if sample_rate <= 0:
        sample_rate = 16000

    byte_rate = sample_rate * channels * 2  # 16-bit
    block_align = channels * 2
    data_size = len(pcm16le)

    # RIFF header
    header = b"RIFF"
    header += struct.pack("<I", 36 + data_size)
    header += b"WAVE"

    # fmt chunk
    header += b"fmt "
    header += struct.pack("<I", 16)  # PCM
    header += struct.pack("<H", 1)  # AudioFormat PCM
    header += struct.pack("<H", channels)
    header += struct.pack("<I", sample_rate)
    header += struct.pack("<I", byte_rate)
    header += struct.pack("<H", block_align)
    header += struct.pack("<H", 16)  # bits per sample

    # data chunk
    header += b"data"
    header += struct.pack("<I", data_size)

    return header + (pcm16le or b"")


class GroqWhisperSTTService:
    """
    Groq Whisper STT service (OpenAI-compatible transcription endpoint).

    Audio is sent as in-memory bytes (WAV). No files are created.
    """

    def __init__(self) -> None:
        self._api_key = (os.getenv("GROQ_API_KEY") or "").strip()
        self._base_url = (os.getenv("GROQ_API_BASE") or "https://api.groq.com/openai/v1").rstrip("/")
        self._model = (os.getenv("GROQ_WHISPER_MODEL") or "whisper-large-v3").strip()
        # Lower temperature reduces hallucinations.
        try:
            self._temperature = float(os.getenv("GROQ_WHISPER_TEMPERATURE", "0") or "0")
        except Exception:
            self._temperature = 0.0

    def enabled(self) -> bool:
        return bool(self._api_key)

    async def transcribe_wav(self, wav_bytes: bytes, *, language: Optional[str] = None) -> str:
        if not self.enabled():
            raise RuntimeError("STT is not configured. Set GROQ_API_KEY.")

        url = f"{self._base_url}/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        data = {"model": self._model, "temperature": self._temperature}
        if language:
            data["language"] = language

        # NOTE: Use an in-memory multipart upload; no disk writes.
        files = {"file": ("audio.wav", wav_bytes or b"", "audio/wav")}

        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, data=data, files=files)
            resp.raise_for_status()
            payload = resp.json() if resp.content else {}
            text = (payload.get("text") or "").strip() if isinstance(payload, dict) else ""
            return text
