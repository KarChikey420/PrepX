import { create } from 'zustand';
import type { CandidateProfile, TurnResponse, FinalReport } from '../types/api';

export type InterviewFlowStage = 'upload' | 'profile' | 'interview' | 'report';

const readStoredJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

interface InterviewState {
  sessionId: string | null;
  profile: CandidateProfile | null;
  currentTurn: TurnResponse | null;
  report: FinalReport | null;
  flowStage: InterviewFlowStage;
  status: 'idle' | 'analyzing' | 'interviewing' | 'finishing' | 'completed';
  error: string | null;
  audioPlayer: HTMLAudioElement | null;

  setSession: (sessionId: string, profile: CandidateProfile) => void;
  setTurn: (turn: TurnResponse) => void;
  playAudio: (url: string | null) => Promise<void>;
  validateSession: () => Promise<boolean>;
  setReport: (report: FinalReport) => void;
  advanceFlowStage: (stage: InterviewFlowStage) => void;
  setStatus: (status: InterviewState['status']) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const FLOW_STAGE_ORDER: Record<InterviewFlowStage, number> = {
  upload: 0,
  profile: 1,
  interview: 2,
  report: 3,
};

const initialSessionId = localStorage.getItem('prepX_sessionId');
const initialProfile = readStoredJson<CandidateProfile>('prepX_profile');
const initialReport = readStoredJson<FinalReport>('prepX_report');
const initialFlowStage = (() => {
  const storedStage = localStorage.getItem('prepX_flowStage') as InterviewFlowStage | null;

  if (storedStage) {
    return storedStage;
  }

  if (initialReport) {
    return 'report';
  }

  if (initialSessionId && initialProfile) {
    return 'profile';
  }

  return 'upload';
})();

export const useInterviewStore = create<InterviewState>((set) => ({
  sessionId: initialSessionId,
  profile: initialProfile,
  currentTurn: null,
  report: initialReport,
  flowStage: initialFlowStage,
  status: 'idle',
  error: null,
  audioPlayer: null,

  playAudio: async (url) => {
    if (!url) return;
    try {
      const { audioPlayer } = useInterviewStore.getState();
      if (audioPlayer) {
        audioPlayer.pause();
      }
      
      const absoluteUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL}${url}`;
      const newPlayer = new Audio(absoluteUrl);
      set({ audioPlayer: newPlayer });
      await newPlayer.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  },

  validateSession: async () => {
    const { sessionId, reset } = useInterviewStore.getState();
    if (!sessionId) return false;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/interview/${sessionId}/status`);
      if (!response.ok) {
        reset();
        return false;
      }
      const data = await response.json();
      if (data.status === 'expired') {
        reset();
        return false;
      }
      return true;
    } catch (err) {
      console.error('Session validation failed:', err);
      return false;
    }
  },

  setSession: (sessionId, profile) => {
    localStorage.setItem('prepX_sessionId', sessionId);
    localStorage.setItem('prepX_profile', JSON.stringify(profile));
    localStorage.removeItem('prepX_report');
    localStorage.setItem('prepX_flowStage', 'profile');
    set({
      sessionId,
      profile,
      currentTurn: null,
      report: null,
      flowStage: 'profile',
      status: 'idle',
      error: null,
    });
  },

  setTurn: (turn) => {
    set({ currentTurn: turn, status: 'interviewing', error: null });
    if (turn.audio_url) {
      useInterviewStore.getState().playAudio(turn.audio_url);
    }
  },

  setReport: (report) => {
    localStorage.setItem('prepX_report', JSON.stringify(report));
    localStorage.setItem('prepX_flowStage', 'report');
    set({ report, flowStage: 'report', status: 'completed', error: null });
  },

  advanceFlowStage: (stage) =>
    set((current) => {
      if (FLOW_STAGE_ORDER[stage] <= FLOW_STAGE_ORDER[current.flowStage]) {
        return current;
      }

      localStorage.setItem('prepX_flowStage', stage);
      return { ...current, flowStage: stage };
    }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error }),

  reset: () => {
    localStorage.removeItem('prepX_sessionId');
    localStorage.removeItem('prepX_profile');
    localStorage.removeItem('prepX_report');
    localStorage.removeItem('prepX_flowStage');
    set({
      sessionId: null,
      profile: null,
      currentTurn: null,
      report: null,
      flowStage: 'upload',
      status: 'idle',
      error: null,
    });
  },
}));
