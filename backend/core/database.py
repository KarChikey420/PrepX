"""
core.database
~~~~~~~~~~~~~
Async MongoDB connection and Beanie ODM initialization.
"""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

import structlog

from core.config import settings

logger = structlog.get_logger(__name__)

_client: AsyncIOMotorClient | None = None  # type: ignore[type-arg]


async def init_db() -> None:
    """Initialize the MongoDB connection and register Beanie documents."""
    global _client

    # Import document models here to avoid circular imports.
    from models.user import User
    from models.session import InterviewSession

    logger.info("database.connecting", url=settings.mongo_link[:30] + "***")

    _client = AsyncIOMotorClient(
        settings.mongo_link,
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
    )

    await init_beanie(
        database=_client[settings.mongodb_db_name],
        document_models=[User, InterviewSession],
    )

    logger.info("database.connected", db=settings.mongodb_db_name)


async def close_db() -> None:
    """Gracefully close the MongoDB connection."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("database.disconnected")


def get_client() -> AsyncIOMotorClient:  # type: ignore[type-arg]
    """Return the active Motor client (for health checks, etc.)."""
    if _client is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _client
