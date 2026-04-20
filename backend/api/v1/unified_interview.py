"""
api.v1.unified_interview
~~~~~~~~~~~~~~~~~~~~~~~~
Unified interview REST API — single flow for all interview sessions.

Flow:
  POST /upload        → resume + JD → profile analysis → MongoDB session
  POST /{id}/start    → generate 10 questions → Redis → return Q1 + TTS
  POST /{id}/turn     → audio → STT → evaluate → mentor hint → next Q + TTS
  POST /{id}/finish   → generate final report → MongoDB
  GET  /{id}/report   → return persisted report
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile
import structlog

from core.redis import get_redis, cache_session_state, get_session_state, update_session_state
from models.schemas import (
    CandidateProfile,
    FinalReport,
    ReportPollResponse,
    StartResponse,
    UnifiedQuestion,
    UnifiedSessionState,
    UnifiedTurnResponse,
    UploadResponse,
    EvaluationResult,
    SessionStatusResponse,
)
from models.session import InterviewSession, SessionStatus
from services.agents.evaluator import EvaluatorAgent
from services.agents.interviewer import InterviewerAgent
from services.agents.mentor import MentorAgent
from services.profile_analyzer import ProfileAnalyzerAgent
from services.resume_parser import extract_text_from_file
from services.voice.stt import transcribe_audio
from services.voice.tts import synthesize_full
from core.redis import store_audio_bytes, get_audio_bytes
from fastapi.responses import Response

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/interview", tags=["Unified Interview"])

# ── Agent singletons (created once, reused per request) ───────────────
_analyzer = ProfileAnalyzerAgent()
_evaluator = EvaluatorAgent()
_interviewer = InterviewerAgent()
_mentor = MentorAgent()

TOTAL_QUESTIONS = 10


def _audio_url_for_turn(session_id: str, turn_index: int) -> str:
    """Build the stable relative URL for a synthesized turn audio asset."""
    return f"/api/v1/interview/{session_id}/audio/{turn_index}"


def _session_profile(session: InterviewSession) -> CandidateProfile | None:
    """Build a candidate profile from a persisted session when analysis is complete."""
    if (
        not session.resume_parsed
        or not session.candidate_name
        or not session.experience_level
        or session.years_of_experience is None
        or not session.job_title_applying_for
    ):
        return None

    return CandidateProfile(
        candidate_name=session.candidate_name,
        experience_level=session.experience_level,
        years_of_experience=session.years_of_experience,
        technical_skills=session.technical_skills or [],
        soft_skills=session.soft_skills or [],
        past_roles=session.past_roles or [],
        projects=session.projects or [],
        job_title_applying_for=session.job_title_applying_for,
        key_jd_requirements=session.key_jd_requirements or [],
        matched_skills=session.matched_skills or [],
        skill_gaps=session.skill_gaps or [],
        interview_focus_areas=session.interview_focus_areas or [],
    )


def _apply_profile_to_session(session: InterviewSession, profile: CandidateProfile) -> None:
    """Persist analyzed profile fields onto the session document."""
    session.role = profile.job_title_applying_for
    session.level = profile.experience_level
    session.target_skills = (
        profile.technical_skills
        or profile.interview_focus_areas
        or profile.skill_gaps
        or ["general_interview"]
    )
    session.candidate_name = profile.candidate_name
    session.experience_level = profile.experience_level
    session.years_of_experience = profile.years_of_experience
    session.technical_skills = profile.technical_skills
    session.soft_skills = profile.soft_skills
    session.past_roles = profile.past_roles
    session.projects = profile.projects
    session.job_title_applying_for = profile.job_title_applying_for
    session.key_jd_requirements = profile.key_jd_requirements
    session.matched_skills = profile.matched_skills
    session.skill_gaps = profile.skill_gaps
    session.interview_focus_areas = profile.interview_focus_areas
    session.resume_parsed = True
    session.status = SessionStatus.ACTIVE
    session.error_detail = None
    session.updated_at = datetime.now(timezone.utc)


def _build_state_from_profile(session_id: str, profile: CandidateProfile) -> UnifiedSessionState:
    """Create the initial Redis state for a freshly analyzed session."""
    return UnifiedSessionState(
        session_id=session_id,
        role=profile.job_title_applying_for,
        level=profile.experience_level,
        profile=profile.model_dump(),
    )


async def _mark_session_error(session_id: str, detail: str) -> None:
    """Persist a session-level analysis failure so clients can surface it."""
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        logger.error("unified.session_error_invalid_id", session_id=session_id, detail=detail)
        return

    if not session:
        logger.error("unified.session_error_missing", session_id=session_id, detail=detail)
        return

    session.status = SessionStatus.ERROR
    session.error_detail = detail
    session.resume_parsed = False
    session.updated_at = datetime.now(timezone.utc)
    await session.save()


async def _analyze_upload_in_background(
    session_id: str,
    file_bytes: bytes,
    filename: str,
    job_description: str,
) -> None:
    """
    Continue resume parsing and AI analysis after the upload response returns.
    """
    logger.info("unified.upload_background_started", session_id=session_id, filename=filename)

    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        logger.exception("unified.upload_background_invalid_session_id", session_id=session_id)
        return

    if not session:
        logger.error("unified.upload_background_session_missing", session_id=session_id)
        return

    try:
        resume_text = await extract_text_from_file(file_bytes, filename)

        if not resume_text.strip():
            raise ValueError(
                "Could not extract text from the resume. Please ensure it is a text-based PDF or DOCX (not an image or scan)."
            )

        profile: CandidateProfile = await _analyzer.analyze_resume(resume_text, job_description)

        _apply_profile_to_session(session, profile)
        await session.save()

        state = _build_state_from_profile(session_id, profile)
        await cache_session_state(session_id, state.model_dump())

        logger.info(
            "unified.upload_background_complete",
            session_id=session_id,
            candidate=profile.candidate_name,
        )
    except ValueError as e:
        logger.error("unified.upload_background_analysis_failed", session_id=session_id, error=str(e))
        await _mark_session_error(session_id, f"Analysis failed: {str(e)}")
    except Exception:
        logger.exception("unified.upload_background_error", session_id=session_id)
        await _mark_session_error(
            session_id,
            "An unexpected error occurred while analyzing the resume. Please try the upload again.",
        )


# ── Helpers ────────────────────────────────────────────────────────────


async def _synthesize_and_store(session_id: str, turn_index: int, text: str) -> str | None:
    """Synthesize TTS audio, store in Redis, and return a relative URL."""
    try:
        audio_bytes = await synthesize_full(text)
        if audio_bytes:
            await store_audio_bytes(session_id, turn_index, audio_bytes)
            return _audio_url_for_turn(session_id, turn_index)
    except Exception as e:
        logger.error(
            "unified.tts_failed",
            session_id=session_id,
            turn_index=turn_index,
            error=str(e),
            exc_info=True,
        )
    return None


async def _ensure_question_audio(session_id: str, turn_index: int, text: str) -> str | None:
    """Reuse cached audio when possible so retried starts stay lightweight."""
    if not text:
        return None

    if await get_audio_bytes(session_id, turn_index):
        return _audio_url_for_turn(session_id, turn_index)

    return await _synthesize_and_store(session_id, turn_index, text)


async def _synthesize_safe(text: str) -> str | None:
    """Deprecated: Base64 synthesis. Use _synthesize_and_store instead."""
    try:
        audio_bytes = await synthesize_full(text)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        logger.warning("unified.tts_failed", error=str(e))
    return None


async def _load_state(session_id: str) -> UnifiedSessionState:
    """Load session state from Redis. Raises 404 if not found."""
    cached = await get_session_state(session_id)
    if cached is None:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    return UnifiedSessionState(**cached)


async def _build_start_response_from_state(session_id: str, state: UnifiedSessionState) -> StartResponse:
    """Return the current question so /start can be safely retried or resumed."""
    if not state.questions:
        raise HTTPException(status_code=409, detail="Interview questions are not ready yet.")

    current_index = min(max(state.current_question_index, 0), len(state.questions) - 1)
    current_question = state.questions[current_index]
    question_text = state.last_question or current_question.get("question", "")
    audio_url = await _ensure_question_audio(session_id, current_index, question_text)

    return StartResponse(
        session_id=session_id,
        question_text=question_text,
        audio_url=audio_url,
        question_number=current_index + 1,
        total_questions=TOTAL_QUESTIONS,
        focus_area=current_question.get("focus_area", ""),
        question_type=current_question.get("type", ""),
    )


# ── UPLOAD ─────────────────────────────────────────────────────────────


@router.post("/upload", response_model=UploadResponse, summary="Upload resume + JD")
async def upload_resume(
    request: Request,
    background_tasks: BackgroundTasks,
    resume: UploadFile = File(..., description="Resume file (PDF or DOCX)"),
    job_description: str = Form(..., description="Full job description text"),
) -> UploadResponse:
    """
    Step 1 — Upload resume and job description.

    - Extracts text from PDF/DOCX.
    - Analyzes profile via LLM (skills, gaps, focus areas).
    - Creates an InterviewSession in MongoDB.
    - Pre-warms Redis state.
    - Returns session_id + structured CandidateProfile.
    """
    logger.info(
        "unified.upload_started",
        filename=resume.filename,
        content_type=resume.content_type,
        job_description_length=len(job_description.strip()),
        client_host=request.client.host if request.client else None,
    )

    # 1. Basic Validation
    if not job_description.strip():
        logger.warning("unified.upload_invalid_job_description", filename=resume.filename)
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    try:
        file_bytes = await resume.read()
        logger.info(
            "unified.upload_file_read",
            filename=resume.filename,
            bytes_read=len(file_bytes),
            content_type=resume.content_type,
        )
        if not file_bytes:
            logger.warning("unified.upload_empty_file", filename=resume.filename)
            raise HTTPException(status_code=400, detail="Resume file is empty.")

        session = InterviewSession(
            role="processing",
            level="processing",
            target_skills=["processing"],
            status=SessionStatus.PROCESSING,
            resume_parsed=False,
        )
        await session.insert()
        session_id = str(session.id)
        logger.info("unified.upload_session_created", session_id=session_id, filename=resume.filename)

        background_tasks.add_task(
            _analyze_upload_in_background,
            session_id,
            file_bytes,
            resume.filename or "resume.pdf",
            job_description,
        )

        logger.info("unified.upload_accepted", session_id=session_id, filename=resume.filename)

        return UploadResponse(
            session_id=session_id,
            status=SessionStatus.PROCESSING.value,
            message="Upload received. Profile analysis is running in the background.",
        )

    except HTTPException as e:
        logger.warning(
            "unified.upload_http_error",
            filename=resume.filename,
            status_code=e.status_code,
            detail=e.detail,
        )
        raise e
    except Exception:
        logger.exception("unified.upload_error", filename=resume.filename)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while accepting the upload.")


# ── START ──────────────────────────────────────────────────────────────


@router.post("/{session_id}/start", response_model=StartResponse, summary="Start interview — generates Q1")
async def start_interview(session_id: str) -> StartResponse:
    """
    Step 2 — Start the interview.

    - Generates 10 personalized questions from the candidate profile.
    - Stores all questions in Redis state.
    - Returns the first question + TTS audio.
    """
    logger.info("unified.start", session_id=session_id)

    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found.")

    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if session.status == SessionStatus.PROCESSING or not session.resume_parsed:
        raise HTTPException(status_code=409, detail="Profile analysis is still in progress.")

    if session.status == SessionStatus.ERROR:
        raise HTTPException(
            status_code=409,
            detail=session.error_detail or "Profile analysis failed. Please upload the resume again.",
        )

    try:
        state = await _load_state(session_id)
    except HTTPException:
        profile = _session_profile(session)
        if not profile:
            raise HTTPException(status_code=404, detail="Session state is not ready yet.")

        state = _build_state_from_profile(session_id, profile)
        await cache_session_state(session_id, state.model_dump())

    if state.status != "active":
        raise HTTPException(status_code=409, detail="Session is not active.")

    if state.questions:
        logger.info(
            "unified.start_resumed",
            session_id=session_id,
            question_index=state.current_question_index,
        )
        return await _build_start_response_from_state(session_id, state)

    # 1. Generate 10 questions
    profile = CandidateProfile(**state.profile)
    questions: list[UnifiedQuestion] = await _analyzer.generate_questions(profile)

    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate questions.")

    questions_dicts = [q.model_dump() for q in questions[:TOTAL_QUESTIONS]]

    # 2. Get first question (index 0, no last_score yet)
    question_text, _ = await _interviewer.get_next_question(
        questions=questions_dicts,
        current_index=0,
        last_score=None,
    )
    first_q = questions_dicts[0]

    # 3. TTS audio (Optimized: Binary)
    audio_url = await _ensure_question_audio(session_id, 0, question_text)

    # 4. Update Redis state
    state.questions = questions_dicts
    state.current_question_index = 0
    state.last_question = question_text
    state.conversation_history.append({
        "role": "interviewer",
        "content": question_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await update_session_state(session_id, state.model_dump())

    logger.info("unified.start_complete", session_id=session_id, q_count=len(questions_dicts))

    return StartResponse(
        session_id=session_id,
        question_text=question_text,
        audio_url=audio_url,
        question_number=1,
        total_questions=TOTAL_QUESTIONS,
        focus_area=first_q.get("focus_area", ""),
        question_type=first_q.get("type", ""),
    )


# ── TURN ───────────────────────────────────────────────────────────────


@router.post("/{session_id}/turn", response_model=UnifiedTurnResponse, summary="Submit audio answer")
async def process_turn(
    session_id: str,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="Candidate's audio response (WebM/WAV/OGG)"),
) -> UnifiedTurnResponse:
    """
    Step 3 (repeated) — Process one interview turn.

    Optimized pipeline:
      Audio → STT → Evaluate → (Mentor + Next Question) concurrent → TTS
      MongoDB persist runs in background (Redis is source of truth).
    """
    turn_start = time.perf_counter()
    logger.info("unified.turn_started", session_id=session_id)

    state = await _load_state(session_id)

    if state.status != "active":
        raise HTTPException(status_code=409, detail="Session is completed. Use /finish or /report.")

    if not state.questions:
        raise HTTPException(status_code=400, detail="Interview not started. Call /start first.")

    current_index = state.current_question_index
    current_q = state.questions[current_index]
    last_question = state.last_question or current_q.get("question", "")

    # ── 1. STT ─────────────────────────────────────────────────────────
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received.")

    stt_start = time.perf_counter()
    try:
        transcript = await transcribe_audio(audio_bytes)
    except Exception as e:
        logger.error("unified.stt_error", error=str(e), session_id=session_id)
        raise HTTPException(status_code=500, detail="Failed to transcribe audio.")

    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Could not understand the audio. Please try again.")

    stt_ms = round((time.perf_counter() - stt_start) * 1000, 2)

    # Record candidate answer in history
    state.conversation_history.append({
        "role": "candidate",
        "content": transcript,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # ── 2. Evaluate (must complete before mentor, needs score) ─────────
    eval_start = time.perf_counter()
    evaluation_dict: Dict[str, Any] = await _analyzer.evaluate_answer(
        question=last_question,
        expected_keywords=current_q.get("expected_keywords", []),
        answer=transcript,
        focus_area=current_q.get("focus_area", ""),
        level=state.level,
    )
    evaluation_dict["question_id"] = current_q.get("id")
    evaluation_dict["focus_area"] = current_q.get("focus_area", "")
    state.evaluations.append(evaluation_dict)
    state.last_score = evaluation_dict.get("score")
    eval_ms = round((time.perf_counter() - eval_start) * 1000, 2)

    logger.info(
        "unified.turn_evaluated",
        session_id=session_id,
        q_index=current_index,
        score=state.last_score,
        stt_ms=stt_ms,
        eval_ms=eval_ms,
    )

    # ── 3. Parallel: Mentor hint + Next question ───────────────────────
    # These are independent of each other — run concurrently with asyncio.gather
    parallel_start = time.perf_counter()

    state.current_question_index += 1
    next_index = state.current_question_index
    is_complete = next_index >= TOTAL_QUESTIONS

    feedback_text = evaluation_dict.get("feedback", "")

    async def _get_mentor_hint() -> str:
        try:
            eval_result = EvaluationResult(
                score=evaluation_dict.get("score", 5),
                feedback=feedback_text,
                strengths=evaluation_dict.get("strengths", []),
                weaknesses=evaluation_dict.get("weaknesses", []),
            )
            next_skill = (
                state.questions[next_index].get("focus_area")
                if not is_complete
                else None
            )
            return await _mentor.generate_transition(
                evaluation=eval_result,
                skill=current_q.get("focus_area", ""),
                is_last_question_for_skill=is_complete,
                next_skill=next_skill,
            )
        except Exception as e:
            logger.warning("unified.mentor_failed", error=str(e))
            return "Great effort, let's continue."

    async def _get_next_question() -> tuple[str, str, str]:
        if is_complete:
            return "", "", ""
        try:
            q_text, _ = await _interviewer.get_next_question(
                questions=state.questions,
                current_index=next_index,
                last_score=state.last_score,
            )
            next_q_data = state.questions[next_index]
            return q_text, next_q_data.get("focus_area", ""), next_q_data.get("type", "")
        except Exception as e:
            logger.error("unified.next_question_error", error=str(e))
            return f"Tell me about your experience in {state.role}.", "", ""

    # Run mentor + next question concurrently
    mentor_hint, (next_question_text, next_focus_area, next_q_type) = await asyncio.gather(
        _get_mentor_hint(),
        _get_next_question(),
    )
    parallel_ms = round((time.perf_counter() - parallel_start) * 1000, 2)

    # ── 4. TTS for next question ───────────────────────────────────────
    audio_url = None
    if not is_complete and next_question_text:
        state.last_question = next_question_text
        state.conversation_history.append({
            "role": "interviewer",
            "content": next_question_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        audio_url = await _synthesize_and_store(session_id, next_index, next_question_text)
    else:
        state.status = "completed"

    # ── 5. Update Redis (hot path source of truth) ─────────────────────
    await update_session_state(session_id, state.model_dump())

    # ── 6. Persist to MongoDB in background (non-blocking) ─────────────
    async def _persist_to_db():
        try:
            session = await InterviewSession.get(PydanticObjectId(session_id))
            if session:
                session.conversation_history = state.conversation_history
                session.current_skill_index = state.current_question_index
                if is_complete:
                    session.status = SessionStatus.COMPLETED
                session.updated_at = datetime.now(timezone.utc)
                await session.save()
        except Exception as e:
            logger.error("unified.db_persist_error", error=str(e))

    background_tasks.add_task(_persist_to_db)

    total_ms = round((time.perf_counter() - turn_start) * 1000, 2)
    logger.info(
        "unified.turn_complete",
        session_id=session_id,
        total_ms=total_ms,
        stt_ms=stt_ms,
        eval_ms=eval_ms,
        parallel_ms=parallel_ms,
        is_complete=is_complete,
    )

    return UnifiedTurnResponse(
        transcription=transcript,
        mentor_hint=mentor_hint,
        feedback=feedback_text,
        question_text=next_question_text,
        audio_url=audio_url,
        question_number=next_index + 1,  # 1-based for the client
        total_questions=TOTAL_QUESTIONS,
        focus_area=next_focus_area,
        question_type=next_q_type,
        is_complete=is_complete,
    )


# ── FINISH ─────────────────────────────────────────────────────────────


@router.post("/{session_id}/finish", response_model=FinalReport, summary="Generate final report")
async def finish_interview(session_id: str) -> FinalReport:
    """
    Step 4 — Complete interview and generate the final report.

    Synchronously generates a structured FinalReport from all evaluations.
    Persists the report to MongoDB and cleans up Redis.
    """
    logger.info("unified.finish_started", session_id=session_id)

    state = await _load_state(session_id)

    if not state.evaluations:
        raise HTTPException(status_code=400, detail="No answers recorded. Complete at least one turn.")

    profile = CandidateProfile(**state.profile)

    # Generate final report
    report: FinalReport = await _analyzer.generate_final_report(
        profile=profile,
        evaluations=state.evaluations,
        questions=state.questions,
    )
    report.session_id = session_id

    # Build markdown report for MongoDB
    rec_list = "\n".join(f"{i+1}. {r}" for i, r in enumerate(report.recommendations))
    strengths_list = "\n".join(f"- {s}" for s in report.strong_areas)
    weak_list = "\n".join(f"- {w}" for w in report.weak_areas)
    gap_list = "\n".join(f"- {g}" for g in report.skill_gap)

    report_md = f"""# PrepX Interview Report — {profile.candidate_name}

