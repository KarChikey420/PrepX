"""
services.voice.tts
~~~~~~~~~~~~~~~~~~
Text-to-Speech using NVIDIA Riva TTS via the NVIDIA API (gRPC).

Implements streaming TTS — text is sent to the gRPC API and audio byte
chunks are yielded back as an async generator for real-time playback
over WebSockets.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

import riva.client
import structlog

from core.config import settings
from core.exceptions import ExternalAPIError

logger = structlog.get_logger(__name__)


async def stream_tts(
    text: str,
    voice: str | None = None,
    sample_rate: int = 22050,
    language_code: str = "en-US",
) -> AsyncIterator[bytes]:
    """
    Stream TTS audio from NVIDIA Riva using the gRPC Python client.

    Sends text to the NVIDIA TTS API and yields audio byte chunks
    as they arrive natively.

    Args:
        text: The text to synthesize into speech.
        voice: NVIDIA Riva voice identifier.
        sample_rate: Audio sample rate in Hz.
        language_code: BCP-47 language code.

    Yields:
        Raw audio bytes (chunks) as they stream from the API.
    """
    if not text.strip():
        return

    voice = voice or settings.nvidia_riva_tts_voice

    # Automatically swap the HTTP base URL out for the gRPC endpoint if using NVIDIA cloud
    uri = settings.nvidia_riva_tts_base_url.replace("https://", "").replace("http://", "").split("/")[0]
    if "integrate.api.nvidia.com" in uri or "ai.api.nvidia.com" in uri:
        # The correct NVCF target for gRPC
        uri = "grpc.nvcf.nvidia.com:443"

    try:
        # Use Riva client auth
        auth = riva.client.Auth(
            uri=uri,
            use_ssl=True if "443" in uri else False,
            metadata_args=[
                ("authorization", f"Bearer {settings.nvidia_riva_tts}"),
                ("function-id", settings.nvidia_riva_tts_model),
            ],
        )

        tts_service = riva.client.SpeechSynthesisService(auth)

        logger.debug(
            "tts.streaming_start",
            text_length=len(text),
            voice=voice,
            uri=uri,
        )

        # Offload the blocking generate call to a thread
        def generate():
            return tts_service.synthesize_online(
                text=text,
                voice_name=voice,
                language_code=language_code,
                sample_rate_hz=sample_rate,
            )

        responses = await asyncio.to_thread(generate)

        # Iterate the chunks asynchronously so we don't freeze the FastAPI loop
        def get_next(iterator):
            try:
                return next(iterator)
            except StopIteration:
                return None

        total_bytes_yielded = 0

        while True:
            resp = await asyncio.to_thread(get_next, responses)
            if resp is None:
                break
                
            if resp.audio:
                total_bytes_yielded += len(resp.audio)
                yield resp.audio

        logger.info(
            "tts.streaming_complete",
            text_length=len(text),
            total_audio_bytes=total_bytes_yielded,
        )

    except Exception as e:
        logger.error("tts.grpc_error", error=str(e))
        raise ExternalAPIError(
            service="NvidiaRivaTTS(gRPC)",
            message=f"TTS gRPC failure: {e}",
        ) from e


async def synthesize_full(
    text: str,
    voice: str | None = None,
    sample_rate: int = 22050,
) -> bytes:
    """
    Non-streaming TTS: synthesize full audio and return all bytes at once.
    """
    chunks: list[bytes] = []
    async for chunk in stream_tts(text, voice=voice, sample_rate=sample_rate):
        chunks.append(chunk)
    return b"".join(chunks)
