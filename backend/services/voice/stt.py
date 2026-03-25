"""
services.voice.stt
~~~~~~~~~~~~~~~~~~
Speech-to-Text using Deepgram API (via HTTP).

Implements chunked audio buffering — audio chunks are accumulated
and sent to the Deepgram API when the buffer reaches a configurable threshold.
"""

from __future__ import annotations

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
    Send audio bytes to Deepgram for transcription via HTTP.

    Args:
        audio_bytes: Raw audio data or WebM.

    Returns:
        The transcribed text string.

    Raises:
        RateLimitError: If the API returns 429.
        ExternalAPIError: For other API failures.
    """
    if not audio_bytes:
        return ""

    url = f"https://api.deepgram.com/v1/listen?model={settings.deepgram_stt_model}&smart_format=true&language=en"
    
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "audio/webm", # Most common from our frontend
    }

    logger.debug(
        "stt.transcribing",
        audio_size_bytes=len(audio_bytes),
        model=settings.deepgram_stt_model,
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, content=audio_bytes)

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            raise RateLimitError(
                service="DeepgramSTT",
                retry_after=int(retry_after) if retry_after else None,
            )

        if response.status_code != 200:
            logger.error(
                "stt.request_failed",
                status_code=response.status_code,
                response_body=response.text[:1000],
            )
            raise ExternalAPIError(
                service="DeepgramSTT",
                message=f"STT request failed with status {response.status_code}",
                details={"status_code": response.status_code, "body": response.text[:500]},
            )

        response_data = response.json()
        transcript = response_data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")

        logger.info(
            "stt.transcribed",
            transcript_length=len(transcript),
            audio_size_bytes=len(audio_bytes),
        )

        return transcript.strip()

    except Exception as e:
        if isinstance(e, (RateLimitError, ExternalAPIError)):
            raise e
        logger.error("stt.exception", error=str(e))
        raise ExternalAPIError(
            service="DeepgramSTT",
            message=f"STT failure: {e}",
        )


async def transcribe_audio_chunks(
    audio_chunks: list[bytes],
    buffer_threshold: int = DEFAULT_BUFFER_THRESHOLD_BYTES,
) -> str:
    """
    Convenience function: accumulate multiple audio chunks and transcribe.
    """
    buffer = AudioBuffer(threshold_bytes=buffer_threshold)
    for chunk in audio_chunks:
        buffer.append(chunk)

    if buffer.has_data():
        audio_data = buffer.flush()
        return await transcribe_audio(audio_data)

    return ""
