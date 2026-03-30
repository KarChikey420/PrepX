"""
core.logging
~~~~~~~~~~~~~
Structured JSON logging configuration using structlog.
"""

from __future__ import annotations

import logging
import sys

import structlog

from core.config import settings


def setup_logging() -> None:
    """
    Configure structlog for structured JSON output with timestamp,
    log level colouring in dev, and JSON rendering in production.
    """

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.log_level == "DEBUG":
        # Development: coloured console output
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        # Production: JSON lines
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(settings.log_level.upper())

    # Quiet noisy libraries and driver internals that spam health/heartbeat logs.
    for noisy in ("uvicorn.access", "motor", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    # PyMongo debug logging can emit verbose SDAM heartbeat payloads when the
    # app runs with LOG_LEVEL=DEBUG. Disable the namespace explicitly so those
    # records never reach stdout in production.
    for noisy in (
        "pymongo",
        "pymongo.topology",
        "pymongo.serverSelection",
        "pymongo.connection",
        "pymongo.command",
    ):
        noisy_logger = logging.getLogger(noisy)
        noisy_logger.handlers.clear()
        noisy_logger.propagate = False
        noisy_logger.setLevel(logging.CRITICAL + 1)
