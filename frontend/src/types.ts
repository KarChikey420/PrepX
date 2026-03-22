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
