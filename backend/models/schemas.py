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
    level: str = Field(..., pattern=r"^(fresher|junior)$", examples=["junior"])
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
    rest_url: Optional[str] = Field(default=None, description="REST URL for turn-based interview")
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


class TurnResponse(BaseModel):
    """Returned after processing an interview audio turn."""
    transcription: str
    evaluation: Optional[Dict[str, Any]] = None
    mentor_text: Optional[str] = None
    question_text: str
    audio_base64: Optional[str] = None
    is_complete: bool = False


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


# ── Smart Interview (Resume-Based) Schemas ────────────────────────────


class CandidateProfile(BaseModel):
    """Extracted and analyzed data from a candidate's resume."""
    candidate_name: str
    experience_level: str
    years_of_experience: int
    technical_skills: List[str]
    soft_skills: List[str]
    past_roles: List[str]
    projects: List[str]
    job_title_applying_for: str
    key_jd_requirements: List[str]
    matched_skills: List[str]
    skill_gaps: List[str]
    interview_focus_areas: List[str]


class ResumeUploadResponse(BaseModel):
    """Returned after successful resume parsing and analysis."""
    session_id: str
    profile: CandidateProfile


class SmartQuestion(BaseModel):
    """A logically generated interview question based on the candidate's profile."""
    id: int
    type: str
    difficulty: str
    question: str
    focus_area: str
    expected_keywords: List[str]


class SmartQuestionSet(BaseModel):
    """Set of questions generated for a smart interview session."""
    session_id: str
    questions: List[SmartQuestion]


class AnswerSubmission(BaseModel):
    """Request schema for submitting a text answer to a smart question."""
    session_id: str
    question_id: int
    answer: str


class AnswerFeedback(BaseModel):
    """Evaluation feedback for a single smart question answer."""
    score: int
    feedback: str
    follow_up_question: Optional[str] = None


class SmartReport(BaseModel):
    """Final performance report for a resume-based smart interview."""
    overall_score: float
    strengths: List[str]
    weak_areas: List[str]
    readiness_verdict: str
    recommendations: List[str]
