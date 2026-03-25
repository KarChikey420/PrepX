import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { AICore } from '../components/AICore';
import { useRestInterview } from '../hooks/useRestInterview';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import type { SessionData } from '../types';
import { Mic, MicOff, RefreshCcw } from 'lucide-react';

interface InterviewViewProps {
  session: SessionData;
  onComplete: () => void;
}

export function InterviewView({ session, onComplete }: InterviewViewProps) {
  const { 
    isConnected, 
    aiState, 
    messages, 
    reportMarkdown,
    sendAudioData, 
    signalTurnEnd, 
    signalInterviewEnd,
    regenerateQuestion,
    setAudioChunkHandler,
    setAiState
  } = useRestInterview(session.session_id);
  const [isEnding, setIsEnding] = useState(false);
  const [endMessage, setEndMessage] = useState<string | null>(null);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder((blob) => {
    // Pipe mic chunks to WebSocket
    sendAudioData(blob);
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleMic = useCallback(async () => {
    initAudio(); // Required to unlock Web Audio API on first interaction
    
    if (isRecording) {
      setAiState('thinking'); // Show processing while we finalize the audio
      await stopRecording();
      signalTurnEnd(); // Tell backend we finished speaking after the last chunk is flushed
    } else {
      if (aiState === 'listening' || aiState === 'idle') {
        setAiState('listening'); // Show listening state immediately
        await startRecording();
      }
    }
  }, [isRecording, aiState, signalTurnEnd, setAiState, startRecording, stopRecording]);

  const { enqueueAudio, initAudio } = useAudioPlayer(() => {
    if (aiState === 'speaking') {
      setAiState('idle');
      // Automatically open mic after AI finishes speaking
      setTimeout(() => {
        // Only start if not already recording and not ending
        // Use latest state via closures is tricky; we'll assume standard flow
        toggleMic();
      }, 500);
    }
  });

  // Pipe TTS chunks to AudioPlayer
  useEffect(() => {
    setAudioChunkHandler(enqueueAudio);
  }, [setAudioChunkHandler, enqueueAudio]);

  useEffect(() => {
    if (reportMarkdown) {
      onComplete();
    }
  }, [reportMarkdown, onComplete]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const endSession = async () => {
    if (isRecording) {
      await stopRecording();
    }
    setIsEnding(true);
    setEndMessage("Ending interview. The report will appear here after it finishes generating.");

    try {
      signalInterviewEnd();
      setEndMessage("Interview ended. Generating your report now.");
    } catch (e) {
      console.error(e);
      setEndMessage("Could not end the interview cleanly. Check the backend logs for details.");
      setIsEnding(false);
    }
  };

  return (
    <div className="interview-view" style={{height: 'calc(100vh - 120px)', display: 'flex', gap: '2rem'}}>
      {/* Visualizer Side */}
      <div className="ai-core-container" style={{flex: 1, position: 'relative'}}>
        <div className="glass-card" style={{height: '100%', overflow: 'hidden'}}>
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <AICore state={aiState} />
          </Canvas>
          <div className="ai-status-overlay">
            <div className={`status-dot ${aiState}`} />
            {aiState.toUpperCase()}
          </div>
        </div>
      </div>

      {/* interaction Sidebar */}
      <div className="interview-sidebar" style={{width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <div className="glass-card" style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
          <div className="chat-box" style={{flex: 1, padding: '1.5rem', overflowY: 'auto'}}>
            {messages.length === 0 && (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem'}}>
                Connection established. Waiting for AI initiation...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                <div style={{fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.4rem', opacity: 0.5, fontWeight: 700}}>
                  {m.role}
                </div>
                {m.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="controls-bar" style={{padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)', textAlign: 'center'}}>
            <button 
              className={`btn-icon ${isRecording ? 'active' : ''}`}
              style={{
                width: '64px', height: '64px', margin: '0 auto 1rem',
                background: isRecording ? 'var(--red)' : 'var(--accent)',
                color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 20px rgba(99, 102, 241, 0.3)'
              }}
              onClick={toggleMic}
              disabled={isEnding || !isConnected || aiState === 'speaking' || aiState === 'thinking'}
            >
              {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            <div className="controls-hint" style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
              {isRecording ? "Listening..." : "Click to speak"}
            </div>
          </div>
        </div>

        <div style={{display: 'flex', gap: '1rem'}}>
          <button 
            className="btn" 
            style={{flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.75rem'}}
            onClick={regenerateQuestion}
            disabled={isEnding || aiState !== 'idle'}
          >
            <RefreshCcw size={18} /> Skip
          </button>
          <button 
            className="btn-primary" 
            style={{flex: 2}}
            onClick={endSession}
            disabled={isEnding}
          >
            End Interview
          </button>
        </div>

        {endMessage && (
          <div style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.95rem', textAlign: 'center', background: 'var(--accent-glow)', padding: '1rem', borderRadius: '8px' }}>
            {endMessage}
          </div>
        )}
      </div>
    </div>
  );
}
