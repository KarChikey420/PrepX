"""
services.agents.interviewer
~~~~~~~~~~~~~~~~~~~~~~~~~~~
InterviewerAgent — Determines next question difficulty based on
the EvaluatorAgent's score and generates adaptive technical questions.
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Optional

import structlog

from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)

INTERVIEWER_SYSTEM_PROMPT = """\
You are an expert technical interviewer conducting a voice-based interview. \
Your job is to generate clear, conversational technical questions appropriate \
for the candidate's skill level.

QUESTION GENERATION RULES:
- Generate exactly ONE question at a time.
- Questions should be open-ended, encouraging the candidate to explain and reason.
- Difficulty adapts based on the provided difficulty level:
  - EASY: Foundational concepts, definitions, simple 'what is' or 'explain' questions.
  - MEDIUM: Applied knowledge, 'how would you', design trade-offs, comparisons.
  - HARD: Deep architectural decisions, edge cases, performance optimization, system design.
- Questions must be specific to the given skill/technology.
- Frame questions conversationally — this is a spoken interview, not a written exam.
- Do NOT include code snippets (this is voice-based).
- Keep each question to 1-3 sentences maximum.
- Do NOT number the question or prefix it with 'Question:'.
- Do NOT repeat questions from the conversation history.\
"""


def _determine_difficulty(score: Optional[int]) -> str:
    """
    Adaptive difficulty selection based on the last evaluation score.

    Score >= 8 → HARD
    Score 5-7 → MEDIUM
    Score < 5 → EASY
    None (first question) → MEDIUM (starting baseline)
    """
    if score is None:
        return "MEDIUM"
    if score >= 8:
        return "HARD"
    if score >= 5:
        return "MEDIUM"
    return "EASY"


class InterviewerAgent(BaseAgent):
    """
    Generates adaptive technical interview questions based on
    the candidate's performance and the current skill being assessed.
    """

    def __init__(self) -> None:
        super().__init__(
            system_prompt=INTERVIEWER_SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=256,
        )

    async def generate_question(
        self,
        skill: str,
        level: str,
        role: str,
        last_score: Optional[int] = None,
        conversation_history: Optional[list[dict[str, Any]]] = None,
    ) -> str:
        """
        Generate the next interview question (non-streaming).

        Args:
            skill: The technical skill to ask about.
            level: Candidate's seniority level.
            role: Target job role.
            last_score: Score from the previous evaluation (for adaptive difficulty).
            conversation_history: Previous Q&A pairs to avoid repetition.

        Returns:
            The generated interview question text.
        """
        difficulty = _determine_difficulty(last_score)

        prompt = self._build_prompt(skill, level, role, difficulty, conversation_history)
        question = await self.generate(prompt)

        logger.info(
            "interviewer.question_generated",
            skill=skill,
            difficulty=difficulty,
            last_score=last_score,
            question_length=len(question),
        )

        return question

    async def generate_question_stream(
        self,
        skill: str,
        level: str,
        role: str,
        last_score: Optional[int] = None,
        conversation_history: Optional[list[dict[str, Any]]] = None,
    ) -> AsyncIterator[str]:
        """
        Generate the next interview question with streaming output.

        Yields text chunks as they arrive from the LLM — ideal for
        piping directly into streaming TTS for ultra-low latency.
        """
        difficulty = _determine_difficulty(last_score)
        prompt = self._build_prompt(skill, level, role, difficulty, conversation_history)

        logger.info(
            "interviewer.question_streaming",
            skill=skill,
            difficulty=difficulty,
            last_score=last_score,
        )

        stream = await self._call_llm_streaming(
            messages=[{"role": "user", "content": prompt}]
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    def _build_prompt(
        self,
        skill: str,
        level: str,
        role: str,
        difficulty: str,
        conversation_history: Optional[list[dict[str, Any]]] = None,
    ) -> str:
        """Build the user prompt for question generation."""
        parts = [
            f"Generate a {difficulty} difficulty technical interview question.",
            f"Role: {role}",
            f"Candidate level: {level}",
            f"Skill/Topic: {skill}",
            f"Difficulty: {difficulty}",
        ]

        if conversation_history:
            recent = conversation_history[-6:]  # Last 3 Q&A pairs
            history_text = "\n".join(
                f"- [{entry.get('role', 'unknown')}]: {entry.get('content', '')[:200]}"
                for entry in recent
            )
            parts.append(f"\nPrevious conversation (do NOT repeat these questions):\n{history_text}")

        parts.append("\nGenerate your question now:")
        return "\n".join(parts)
