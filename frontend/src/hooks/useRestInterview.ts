import { useState, useEffect, useRef, useCallback } from 'react';

export type AIState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface MessageInfo {
  role: 'interviewer' | 'candidate' | 'mentor' | 'system';
  content: string;
}

export function useRestInterview(sessionId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [aiState, setAiState] = useState<AIState>('idle');
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);

  const onAudioChunkRef = useRef<((chunk: Blob) => void) | undefined>(undefined);
  const hasStartedRef = useRef(false);
  
  // Accumulate chunks locally until turn ends
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!sessionId || hasStartedRef.current) return;
    hasStartedRef.current = true;
    setIsConnected(true);
    setAiState('thinking');

    // Start interview
    fetch(`http://localhost:8000/api/v1/interview/${sessionId}/start`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setMessages([{ role: 'interviewer', content: data.question_text }]);
        if (data.audio_base64 && onAudioChunkRef.current) {
          const byteCharacters = atob(data.audio_base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/wav' });
          onAudioChunkRef.current(blob);
          setAiState('speaking');
        } else {
          setAiState('idle');
        }
      })
      .catch(err => {
        console.error("Start error", err);
        setAiState('idle');
      });
  }, [sessionId]);

  const sendAudioData = useCallback((chunk: Blob) => {
    if (chunk.size > 0) {
      audioChunksRef.current.push(chunk);
    }
  }, []);

  const signalTurnEnd = useCallback(async () => {
    if (!sessionId || audioChunksRef.current.length === 0) return;
    
    setAiState('thinking');
    
    // Combine chunks
    const mimeType = audioChunksRef.current[0].type || 'audio/webm';
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
    audioChunksRef.current = []; // clear

    const formData = new FormData();
    // determine extension based on mimetype
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `audio.${ext}`);

    try {
      setMessages(prev => [...prev, { role: 'system', content: 'Transcribing & Evaluating...' }]);
      
      const response = await fetch(`http://localhost:8000/api/v1/interview/${sessionId}/turn`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process turn");
      }

      const data = await response.json();

      setMessages(prev => {
        // Remove the temporary system message
        const filtered = prev.filter(m => m.content !== 'Transcribing & Evaluating...');
        
        filtered.push({ role: 'candidate', content: data.transcription });
        
        if (data.evaluation) {
          filtered.push({ role: 'system', content: JSON.stringify(data.evaluation) });
        }
        if (data.mentor_text) {
          filtered.push({ role: 'mentor', content: data.mentor_text });
        }
        if (data.question_text) {
          filtered.push({ role: 'interviewer', content: data.question_text });
        }
        return filtered;
      });

      if (data.audio_base64 && onAudioChunkRef.current) {
        const byteCharacters = atob(data.audio_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        onAudioChunkRef.current(blob);
        setAiState('speaking');
      } else {
        setAiState('idle');
      }

      if (data.is_complete) {
        setReportMarkdown("generating");
        await fetch(`http://localhost:8000/api/v1/interview/${sessionId}/finalize`, { method: 'POST' });
      }

    } catch (err) {
      console.error("Turn error", err);
      // Remove loading message
      setMessages(prev => prev.filter(m => m.content !== 'Transcribing & Evaluating...'));
      setAiState('idle');
      alert("Error processing audio. Please try again.");
    }
  }, [sessionId]);

  const signalInterviewEnd = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`http://localhost:8000/api/v1/interview/${sessionId}/finalize`, { method: 'POST' });
      setReportMarkdown("generating");
    } catch (error) {
      console.error('Finalize error', error);
    }
  }, [sessionId]);

  const setAudioChunkHandler = useCallback((handler: (chunk: Blob) => void) => {
    onAudioChunkRef.current = handler;
  }, []);

  return {
    isConnected,
    aiState,
    setAiState,
    messages,
    reportMarkdown,
    sendAudioData,
    signalTurnEnd,
    signalInterviewEnd,
    setAudioChunkHandler
  };
}
