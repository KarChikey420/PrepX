import { useState } from 'react';
import { SetupView } from './views/SetupView';
import { InterviewView } from './views/InterviewView';
import type { SessionData } from './types';

type AppState = 'setup' | 'interview';

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [session, setSession] = useState<SessionData | null>(null);

  const handleInitialize = (data: SessionData) => {
    setSession(data);
    setAppState('interview');
  };

  return (
    <div className="container">
      {/* Header */}
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)'
        }}>
          AI
        </div>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.02em' }}>Voice Interview Matrix</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Production Build 1.0
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {appState === 'setup' && <SetupView onInitialize={handleInitialize} />}
      
      {appState === 'interview' && session && (
        <InterviewView session={session} />
      )}
    </div>
  );
}
