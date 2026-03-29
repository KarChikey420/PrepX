"""
services.profile_analyzer
~~~~~~~~~~~~~~~~~~~~~~~~~
LLM-based analysis of candidate resumes and job descriptions.
Uses Kimi K2 to extract profiles, generate questions, and evaluate answers,
and generate the final structured interview report.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

import structlog

from models.schemas import CandidateProfile, UnifiedQuestion, FinalReport
from services.agents.base import BaseAgent

logger = structlog.get_logger(__name__)


class ProfileAnalyzerAgent(BaseAgent):
    """
    Expert technical recruiter and interviewer agent.
    Handles resume analysis, question generation, answer evaluation,
    and final report generation for the unified interview flow.
    """

    def __init__(self) -> None:
        super().__init__(
            system_prompt=(
                "You are an expert technical recruiter and senior interviewer. "
                "You analyze resumes, generate interview questions, evaluate answers, "
                "and produce actionable performance reports. "
                "Always return raw valid JSON only — no markdown fences, no explanations."
            ),
            temperature=0.2,
        )

    # ── Profile Analysis ───────────────────────────────────────────────

    async def analyze_resume(
        self, resume_text: str, job_description: str
    ) -> CandidateProfile:
        """
        Analyze resume + JD and return a structured CandidateProfile.
        """
        prompt = f"""Analyze the following resume and job description.
Return ONLY valid raw JSON matching the schema below. No extra text.

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
}}"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            return CandidateProfile(**data)
        except Exception as e:
            logger.error("profile_analyzer.analyze_error", error=str(e), raw_response=response_text)
            raise ValueError(f"Failed to parse LLM response into CandidateProfile: {str(e)}") from e

    # ── Question Generation ────────────────────────────────────────────

    async def generate_questions(
        self, profile: CandidateProfile
    ) -> List[UnifiedQuestion]:
        """
        Generate exactly 10 personalized interview questions from the candidate profile.
        Distribution: 5 technical, 3 behavioral, 2 situational.
        Start difficulty: medium. Adaptive adjustment happens at runtime per answer.
        """
        prompt = f"""You are a senior technical interviewer.
Generate exactly 10 interview questions for this candidate. Return ONLY valid raw JSON.

CANDIDATE PROFILE:
{profile.model_dump_json(indent=2)}

REQUIREMENTS:
- 5 technical questions (focused on matched_skills and skill_gaps, personalized to projects/roles)
- 3 behavioral questions (appropriate for level: {profile.experience_level})
- 2 situational questions (derived from key_jd_requirements)
- Start all difficulties at "medium" — runtime will adapt to "easy"/"hard" based on scoring
- Questions must be concise and voice-interview friendly (1-3 sentences max, no code blocks)
- Questions must be unique and personalized — not generic

JSON SCHEMA:
{{
  "questions": [
    {{
      "id": "int (1-10)",
      "type": "technical|behavioral|situational",
      "difficulty": "medium",
      "question": "str",
      "focus_area": "str",
      "expected_keywords": ["str"]
    }}
  ]
}}"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            questions = [UnifiedQuestion(**q) for q in data.get("questions", [])]
            logger.info("profile_analyzer.questions_generated", count=len(questions))
            return questions
        except Exception as e:
            logger.error("profile_analyzer.generate_questions_error", error=str(e))
            raise ValueError("Failed to generate interview questions") from e

    # ── Answer Evaluation ──────────────────────────────────────────────

    async def evaluate_answer(
        self,
        question: str,
        expected_keywords: List[str],
        answer: str,
        focus_area: str,
        level: str,
    ) -> Dict[str, Any]:
        """
        Evaluate a candidate's answer. Returns score (internal), feedback, strengths, weaknesses.
        Score is NEVER passed to the client — only used for adaptive difficulty and final report.
        """
        prompt = f"""As a technical interviewer, evaluate the following Q&A.
Return ONLY valid raw JSON.

FOCUS AREA: {focus_area}
CANDIDATE LEVEL: {level}
QUESTION: {question}
EXPECTED KEYWORDS: {', '.join(expected_keywords)}
CANDIDATE ANSWER: {answer}

