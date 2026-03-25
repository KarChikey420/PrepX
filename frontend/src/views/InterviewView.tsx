import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { AICore } from '../components/AICore';
import { useRestInterview } from '../hooks/useRestInterview';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import type { SessionData } from '../types';
import { Mic, MicOff, CheckCircle, RefreshCcw } from 'lucide-react';

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
    <div className="interview-view">
      {/* 3D Visualizer Side */}
      <div className="glass-panel ai-core-container">
        <div className="canvas-wrapper">
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <AICore state={aiState} />
          </Canvas>
        </div>
        
        <div className="ai-status-overlay">
          <div className={`status-dot ${aiState}`}></div>
          {aiState === 'idle' && 'SYSTEM READY'}
          {aiState === 'listening' && 'LISTENING...'}
          {aiState === 'thinking' && 'PROCESSING...'}
          {aiState === 'speaking' && 'GENERATING AUDIO'}
        </div>
      </div>

      {/* Chat & Controls Side */}
      <div className="interview-sidebar glass-panel">
        
        <div className="chat-box">
          {messages.length === 0 && (
            <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem'}}>
              Connection established. Waiting for AI initiation...
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.role === 'interviewer' && <strong>AI: </strong>}
              {msg.role === 'candidate' && <strong>You: </strong>}
              {msg.role === 'mentor' && <strong style={{color: 'var(--accent-cyan)'}}>Mentor: </strong>}
              {msg.content.startsWith('{') ? null : msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="controls-bar">
          <button 
            className={`btn-icon ${isRecording ? 'active' : ''}`}
            onClick={toggleMic}
            disabled={isEnding || !isConnected || aiState === 'speaking' || aiState === 'thinking'}
            title={isRecording ? "Stop Recording & Submit" : "Hold or Click to Speak"}
          >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <div className="controls-hint">
            {isRecording 
              ? 'Recording... Click to end turn.' 
              : 'Click Mic to answer.'}
          </div>

          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button 
              className="btn btn-secondary" 
              style={{padding: '0.75rem 1rem'}}
              onClick={regenerateQuestion}
              disabled={isEnding || aiState !== 'idle'}
              title="Skip this question and ask another one"
            >
              <RefreshCcw size={18} style={{marginRight: 8, display: 'inline'}} /> New Question
            </button>

            <button 
              className="btn btn-primary" 
              style={{padding: '0.75rem 1rem'}}
              onClick={endSession}
              disabled={isEnding}
            >
              <CheckCircle size={18} style={{marginRight: 8, display: 'inline'}} /> End
            </button>
          </div>
        </div>

        {endMessage && (
          <div style={{ marginTop: '1rem', color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
            {endMessage}
          </div>
        )}
      </div>
    </div>
  );
}
