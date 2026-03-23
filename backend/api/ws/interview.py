"""
api.ws.interview
~~~~~~~~~~~~~~~~
WebSocket endpoint for the real-time voice interview streaming pipeline.

Pipeline: Audio Bytes → STT → EvaluatorAgent → Redis State Update →
          MentorAgent → InterviewerAgent → Streaming TTS → Audio Bytes

This is the core event loop of the interview system.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict

from beanie import PydanticObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog

from core.exceptions import SessionNotFoundError
from core.redis import get_session_state, update_session_state
from models.schemas import EvaluationResult, SessionState
from models.session import InterviewSession, SessionStatus
from services.agents.evaluator import EvaluatorAgent
from services.agents.interviewer import InterviewerAgent
from services.agents.mentor import MentorAgent
from services.voice.stt import AudioBuffer, transcribe_audio
from services.voice.tts import synthesize_full

logger = structlog.get_logger(__name__)

ws_router = APIRouter()

# Pre-create agent singletons for efficiency
_evaluator = EvaluatorAgent()
_mentor = MentorAgent()
_interviewer = InterviewerAgent()


async def _send_json(ws: WebSocket, msg_type: str, data: Dict[str, Any]) -> None:
    """Send a typed JSON message over the WebSocket."""
    await ws.send_json({"type": msg_type, "data": data})


async def _send_error(ws: WebSocket, message: str, recoverable: bool = True) -> None:
    """Send an error message over the WebSocket."""
    await _send_json(ws, "error", {"message": message, "recoverable": recoverable})


@ws_router.websocket("/api/v1/interview/stream/{session_id}")
async def interview_stream(ws: WebSocket, session_id: str) -> None:
    """
    Core WebSocket endpoint for real-time voice interview streaming.

    Protocol:
      Client → Server:
        - Binary frames: raw audio bytes (PCM/WAV chunks)
        - Text frames: JSON control messages
          - {"type": "end_turn"} — signals end of speech
          - {"type": "end_interview"} — signals user wants to end early

      Server → Client:
        - Text frames: JSON status/data messages
          - {"type": "ready", "data": {...}} — connection established
          - {"type": "question", "data": {"text": "..."}} — interview question
          - {"type": "transcription", "data": {"text": "..."}} — STT result
          - {"type": "evaluation", "data": {...}} — evaluation result
          - {"type": "mentor", "data": {"text": "..."}} — mentor transition
          - {"type": "status", "data": {"message": "..."}} — pipeline status
          - {"type": "skill_transition", "data": {...}} — moving to next skill
          - {"type": "interview_complete", "data": {...}} — all skills done
          - {"type": "error", "data": {"message": "...", "recoverable":bool}}
        - Binary frames: TTS audio byte chunks
    """
    await ws.accept()
    logger.info("ws.connected", session_id=session_id)

    state: SessionState | None = None
    try:
        # ── Load session state from Redis (0ms lookups) ────────────
        cached_state = get_session_state(session_id)
        if cached_state is None:
            # Fallback: load from MongoDB
            try:
                session = await InterviewSession.get(PydanticObjectId(session_id))
            except Exception:
                await _send_error(ws, f"Session '{session_id}' not found.", recoverable=False)
                await ws.close(code=4004, reason="Session not found")
                return

            if session is None:
                await _send_error(ws, f"Session '{session_id}' not found.", recoverable=False)
                await ws.close(code=4004, reason="Session not found")
                return

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
            await _send_error(ws, "Session is not active.", recoverable=False)
            await ws.close(code=4009, reason="Session not active")
            return

        # ── Send ready signal ──────────────────────────────────────
        await _send_json(ws, "ready", {
            "session_id": session_id,
            "role": state.role,
            "level": state.level,
            "target_skills": state.target_skills,
            "current_skill": state.target_skills[state.current_skill_index]
            if state.current_skill_index < len(state.target_skills) else None,
        })

        # ── Generate and send initial question ─────────────────────
        await _generate_and_send_question(ws, state, session_id)

        # ── Main event loop ────────────────────────────────────────
        audio_buffer = AudioBuffer()

        while True:
            message = await ws.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Handle binary audio frames
            if "bytes" in message and message["bytes"]:
                audio_chunk: bytes = message["bytes"]
                audio_buffer.append(audio_chunk)

            # Handle text control messages
            elif "text" in message and message["text"]:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    await _send_error(ws, "Invalid JSON message.")
                    continue

                msg_type = control.get("type", "")

                if msg_type == "end_turn":
                    # Process the accumulated audio
                    await _process_turn(
                        ws=ws,
                        audio_buffer=audio_buffer,
                        state=state,
                        session_id=session_id,
                    )

                elif msg_type == "end_interview":
                    logger.info("ws.end_interview_requested", session_id=session_id)
                    await _send_json(ws, "interview_complete", {
                        "message": "Interview ended by user.",
                        "session_id": session_id,
                    })
                    break

                else:
                    await _send_error(ws, f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        logger.info("ws.disconnected", session_id=session_id)

    except Exception:
        logger.exception("ws.unhandled_error", session_id=session_id)
        try:
            await _send_error(ws, "An internal error occurred.", recoverable=False)
        except Exception:
            pass

    finally:
        # Persist final state back to MongoDB
        await _persist_state(session_id, state)
        logger.info("ws.cleanup_complete", session_id=session_id)


async def _process_turn(
    ws: WebSocket,
    audio_buffer: AudioBuffer,
    state: SessionState,
    session_id: str,
) -> None:
    """
    Process a single interview turn:
    Audio → STT → Evaluate → Mentor → Next Question → TTS → Audio
    """
    turn_start = time.perf_counter()

    # ── 1. Transcribe audio ────────────────────────────────────────
    if not audio_buffer.has_data():
        await _send_error(ws, "No audio data received for this turn.")
        return

    await _send_json(ws, "status", {"message": "Transcribing your answer..."})
    audio_data = audio_buffer.flush()

    try:
        transcript = await transcribe_audio(audio_data)
    except Exception as e:
        logger.error("ws.stt_error", error=str(e), session_id=session_id)
        await _send_error(ws, "Failed to transcribe audio. Please try again.")
        return

    if not transcript.strip():
        await _send_error(ws, "Could not understand the audio. Please try again.")
        return

    ttfb_stt = (time.perf_counter() - turn_start) * 1000

    await _send_json(ws, "transcription", {"text": transcript})

    # Record candidate's answer in conversation history
    state.conversation_history.append({
        "role": "candidate",
        "content": transcript,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    current_skill = state.target_skills[state.current_skill_index]
    last_question = state.last_question or "unknown question"

    # ── 2. Evaluate the answer ─────────────────────────────────────
    await _send_json(ws, "status", {"message": "Evaluating your response..."})

    try:
        evaluation: EvaluationResult = await _evaluator.evaluate(
            question=last_question,
            answer=transcript,
            skill=current_skill,
            level=state.level,
        )
    except Exception as e:
        logger.error("ws.evaluator_error", error=str(e), session_id=session_id)
        await _send_error(ws, "Evaluation failed. Moving to next question.")
        evaluation = EvaluationResult(
            score=5, feedback="Could not evaluate.", strengths=[], weaknesses=[]
        )

    eval_dict = evaluation.model_dump()
    eval_dict["skill"] = current_skill
    await _send_json(ws, "evaluation", eval_dict)

    # ── 3. Update Redis state ──────────────────────────────────────
    state.last_evaluation = eval_dict
    state.current_question_count += 1
    update_session_state(session_id, state.model_dump())

    # ── 4. Check skill progression ─────────────────────────────────
    is_last_question = state.current_question_count >= state.questions_per_skill
    next_skill = None

    if is_last_question:
        next_index = state.current_skill_index + 1
        if next_index < len(state.target_skills):
            next_skill = state.target_skills[next_index]
        else:
            next_skill = None  # Interview complete

    # ── 5. Mentor transition ───────────────────────────────────────
    await _send_json(ws, "status", {"message": "Generating feedback..."})

    try:
        mentor_text = await _mentor.generate_transition(
            evaluation=evaluation,
            skill=current_skill,
            is_last_question_for_skill=is_last_question,
            next_skill=next_skill,
        )
    except Exception as e:
        logger.error("ws.mentor_error", error=str(e))
        mentor_text = "Great, let's continue."

    await _send_json(ws, "mentor", {"text": mentor_text})

    # ── 6. Advance skill if needed ─────────────────────────────────
    if is_last_question:
        if next_skill:
            state.current_skill_index += 1
            state.current_question_count = 0
            await _send_json(ws, "skill_transition", {
                "completed_skill": current_skill,
                "next_skill": next_skill,
                "skills_remaining": len(state.target_skills) - state.current_skill_index,
            })
        else:
            # All skills exhausted — interview complete
            total_latency = (time.perf_counter() - turn_start) * 1000
            await _send_json(ws, "interview_complete", {
                "message": "All skills have been assessed. Great job!",
                "session_id": session_id,
                "total_turns": len(state.conversation_history),
            })
            state.status = "completed"
            update_session_state(session_id, state.model_dump())
            return

    # ── 7. Generate and stream next question + TTS ─────────────────
    await _generate_and_send_question(ws, state, session_id)

    # ── 8. Record metrics ──────────────────────────────────────────
    total_latency = (time.perf_counter() - turn_start) * 1000
    logger.info(
        "ws.turn_complete",
        session_id=session_id,
        skill=current_skill,
        score=evaluation.score,
        ttfb_ms=round(ttfb_stt, 2),
        total_latency_ms=round(total_latency, 2),
    )

    # Store evaluation in state for finalization
    state.conversation_history.append({
        "role": "system",
        "content": json.dumps(eval_dict),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "evaluation",
    })


async def _generate_and_send_question(
    ws: WebSocket,
    state: SessionState,
    session_id: str,
) -> None:
    """Generate the next question, stream TTS, and update state."""
    if state.current_skill_index >= len(state.target_skills):
        return

    current_skill = state.target_skills[state.current_skill_index]
    last_score = state.last_evaluation.get("score") if state.last_evaluation else None

    await _send_json(ws, "status", {"message": f"Preparing question about {current_skill}..."})

    # Generate question text (streaming into a buffer for TTS)
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
        logger.error("ws.interviewer_error", error=str(e), session_id=session_id)
        # Fallback question
        question_parts = [f"Tell me about your experience with {current_skill}."]

    full_question = "".join(question_parts)
    state.last_question = full_question

    # Send question text
    await _send_json(ws, "question", {"text": full_question, "skill": current_skill})

    # Record in conversation history
    state.conversation_history.append({
        "role": "interviewer",
        "content": full_question,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Stream TTS audio
    try:
        full_audio = await synthesize_full(full_question)
        if full_audio:
            await ws.send_bytes(full_audio)
            await _send_json(ws, "audio_complete", {"chunks_sent": 1})
        else:
            await _send_json(ws, "audio_complete", {
                "chunks_sent": 0,
                "error": "TTS unavailable - continuing in text-only mode.",
            })

    except Exception as e:
        logger.error("ws.tts_error", error=str(e), session_id=session_id)
        await _send_json(ws, "audio_complete", {
            "chunks_sent": 0,
            "error": "TTS failed - question was sent as text only.",
        })

    # Update Redis
    update_session_state(session_id, state.model_dump())


async def _persist_state(session_id: str, state: SessionState | None) -> None:
    """Persist the WebSocket session state back to MongoDB."""
    try:
        session = await InterviewSession.get(PydanticObjectId(session_id))
        if session is None:
            return

        if state:
            session.current_skill_index = state.current_skill_index
            session.current_question_count = state.current_question_count
            session.conversation_history = state.conversation_history

            # Extract evaluations from conversation history
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

        logger.info("ws.state_persisted", session_id=session_id)

    except Exception:
        logger.exception("ws.persist_error", session_id=session_id)
