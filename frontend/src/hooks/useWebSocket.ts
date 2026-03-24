import { useState, useEffect, useRef, useCallback } from 'react';

export type AIState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface MessageInfo {
  role: 'interviewer' | 'candidate' | 'mentor' | 'system';
  content: string;
}

export function useWebSocket(sessionId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [aiState, setAiState] = useState<AIState>('idle');
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const onAudioChunkRef = useRef<((chunk: Blob) => void) | undefined>(undefined);
  const isFinalizingRef = useRef(false);
  const hasShownTtsFallbackRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Connect standard WebSocket
    const ws = new WebSocket(`ws://localhost:8000/api/v1/interview/stream/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS Connected');
      setIsConnected(true);
    };

    const finalizeInterview = async (sid: string) => {
      if (isFinalizingRef.current) return;
      isFinalizingRef.current = true;

      try {
        await fetch(`http://localhost:8000/api/v1/interview/${sid}/finalize`, { method: 'POST' });
      } catch (error) {
        console.error('Finalize error', error);
      } finally {
        setReportMarkdown("generating");
      }
    };

    ws.onmessage = async (event) => {
      // Handle Binary (Audio Chunks from TTS)
      if (event.data instanceof Blob) {
        setAiState('speaking');
        if (onAudioChunkRef.current) {
          onAudioChunkRef.current(event.data);
        }
        return;
      }

      // Handle JSON text messages
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      const { type, data } = msg;
      console.log("WS Data", type, data);

      if (type === 'ready') {
        setAiState('thinking');
      } else if (type === 'question') {
        setMessages(prev => [...prev, { role: 'interviewer', content: data.text }]);
        setAiState('speaking');
      } else if (type === 'transcription') {
        setMessages(prev => [...prev, { role: 'candidate', content: data.text }]);
      } else if (type === 'status') {
        setAiState('thinking');
      } else if (type === 'mentor') {
        setMessages(prev => [...prev, { role: 'mentor', content: data.text }]);
        setAiState('speaking');
      } else if (type === 'audio_complete') {
        // AI finished sending audio
        setAiState('idle');
        if (data?.error && !hasShownTtsFallbackRef.current) {
          hasShownTtsFallbackRef.current = true;
          setMessages(prev => [
            ...prev,
            {
              role: 'system',
              content: 'Voice playback is unavailable right now. The interview will continue in text-only mode.',
            },
          ]);
        }
      } else if (type === 'interview_complete') {
        ws.close();
        setAiState('idle');
        finalizeInterview(sessionId);
      } else if (type === 'error') {
        console.error("WS Server Error:", data.message);
        alert(`Error: ${data.message}`);
      }
    };

    ws.onerror = (e) => {
      console.error('WS Error', e);
    };

    ws.onclose = () => {
      console.log('WS Disconnected');
      setIsConnected(false);
    };

    return () => {
      // Force close regardless of ready state to prevent ghost connections
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [sessionId]);



  const sendAudioData = useCallback((blob: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(blob);
    }
  }, []);

  const signalTurnEnd = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_turn' }));
    }
  }, []);

  const signalInterviewEnd = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_interview' }));
    }
  }, []);

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
