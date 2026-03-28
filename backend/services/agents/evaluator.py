"""
services.agents.evaluator
~~~~~~~~~~~~~~~~~~~~~~~~~
EvaluatorAgent — Analyzes candidate answers using function/tool calling
to guarantee a strict JSON evaluation response.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

import structlog

from models.schemas import EvaluationResult
from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)

# ── Tool Definition (Function Calling Schema) ────────────────────────

EVALUATION_TOOL: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "submit_evaluation",
        "description": (
            "Submit a structured evaluation of the candidate's answer. "
            "You MUST call this function with your evaluation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "score": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "description": (
                        "Quality score from 1 (poor) to 10 (excellent). "
                        "Consider technical accuracy, depth, clarity, and completeness."
                    ),
                },
                "feedback": {
                    "type": "string",
                    "description": (
                        "Detailed, constructive feedback on the candidate's answer. "
                        "Be specific about what was good and what could be improved. "
                        "2-4 sentences."
                    ),
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of 1-3 key strengths demonstrated in the answer.",
                },
                "weaknesses": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of 1-3 areas for improvement or gaps in the answer.",
                },
            },
            "required": ["score", "feedback", "strengths", "weaknesses"],
        },
    },
}

EVALUATOR_SYSTEM_PROMPT = """\
You are a senior technical interviewer and evaluator. Your role is to analyze \
a candidate's answer to a technical interview question and provide a structured evaluation.

EVALUATION CRITERIA:
- Technical accuracy: Is the answer factually correct?
- Depth of understanding: Does the answer show deep knowledge or just surface-level?
- Clarity of explanation: Is the answer well-structured and easy to follow?
- Completeness: Does the answer address all aspects of the question?
- Practical relevance: Does the answer show real-world experience?

SCORING GUIDE:
- 1-3: Incorrect, very incomplete, or shows fundamental misunderstanding
- 4-5: Partially correct but missing key concepts or has significant gaps
- 6-7: Mostly correct with good understanding but could be more detailed
- 8-9: Strong answer demonstrating deep knowledge and practical experience
- 10: Exceptional answer that is comprehensive, insightful, and technically flawless

You MUST call the submit_evaluation function with your assessment. Do NOT respond with plain text.\
"""


class EvaluatorAgent(BaseAgent):
    """
    Evaluates candidate answers via function/tool calling
    to guarantee strict JSON output conforming to EvaluationResult.
    """

    def __init__(self) -> None:
        super().__init__(
            system_prompt=EVALUATOR_SYSTEM_PROMPT,
            temperature=0.3,  # Low temperature for consistent scoring
            max_tokens=512,
        )

    async def evaluate(
        self,
        question: str,
        answer: str,
        skill: str,
        level: str,
    ) -> EvaluationResult:
        """
        Evaluate a candidate's answer to a technical question.

        Args:
            question: The interview question that was asked.
            answer: The candidate's transcribed answer.
            skill: The skill being assessed (e.g., "python").
            level: Expected candidate level (e.g., "senior").

        Returns:
            EvaluationResult with score, feedback, strengths, weaknesses.
        """
        user_prompt = (
            f"**Skill being assessed:** {skill}\n"
            f"**Expected level:** {level}\n\n"
            f"**Question asked:**\n{question}\n\n"
            f"**Candidate's answer:**\n{answer}\n\n"
            "Evaluate this answer by calling the submit_evaluation function."
        )

        response = await self._call_llm(
            messages=[{"role": "user", "content": user_prompt}],
            tools=[EVALUATION_TOOL],
            tool_choice={"type": "function", "function": {"name": "submit_evaluation"}},
        )

        message = response.choices[0].message

        # Extract the function call arguments
        if message.tool_calls and len(message.tool_calls) > 0:
            tool_call = message.tool_calls[0]
            arguments_str = tool_call.function.arguments
            
            try:
                # Robust parsing: handle potential prefixes or markdown
                clean_args = arguments_str.strip()
                if "```json" in clean_args:
                    clean_args = clean_args.split("```json")[-1].split("```")[0].strip()
                elif "```" in clean_args:
                    clean_args = clean_args.split("```")[-1].split("```")[0].strip()
                
                arguments = json.loads(clean_args)
            except json.JSONDecodeError:
                logger.error("evaluator.parsing_error", raw=arguments_str)
                arguments = {}

            logger.info(
                "evaluator.result",
                skill=skill,
                score=arguments.get("score"),
                strengths_count=len(arguments.get("strengths", [])),
                weaknesses_count=len(arguments.get("weaknesses", [])),
            )

            return EvaluationResult(**arguments)

        # Fallback: If the model didn't use the tool (shouldn't happen with tool_choice),
        # attempt to parse the response content as JSON.
        logger.warning("evaluator.no_tool_call", content=message.content)

        if message.content:
            try:
                parsed = json.loads(message.content)
                return EvaluationResult(**parsed)
            except (json.JSONDecodeError, ValueError):
                pass

        # Ultimate fallback: return a neutral evaluation
        logger.error("evaluator.parse_failure", content=message.content)
        return EvaluationResult(
            score=5,
            feedback="Unable to fully evaluate the response. Please try again.",
            strengths=["Attempted to answer the question"],
            weaknesses=["Evaluation could not be parsed properly"],
        )
