"""
main.py
~~~~~~~
FastAPI application entry point.

Initializes the application with lifecycle management (startup/shutdown),
mounts all routers, registers exception handlers, and configures CORS.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from core.config import settings
from core.database import init_db, close_db
from core.exceptions import register_exception_handlers
from core.logging import setup_logging
from core.redis import get_redis
from api.v1.router import v1_router
from api.ws.interview import ws_router

# ── Initialize logging before anything else ────────────────────────────
setup_logging()
logger = structlog.get_logger(__name__)


# ── Application Lifespan ───────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manage application startup and shutdown lifecycle.

    Startup:
      1. Initialize MongoDB + Beanie
      2. Warm up Redis connection
      3. Log readiness

    Shutdown:
      1. Close MongoDB connection
      2. Log shutdown
    """
    logger.info(
        "app.starting",
        app_name=settings.app_name,
        version=settings.app_version,
    )

    # ── Startup ────────────────────────────────────────────────────
    await init_db()
    get_redis()  # Warm up the Redis singleton
    logger.info("app.ready", app_name=settings.app_name)

    yield

    # ── Shutdown ───────────────────────────────────────────────────
    await close_db()
    logger.info("app.shutdown_complete")


# ── Create FastAPI App ─────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Enterprise AI Voice Interviewer — A production-grade, asynchronous "
        "backend for conducting real-time AI-powered technical interviews "
        "with voice streaming."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS Middleware ────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Register Exception Handlers ───────────────────────────────────────

register_exception_handlers(app)


# ── Mount Routers ──────────────────────────────────────────────────────

app.include_router(v1_router)
app.include_router(ws_router)


# ── Health Check ───────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check() -> dict:
    """
    Health check endpoint for load balancers and Docker HEALTHCHECK.
    """
    # Quick Redis check
    redis_status = "connected"
    try:
        client = get_redis()
        client.ping()
    except Exception:
        redis_status = "disconnected"

    # Quick MongoDB check
    mongo_status = "connected"
    try:
        from core.database import get_client
        client = get_client()
        await client.admin.command("ping")
    except Exception:
        mongo_status = "disconnected"

    return {
        "status": "ok",
        "version": settings.app_version,
        "app_name": settings.app_name,
        "mongodb": mongo_status,
        "redis": redis_status,
    }


@app.get("/", tags=["System"])
async def root() -> dict:
    """Root endpoint with API information."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "initialize": "POST /api/v1/interview/initialize",
            "stream": "WS /api/v1/interview/stream/{session_id}",
            "finalize": "POST /api/v1/interview/{session_id}/finalize",
            "report": "GET /api/v1/interview/{session_id}/report",
        },
    }
