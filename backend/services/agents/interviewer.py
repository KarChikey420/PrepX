"""
services.agents.interviewer
~~~~~~~~~~~~~~~~~~~~~~~~~~~
InterviewerAgent — Selects and adaptively re-frames questions from the
pre-generated question list based on the candidate's last score.

In the new unified flow, questions are generated upfront by ProfileAnalyzerAgent.
The InterviewerAgent's role is to:
  1. Pick the next question from the ordered list.
  2. Optionally re-frame the question text to match adaptive difficulty
     (EASY / MEDIUM / HARD) based on the last evaluation score.
  3. Return a clean, voice-friendly question string.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import structlog

from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)


# ── Difficulty Adapter ─────────────────────────────────────────────────


def determine_difficulty(last_score: Optional[int]) -> str:
    """
    Determine question difficulty based on the previous answer score.

    Score >= 8  → HARD   (push the candidate)
    Score 5-7   → MEDIUM (maintain baseline)
    Score < 5   → EASY   (guide and rebuild confidence)
    None        → MEDIUM (first question, start neutral)
    """
    if last_score is None:
        return "MEDIUM"
    if last_score >= 8:
        return "HARD"
    if last_score >= 5:
        return "MEDIUM"
    return "EASY"


# ── System Prompt ──────────────────────────────────────────────────────


INTERVIEWER_SYSTEM_PROMPT = """\
You are an expert technical interviewer conducting a voice-based interview.
Your job is to re-frame a given question to match the specified difficulty level,
keeping it concise, conversational, and appropriate for a spoken interview.

RULES:
- Preserve the core topic and focus area of the original question.
- EASY: Simplify — ask for definitions, basic explanations, or a simple example.
- MEDIUM: Keep the original question as-is (lightly polish phrasing if needed).
- HARD: Deepen — ask about edge cases, architecture trade-offs, or optimization.
- Max 1-3 sentences. No code snippets (voice interview).
- Do NOT prefix with "Question:" or numbering.
- Return ONLY the final question text, nothing else.\
"""


class InterviewerAgent(BaseAgent):
    """
    Selects and adaptively re-frames the next question from the pre-generated list.
    """

    def __init__(self) -> None:
        super().__init__(
            system_prompt=INTERVIEWER_SYSTEM_PROMPT,
            temperature=0.6,
            max_tokens=200,
        )

    async def get_next_question(
        self,
        questions: List[Dict[str, Any]],
        current_index: int,
        last_score: Optional[int] = None,
    ) -> tuple[str, str]:
        """
        Select the question at current_index and re-frame it for adaptive difficulty.

        Args:
            questions: Full list of pre-generated UnifiedQuestion dicts.
            current_index: Zero-based index into the questions list.
            last_score: Score from the previous answer (None for the first question).

        Returns:
            Tuple of (question_text, difficulty_label).
        """
        if current_index >= len(questions):
            raise IndexError(f"Question index {current_index} out of range ({len(questions)} questions)")

        question_data = questions[current_index]
        original_question = question_data.get("question", "")
        focus_area = question_data.get("focus_area", "")
        q_type = question_data.get("type", "technical")
        difficulty = determine_difficulty(last_score)

        # For behavioral/situational questions, difficulty re-framing is less meaningful.
        # Return original text for those; only re-frame technical questions.
        if q_type in ("behavioral", "situational") or difficulty == "MEDIUM":
            logger.info(
                "interviewer.question_selected",
                index=current_index,
                q_type=q_type,
                difficulty=difficulty,
                reframed=False,
            )
            return original_question, difficulty

        # Re-frame the question for EASY or HARD difficulty
        prompt = (
            f"Original question: {original_question}\n"
            f"Focus area: {focus_area}\n"
            f"Target difficulty: {difficulty}\n\n"
            "Re-frame this question to match the target difficulty. "
            "Return only the new question text."
        )

        try:
            reframed = await self.generate(prompt)
            question_text = reframed.strip() if reframed.strip() else original_question
        except Exception as e:
            logger.warning("interviewer.reframe_failed", error=str(e), index=current_index)
            question_text = original_question

        logger.info(
            "interviewer.question_reframed",
            index=current_index,
            q_type=q_type,
            difficulty=difficulty,
            reframed=True,
        )

        return question_text, difficulty

    async def generate_question_stream(
        self,
        questions: List[Dict[str, Any]],
        current_index: int,
        last_score: Optional[int] = None,
    ):
        """
        Streaming variant — yields question text chunks for low-latency TTS pipeline.
        Falls back to returning the full question text in one chunk if streaming fails.
        """
        question_text, difficulty = await self.get_next_question(
            questions, current_index, last_score
        )
        # Yield the full text as a single chunk (adaptive re-framing is already done above)
        yield question_text
