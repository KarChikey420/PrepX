"""
main.py
~~~~~~~
FastAPI application entry point — Unified Interview System.

Lifecycle:
  Startup:  MongoDB init → Redis warm-up
  Shutdown: MongoDB close

Routers:
  v1_router → /api/v1/interview/* (unified flow)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import structlog

from core.config import settings
from core.database import init_db, close_db
from core.exceptions import register_exception_handlers
from core.logging import setup_logging
from core.redis import get_redis
from api.v1.router import v1_router

# ── Initialize logging before anything else ────────────────────────────
setup_logging()
logger = structlog.get_logger(__name__)


# ── Application Lifespan ───────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Startup:  Init MongoDB + Beanie, warm up Redis.
    Shutdown: Close MongoDB connection.
    """
    logger.info("app.starting", app_name=settings.app_name, version=settings.app_version)
    await init_db()
    get_redis()  # Warm up singleton
    logger.info("app.ready", app_name=settings.app_name)

    yield

    await close_db()
    logger.info("app.shutdown_complete")


# ── App Instance ───────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "PrepX — AI-powered interview assistant. "
        "Upload your resume and job description to start a personalized, "
        "voice-enabled mock interview with adaptive difficulty and a final performance report."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS ───────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["https://prep-x-omega.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret_key,
)


# ── Exception Handlers ─────────────────────────────────────────────────

register_exception_handlers(app)


# ── Routers ────────────────────────────────────────────────────────────

app.include_router(v1_router)


# ── System Endpoints ───────────────────────────────────────────────────


@app.get("/health", tags=["System"], summary="Health check")
async def health_check() -> dict:
    """Liveness + readiness probe. Pings MongoDB and Redis."""
    redis_status = "connected"
    try:
        client = get_redis()
        await client.ping()
    except Exception:
        redis_status = "disconnected"

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


@app.get("/", tags=["System"], summary="API info")
async def root() -> dict:
    """Root endpoint — API info and endpoint map."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
        "flow": "upload → start → turn (×9) → finish → report",
        "endpoints": {
            "upload":  "POST /api/v1/interview/upload",
            "start":   "POST /api/v1/interview/{session_id}/start",
            "turn":    "POST /api/v1/interview/{session_id}/turn",
            "finish":  "POST /api/v1/interview/{session_id}/finish",
            "report":  "GET  /api/v1/interview/{session_id}/report",
        },
    }
