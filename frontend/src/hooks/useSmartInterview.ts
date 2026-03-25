import { useState } from 'react';
import type { CandidateProfile, SmartQuestion, AnswerFeedback, SmartReport } from '../types';

export function useSmartInterview() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [questions, setQuestions] = useState<SmartQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbacks, setFeedbacks] = useState<AnswerFeedback[]>([]);
  const [report, setReport] = useState<SmartReport | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadResume = async (resume: File, jobDescription: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('resume', resume);
      formData.append('job_description', jobDescription);

      const res = await fetch('http://localhost:8000/api/v1/smart/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload and analyze resume");
      const data = await res.json();
      
      setSessionId(data.session_id);
      setProfile(data.profile);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const startInterview = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/smart/start/${id}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to start interview");
      const data = await res.json();
      setQuestions(data.questions);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async (questionId: number, answer: string) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/smart/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: questionId,
          answer
        })
      });
      if (!res.ok) throw new Error("Failed to submit answer");
      const data = await res.json();
      setFeedbacks(prev => [...prev, data]);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const finishInterview = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/smart/finish/${sessionId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to generate report");
      const data = await res.json();
      setReport(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sessionId,
    profile,
    questions,
    currentIndex,
    setCurrentIndex,
    feedbacks,
    report,
    isLoading,
    error,
    uploadResume,
    startInterview,
    submitAnswer,
    finishInterview
  };
}
