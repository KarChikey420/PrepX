"""
services.report
~~~~~~~~~~~~~~~
Background report generation using Kimi K2.

Generates a comprehensive Markdown performance report from
session data, called as a FastAPI BackgroundTask to prevent
HTTP timeouts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

import structlog

from core.config import settings
from models.session import InterviewSession, SessionStatus
from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)


def _emit_report_to_terminal(session_id: str, report_md: str) -> None:
    """Print the generated report to the backend terminal for local debugging."""
    separator = "=" * 80
    print(separator)
    print(f"INTERVIEW REPORT [{session_id}]")
    print(separator)
    print(report_md)
    print(separator)

REPORT_SYSTEM_PROMPT = """\
You are an expert technical interview analyst. Generate a comprehensive, \
well-structured Markdown performance report based on the interview session data.

REPORT STRUCTURE:
1. **Executive Summary** — 2-3 sentence overview of performance.
2. **Skill-by-Skill Analysis** — For each skill assessed:
   - Overall score and difficulty progression
   - Key strengths demonstrated
   - Areas for improvement
   - Notable moments
3. **Performance Metrics** — Include TTFB and latency data if available.
4. **Recommendations** — 3-5 actionable study recommendations.
5. **Overall Assessment** — Final verdict with an overall score.

FORMAT RULES:
- Use proper Markdown with headers, bullet points, and tables.
- Include emoji for visual clarity (✅ ❌ ⚠️ 📊 🎯).
- Be constructive and encouraging, even for weak performances.
- Reference specific questions and answers where relevant.\
"""


class ReportGenerator(BaseAgent):
    """Generates comprehensive Markdown interview reports."""

    def __init__(self) -> None:
        super().__init__(
            system_prompt=REPORT_SYSTEM_PROMPT,
            temperature=0.5,
            max_tokens=4096,
        )

    async def generate_report(self, session: InterviewSession) -> str:
        """
        Generate a full Markdown performance report from session data.

        Args:
            session: The completed InterviewSession document.

        Returns:
            A comprehensive Markdown report string.
        """
        report_context = self._build_context(session)
        prompt = (
            "Generate a comprehensive interview performance report based on "
            "the following session data:\n\n"
            f"{report_context}\n\n"
            "Generate the full Markdown report now."
        )

        report = await self.generate(prompt)

        logger.info(
            "report.generated",
            session_id=str(session.id),
            report_length=len(report),
        )

        return report

    def _build_context(self, session: InterviewSession) -> str:
        """Build a structured context string from session data."""
        parts: list[str] = [
            f"## Interview Details",
            f"- **Role:** {session.role}",
            f"- **Level:** {session.level}",
            f"- **Skills Assessed:** {', '.join(session.target_skills)}",
            f"- **Status:** {session.status.value}",
            f"- **Duration:** {self._format_duration(session)}",
            "",
        ]

        # Evaluation history
        if session.evaluation_history:
            parts.append("## Evaluations")
            for i, eval_entry in enumerate(session.evaluation_history, 1):
                parts.append(f"\n### Turn {i}")
                parts.append(f"- **Skill:** {eval_entry.get('skill', 'N/A')}")
                parts.append(f"- **Score:** {eval_entry.get('score', 'N/A')}/10")
                parts.append(f"- **Feedback:** {eval_entry.get('feedback', 'N/A')}")
                strengths = eval_entry.get("strengths", [])
                weaknesses = eval_entry.get("weaknesses", [])
                if strengths:
                    parts.append(f"- **Strengths:** {', '.join(strengths)}")
                if weaknesses:
                    parts.append(f"- **Weaknesses:** {', '.join(weaknesses)}")

        # Conversation log
        if session.conversation_history:
            parts.append("\n## Conversation Log")
            for entry in session.conversation_history:
                role = entry.get("role", "unknown").capitalize()
                content = entry.get("content", "")[:500]
                parts.append(f"\n**{role}:** {content}")

        # Performance metrics
        if session.metrics:
            parts.append("\n## Performance Metrics")
            for skill, turns in session.metrics.items():
                avg_ttfb = sum(t.get("ttfb_ms", 0) for t in turns) / max(len(turns), 1)
                avg_latency = sum(t.get("total_latency_ms", 0) for t in turns) / max(len(turns), 1)
                parts.append(
                    f"- **{skill}:** Avg TTFB={avg_ttfb:.1f}ms, "
                    f"Avg Total Latency={avg_latency:.1f}ms ({len(turns)} turns)"
                )

        return "\n".join(parts)

    def _format_duration(self, session: InterviewSession) -> str:
        """Calculate and format the interview duration."""
        if session.updated_at and session.created_at:
            delta = session.updated_at - session.created_at
            minutes = int(delta.total_seconds() // 60)
            seconds = int(delta.total_seconds() % 60)
            return f"{minutes}m {seconds}s"
        return "N/A"


# ── Module-level singleton (avoids re-creating AsyncOpenAI client per call) ──
_report_generator = ReportGenerator()


async def generate_session_report(session_id: str) -> None:
    """
    Background task entry point: load session, generate report, save to DB.

    This is designed to be called as a FastAPI BackgroundTask
    from the finalize endpoint.
    """
    logger.info("report.background_start", session_id=session_id)

    try:
        session = await InterviewSession.get(session_id)
        if session is None:
            logger.error("report.session_not_found", session_id=session_id)
            return

        report_md = await _report_generator.generate_report(session)

        # Save report to the session document
        session.report_markdown = report_md
        session.status = SessionStatus.COMPLETED
        session.updated_at = datetime.now(timezone.utc)
        await session.save()

        logger.info(
            "report.background_complete",
            session_id=session_id,
            report_length=len(report_md),
        )
        _emit_report_to_terminal(session_id, report_md)

    except Exception:
        logger.exception("report.background_error", session_id=session_id)
        # Attempt to mark session as errored
        try:
            session = await InterviewSession.get(session_id)
            if session:
                session.status = SessionStatus.ERROR
                session.updated_at = datetime.now(timezone.utc)
                await session.save()
        except Exception:
            logger.exception("report.error_status_update_failed", session_id=session_id)
