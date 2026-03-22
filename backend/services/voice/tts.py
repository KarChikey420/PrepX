"""
services.voice.tts
~~~~~~~~~~~~~~~~~~
Text-to-Speech using NVIDIA Riva TTS via the NVIDIA API.

Implements streaming TTS — text is sent to the API and audio byte
chunks are yielded back as an async generator for real-time playback
over WebSockets.
"""

from __future__ import annotations

from typing import AsyncIterator, Optional

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential
import structlog

from core.config import settings
from core.exceptions import ExternalAPIError, RateLimitError

logger = structlog.get_logger(__name__)


async def stream_tts(
    text: str,
    voice: str = "English-US.Female-1",
    sample_rate: int = 22050,
    language_code: str = "en-US",
) -> AsyncIterator[bytes]:
    """
    Stream TTS audio from NVIDIA Riva.

    Sends text to the NVIDIA TTS API and yields audio byte chunks
    as they arrive — enabling real-time audio streaming over WebSockets
    without waiting for the entire audio file to render.

    Args:
        text: The text to synthesize into speech.
        voice: NVIDIA Riva voice identifier.
        sample_rate: Audio sample rate in Hz.
        language_code: BCP-47 language code.

    Yields:
        Raw audio bytes (chunks) as they stream from the API.

    Raises:
        RateLimitError: If the API returns 429.
        ExternalAPIError: For other API failures.
    """
    if not text.strip():
        return

    headers = {
        "Authorization": f"Bearer {settings.nvidia_riva_tts}",
        "Content-Type": "application/json",
        "Accept": "audio/wav",
    }

    payload = {
        "model": settings.nvidia_riva_tts_model,
        "input": text,
        "voice": voice,
        "response_format": "wav",
        "sample_rate": sample_rate,
        "language_code": language_code,
    }

    logger.debug(
        "tts.streaming_start",
        text_length=len(text),
        voice=voice,
        model=settings.nvidia_riva_tts_model,
    )

    total_bytes_yielded = 0

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{settings.nvidia_riva_tts_base_url}/audio/speech",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    raise RateLimitError(
                        service="NvidiaRivaTTS",
                        retry_after=int(retry_after) if retry_after else None,
                    )

                if response.status_code != 200:
                    body = await response.aread()
                    raise ExternalAPIError(
                        service="NvidiaRivaTTS",
                        message=f"TTS request failed with status {response.status_code}",
                        details={
                            "status_code": response.status_code,
                            "body": body.decode("utf-8", errors="replace")[:500],
                        },
                    )

                async for chunk in response.aiter_bytes(chunk_size=4096):
                    total_bytes_yielded += len(chunk)
                    yield chunk

        logger.info(
            "tts.streaming_complete",
            text_length=len(text),
            total_audio_bytes=total_bytes_yielded,
        )

    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.error("tts.connection_error", error=str(e))
        raise ExternalAPIError(
            service="NvidiaRivaTTS",
            message=f"TTS connection failed: {e}",
        ) from e


async def synthesize_full(
    text: str,
    voice: str = "English-US.Female-1",
    sample_rate: int = 22050,
) -> bytes:
    """
    Non-streaming TTS: synthesize full audio and return all bytes at once.

    Use this for short phrases where latency is less critical
    (e.g., initial greeting).
    """
    chunks: list[bytes] = []
    async for chunk in stream_tts(text, voice=voice, sample_rate=sample_rate):
        chunks.append(chunk)
    return b"".join(chunks)
