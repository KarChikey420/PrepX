import { useState, useEffect } from 'react';
import { SetupView } from './views/SetupView';
import { InterviewView } from './views/InterviewView';
import { ReportView } from './views/ReportView';
import { ResumeSetupView } from './views/ResumeSetupView';
import { ProfileReviewView } from './views/ProfileReviewView';
import { SmartInterviewView } from './views/SmartInterviewView';
import { SmartResultsView } from './views/SmartResultsView';
import type { SessionData } from './types';

type AppState = 'setup' | 'interview' | 'report';

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [session, setSession] = useState<SessionData | null>(null);

  const handleInitialize = (data: SessionData) => {
    setSession(data);
    setAppState('interview');
  };

  const handleInterviewComplete = () => {
    setAppState('report');
  };

  const handleRestart = () => {
    setSession(null);
    setAppState('setup');
    window.location.hash = '';
  };

  // Simple Hash-based Router implementation for the new views
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="container">
      {/* Header */}
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 15px var(--accent-glow)'
        }}>
          PX
        </div>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>PrepX</h2>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
            AI Interview Matrix v1.1
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {appState === 'setup' && !hash && <SetupView onInitialize={handleInitialize} />}
      
      {appState === 'interview' && session && (
        <InterviewView session={session} onComplete={handleInterviewComplete} />
      )}

      {appState === 'report' && session && (
        <ReportView session={session} onRestart={handleRestart} />
      )}

      {/* Smart Interview Flow Routes */}
      {hash === '#/resume-setup' && <ResumeSetupView onAnalyzed={() => window.location.hash = '#/profile-review'} />}
      {hash === '#/profile-review' && <ProfileReviewView onStart={() => window.location.hash = '#/smart-interview'} />}
      {hash === '#/smart-interview' && <SmartInterviewView onComplete={() => window.location.hash = '#/smart-results'} />}
      {hash === '#/smart-results' && <SmartResultsView onRestart={() => window.location.hash = '#/resume-setup'} onHome={handleRestart} />}
    </div>
  );
}
