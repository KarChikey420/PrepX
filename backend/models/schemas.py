"""
models.schemas
~~~~~~~~~~~~~~
Pydantic V2 request / response schemas for the unified AI interview API.

Single flow:
  upload → start → turn (×9) → finish → report
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Candidate Profile ─────────────────────────────────────────────────


class CandidateProfile(BaseModel):
    """Extracted and analyzed data from a candidate's resume and JD."""
    candidate_name: str
    experience_level: str                    # fresher | junior | mid | senior | lead
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


# ── Upload ─────────────────────────────────────────────────────────────


class UploadResponse(BaseModel):
    """Returned after the resume + JD upload has been accepted for analysis."""
    session_id: str
    status: str = "processing"              # processing | active | error
    profile: Optional[CandidateProfile] = None
    message: str = "Profile analysis started. Poll session status until the profile is ready."


# ── Question ───────────────────────────────────────────────────────────


class UnifiedQuestion(BaseModel):
    """
    A single interview question generated from the candidate profile.
    Stored in Redis; difficulty may be re-framed adaptively during the interview.
    """
    id: int                                  # 1-10
    type: str                                # technical | behavioral | situational
    difficulty: str                          # easy | medium | hard
    question: str
    focus_area: str
    expected_keywords: List[str]


# ── Session State (Redis) ──────────────────────────────────────────────


class UnifiedSessionState(BaseModel):
    """
    Full session state stored in Redis.
    The single source of truth for the hot-path interview loop.
    """
    session_id: str
    role: str
    level: str
    profile: Dict[str, Any]                          # serialized CandidateProfile
    questions: List[Dict[str, Any]] = Field(default_factory=list)  # List[UnifiedQuestion]
    current_question_index: int = 0
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    evaluations: List[Dict[str, Any]] = Field(default_factory=list)
    last_score: Optional[int] = None
    last_question: Optional[str] = None
    status: str = "active"                   # active | completed


# ── Start ──────────────────────────────────────────────────────────────


class StartResponse(BaseModel):
    """Returned after /start generates 10 questions and delivers Q1."""
    session_id: str
    question_text: str
    audio_base64: Optional[str] = None      # Deprecated: use audio_url
    audio_url: Optional[str] = None         # URL for binary audio playback
    question_number: int = 1
    total_questions: int = 10
    focus_area: str = ""
    question_type: str = ""


# ── Turn ───────────────────────────────────────────────────────────────


class UnifiedTurnResponse(BaseModel):
    """Returned after each audio turn (questions 2-10)."""
    transcription: str
    mentor_hint: Optional[str] = None       # Empathetic 1-2 sentence encouragement
    feedback: Optional[str] = None          # Actionable feedback (no score)
    question_text: str = ""
    audio_base64: Optional[str] = None      # Deprecated: use audio_url
    audio_url: Optional[str] = None         # URL for binary audio playback
    question_number: int
    total_questions: int = 10
    focus_area: str = ""
    question_type: str = ""
    is_complete: bool = False


# ── Final Report ────────────────────────────────────────────────────────


class FinalReport(BaseModel):
    """
    Structured final performance report generated after all 10 questions.
    Verdict is one of: Hire | Borderline | Needs Improvement
    """
    overall_summary: str
    strong_areas: List[str]
    weak_areas: List[str]
    skill_gap: List[str]
    communication_assessment: str
    verdict: str                             # Hire | Borderline | Needs Improvement
    recommendations: List[str]
    overall_score: float                     # Shown in report summary
    session_id: str


# ── Report Poll ────────────────────────────────────────────────────────


class ReportPollResponse(BaseModel):
    """Response for GET /{session_id}/report."""
    session_id: str
    status: str                              # ready | generating | not_started
    report_markdown: Optional[str] = None
    report: Optional[FinalReport] = None


# ── Evaluation (Internal) ──────────────────────────────────────────────


class EvaluationResult(BaseModel):
    """
    Strict schema for the EvaluatorAgent's tool-call output.
    Enforced via function/tool calling on Kimi K2.
    Score is NEVER exposed to the client directly.
    """
    score: int = Field(..., ge=1, le=10, description="Quality score 1-10 (internal only)")
    feedback: str = Field(..., min_length=1, description="Constructive feedback")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)


# ── Health ─────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    """GET /health"""
    status: str = "ok"
    version: str
    mongodb: str = "connected"
    redis: str = "connected"


class SessionStatusResponse(BaseModel):
    """GET /interview/{session_id}/status"""
    session_id: str
    status: str                              # processing | active | completed | error | expired
    current_step: str                        # upload | profile | interview | report
    question_number: int
    total_questions: int = 10
    profile: Optional[CandidateProfile] = None
    detail: Optional[str] = None
