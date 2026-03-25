import { useState } from 'react';
import type { SessionData } from '../types';
import { Mic, Briefcase, Zap } from 'lucide-react';

interface SetupViewProps {
  onInitialize: (data: SessionData) => void;
}

export function SetupView({ onInitialize }: SetupViewProps) {
  const [role, setRole] = useState('Backend Engineer');
  const [level, setLevel] = useState('junior');
  const [skillsInput, setSkillsInput] = useState('python, system design, databases');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
    if (skills.length === 0) {
      setError("Please provide at least one skill.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/v1/interview/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          level,
          skills,
          questions_per_skill: 3
        })
      });

      if (!res.ok) throw new Error("Failed to initialize session");
      const data = await res.json();
      
      onInitialize({
        session_id: data.session_id,
        role: data.role,
        level: data.level,
        target_skills: data.target_skills
      });
      
    } catch (err: unknown) {
      console.error("Initialization error:", err);
      if (err instanceof Error) {
        setError(err.message || "Network error. Is the backend running?");
      } else {
        setError("Network error. Is the backend running?");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="setup-view glass-card" style={{padding: '3rem', maxWidth: '600px', margin: '4rem auto'}}>
      <div style={{textAlign: 'center', marginBottom: '2.5rem'}}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px', 
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1rem', boxShadow: '0 8px 20px var(--accent-glow)'
        }}>
          <Zap size={32} color="white" />
        </div>
        <h1 style={{fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem'}}>PrepX</h1>
        <p style={{color: 'var(--text-secondary)', fontWeight: 500}}>AI-Powered Interview Simulator</p>
      </div>

      {error && <div style={{ color: 'var(--red)', marginBottom: '1.5rem', textAlign: 'center' }}>{error}</div>}

      <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <div className="form-group">
          <label className="form-label" style={{color: 'var(--text-secondary)'}}>
            <Briefcase size={14} style={{verticalAlign: 'middle', marginRight: '6px'}} /> Target Role
          </label>
          <input 
            type="text" 
            className="form-input" 
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Fullstack Engineer"
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{color: 'var(--text-secondary)'}}>
            <Zap size={14} style={{verticalAlign: 'middle', marginRight: '6px'}} /> Career Level
          </label>
          <select 
            className="form-select"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="fresher">Fresher (L1/L2)</option>
            <option value="junior">Junior (L3)</option>
          </select>
        </div>

        <div className="form-group" style={{marginBottom: '2rem'}}>
          <label className="form-label" style={{color: 'var(--text-secondary)'}}>Focus Skills</label>
          <input 
            type="text" 
            className="form-input" 
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="React, Node.js, AWS..."
          />
        </div>

        <button 
          onClick={handleSubmit} 
          className="btn-primary" 
          style={{width: '100%', padding: '1.25rem', fontSize: '1.1rem'}} 
          disabled={isLoading}
        >
          {isLoading ? 'Booting Core...' : <><Mic size={20} /> Start Voice Interview</>}
        </button>

        <div style={{display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0'}}>
          <div style={{flex: 1, height: '1px', background: 'var(--border)'}}></div>
          <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600}}>OR</span>
          <div style={{flex: 1, height: '1px', background: 'var(--border)'}}></div>
        </div>

        <button 
          className="btn" 
          style={{
            width: '100%', padding: '1.25rem', fontSize: '1.1rem',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', transition: 'all 0.2s'
          }}
          onClick={() => window.location.hash = '#/resume-setup'}
        >
          <FileText size={20} style={{marginRight: '8px'}} /> Resume-Based Interview
        </button>
      </div>
    </div>
  );
}

function FileText({ size, style }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );
}
