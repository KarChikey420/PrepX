"""
services.voice.stt
~~~~~~~~~~~~~~~~~~
Speech-to-Text using NVIDIA Nematron ASR via the NVIDIA API.

Implements chunked audio buffering — audio chunks are accumulated
and sent to the STT API when the buffer reaches a configurable threshold,
allowing processing to begin before the user finishes speaking.
"""

from __future__ import annotations

import base64
import io
from typing import Optional

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential
import structlog

from core.config import settings
from core.exceptions import ExternalAPIError, RateLimitError

logger = structlog.get_logger(__name__)

# Buffer threshold: accumulate at least this many bytes before sending to STT.
# 16kHz, 16-bit mono PCM ≈ 32KB/s → 48KB ≈ 1.5s of audio.
DEFAULT_BUFFER_THRESHOLD_BYTES: int = 48_000


class AudioBuffer:
    """
    Accumulates raw audio bytes and triggers STT when the buffer
    reaches a configurable threshold.
    """

    def __init__(self, threshold_bytes: int = DEFAULT_BUFFER_THRESHOLD_BYTES) -> None:
        self._buffer = io.BytesIO()
        self._threshold = threshold_bytes
        self._total_bytes = 0

    def append(self, chunk: bytes) -> bool:
        """
        Append audio bytes. Returns True if the buffer is ready for STT.
        """
        self._buffer.write(chunk)
        self._total_bytes += len(chunk)
        return self._total_bytes >= self._threshold

    def flush(self) -> bytes:
        """Return all buffered audio and reset."""
        data = self._buffer.getvalue()
        self._buffer = io.BytesIO()
        self._total_bytes = 0
        return data

    @property
    def size(self) -> int:
        return self._total_bytes

    def has_data(self) -> bool:
        return self._total_bytes > 0


@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
    wait=wait_exponential(multiplier=1, min=1, max=15),
    stop=stop_after_attempt(3),
)
async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Send audio bytes to NVIDIA Nematron ASR for transcription.

    Args:
        audio_bytes: Raw audio data (WAV/PCM format).

    Returns:
        The transcribed text string.

    Raises:
        RateLimitError: If the API returns 429.
        ExternalAPIError: For other API failures.
    """
    if not audio_bytes:
        return ""

    # Encode audio to base64 for the NVIDIA API
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    headers = {
        "Authorization": f"Bearer {settings.nematron_asr_stt}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "model": settings.nematron_stt_model,
        "messages": [
            {
                "role": "user",
                "content": (
                    f"Transcribe the following audio:\n"
                    f'<audio src="data:audio/wav;base64,{audio_b64}" />'
                ),
            }
        ],
        "max_tokens": 1024,
        "temperature": 0.0,
    }

    logger.debug(
        "stt.transcribing",
        audio_size_bytes=len(audio_bytes),
        model=settings.nematron_stt_model,
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.nematron_stt_base_url}/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code == 429:
        retry_after = response.headers.get("Retry-After")
        raise RateLimitError(
            service="NematronSTT",
            retry_after=int(retry_after) if retry_after else None,
        )

    if response.status_code != 200:
        raise ExternalAPIError(
            service="NematronSTT",
            message=f"STT request failed with status {response.status_code}",
            details={"status_code": response.status_code, "body": response.text[:500]},
        )

    data = response.json()
    transcript = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    logger.info(
        "stt.transcribed",
        transcript_length=len(transcript),
        audio_size_bytes=len(audio_bytes),
    )

    return transcript.strip()


async def transcribe_audio_chunks(
    audio_chunks: list[bytes],
    buffer_threshold: int = DEFAULT_BUFFER_THRESHOLD_BYTES,
) -> str:
    """
    Convenience function: accumulate multiple audio chunks and transcribe.

    This merges all provided chunks then sends them at once.
    For real-time chunked processing during a WebSocket stream,
    use AudioBuffer directly.
    """
    buffer = AudioBuffer(threshold_bytes=buffer_threshold)
    for chunk in audio_chunks:
        buffer.append(chunk)

    if buffer.has_data():
        audio_data = buffer.flush()
        return await transcribe_audio(audio_data)

    return ""
