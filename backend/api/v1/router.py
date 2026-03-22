"""
api.v1.router
~~~~~~~~~~~~~
Aggregate all v1 REST API routes.
"""

from __future__ import annotations

from fastapi import APIRouter

from api.v1.interview import router as interview_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(interview_router)
