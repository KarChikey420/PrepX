"""
core.redis
~~~~~~~~~~
Upstash Redis REST client for distributed session state caching.

Uses the Upstash REST API (HTTP-based) rather than raw TCP Redis,
which is ideal for serverless / edge-compatible deployments.
"""

from __future__ import annotations

import base64
import json
from typing import Any, Optional

from upstash_redis.asyncio import Redis
import structlog

from core.config import settings

logger = structlog.get_logger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis:
    """Return the Upstash Redis singleton client (lazy-initialized)."""
    global _redis
    if _redis is None:
        _redis = Redis(
            url=settings.upstash_redis_rest_url,
            token=settings.upstash_redis_rest_token,
        )
        logger.info("redis.connected", url=settings.upstash_redis_rest_url[:40] + "***")
    return _redis


# ── Session State Helpers ──────────────────────────────────────────────


def _session_key(session_id: str) -> str:
    """Consistent Redis key for a session."""
    return f"session:{session_id}"


async def cache_session_state(session_id: str, state: dict[str, Any], ttl_seconds: int = 7200) -> None:
    """
    Pre-warm or update session state in Redis.

    Args:
        session_id: The interview session ID.
        state: Dictionary representing the serializable session state.
        ttl_seconds: Time-to-live in seconds (default 2 hours).
    """
    client = get_redis()
    payload = json.dumps(state, default=str)
    await client.set(_session_key(session_id), payload, ex=ttl_seconds)
    logger.debug("redis.session_cached", session_id=session_id, ttl=ttl_seconds)


async def get_session_state(session_id: str) -> Optional[dict[str, Any]]:
    """
    Retrieve cached session state from Redis.

    Returns:
        The session state dict, or None if not found / expired.
    """
    client = get_redis()
    raw: Optional[str] = await client.get(_session_key(session_id))  # type: ignore[assignment]
    if raw is None:
        logger.debug("redis.session_miss", session_id=session_id)
        return None
    logger.debug("redis.session_hit", session_id=session_id)
    return json.loads(raw)  # type: ignore[arg-type]


async def update_session_state(session_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    """
    Merge *updates* into the existing cached session state.

    If no cached state exists, the updates dict becomes the full state.
    Returns the updated state.

    Performance: Single GET→merge→SET cycle (no retry loop).
    Upstash REST API operations are inherently atomic per-command,
    so the previous 5-retry optimistic concurrency loop was unnecessary overhead.
    """
    client = get_redis()
    key = _session_key(session_id)

    try:
        current_raw = await client.get(key)
        current = json.loads(current_raw) if current_raw else {}
        current.update(updates)
        await client.set(key, json.dumps(current, default=str), ex=7200)
        logger.debug("redis.session_updated", session_id=session_id)
        return current
    except Exception as e:
        logger.error("redis.update_failed", session_id=session_id, error=str(e))
        # Fallback: write updates as the full state
        await cache_session_state(session_id, updates)
        return updates


# ── Binary Audio Storage (Optimized for JSON-free delivery) ───────────


def _audio_key(session_id: str, turn_index: int) -> str:
    """Redis key for binary audio playback."""
    return f"session:{session_id}:audio:{turn_index}"


async def store_audio_bytes(session_id: str, turn_index: int, audio_bytes: bytes, ttl: int = 600) -> None:
    """Store audio bytes as base64 text for safe transport through Upstash REST."""
    client = get_redis()
    encoded_audio = base64.b64encode(audio_bytes).decode("ascii")
    await client.set(_audio_key(session_id, turn_index), encoded_audio, ex=ttl)
    logger.debug("redis.audio_stored", session_id=session_id, turn=turn_index, size=len(audio_bytes))


async def get_audio_bytes(session_id: str, turn_index: int) -> Optional[bytes]:
    """Retrieve audio bytes that were stored as base64 text."""
    client = get_redis()
    encoded_audio: Optional[str] = await client.get(_audio_key(session_id, turn_index))  # type: ignore[assignment]
    if encoded_audio is None:
        return None

    try:
        return base64.b64decode(encoded_audio)
    except (TypeError, ValueError) as exc:
        logger.error(
            "redis.audio_decode_failed",
            session_id=session_id,
            turn=turn_index,
            error=str(exc),
        )
        return None


async def delete_session_state(session_id: str) -> None:
    """Remove session state from Redis."""
    client = get_redis()
    await client.delete(_session_key(session_id))
    logger.debug("redis.session_deleted", session_id=session_id)
