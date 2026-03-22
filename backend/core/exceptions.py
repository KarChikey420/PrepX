"""
core.exceptions
~~~~~~~~~~~~~~~
Custom exceptions and FastAPI exception handlers.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger(__name__)


# ── Custom Exceptions ──────────────────────────────────────────────────


class AppBaseError(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str, status_code: int = 500, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class ExternalAPIError(AppBaseError):
    """Raised when an external API call fails (non-429)."""

    def __init__(self, service: str, message: str, details: Any = None) -> None:
        super().__init__(
            message=f"[{service}] {message}",
            status_code=502,
            details=details,
        )
        self.service = service


class RateLimitError(AppBaseError):
    """Raised when an external API returns HTTP 429."""

    def __init__(self, service: str, retry_after: int | None = None) -> None:
        super().__init__(
            message=f"[{service}] Rate limit exceeded. Retry after {retry_after or 'unknown'}s.",
            status_code=429,
            details={"service": service, "retry_after": retry_after},
        )
        self.service = service
        self.retry_after = retry_after


class SessionNotFoundError(AppBaseError):
    """Raised when an interview session cannot be found."""

    def __init__(self, session_id: str) -> None:
        super().__init__(
            message=f"Interview session '{session_id}' not found.",
            status_code=404,
            details={"session_id": session_id},
        )


class SessionExpiredError(AppBaseError):
    """Raised when a session has already been completed or expired."""

    def __init__(self, session_id: str) -> None:
        super().__init__(
            message=f"Interview session '{session_id}' has already been completed.",
            status_code=409,
            details={"session_id": session_id},
        )


# ── FastAPI Exception Handlers ────────────────────────────────────────


def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the FastAPI app."""

    @app.exception_handler(RateLimitError)
    async def handle_rate_limit(request: Request, exc: RateLimitError) -> JSONResponse:
        logger.warning(
            "api.rate_limited",
            service=exc.service,
            retry_after=exc.retry_after,
            path=str(request.url),
        )
        headers = {}
        if exc.retry_after is not None:
            headers["Retry-After"] = str(exc.retry_after)
        return JSONResponse(
            status_code=429,
            content={
                "error": "RateLimitError",
                "message": exc.message,
                "details": exc.details,
            },
            headers=headers,
        )

    @app.exception_handler(AppBaseError)
    async def handle_app_error(request: Request, exc: AppBaseError) -> JSONResponse:
        logger.error(
            "app.error",
            error_type=type(exc).__name__,
            message=exc.message,
            status_code=exc.status_code,
            path=str(request.url),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": type(exc).__name__,
                "message": exc.message,
                "details": exc.details,
            },
        )

    @app.exception_handler(Exception)
    async def handle_unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "app.unhandled_error",
            error_type=type(exc).__name__,
            message=str(exc),
            path=str(request.url),
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "message": "An unexpected error occurred.",
                "details": None,
            },
        )