JSON SCHEMA:
{{
  "score": "int (1-10, internal only)",
  "feedback": "str (2-3 sentences, constructive and specific)",
  "strengths": ["str (1-3 items)"],
  "weaknesses": ["str (1-3 items)"]
}}"""
        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            logger.info(
                "profile_analyzer.evaluation_complete",
                focus_area=focus_area,
                score=data.get("score"),
            )
            return data
        except Exception as e:
            logger.error("profile_analyzer.evaluate_error", error=str(e))
            return {
                "score": 5,
                "feedback": "Could not evaluate the response.",
                "strengths": [],
                "weaknesses": [],
            }

    # ── Final Report ───────────────────────────────────────────────────

    async def generate_final_report(
        self,
        profile: CandidateProfile,
        evaluations: List[Dict[str, Any]],
        questions: List[Dict[str, Any]],
    ) -> FinalReport:
        """
        Generate a comprehensive final report after all 10 questions.

        Includes:
        - Overall performance summary
        - Strong and weak areas
        - Skill gap vs JD
        - Communication assessment
        - Verdict: Hire | Borderline | Needs Improvement
        - Actionable recommendations
        - Overall score (visible in report summary)
        """
        # Pair questions with their evaluations for richer context
        qa_pairs = []
        for i, evaluation in enumerate(evaluations):
            q_data = questions[i] if i < len(questions) else {}
            qa_pairs.append({
                "question_number": i + 1,
                "focus_area": q_data.get("focus_area", ""),
                "question_type": q_data.get("type", ""),
                "question": q_data.get("question", ""),
                "score": evaluation.get("score", 0),
                "feedback": evaluation.get("feedback", ""),
                "strengths": evaluation.get("strengths", []),
                "weaknesses": evaluation.get("weaknesses", []),
            })

        prompt = f"""You are an expert technical recruiter. Analyze this interview session and generate a final report.
Return ONLY valid raw JSON matching the schema below.

CANDIDATE: {profile.candidate_name}
ROLE APPLIED: {profile.job_title_applying_for}
EXPERIENCE LEVEL: {profile.experience_level} ({profile.years_of_experience} years)
SKILL GAPS VS JD: {", ".join(profile.skill_gaps)}
JD REQUIREMENTS: {", ".join(profile.key_jd_requirements)}

INTERVIEW Q&A WITH SCORES:
{json.dumps(qa_pairs, indent=2)}

VERDICT CRITERIA:
- "Hire": Average score >= 7.5, no critical weaknesses, solid communication
- "Borderline": Average score 5.5-7.4, some gaps but shows potential
- "Needs Improvement": Average score < 5.5, major gaps or poor communication

JSON SCHEMA:
{{
  "overall_summary": "str (3-4 sentences summarizing overall performance)",
  "strong_areas": ["str (3-5 specific strengths with context)"],
  "weak_areas": ["str (3-5 specific weaknesses with context)"],
  "skill_gap": ["str (gaps relative to the JD requirements)"],
  "communication_assessment": "str (2-3 sentences on clarity, structure, confidence)",
  "verdict": "Hire|Borderline|Needs Improvement",
  "recommendations": ["str (5-7 very specific, actionable recommendations)"],
  "overall_score": "float (0-10, weighted average with context)"
}}"""

        response_text = await self.generate(prompt)
        try:
            data = self._parse_json(response_text)
            report = FinalReport(
                session_id="",  # Will be injected by the router
                **data,
            )
            logger.info(
                "profile_analyzer.report_generated",
                verdict=report.verdict,
                score=report.overall_score,
            )
            return report
        except Exception as e:
            logger.error("profile_analyzer.report_error", error=str(e))
            raise ValueError("Failed to generate final report") from e

    # ── JSON Helper ────────────────────────────────────────────────────

    def _parse_json(self, text: str) -> dict:
        """Strip markdown fences and parse JSON from LLM output."""
        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        return json.loads(clean.strip())
