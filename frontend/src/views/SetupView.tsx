import { useState } from 'react';
import type { SessionData } from '../types';
import { Mic, Briefcase, Zap } from 'lucide-react';

interface SetupViewProps {
  onInitialize: (data: SessionData) => void;
}

export function SetupView({ onInitialize }: SetupViewProps) {
  const [role, setRole] = useState('Backend Engineer');
  const [level, setLevel] = useState('senior');
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
    <div className="setup-view glass-panel">
      <h1 className="title">System Configuration</h1>
      <p className="subtitle">Initialize the Voice Interview Matrix</p>

      {error && <div style={{ color: 'var(--accent-rose)', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label"><Briefcase size={16} style={{display: 'inline', marginRight: 8, verticalAlign: 'text-bottom'}} /> Role</label>
          <input 
            type="text" 
            className="form-input" 
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label"><Zap size={16} style={{display: 'inline', marginRight: 8, verticalAlign: 'text-bottom'}} /> Level</label>
          <select 
            className="form-select"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="junior">Junior (L3)</option>
            <option value="mid">Mid-level (L4)</option>
            <option value="senior">Senior (L5)</option>
            <option value="lead">Lead (L6)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Core Skills (comma separated)</label>
          <input 
            type="text" 
            className="form-input" 
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            required
            placeholder="e.g. React, Node.js, System Design"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}} disabled={isLoading}>
          {isLoading ? 'Booting Core...' : <><Mic size={20} /> Initialize Session</>}
        </button>
      </form>
    </div>
  );
}
