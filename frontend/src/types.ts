// types.ts
export interface SessionData {
  session_id: string;
  role: string;
  level: string;
  target_skills: string[];
}

export type AIState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface MessageLine {
  id: string;
  role: 'system' | 'interviewer' | 'candidate' | 'mentor';
  content: string;
}

export interface CandidateProfile {
  candidate_name: string;
  experience_level: 'fresher' | 'junior' | 'mid' | 'senior' | 'lead';
  years_of_experience: number;
  technical_skills: string[];
  soft_skills: string[];
  past_roles: string[];
  projects: string[];
  job_title_applying_for: string;
  key_jd_requirements: string[];
  matched_skills: string[];
  skill_gaps: string[];
  interview_focus_areas: string[];
}

export interface SmartQuestion {
  id: number;
  type: 'technical' | 'behavioral' | 'situational';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  focus_area: string;
  expected_keywords: string[];
}

export interface AnswerFeedback {
  score: number;
  feedback: string;
  follow_up_question?: string;
}

export interface SmartReport {
  overall_score: number;
  strengths: string[];
  weak_areas: string[];
  readiness_verdict: 'Ready' | 'Needs Practice' | 'Not Ready';
  recommendations: string[];
}
