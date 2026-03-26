import { create } from 'zustand';
import type { CandidateProfile, TurnResponse, FinalReport } from '../types/api';

interface InterviewState {
  sessionId: string | null;
  profile: CandidateProfile | null;
  currentTurn: TurnResponse | null;
  report: FinalReport | null;
  status: 'idle' | 'analyzing' | 'interviewing' | 'finishing' | 'completed';
  error: string | null;

  setSession: (sessionId: string, profile: CandidateProfile) => void;
  setTurn: (turn: TurnResponse) => void;
  setReport: (report: FinalReport) => void;
  setStatus: (status: InterviewState['status']) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  sessionId: localStorage.getItem('prepX_sessionId'),
  profile: JSON.parse(localStorage.getItem('prepX_profile') || 'null'),
  currentTurn: null,
  report: null,
  status: 'idle',
  error: null,

  setSession: (sessionId, profile) => {
    localStorage.setItem('prepX_sessionId', sessionId);
    localStorage.setItem('prepX_profile', JSON.stringify(profile));
    set({ sessionId, profile, status: 'idle', error: null });
  },

  setTurn: (turn) => set({ currentTurn: turn, status: 'interviewing', error: null }),

  setReport: (report) => {
    set({ report, status: 'completed', error: null });
  },

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error }),

  reset: () => {
    localStorage.removeItem('prepX_sessionId');
    localStorage.removeItem('prepX_profile');
    set({
      sessionId: null,
      profile: null,
      currentTurn: null,
      report: null,
      status: 'idle',
      error: null,
    });
  },
}));
