"""
api.v1.smart_interview
~~~~~~~~~~~~~~~~~~~~~~~
REST endpoints for the resume-based "Smart Interview" flow.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List

from beanie import PydanticObjectId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import structlog

from core.redis import get_redis
from models.schemas import (
    AnswerFeedback,
    AnswerSubmission,
    CandidateProfile,
    ResumeUploadResponse,
    SmartQuestion,
    SmartQuestionSet,
    SmartReport,
)
from models.session import InterviewSession, SessionStatus
from services.profile_analyzer import ProfileAnalyzerAgent
from services.resume_parser import extract_text_from_file

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/smart", tags=["Smart Interview"])

_analyzer = ProfileAnalyzerAgent()


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
) -> ResumeUploadResponse:
    """
    Upload a resume and job description to initialize a smart interview session.
    """
    logger.info("smart.upload_started", filename=resume.filename)

    # 1. Extract text from resume
    file_bytes = await resume.read()
    resume_text = await extract_text_from_file(file_bytes, resume.filename or "resume.pdf")

    # 2. Analyze resume and JD using LLM
    profile = await _analyzer.analyze_resume(resume_text, job_description)

    # 3. Create session in MongoDB
    session = InterviewSession(
        role=profile.job_title_applying_for,
        level=profile.experience_level,
        target_skills=profile.technical_skills,
        candidate_name=profile.candidate_name,
        experience_level=profile.experience_level,
        years_of_experience=profile.years_of_experience,
        technical_skills=profile.technical_skills,
        soft_skills=profile.soft_skills,
        past_roles=profile.past_roles,
        projects=profile.projects,
        job_title_applying_for=profile.job_title_applying_for,
        key_jd_requirements=profile.key_jd_requirements,
        matched_skills=profile.matched_skills,
        skill_gaps=profile.skill_gaps,
        interview_focus_areas=profile.interview_focus_areas,
        resume_parsed=True,
    )
    await session.insert()
    session_id = str(session.id)

    logger.info("smart.session_created", session_id=session_id)

    return ResumeUploadResponse(session_id=session_id, profile=profile)


@router.get("/profile/{session_id}", response_model=CandidateProfile)
async def get_smart_profile(session_id: str) -> CandidateProfile:
    """
    Retrieve the analyzed candidate profile for a session.
    """
    session = await InterviewSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return CandidateProfile(
        candidate_name=session.candidate_name or "Unknown",
        experience_level=session.experience_level or "junior",
        years_of_experience=session.years_of_experience or 0,
        technical_skills=session.technical_skills or [],
        soft_skills=session.soft_skills or [],
        past_roles=session.past_roles or [],
        projects=session.projects or [],
        job_title_applying_for=session.job_title_applying_for or "Unknown",
        key_jd_requirements=session.key_jd_requirements or [],
        matched_skills=session.matched_skills or [],
        skill_gaps=session.skill_gaps or [],
        interview_focus_areas=session.interview_focus_areas or [],
    )


@router.post("/start/{session_id}", response_model=SmartQuestionSet)
async def start_smart_interview(session_id: str) -> SmartQuestionSet:
    """
    Generate questions and start the smart interview.
    """
    session = await InterviewSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    profile = await get_smart_profile(session_id)
    questions = await _analyzer.generate_questions(profile)

    # Store questions in Redis for state management
    redis = get_redis()
    questions_key = f"smart:{session_id}:questions"
    questions_data = [q.model_dump() for q in questions]
    await redis.set(questions_key, json.dumps(questions_data), ex=3600)

    logger.info("smart.interview_started", session_id=session_id, question_count=len(questions))

    return SmartQuestionSet(session_id=session_id, questions=questions)


@router.post("/answer", response_model=AnswerFeedback)
async def submit_smart_answer(request: AnswerSubmission) -> AnswerFeedback:
    """
    Submit an answer to a smart question and get feedback.
    """
    redis = get_redis()
    questions_key = f"smart:{request.session_id}:questions"
    raw_questions = await redis.get(questions_key)
    if not raw_questions:
        raise HTTPException(status_code=404, detail="Questions not found or session expired")

    questions = json.loads(raw_questions)
    # Find the specific question
    question_data = next((q for q in questions if q["id"] == request.question_id), None)
    if not question_data:
        raise HTTPException(status_code=404, detail="Question ID not found")

    # Evaluate answer
    feedback = await _analyzer.evaluate_answer(
        question=question_data["question"],
        expected_keywords=question_data["expected_keywords"],
        answer=request.answer,
    )

    # Store answer and feedback in Redis
    answers_key = f"smart:{request.session_id}:answers"
    answer_record = {
        "question_id": request.question_id,
        "question": question_data["question"],
        "answer": request.answer,
        "score": feedback.score,
        "feedback": feedback.feedback,
    }
    await redis.rpush(answers_key, json.dumps(answer_record))

    return feedback


@router.post("/finish/{session_id}", response_model=SmartReport)
async def finish_smart_interview(session_id: str) -> SmartReport:
    """
    Complete the smart interview and generate the final report.
    """
    session = await InterviewSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    redis = get_redis()
    answers_key = f"smart:{session_id}:answers"
    raw_answers = await redis.lrange(answers_key, 0, -1)
    if not raw_answers:
        raise HTTPException(status_code=400, detail="No answers found for this session")

    answers = [json.loads(a) for a in raw_answers]
    
    # Generate final report
    report = await _analyzer.generate_report({"answers": answers})

    # Persist report and update session status
    session.status = SessionStatus.COMPLETED
    session.updated_at = datetime.now(timezone.utc)
    # We store the smart report summary in the generic report_markdown field or handle differently
    # Let's just persist the smart report data as a block of text for now or extend model if needed
    # User prompt said: "persists report to MongoDB InterviewSession document"
    # But didn't specify a NEW field, so I'll reuse report_markdown with a summary
    session.report_markdown = f"""
# Smart Interview Report
**Overall Score: {report.overall_score}/10**
**Verdict: {report.readiness_verdict}**

## Strengths
{chr(10).join(f'- {s}' for s in report.strengths)}

## Areas to Improve
{chr(10).join(f'- {w}' for w in report.weak_areas)}

## Recommendations
{chr(10).join(f'{i+1}. {r}' for i, r in enumerate(report.recommendations))}
"""
    await session.save()

    # Clean up Redis
    await redis.delete(f"smart:{session_id}:questions")
    await redis.delete(answers_key)

    logger.info("smart.interview_finished", session_id=session_id, score=report.overall_score)

    return report
