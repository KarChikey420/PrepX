"""
models.schemas
~~~~~~~~~~~~~~
Pydantic V2 request / response schemas for the API layer.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Request Schemas ────────────────────────────────────────────────────


class InitializeRequest(BaseModel):
    """POST /api/v1/interview/initialize"""
    role: str = Field(..., min_length=1, examples=["Backend Engineer"])
    level: str = Field(..., pattern=r"^(junior|mid|senior|lead)$", examples=["senior"])
    skills: List[str] = Field(
        ..., min_length=1, examples=[["python", "system_design", "databases"]]
    )
    user_email: Optional[str] = Field(default=None, examples=["dev@example.com"])
    questions_per_skill: int = Field(default=3, ge=1, le=10)


# ── Response Schemas ───────────────────────────────────────────────────


class InitializeResponse(BaseModel):
    """Returned after successful session initialization."""
    session_id: str
    ws_url: str = Field(description="WebSocket URL for streaming interview")
    role: str
    level: str
    target_skills: List[str]
    message: str = Field(default="Session initialized. Connect to ws_url to begin.")


class FinalizeResponse(BaseModel):
    """Returned after triggering session finalization."""
    session_id: str
    status: str
    message: str
    report_markdown: Optional[str] = None


class HealthResponse(BaseModel):
    """GET /health"""
    status: str = "ok"
    version: str
    mongodb: str = "connected"
    redis: str = "connected"


# ── AI Evaluation Schema ──────────────────────────────────────────────


class EvaluationResult(BaseModel):
    """
    Strict schema for the EvaluatorAgent's tool-call output.
    Enforced via function/tool calling on Kimi K2.
    """
    score: int = Field(..., ge=1, le=10, description="Quality score 1-10")
    feedback: str = Field(..., min_length=1, description="Detailed evaluation feedback")
    strengths: List[str] = Field(default_factory=list, description="Key strengths identified")
    weaknesses: List[str] = Field(default_factory=list, description="Areas for improvement")


# ── Session State (Redis Cache) ───────────────────────────────────────


class SessionState(BaseModel):
    """
    Lightweight, serializable representation of session state for Redis.
    This is the hot-path data used during WebSocket streaming.
    """
    session_id: str
    role: str
    level: str
    target_skills: List[str]
    current_skill_index: int = 0
    current_question_count: int = 0
    questions_per_skill: int = 3
    last_evaluation: Optional[Dict[str, Any]] = None
    last_question: Optional[str] = None
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "active"


# ── WebSocket Messages ────────────────────────────────────────────────


class WSMessage(BaseModel):
    """Generic WebSocket JSON message envelope."""
    type: str = Field(..., description="Message type identifier")
    data: Dict[str, Any] = Field(default_factory=dict)


class WSTranscription(BaseModel):
    """Server → Client: transcription result."""
    type: str = "transcription"
    text: str
    is_final: bool = True


class WSEvaluation(BaseModel):
    """Server → Client: evaluation result."""
    type: str = "evaluation"
    evaluation: Dict[str, Any]


class WSAudioChunk(BaseModel):
    """Server → Client: audio chunk metadata (actual bytes sent as binary frame)."""
    type: str = "audio_chunk"
    sequence: int
    is_last: bool = False


class WSError(BaseModel):
    """Server → Client: error notification."""
    type: str = "error"
    message: str
    recoverable: bool = True
