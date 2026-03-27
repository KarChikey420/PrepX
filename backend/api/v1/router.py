"""
api.v1.router
~~~~~~~~~~~~~
Unified v1 API router — single interview flow only.
"""

from __future__ import annotations

from fastapi import APIRouter

from api.v1.unified_interview import router as unified_router
from api.v1.auth import router as auth_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(unified_router)
v1_router.include_router(auth_router)