**Role:** {profile.job_title_applying_for}  
**Level:** {profile.experience_level}  
**Overall Score:** {report.overall_score:.1f}/10  
**Verdict:** {report.verdict}

---

## Overall Summary
{report.overall_summary}

## Strong Areas
{strengths_list}

## Weak Areas
{weak_list}

## Skill Gaps vs JD
{gap_list}

## Communication Assessment
{report.communication_assessment}

## Recommendations
{rec_list}
"""

    # Persist to MongoDB
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
        if session:
            session.status = SessionStatus.COMPLETED
            session.evaluation_history = state.evaluations
            session.report_markdown = report_md
            session.report_data = report.model_dump()
            session.updated_at = datetime.now(timezone.utc)
            await session.save()
    except Exception as e:
        logger.error("unified.finish_db_error", error=str(e))

    # Clean up Redis
    try:
        redis = get_redis()
        await redis.delete(f"session:{session_id}")
    except Exception as e:
        logger.warning("unified.redis_cleanup_failed", error=str(e))

    logger.info("unified.finish_complete", session_id=session_id, verdict=report.verdict)

    return report


# ── REPORT ─────────────────────────────────────────────────────────────


@router.get("/{session_id}/report", response_model=ReportPollResponse, summary="Get interview report")
async def get_report(session_id: str) -> ReportPollResponse:
    """
    Step 5 — Retrieve the final report from MongoDB.

    Returns status: ready | not_started
    """
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found.")

    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if session.report_markdown:
        return ReportPollResponse(
            session_id=session_id,
            status="ready",
            report_markdown=session.report_markdown,
            report=FinalReport(**session.report_data) if session.report_data else None,
        )

    return ReportPollResponse(
        session_id=session_id,
        status="not_started",
        report_markdown=None,
    )


# ── UTILITY ENDPOINTS (Status + Binary Audio) ────────────────────────


@router.get("/{session_id}/status", response_model=SessionStatusResponse, summary="Check session status")
async def check_session_status(session_id: str) -> SessionStatusResponse:
    """Check if session is alive in Redis and return current progress."""
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
    except Exception:
        session = None

    if not session:
        return SessionStatusResponse(
            session_id=session_id,
            status="expired",
            current_step="upload",
            question_number=0,
            detail="Session not found.",
        )

    profile = _session_profile(session)

    if session.status == SessionStatus.PROCESSING or not session.resume_parsed:
        return SessionStatusResponse(
            session_id=session_id,
            status=SessionStatus.PROCESSING.value,
            current_step="upload",
            question_number=0,
            profile=None,
            detail="Profile analysis is still running.",
        )

    if session.status == SessionStatus.ERROR:
        return SessionStatusResponse(
            session_id=session_id,
            status=SessionStatus.ERROR.value,
            current_step="upload",
            question_number=0,
            profile=None,
            detail=session.error_detail or "Profile analysis failed.",
        )

    state_dict = await get_session_state(session_id)

    if state_dict:
        state = UnifiedSessionState(**state_dict)
        current_step = "profile"
        question_number = 0

        if state.questions:
            current_step = "interview" if state.status == "active" else "report"
            question_number = state.current_question_index + 1

        return SessionStatusResponse(
            session_id=session_id,
            status=state.status,
            current_step=current_step,
            question_number=question_number,
            total_questions=TOTAL_QUESTIONS,
            profile=profile,
        )

    step = "profile"
    if session.conversation_history and session.status != SessionStatus.COMPLETED:
        step = "interview"
    elif session.status == SessionStatus.COMPLETED:
        step = "report"

    return SessionStatusResponse(
        session_id=session_id,
        status="active" if session.status != SessionStatus.COMPLETED else "completed",
        current_step=step,
        question_number=session.current_skill_index or 0,
        total_questions=TOTAL_QUESTIONS,
        profile=profile,
        detail=session.error_detail,
    )


@router.get("/{session_id}/audio/{turn_id}", summary="Fetch binary audio WAV")
async def get_turn_audio(session_id: str, turn_id: int):
    """Serve binary WAV audio from Redis cache."""
    audio_bytes = await get_audio_bytes(session_id, turn_id)
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="Audio not found or expired.")
    
    return Response(content=audio_bytes, media_type="audio/wav")
