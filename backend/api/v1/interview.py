"""
api.v1.interview
~~~~~~~~~~~~~~~~
REST endpoints for interview session lifecycle management.
"""

from __future__ import annotations

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException
import structlog

from core.exceptions import SessionNotFoundError, SessionExpiredError
from core.redis import cache_session_state
from models.schemas import (
    InitializeRequest,
    InitializeResponse,
    FinalizeResponse,
    SessionState,
)
from models.session import InterviewSession, SessionStatus
from models.user import User
from services.report import generate_session_report

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/interview", tags=["Interview"])


@router.post("/initialize", response_model=InitializeResponse)
async def initialize_interview(request: InitializeRequest) -> InitializeResponse:
    """
    Initialize a new interview session.

    - Creates the session in MongoDB.
    - Pre-warms the Redis cache with session state for 0ms lookups.
    - Returns the session ID and WebSocket URL for streaming.
    """
    logger.info(
        "interview.initializing",
        role=request.role,
        level=request.level,
        skills=request.skills,
    )

    # ── Resolve or create user ─────────────────────────────────────
    user_id: str | None = None
    if request.user_email:
        user = await User.find_one(User.email == request.user_email)
        if user is None:
            user = User(email=request.user_email)
            await user.insert()
            logger.info("interview.user_created", email=request.user_email)
        user_id = str(user.id)

    # ── Create session in MongoDB ──────────────────────────────────
    session = InterviewSession(
        user_id=user_id,
        role=request.role,
        level=request.level,
        target_skills=request.skills,
        questions_per_skill=request.questions_per_skill,
    )
    await session.insert()
    session_id = str(session.id)

    # ── Pre-warm Redis cache ───────────────────────────────────────
    state = SessionState(
        session_id=session_id,
        role=request.role,
        level=request.level,
        target_skills=request.skills,
        questions_per_skill=request.questions_per_skill,
    )
    await cache_session_state(session_id, state.model_dump())

    # ── Link session to user history ───────────────────────────────
    if user_id:
        user = await User.get(user_id)
        if user:
            user.history.append(session_id)
            await user.save()

    ws_url = f"/api/v1/interview/stream/{session_id}"

    logger.info(
        "interview.initialized",
        session_id=session_id,
        ws_url=ws_url,
    )

    return InitializeResponse(
        session_id=session_id,
        ws_url=ws_url,
        role=request.role,
        level=request.level,
        target_skills=request.skills,
    )


@router.post("/{session_id}/finalize", response_model=FinalizeResponse)
async def finalize_interview(
    session_id: str,
    background_tasks: BackgroundTasks,
) -> FinalizeResponse:
    """
    Finalize an interview session.

    - Aggregates session data.
    - Triggers a background task to generate a Markdown report using Kimi K2.
    - Returns immediately to prevent HTTP timeouts.
    """
    logger.info("interview.finalizing", session_id=session_id)

    # ── Load session ───────────────────────────────────────────────
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        raise SessionNotFoundError(session_id=session_id)

    if session is None:
        raise SessionNotFoundError(session_id=session_id)

    if session.status == SessionStatus.COMPLETED:
        # Already finalized — return the existing report
        return FinalizeResponse(
            session_id=session_id,
            status=session.status.value,
            message="Session already finalized.",
            report_markdown=session.report_markdown,
        )

    # ── Mark as completing ─────────────────────────────────────────
    session.status = SessionStatus.COMPLETED
    session.updated_at = datetime.now(timezone.utc)
    await session.save()

    # ── Update user skill matrix ───────────────────────────────────
    if session.user_id and session.evaluation_history:
        user = await User.get(session.user_id)
        if user:
            for evaluation in session.evaluation_history:
                skill = evaluation.get("skill", "unknown")
                score = evaluation.get("score", 0)
                if skill not in user.skill_matrix:
                    user.skill_matrix[skill] = []
                user.skill_matrix[skill].append(score)
            await user.save()
            logger.info("interview.skill_matrix_updated", user_id=session.user_id)

    # ── Trigger background report generation ───────────────────────
    background_tasks.add_task(generate_session_report, session_id)

    logger.info("interview.finalize_triggered", session_id=session_id)

    return FinalizeResponse(
        session_id=session_id,
        status="completing",
        message="Session finalized. Report is being generated in the background.",
    )


@router.get("/{session_id}/report")
async def get_report(session_id: str) -> dict:
    """
    Retrieve the generated interview report.

    Returns the Markdown report if available, or a status indicating
    it's still being generated.
    """
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        raise SessionNotFoundError(session_id=session_id)

    if session is None:
        raise SessionNotFoundError(session_id=session_id)

    if session.report_markdown:
        return {
            "session_id": session_id,
            "status": "ready",
            "report_markdown": session.report_markdown,
        }

    return {
        "session_id": session_id,
        "status": "generating",
        "message": "Report is still being generated. Please check back shortly.",
    }
