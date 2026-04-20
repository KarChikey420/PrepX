"""
services.voice.tts
~~~~~~~~~~~~~~~~~~
Text-to-Speech using Deepgram Aura API.

Implements streaming TTS — text is sent to the Deepgram API and audio byte
chunks are yielded back as an async generator.

Performance: Uses a module-level httpx client with connection pooling
to avoid TCP+TLS handshake overhead on every request (~200-400ms saved).
"""

from __future__ import annotations

import asyncio
import struct
from typing import AsyncIterator

import httpx
import structlog

from core.config import settings
from core.exceptions import ExternalAPIError

logger = structlog.get_logger(__name__)

# ── Connection-Pooled HTTP Client (Singleton) ─────────────────────────
# Reuses TCP connections across requests, eliminating DNS + TCP + TLS
# handshake overhead (~200-400ms per call on Render).

_http_client: httpx.AsyncClient | None = None


def get_tts_client() -> httpx.AsyncClient:
    """Return the singleton httpx client for TTS, lazily initialized."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(
                max_connections=10,
                max_keepalive_connections=5,
                keepalive_expiry=120,
            ),
            http2=False,  # Deepgram doesn't support HTTP/2 for TTS
        )
        logger.info("tts.client_initialized")
    return _http_client


async def close_tts_client() -> None:
    """Gracefully close the TTS HTTP client. Called during app shutdown."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None
        logger.info("tts.client_closed")


async def stream_tts(
    text: str,
    voice: str | None = None,
    sample_rate: int = 16000,
    language_code: str = "en-US",
) -> AsyncIterator[bytes]:
    """
    Stream TTS audio from Deepgram Aura.

    Args:
        text: The text to synthesize into speech.
        voice: Deepgram Aura voice identifier (e.g., 'aura-athena-en').
        sample_rate: Audio sample rate in Hz.

    Yields:
        Raw audio bytes (chunks) as they stream from the API.
    """
    if not text.strip():
        return

    voice = voice or settings.deepgram_tts_model
    # Requesting raw linear16 PCM to match original implementation's expectations if joined
    url = f"https://api.deepgram.com/v1/speak?model={voice}&encoding=linear16&sample_rate={sample_rate}"
    
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "application/json",
    }
    payload = {"text": text}

    logger.debug(
        "tts.streaming_start",
        text_length=len(text),
        voice=voice,
        sample_rate=sample_rate,
    )

    client = get_tts_client()

    try:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                error_msg = error_text.decode()
                logger.error(
                    "tts.request_failed",
                    status_code=response.status_code,
                    error=error_msg,
                    url=url,
                )
                raise ExternalAPIError(
                    service="DeepgramTTS",
                    message=f"TTS request failed with status {response.status_code}: {error_msg}",
                )

            total_bytes_yielded = 0
            async for chunk in response.aiter_bytes():
                if chunk:
                    total_bytes_yielded += len(chunk)
                    yield chunk

            logger.info(
                "tts.streaming_complete",
                text_length=len(text),
                total_audio_bytes=total_bytes_yielded,
            )

    except Exception as e:
        logger.error("tts.error", error=str(e))
        if isinstance(e, ExternalAPIError):
            raise e
        raise ExternalAPIError(
            service="DeepgramTTS",
            message=f"TTS failure: {e}",
        ) from e


def create_wav_header(data_size: int, sample_rate: int = 16000, num_channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Create a standard WAV header for raw PCM data."""
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)
    
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,  # Subchunk1Size for PCM
        1,   # AudioFormat: PCM
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b'data',
        data_size
    )
    return header


async def synthesize_full(
    text: str,
    voice: str | None = None,
    sample_rate: int = 16000,
) -> bytes:
    """
    Non-streaming TTS: synthesize full audio and return all bytes at once.
    """
    chunks: list[bytes] = []
    async for chunk in stream_tts(text, voice=voice, sample_rate=sample_rate):
        chunks.append(chunk)
        
    pcm_data = b"".join(chunks)
    if not pcm_data:
        return b""
        
    # Re-adding WAV header because we requested linear16 PCM from Deepgram
    wav_header = create_wav_header(len(pcm_data), sample_rate=sample_rate)
    return wav_header + pcm_data
