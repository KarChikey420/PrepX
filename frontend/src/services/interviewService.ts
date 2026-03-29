import api from './api';
import type { 
  UploadResponse, 
  StartResponse, 
  TurnResponse, 
  FinalReport, 
  ReportPollResponse 
} from '../types/api';

export const interviewService = {
  upload: async (resume: File, jobDescription: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('resume', resume);
    formData.append('job_description', jobDescription);
    
    const response = await api.post<UploadResponse>('/interview/upload', formData);
    return response.data;
  },

  start: async (sessionId: string): Promise<StartResponse> => {
    const response = await api.post<StartResponse>(`/interview/${sessionId}/start`);
    return response.data;
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
