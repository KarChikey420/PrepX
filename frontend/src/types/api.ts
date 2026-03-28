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

export interface UploadResponse {
  session_id: string;
  profile: CandidateProfile;
  message: string;
}

export interface StartResponse {
  session_id: string;
  question_text: string;
  audio_base64: string | null; // Deprecated
  audio_url: string | null;    // New binary URL
  question_number: number;
  total_questions: number;
  focus_area: string;
  question_type: string;
}

export interface TurnResponse {
  transcription: string;
  mentor_hint: string | null;
  feedback: string | null;
  question_text: string;
  audio_base64: string | null; // Deprecated
  audio_url: string | null;    // New binary URL
  question_number: number;
  total_questions: number;
  focus_area: string;
  question_type: string;
  is_complete: boolean;
}

export interface FinalReport {
  overall_summary: string;
  strong_areas: string[];
  weak_areas: string[];
  skill_gap: string[];
  communication_assessment: string;
  verdict: 'Hire' | 'Borderline' | 'Needs Improvement';
  recommendations: string[];
  overall_score: number;
  session_id: string;
}

export interface ReportPollResponse {
  session_id: string;
  status: 'ready' | 'generating' | 'not_started';
  report_markdown: string | null;
  report: FinalReport | null;
}

export interface SessionStatusResponse {
  session_id: string;
  status: 'active' | 'completed' | 'expired';
  current_step: 'upload' | 'profile' | 'interview' | 'report';
  question_number: number;
  total_questions: number;
}
