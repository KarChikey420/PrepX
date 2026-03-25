import { useSmartInterview } from '../hooks/useSmartInterview';
import { Trophy, Shield, AlertCircle, List, ArrowLeft, RotateCcw } from 'lucide-react';

interface SmartResultsViewProps {
  onRestart: () => void;
  onHome: () => void;
}

export function SmartResultsView({ onRestart, onHome }: SmartResultsViewProps) {
  const { report } = useSmartInterview();

  if (!report) return null;

  const scoreColor = report.overall_score >= 7 ? 'var(--green)' : (report.overall_score >= 4 ? 'var(--amber)' : 'var(--red)');
  const verdictBadgeClass = report.readiness_verdict === 'Ready' ? 'badge-green' : (report.readiness_verdict === 'Needs Practice' ? 'badge-amber' : 'badge-red');

  return (
    <div className="container" style={{maxWidth: '1000px'}}>
      {/* Hero Score Section */}
      <div className="glass-card" style={{padding: '4rem 2rem', textAlign: 'center', marginBottom: '2.5rem', position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '400px', background: scoreColor, filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none'}}></div>
        
        <div style={{display: 'inline-block', position: 'relative', marginBottom: '2rem'}}>
          <svg width="180" height="180" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle 
              cx="50" cy="50" r="45" fill="none" stroke={scoreColor} strokeWidth="8" 
              strokeDasharray="283" strokeDashoffset={283 - (report.overall_score / 10 * 283)} 
              strokeLinecap="round" transform="rotate(-90 50 50)"
            />
            <text x="50" y="55" textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{report.overall_score}</text>
            <text x="50" y="70" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="600">OVERALL SCORE</text>
          </svg>
        </div>

        <h1 style={{fontSize: '2.5rem', marginBottom: '1rem'}}>Interview Evaluation Complete</h1>
        <div className={`badge ${verdictBadgeClass}`} style={{padding: '0.75rem 2rem', fontSize: '1.2rem', borderRadius: '12px'}}>
          {report.readiness_verdict.toUpperCase()}
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem'}}>
        <div className="glass-card" style={{padding: '2rem'}}>
          <h3 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <Shield size={20} color="var(--green)" /> Core Strengths
          </h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            {report.strengths.map((s, i) => (
              <div key={i} style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                <Trophy size={18} color="var(--green)" style={{flexShrink: 0, marginTop: '2px'}} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{padding: '2rem'}}>
          <h3 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <AlertCircle size={20} color="var(--amber)" /> Areas to Improve
          </h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            {report.weak_areas.map((w, i) => (
              <div key={i} style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                <AlertCircle size={18} color="var(--amber)" style={{flexShrink: 0, marginTop: '2px'}} />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{padding: '2rem', marginBottom: '4rem'}}>
        <h3 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
          <List size={20} color="var(--accent)" /> Personalized Recommendations
        </h3>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem'}}>
          {report.recommendations.map((r, i) => (
            <div key={i} style={{
              padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)',
              borderLeft: '4px solid var(--accent)', display: 'flex', gap: '1rem'
            }}>
              <span style={{fontWeight: 800, color: 'var(--accent)'}}>{i + 1}</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '6rem'}}>
        <button className="btn" style={{background: 'var(--bg-card)', border: '1px solid var(--border)'}} onClick={onHome}>
          <ArrowLeft size={18} /> Back to Home
        </button>
        <button className="btn-primary" onClick={onRestart}>
          <RotateCcw size={18} /> Retake Interview
        </button>
      </div>
    </div>
  );
}
