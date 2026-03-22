"""
services.agents.mentor
~~~~~~~~~~~~~~~~~~~~~~
MentorAgent — Generates empathetic, conversational transitions
based on the EvaluatorAgent's assessment.
"""

from __future__ import annotations

import structlog

from models.schemas import EvaluationResult
from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)

MENTOR_SYSTEM_PROMPT = """\
You are a supportive, empathetic interview mentor. After a candidate answers a \
technical question, you provide a brief, conversational transition that:

1. Acknowledges their effort positively (even for weak answers).
2. Provides a concise, encouraging insight based on the evaluation.
3. Smoothly transitions to the next question.

RULES:
- Keep your response to 1-2 sentences MAXIMUM.
- Be warm and professional — like a helpful colleague, not a cold examiner.
- If the score is low (1-4), be extra encouraging and supportive.
- If the score is high (8-10), show genuine appreciation.
- NEVER repeat the evaluation verbatim or list strengths/weaknesses.
- NEVER say the score number aloud.
- Speak directly to the candidate using "you".
- End with a natural transition like "Let's move on" or "Here's your next question".\
"""


class MentorAgent(BaseAgent):
    """
    Takes the EvaluatorAgent's structured output and generates a
    brief, empathetic, conversational transition for the candidate.
    """

    def __init__(self) -> None:
        super().__init__(
            system_prompt=MENTOR_SYSTEM_PROMPT,
            temperature=0.8,  # Higher creativity for natural speech
            max_tokens=150,   # Short responses only
        )

    async def generate_transition(
        self,
        evaluation: EvaluationResult,
        skill: str,
        is_last_question_for_skill: bool = False,
        next_skill: str | None = None,
    ) -> str:
        """
        Generate a 1-2 sentence empathetic transition based on evaluation.

        Args:
            evaluation: The EvaluatorAgent's structured evaluation.
            skill: Current skill being assessed.
            is_last_question_for_skill: Whether this is the last question for this skill.
            next_skill: The next skill to transition to, if any.

        Returns:
            A short, warm transition sentence.
        """
        context_parts = [
            f"Skill assessed: {skill}",
            f"Score: {evaluation.score}/10",
            f"Key feedback: {evaluation.feedback}",
        ]

        if evaluation.strengths:
            context_parts.append(f"Strengths noted: {', '.join(evaluation.strengths)}")
        if evaluation.weaknesses:
            context_parts.append(f"Areas to improve: {', '.join(evaluation.weaknesses)}")

        if is_last_question_for_skill and next_skill:
            context_parts.append(
                f"This was the last question on '{skill}'. "
                f"Transition smoothly to the next topic: '{next_skill}'."
            )
        elif is_last_question_for_skill and not next_skill:
            context_parts.append(
                f"This was the last question of the entire interview on '{skill}'. "
                "Wrap up warmly and let them know the interview is complete."
            )

        user_prompt = (
            "Based on the following evaluation, generate a brief empathetic transition:\n\n"
            + "\n".join(context_parts)
        )

        transition = await self.generate(user_prompt)

        logger.info(
            "mentor.transition_generated",
            skill=skill,
            score=evaluation.score,
            transition_length=len(transition),
        )

        return transition
