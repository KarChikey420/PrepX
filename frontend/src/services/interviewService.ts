import api, { ensureBackendReady, isRecoverableNetworkError } from './api';
import type { 
  UploadResponse, 
  StartResponse, 
  TurnResponse, 
  FinalReport, 
  ReportPollResponse 
} from '../types/api';

const REQUEST_RETRY_DELAY_MS = 1500;
const UPLOAD_TIMEOUT_MS = 300000;
const START_TIMEOUT_MS = 240000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const withBackendRecovery = async <T>(
  request: (attempt: number) => Promise<T>,
  retryCount = 1,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      await ensureBackendReady(attempt > 0);
      return await request(attempt);
    } catch (error) {
      lastError = error;

      if (!isRecoverableNetworkError(error) || attempt === retryCount) {
        throw error;
      }

      await sleep(REQUEST_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError ?? new Error('Request failed unexpectedly.');
};

export const interviewService = {
  upload: async (resume: File, jobDescription: string): Promise<UploadResponse> => {
    return withBackendRecovery(async () => {
      const formData = new FormData();
      formData.append('resume', resume);
      formData.append('job_description', jobDescription);

      const response = await api.post<UploadResponse>('/interview/upload', formData, {
        timeout: UPLOAD_TIMEOUT_MS,
      });
      return response.data;
    });
  },

  start: async (sessionId: string): Promise<StartResponse> => {
    return withBackendRecovery(async () => {
      const response = await api.post<StartResponse>(`/interview/${sessionId}/start`, undefined, {
        timeout: START_TIMEOUT_MS,
      });
      return response.data;
    });
  },

  submitTurn: async (sessionId: string, audioBlob: Blob): Promise<TurnResponse> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    const response = await api.post<TurnResponse>(`/interview/${sessionId}/turn`, formData);
    return response.data;
  },

  finish: async (sessionId: string): Promise<FinalReport> => {
    const response = await api.post<FinalReport>(`/interview/${sessionId}/finish`);
    return response.data;
  },

  getReport: async (sessionId: string): Promise<ReportPollResponse> => {
    const response = await api.get<ReportPollResponse>(`/interview/${sessionId}/report`);
    return response.data;
  },
};
