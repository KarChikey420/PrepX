"""
api.rest.interview
~~~~~~~~~~~~~~~~~~
REST endpoints for the interview session lifecycle management and turn processing.

Pipeline for /turn:
Audio Bytes → STT → EvaluatorAgent → Redis State Update → MentorAgent →
InterviewerAgent → Streaming TTS → Base64 Audio → Client HTTP Response
"""

from __future__ import annotations

import base64
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict

from beanie import PydanticObjectId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, BackgroundTasks
import structlog

from core.exceptions import SessionNotFoundError
from core.redis import get_session_state, update_session_state
from models.schemas import EvaluationResult, SessionState, TurnResponse
from models.session import InterviewSession, SessionStatus
from services.agents.evaluator import EvaluatorAgent
from services.agents.interviewer import InterviewerAgent
from services.agents.mentor import MentorAgent
from services.voice.stt import transcribe_audio
from services.voice.tts import synthesize_full

logger = structlog.get_logger(__name__)

rest_router = APIRouter(prefix="/api/v1/interview", tags=["Interview REST"])

# Pre-create agent singletons for efficiency
_evaluator = EvaluatorAgent()
_mentor = MentorAgent()
_interviewer = InterviewerAgent()


@rest_router.post("/{session_id}/turn", response_model=TurnResponse)
async def process_turn(
    session_id: str,
    audio: UploadFile = File(...),
) -> TurnResponse:
    """
    Process a single interview turn via REST.
    Accepts raw audio data as an UploadFile from the client and returns the complete turn data.
    """
    turn_start = time.perf_counter()
    logger.info("rest.turn_started", session_id=session_id)

    # ── Load session state from Redis ────────────
    cached_state = await get_session_state(session_id)
    if cached_state is None:
        # Fallback: load from MongoDB
        session = await InterviewSession.get(PydanticObjectId(session_id))
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")

        cached_state = SessionState(
            session_id=session_id,
            role=session.role,
            level=session.level,
            target_skills=session.target_skills,
            current_skill_index=session.current_skill_index,
            current_question_count=session.current_question_count,
            questions_per_skill=session.questions_per_skill,
            conversation_history=[],
            status=session.status.value,
        ).model_dump()

    state = SessionState(**cached_state)

    if state.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # ── 1. Transcribe audio ────────────────────────────────────────
    audio_data = await audio.read()
    if not audio_data:
        raise HTTPException(status_code=400, detail="No audio data received.")

    try:
        transcript = await transcribe_audio(audio_data)
    except Exception as e:
        logger.error("rest.stt_error", error=str(e), session_id=session_id)
        raise HTTPException(status_code=500, detail="Failed to transcribe audio.")

    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Could not understand the audio. Please try again.")

    ttfb_stt = (time.perf_counter() - turn_start) * 1000

    # Record candidate's answer in conversation history
    state.conversation_history.append({
        "role": "candidate",
        "content": transcript,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    current_skill = state.target_skills[state.current_skill_index]
    last_question = state.last_question or "unknown question"

    # ── 2. Evaluate the answer ─────────────────────────────────────
    try:
        evaluation: EvaluationResult = await _evaluator.evaluate(
            question=last_question,
            answer=transcript,
            skill=current_skill,
            level=state.level,
        )
    except Exception as e:
        logger.error("rest.evaluator_error", error=str(e), session_id=session_id)
        evaluation = EvaluationResult(
            score=5, feedback="Could not evaluate.", strengths=[], weaknesses=[]
        )

    eval_dict = evaluation.model_dump()
    eval_dict["skill"] = current_skill

    # ── 3. Update state ──────────────────────────────────────
    state.last_evaluation = eval_dict
    state.current_question_count += 1

    # ── 4. Check skill progression ─────────────────────────────────
    is_last_question = state.current_question_count >= state.questions_per_skill
    next_skill = None
    is_complete = False

    if is_last_question:
        next_index = state.current_skill_index + 1
        if next_index < len(state.target_skills):
            next_skill = state.target_skills[next_index]
        else:
            is_complete = True

    # ── 5. Mentor transition ───────────────────────────────────────
    try:
        mentor_text = await _mentor.generate_transition(
            evaluation=evaluation,
            skill=current_skill,
            is_last_question_for_skill=is_last_question,
            next_skill=next_skill,
        )
    except Exception as e:
        logger.error("rest.mentor_error", error=str(e))
        mentor_text = "Great, let's continue."

    # ── 6. Advance skill or complete ─────────────────────────────────
    if is_last_question:
        if next_skill:
            state.current_skill_index += 1
            state.current_question_count = 0
        else:
            state.status = "completed"

    # ── 7. Generate next question + TTS ─────────────────
    question_text = ""
    audio_base64 = None

    if not is_complete:
        current_skill = state.target_skills[state.current_skill_index]
        last_score = state.last_evaluation.get("score") if state.last_evaluation else None

        question_parts: list[str] = []
        try:
            async for chunk in _interviewer.generate_question_stream(
                skill=current_skill,
                level=state.level,
                role=state.role,
                last_score=last_score,
                conversation_history=state.conversation_history,
            ):
                question_parts.append(chunk)
        except Exception as e:
            logger.error("rest.interviewer_error", error=str(e), session_id=session_id)
            question_parts = [f"Tell me about your experience with {current_skill}."]

        question_text = "".join(question_parts)
        state.last_question = question_text

        # Record in conversation history
        state.conversation_history.append({
            "role": "interviewer",
            "content": question_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Generate audio
        try:
            full_audio = await synthesize_full(question_text)
            if full_audio:
                audio_base64 = base64.b64encode(full_audio).decode("utf-8")
        except Exception as e:
            logger.error("rest.tts_error", error=str(e), session_id=session_id)

    # ── 8. Record metrics ──────────────────────────────────────────
    total_latency = (time.perf_counter() - turn_start) * 1000
    logger.info(
        "rest.turn_complete",
        session_id=session_id,
        skill=current_skill,
        score=evaluation.score,
        ttfb_ms=round(ttfb_stt, 2),
        total_latency_ms=round(total_latency, 2),
    )

    client_eval = eval_dict.copy()
    client_eval.pop("score", None)

    # Persist state back to Redis
    await update_session_state(session_id, state.model_dump())

    # And persist back to MongoDB asynchronously (or do it synchronously for simplicity)
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
        if session:
            session.current_skill_index = state.current_skill_index
            session.current_question_count = state.current_question_count
            session.conversation_history = state.conversation_history
            
            # Extract evaluations
            evaluations = [
                json.loads(entry["content"])
                for entry in state.conversation_history
                if entry.get("type") == "evaluation"
            ]
            session.evaluation_history = evaluations

            if state.status == "completed":
                session.status = SessionStatus.COMPLETED

            session.updated_at = datetime.now(timezone.utc)
            await session.save()
    except Exception as e:
        logger.error("rest.db_persist_error", error=str(e))

    return TurnResponse(
        transcription=transcript,
        evaluation=client_eval,
        mentor_text=mentor_text,
        question_text=question_text,
        audio_base64=audio_base64,
        is_complete=is_complete,
    )

@rest_router.post("/{session_id}/start", response_model=TurnResponse)
async def start_interview(session_id: str) -> TurnResponse:
    """
    Start the interview by generating the first question.
    """
    logger.info("rest.start_interview", session_id=session_id)
    
    cached_state = await get_session_state(session_id)
    if cached_state is None:
        session = await InterviewSession.get(PydanticObjectId(session_id))
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
            
        cached_state = SessionState(
            session_id=session_id,
            role=session.role,
            level=session.level,
            target_skills=session.target_skills,
            current_skill_index=session.current_skill_index,
            current_question_count=session.current_question_count,
            questions_per_skill=session.questions_per_skill,
            conversation_history=[],
            status=session.status.value,
        ).model_dump()
        
    state = SessionState(**cached_state)
    
    if state.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    current_skill = state.target_skills[state.current_skill_index]
    
    question_parts: list[str] = []
    try:
        async for chunk in _interviewer.generate_question_stream(
            skill=current_skill,
            level=state.level,
            role=state.role,
            last_score=None,
            conversation_history=state.conversation_history,
        ):
            question_parts.append(chunk)
    except Exception as e:
        logger.error("rest.interviewer_error", error=str(e), session_id=session_id)
        question_parts = [f"Tell me about your experience with {current_skill}."]

    question_text = "".join(question_parts)
    state.last_question = question_text

    state.conversation_history.append({
        "role": "interviewer",
        "content": question_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    audio_base64 = None
    try:
        full_audio = await synthesize_full(question_text)
        if full_audio:
            audio_base64 = base64.b64encode(full_audio).decode("utf-8")
    except Exception as e:
        logger.error("rest.tts_error", error=str(e), session_id=session_id)
        
    await update_session_state(session_id, state.model_dump())
    
    return TurnResponse(
        transcription="",
        evaluation=None,
        mentor_text=None,
        question_text=question_text,
        audio_base64=audio_base64,
        is_complete=False,
    )

@rest_router.post("/{session_id}/regenerate", response_model=TurnResponse)
async def regenerate_question(session_id: str) -> TurnResponse:
    """
    Regenerate the current question (replace it with a different one for the same skill).
    """
    logger.info("rest.regenerate_question", session_id=session_id)
    
    cached_state = await get_session_state(session_id)
    if cached_state is None:
        raise HTTPException(status_code=404, detail="Session not found")
        
    state = SessionState(**cached_state)
    
    if state.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # Remove the last interviewer message if we are regenerating
    if state.conversation_history and state.conversation_history[-1]["role"] == "interviewer":
        state.conversation_history.pop()

    current_skill = state.target_skills[state.current_skill_index]
    last_score = state.last_evaluation.get("score") if state.last_evaluation else None
    
    question_parts: list[str] = []
    try:
        async for chunk in _interviewer.generate_question_stream(
            skill=current_skill,
            level=state.level,
            role=state.role,
            last_score=last_score,
            conversation_history=state.conversation_history,
        ):
            question_parts.append(chunk)
    except Exception as e:
        logger.error("rest.interviewer_error", error=str(e), session_id=session_id)
        question_parts = [f"Could you tell me more about your experience with {current_skill}?"]

    question_text = "".join(question_parts)
    state.last_question = question_text

    state.conversation_history.append({
        "role": "interviewer",
        "content": question_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    audio_base64 = None
    try:
        full_audio = await synthesize_full(question_text)
        if full_audio:
            audio_base64 = base64.b64encode(full_audio).decode("utf-8")
    except Exception as e:
        logger.error("rest.tts_error", error=str(e), session_id=session_id)
        
    await update_session_state(session_id, state.model_dump())
    
    return TurnResponse(
        transcription="",
        evaluation=None,
        mentor_text=None,
        question_text=question_text,
        audio_base64=audio_base64,
        is_complete=False,
    )
