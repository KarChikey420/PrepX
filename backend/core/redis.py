"""
core.redis
~~~~~~~~~~
Upstash Redis REST client for distributed session state caching.

Uses the Upstash REST API (HTTP-based) rather than raw TCP Redis,
which is ideal for serverless / edge-compatible deployments.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from upstash_redis import Redis
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


def cache_session_state(session_id: str, state: dict[str, Any], ttl_seconds: int = 7200) -> None:
    """
    Pre-warm or update session state in Redis.

    Args:
        session_id: The interview session ID.
        state: Dictionary representing the serializable session state.
        ttl_seconds: Time-to-live in seconds (default 2 hours).
    """
    client = get_redis()
    payload = json.dumps(state, default=str)
    client.set(_session_key(session_id), payload, ex=ttl_seconds)
    logger.debug("redis.session_cached", session_id=session_id, ttl=ttl_seconds)


def get_session_state(session_id: str) -> Optional[dict[str, Any]]:
    """
    Retrieve cached session state from Redis.

    Returns:
        The session state dict, or None if not found / expired.
    """
    client = get_redis()
    raw: Optional[str] = client.get(_session_key(session_id))  # type: ignore[assignment]
    if raw is None:
        logger.debug("redis.session_miss", session_id=session_id)
        return None
    logger.debug("redis.session_hit", session_id=session_id)
    return json.loads(raw)  # type: ignore[arg-type]


def update_session_state(session_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    """
    Merge *updates* into the existing cached session state.

    If no cached state exists, the updates dict becomes the full state.
    Returns the updated state.
    """
    current = get_session_state(session_id) or {}
    current.update(updates)
    cache_session_state(session_id, current)
    return current


def delete_session_state(session_id: str) -> None:
    """Remove session state from Redis."""
    client = get_redis()
    client.delete(_session_key(session_id))
    logger.debug("redis.session_deleted", session_id=session_id)
