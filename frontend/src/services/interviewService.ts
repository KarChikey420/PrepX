import api, { ensureBackendReady, isRecoverableNetworkError } from './api';
import type { 
  UploadResponse, 
  StartResponse, 
  TurnResponse, 
  FinalReport, 
  ReportPollResponse,
  SessionStatusResponse,
} from '../types/api';

const REQUEST_RETRY_DELAY_MS = 1500;
const UPLOAD_TIMEOUT_MS = 180000;
const START_TIMEOUT_MS = 240000;
const UPLOAD_STATUS_POLL_MS = 4000;
const UPLOAD_STATUS_MAX_POLLS = 75;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const withBackendRecovery = async <T>(
  request: (attempt: number) => Promise<T>,
  retryCount = 4,
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

      const backoffDelay = REQUEST_RETRY_DELAY_MS * Math.pow(2, attempt);
      await sleep(backoffDelay);
    }
  }

  throw lastError ?? new Error('Request failed unexpectedly.');
};

export const interviewService = {
  upload: async (resume: File, jobDescription: string): Promise<UploadResponse> => {
    return withBackendRecovery(async () => {
      const formData = new FormData();
      formData.append('resume', resume);
      formData.append('job_description', jobDescription.trim());

      const response = await api.post<UploadResponse>('/interview/upload', formData, {
        timeout: UPLOAD_TIMEOUT_MS,
      });
      return response.data;
    });
  },

  getSessionStatus: async (sessionId: string): Promise<SessionStatusResponse> => {
    const response = await api.get<SessionStatusResponse>(`/interview/${sessionId}/status`);
    return response.data;
  },

  waitForUploadReady: async (sessionId: string): Promise<SessionStatusResponse> => {
    let shouldForceBackendWake = false;

    for (let attempt = 0; attempt < UPLOAD_STATUS_MAX_POLLS; attempt += 1) {
      try {
        // Only force a wake-up after an actual recoverable failure.
        // Re-warming on every poll adds unnecessary load on Render.
        await ensureBackendReady(shouldForceBackendWake);
        shouldForceBackendWake = false;

        const status = await interviewService.getSessionStatus(sessionId);

        if ((status.status === 'active' || status.status === 'completed') && status.profile) {
          return status;
        }

        if (status.status === 'error') {
          throw new Error(status.detail || 'Profile analysis failed. Please upload the resume again.');
        }

        if (status.status === 'expired') {
          throw new Error('The upload session expired before analysis completed. Please upload again.');
        }
      } catch (error) {
        if (!isRecoverableNetworkError(error)) {
          throw error;
        }

        shouldForceBackendWake = true;
      }

      await sleep(UPLOAD_STATUS_POLL_MS);
    }

    throw new Error('Profile analysis is taking longer than expected. Please keep the page open and try again shortly.');
  },

  start: async (sessionId: string): Promise<StartResponse> => {
    return withBackendRecovery(async () => {
      const response = await api.post<StartResponse>(`/interview/${sessionId}/start`, null, {
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
