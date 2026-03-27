"""
models.session
~~~~~~~~~~~~~~
InterviewSession domain model (Beanie ODM document for MongoDB).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from beanie import Document
from pydantic import Field


class SessionStatus(str, Enum):
    """Lifecycle states of an interview session."""
    ACTIVE = "active"
    COMPLETED = "completed"
    ERROR = "error"



class InterviewSession(Document):
    """
    Represents a single AI voice interview session.

    Attributes:
        user_id: Reference to the User who owns this session.
        role: Target job role (e.g. "Backend Engineer").
        level: Candidate experience level (e.g. "senior", "mid", "junior").
        target_skills: Ordered list of skills to evaluate.
        current_skill_index: Index into target_skills for the current skill.
        metrics: Per-turn performance data (TTFB, processing latency).
        conversation_history: Full conversation log for report generation.
        status: Session lifecycle state.
        report_markdown: Generated Markdown report (populated on finalize).
        created_at: Session start timestamp.
        updated_at: Last modification timestamp.
    """

    user_id: Optional[str] = Field(default=None, description="User document ID")
    role: str = Field(..., description="Target job role, e.g. 'Backend Engineer'")
    level: str = Field(..., description="Candidate level: junior / mid / senior")
    target_skills: List[str] = Field(
        ..., min_length=1, description="Ordered list of skills to assess"
    )
    current_skill_index: int = Field(
        default=0, ge=0, description="Current position in target_skills"
    )
    questions_per_skill: int = Field(
        default=3, ge=1, description="Number of questions per skill before moving on"
    )
    current_question_count: int = Field(
        default=0, ge=0, description="Questions asked for current skill"
    )
    metrics: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=dict,
        description="Per-skill list of turn metrics (ttfb_ms, latency_ms, etc.)",
    )
    conversation_history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="[{'role': 'interviewer'|'candidate', 'content': str, 'timestamp': str}]",
    )
    evaluation_history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of EvaluationResult dicts from the EvaluatorAgent.",
    )
    status: SessionStatus = Field(default=SessionStatus.ACTIVE)
    report_markdown: Optional[str] = Field(
        default=None, description="Generated Markdown performance report"
    )
    report_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured final report payload for client-side results rendering",
    )
    
    # -- Resume / Smart Interview fields --
    candidate_name: Optional[str] = None
    experience_level: Optional[str] = None
    years_of_experience: Optional[int] = None
    technical_skills: Optional[List[str]] = []
    soft_skills: Optional[List[str]] = []
    past_roles: Optional[List[str]] = []
    projects: Optional[List[str]] = []
    job_title_applying_for: Optional[str] = None
    key_jd_requirements: Optional[List[str]] = []
    matched_skills: Optional[List[str]] = []
    skill_gaps: Optional[List[str]] = []
    interview_focus_areas: Optional[List[str]] = []
    resume_parsed: Optional[bool] = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "interview_sessions"
        use_state_management = True

    @property
    def current_skill(self) -> Optional[str]:
        """Return the skill currently being evaluated, or None if exhausted."""
        if self.current_skill_index < len(self.target_skills):
            return self.target_skills[self.current_skill_index]
        return None

    @property
    def is_complete(self) -> bool:
        """True when all skills have been covered."""
        return self.current_skill_index >= len(self.target_skills)

    def advance_skill(self) -> Optional[str]:
        """Move to the next skill. Returns the new skill or None if done."""
        self.current_skill_index += 1
        self.current_question_count = 0
        self.updated_at = datetime.now(timezone.utc)
        return self.current_skill

    def record_turn_metrics(self, skill: str, ttfb_ms: float, total_latency_ms: float) -> None:
        """Append latency metrics for a turn under the given skill."""
        if skill not in self.metrics:
            self.metrics[skill] = []
        self.metrics[skill].append({
            "ttfb_ms": round(ttfb_ms, 2),
            "total_latency_ms": round(total_latency_ms, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    class Config:
        json_schema_extra = {
            "example": {
                "role": "Backend Engineer",
                "level": "senior",
                "target_skills": ["python", "system_design", "databases"],
                "current_skill_index": 1,
                "status": "active",
            }
        }
