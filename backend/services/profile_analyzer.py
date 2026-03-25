"""
services.profile_analyzer
~~~~~~~~~~~~~~~~~~~~~~~~~
LLM-based analysis of candidate resumes and job descriptions.
Uses Kimi K2 to extract profiles, generate questions, and evaluate answers.
"""

from __future__ import annotations

import json
from typing import List, Optional

import structlog

from models.schemas import CandidateProfile, SmartQuestion, AnswerFeedback, SmartReport
from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)


class ProfileAnalyzerAgent(BaseAgent):
    """
    Expert technical recruiter and interviewer agent.
    Handles resume analysis, question generation, and evaluation.
    """

    def __init__(self) -> None:
        super().__init__(
            system_prompt="You are an expert technical recruiter and senior interviewer.",
            temperature=0.2,  # Lower temperature for consistent JSON output
        )

    async def analyze_resume(self, resume_text: str, job_description: str) -> CandidateProfile:
        """
        Analyze the resume and JD to extract a structured CandidateProfile.
        """
        prompt = f"""
Analyze the following resume and job description.
Return ONLY valid raw JSON, no explanation, no markdown fences.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

JSON SCHEMA:
{{
  "candidate_name": "str",
  "experience_level": "fresher|junior|mid|senior|lead",
  "years_of_experience": "int",
  "technical_skills": ["str"],
  "soft_skills": ["str"],
  "past_roles": ["str"],
  "projects": ["str"],
  "job_title_applying_for": "str",
  "key_jd_requirements": ["str"],
  "matched_skills": ["str"],
  "skill_gaps": ["str"],
  "interview_focus_areas": ["str"]
}}
"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            return CandidateProfile(**data)
        except Exception as e:
            logger.error("profile_analyzer.parse_error", error=str(e), response=response_text)
            raise ValueError("Failed to parse LLM response into CandidateProfile")

    async def generate_questions(self, profile: CandidateProfile) -> List[SmartQuestion]:
        """
        Generate exactly 10 interview questions based on the candidate's profile.
        5 technical, 3 behavioral, 2 situational.
        """
        prompt = f"""
You are a senior technical interviewer. Generate exactly 10 interview questions for this candidate.
Return ONLY valid raw JSON, no explanation, no markdown fences.

CANDIDATE PROFILE:
{profile.model_dump_json(indent=2)}

REQUIREMENTS:
- 5 technical questions (focused on matched skills and skill gaps)
- 3 behavioral questions (appropriate for experience level: {profile.experience_level})
- 2 situational questions (derived from JD requirements)

JSON SCHEMA:
{{
  "questions": [
    {{
      "id": "int (1-10)",
      "type": "technical|behavioral|situational",
      "difficulty": "easy|medium|hard",
      "question": "str",
      "focus_area": "str",
      "expected_keywords": ["str"]
    }}
  ]
}}
"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            return [SmartQuestion(**q) for q in data.get("questions", [])]
        except Exception as e:
            logger.error("profile_analyzer.generate_questions_error", error=str(e), response=response_text)
            raise ValueError("Failed to generate smart questions")

    async def evaluate_answer(
        self, question: str, expected_keywords: List[str], answer: str
    ) -> AnswerFeedback:
        """
        Evaluate a candidate's answer and provide feedback + optional follow-up.
        """
        prompt = f"""
As a technical interviewer, evaluate the following answer.
Return ONLY valid raw JSON.

QUESTION: {question}
EXPECTED KEYWORDS: {', '.join(expected_keywords)}
CANDIDATE ANSWER: {answer}

JSON SCHEMA:
{{
  "score": "int (0-10)",
  "feedback": "str (concise constructive feedback)",
  "follow_up_question": "optional str (if the answer was incomplete or interesting)"
}}
"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            return AnswerFeedback(**data)
        except Exception as e:
            logger.error("profile_analyzer.evaluate_error", error=str(e), response=response_text)
            return AnswerFeedback(score=0, feedback="Error evaluating answer.")

    async def generate_report(self, session_data: dict) -> SmartReport:
        """
        Generate a final smart report based on the session's answers and evaluations.
        """
        prompt = f"""
Analyze the following interview performance data and generate a final readiness report.
Return ONLY valid raw JSON.

SESSION DATA:
{json.dumps(session_data, indent=2)}

JSON SCHEMA:
{{
  "overall_score": "float (0-10)",
  "strengths": ["str"],
  "weak_areas": ["str"],
  "readiness_verdict": "Ready|Needs Practice|Not Ready",
  "recommendations": ["str"]
}}
"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            return SmartReport(**data)
        except Exception as e:
            logger.error("profile_analyzer.report_error", error=str(e), response=response_text)
            raise ValueError("Failed to generate smart report")

    def _parse_json(self, text: str) -> dict:
        """Helper to clean and parse LLM JSON responses."""
        # Strip potential markdown fences
        clean_text = text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        return json.loads(clean_text.strip())
