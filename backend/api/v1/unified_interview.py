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

import base64
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict

from beanie import PydanticObjectId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
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


# ── Helpers ────────────────────────────────────────────────────────────


async def _synthesize_and_store(session_id: str, turn_index: int, text: str) -> str | None:
    """Synthesize TTS audio, store in Redis, and return a relative URL."""
    try:
        audio_bytes = await synthesize_full(text)
        if audio_bytes:
            await store_audio_bytes(session_id, turn_index, audio_bytes)
            return f"/api/v1/interview/{session_id}/audio/{turn_index}"
    except Exception as e:
        logger.error(
            "unified.tts_failed",
            session_id=session_id,
            turn_index=turn_index,
            error=str(e),
            exc_info=True,
        )
    return None


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


# ── UPLOAD ─────────────────────────────────────────────────────────────


@router.post("/upload", response_model=UploadResponse, summary="Upload resume + JD")
async def upload_resume(
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
    logger.info("unified.upload_started", filename=resume.filename)

    # 1. Basic Validation
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    try:
        # 2. Extract text
        file_bytes = await resume.read()
        resume_text = await extract_text_from_file(file_bytes, resume.filename or "resume.pdf")

        if not resume_text.strip():
            logger.warning("unified.upload_empty_text", filename=resume.filename)
            raise HTTPException(
                status_code=400, 
                detail="Could not extract text from the resume. Please ensure it is a text-based PDF or DOCX (not an image or scan)."
            )

        # 3. Analyze resume + JD
        profile: CandidateProfile = await _analyzer.analyze_resume(resume_text, job_description)

        # 4. Persist session to MongoDB
        session = InterviewSession(
            role=profile.job_title_applying_for,
            level=profile.experience_level,
            target_skills=profile.technical_skills,
            candidate_name=profile.candidate_name,
            experience_level=profile.experience_level,
            years_of_experience=profile.years_of_experience,
            technical_skills=profile.technical_skills,
            soft_skills=profile.soft_skills,
            past_roles=profile.past_roles,
            projects=profile.projects,
            job_title_applying_for=profile.job_title_applying_for,
            key_jd_requirements=profile.key_jd_requirements,
            matched_skills=profile.matched_skills,
            skill_gaps=profile.skill_gaps,
            interview_focus_areas=profile.interview_focus_areas,
            resume_parsed=True,
        )
        await session.insert()
        session_id = str(session.id)

        # 5. Pre-warm Redis with minimal state (questions generated in /start)
        state = UnifiedSessionState(
            session_id=session_id,
            role=profile.job_title_applying_for,
            level=profile.experience_level,
            profile=profile.model_dump(),
        )
        await cache_session_state(session_id, state.model_dump())

        logger.info("unified.upload_complete", session_id=session_id, candidate=profile.candidate_name)

        return UploadResponse(session_id=session_id, profile=profile)

    except HTTPException as e:
        # Re-raise known HTTP exceptions
        raise e
    except ValueError as e:
        # Known LLM parsing / validation errors
        logger.error("unified.upload_analysis_failed", error=str(e))
        raise HTTPException(status_code=422, detail=f"Analysis failed: {str(e)}")
    except Exception as e:
        # Unexpected internal errors
        logger.exception("unified.upload_error")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during profile analysis.")


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

    state = await _load_state(session_id)

    if state.status != "active":
        raise HTTPException(status_code=409, detail="Session is not active.")

    if state.questions:
        raise HTTPException(status_code=409, detail="Interview already started. Use /turn.")

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
    audio_url = await _synthesize_and_store(session_id, 0, question_text)

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
    audio: UploadFile = File(..., description="Candidate's audio response (WebM/WAV/OGG)"),
) -> UnifiedTurnResponse:
    """
    Step 3 (repeated) — Process one interview turn.

    Pipeline:
      Audio → STT → Evaluate → Mentor hint → Adaptive next question → TTS
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

    try:
        transcript = await transcribe_audio(audio_bytes)
    except Exception as e:
        logger.error("unified.stt_error", error=str(e), session_id=session_id)
        raise HTTPException(status_code=500, detail="Failed to transcribe audio.")

    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Could not understand the audio. Please try again.")

    # Record candidate answer in history
    state.conversation_history.append({
        "role": "candidate",
        "content": transcript,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # ── 2. Evaluate ────────────────────────────────────────────────────
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

    logger.info(
        "unified.turn_evaluated",
        session_id=session_id,
        q_index=current_index,
        score=state.last_score,
        elapsed_ms=round((time.perf_counter() - turn_start) * 1000, 2),
    )

    # ── 3. Mentor hint ─────────────────────────────────────────────────
    mentor_hint = "Great effort, let's continue."
    feedback_text = evaluation_dict.get("feedback", "")
    try:
        eval_result = EvaluationResult(
            score=evaluation_dict.get("score", 5),
            feedback=feedback_text,
            strengths=evaluation_dict.get("strengths", []),
            weaknesses=evaluation_dict.get("weaknesses", []),
        )
        next_index = current_index + 1
        is_last = next_index >= TOTAL_QUESTIONS
        next_skill = (
            state.questions[next_index].get("focus_area")
            if not is_last
            else None
        )
        mentor_hint = await _mentor.generate_transition(
            evaluation=eval_result,
            skill=current_q.get("focus_area", ""),
            is_last_question_for_skill=is_last,
            next_skill=next_skill,
        )
    except Exception as e:
        logger.warning("unified.mentor_failed", error=str(e))

    # ── 4. Advance index ───────────────────────────────────────────────
    state.current_question_index += 1
    next_index = state.current_question_index
    is_complete = next_index >= TOTAL_QUESTIONS

    # ── 5. Next question + TTS ─────────────────────────────────────────
    next_question_text = ""
    next_audio_b64 = None
    next_focus_area = ""
    next_q_type = ""

    if not is_complete:
        try:
            next_question_text, _ = await _interviewer.get_next_question(
                questions=state.questions,
                current_index=next_index,
                last_score=state.last_score,
            )
            next_q_data = state.questions[next_index]
            next_focus_area = next_q_data.get("focus_area", "")
            next_q_type = next_q_data.get("type", "")
        except Exception as e:
            logger.error("unified.next_question_error", error=str(e))
            next_question_text = f"Tell me about your experience in {state.role}."

        state.last_question = next_question_text
        state.conversation_history.append({
            "role": "interviewer",
            "content": next_question_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        audio_url = await _synthesize_and_store(session_id, next_index, next_question_text)
    else:
        state.status = "completed"
        audio_url = None

    # ── 6. Persist (DB Synchronous consistency fix) ───────────────────
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

    # Finally update Redis
    await update_session_state(session_id, state.model_dump())

    total_ms = round((time.perf_counter() - turn_start) * 1000, 2)
    logger.info("unified.turn_complete", session_id=session_id, total_ms=total_ms, is_complete=is_complete)

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
    state_dict = await get_session_state(session_id)
    
    # If not in Redis, check DB
    if not state_dict:
        try:
            session = await InterviewSession.get(PydanticObjectId(session_id))
            if not session:
                return SessionStatusResponse(
                    session_id=session_id, status="expired", current_step="upload", question_number=0
                )
            
            # Map DB status to simplified step
            step = "upload"
            if session.resume_parsed and not session.conversation_history:
                step = "profile"
            elif session.conversation_history and session.status != SessionStatus.COMPLETED:
                step = "interview"
            elif session.status == SessionStatus.COMPLETED:
                step = "report"

            return SessionStatusResponse(
                session_id=session_id,
                status="active" if session.status != SessionStatus.COMPLETED else "completed",
                current_step=step,
                question_number=session.current_skill_index or 0
            )
        except Exception:
            return SessionStatusResponse(
                session_id=session_id, status="expired", current_step="upload", question_number=0
            )

    state = UnifiedSessionState(**state_dict)
    return SessionStatusResponse(
        session_id=session_id,
        status=state.status,
        current_step="interview" if state.status == "active" else "report",
        question_number=state.current_question_index + 1,
        total_questions=TOTAL_QUESTIONS
    )


@router.get("/{session_id}/audio/{turn_id}", summary="Fetch binary audio WAV")
async def get_turn_audio(session_id: str, turn_id: int):
    """Serve binary WAV audio from Redis cache."""
    audio_bytes = await get_audio_bytes(session_id, turn_id)
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="Audio not found or expired.")
    
    return Response(content=audio_bytes, media_type="audio/wav")
