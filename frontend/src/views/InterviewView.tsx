import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AICore } from '../components/AICore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import type { SessionData } from '../types';
import { Mic, MicOff, CheckCircle } from 'lucide-react';

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
    setAudioChunkHandler 
  } = useWebSocket(session.session_id);

  const { enqueueAudio, initAudio } = useAudioPlayer();
  
  const { isRecording, startRecording, stopRecording } = useAudioRecorder((blob) => {
    // Pipe mic chunks to WebSocket
    sendAudioData(blob);
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Pipe TTS chunks to AudioPlayer
  useEffect(() => {
    setAudioChunkHandler(enqueueAudio);
  }, [setAudioChunkHandler, enqueueAudio]);

  // Handle interview completion
  useEffect(() => {
    if (reportMarkdown) {
      onComplete(); // Tells parent to switch to ReportView
    }
  }, [reportMarkdown, onComplete]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleMic = () => {
    initAudio(); // Required to unlock Web Audio API on first interaction
    
    if (isRecording) {
      stopRecording();
      signalTurnEnd(); // Tell backend we finished speaking
    } else {
      if (aiState === 'listening' || aiState === 'idle') {
        startRecording();
      }
    }
  };

  const endSession = async () => {
    if (isRecording) stopRecording();
    try {
      await fetch(`http://localhost:8000/api/v1/interview/${session.session_id}/finalize`, { method: 'POST' });
      // The WebSocket will receive 'interview_complete' and update state shortly.
    } catch (e) {
      console.error(e);
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
              {msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="controls-bar">
          <button 
            className={`btn-icon ${isRecording ? 'active' : ''}`}
            onClick={toggleMic}
            disabled={!isConnected || aiState === 'speaking' || aiState === 'thinking'}
            title={isRecording ? "Stop Recording & Submit" : "Hold or Click to Speak"}
          >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <div className="controls-hint">
            {isRecording 
              ? 'Recording... Click to end turn.' 
              : 'Click Mic to answer.'}
          </div>

          <button 
            className="btn btn-primary" 
            style={{padding: '0.75rem 1rem'}}
            onClick={endSession}
          >
            <CheckCircle size={18} /> End Interview
          </button>
        </div>
      </div>
    </div>
  );
}
