import { useSmartInterview } from '../hooks/useSmartInterview';
import { User, Target, Zap, Clock, ChevronRight, Loader2, CheckCircle } from 'lucide-react';

interface ProfileReviewViewProps {
  onStart: () => void;
}

export function ProfileReviewView({ onStart }: ProfileReviewViewProps) {
  const { profile, isLoading, startInterview, sessionId } = useSmartInterview();

  if (!profile) return (
    <div className="container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <Loader2 className="animate-spin" size={48} color="var(--accent)" />
    </div>
  );

  const levelColorMap = {
    'senior': 'badge-green',
    'mid': 'badge-indigo',
    'junior': 'badge-amber',
    'fresher': 'badge-red',
    'lead': 'badge-green'
  };

  const currentLevelColor = levelColorMap[profile.experience_level as keyof typeof levelColorMap] || 'badge-indigo';

  const handleStartSmart = async () => {
    if (sessionId) {
      await startInterview(sessionId);
      onStart();
    }
  };

  return (
    <div className="container" style={{maxWidth: '900px'}}>
      {/* Top - Candidate Hero Card */}
      <div className="glass-card" style={{padding: '2.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '2rem'}}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <User size={40} color="var(--accent)" />
        </div>
        <div style={{flex: 1}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem'}}>
            <h1 style={{fontSize: '1.8rem', fontWeight: 700}}>{profile.candidate_name}</h1>
            <span className={`badge ${currentLevelColor}`}>{profile.experience_level.toUpperCase()}</span>
          </div>
          <p style={{color: 'var(--text-secondary)', fontSize: '1.1rem'}}>
            {profile.years_of_experience} Years Experience • Candidate for {profile.job_title_applying_for}
          </p>
        </div>
      </div>

      {/* Grid - Skills Analysis */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem'}}>
        <div className="glass-card" style={{padding: '2rem'}}>
          <h3 style={{marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <CheckCircle size={20} color="var(--green)" /> Matched Skills
          </h3>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.75rem'}}>
            {profile.matched_skills.map((skill, i) => (
              <span key={i} className="badge badge-indigo" style={{background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)'}}>
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{padding: '2rem'}}>
          <h3 style={{marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <Zap size={20} color="var(--red)" /> Skill Gaps
          </h3>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.75rem'}}>
            {profile.skill_gaps.map((skill, i) => (
              <span key={i} className="badge badge-red">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Focus Areas */}
      <div className="glass-card" style={{padding: '2rem', marginBottom: '4rem'}}>
        <h3 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
          <Target size={20} color="var(--accent)" /> Interview Focus Areas
        </h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          {profile.interview_focus_areas.map((area, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '1.5rem',
              padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)'
            }}>
              <span style={{
                width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
              }}>{i + 1}</span>
              <span style={{fontSize: '1.05rem'}}>{area}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Footer */}
      <div style={{
        position: 'fixed', bottom: '0', left: '0', right: '0', 
        padding: '2rem', background: 'rgba(8, 8, 15, 0.8)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', zIndex: 100
      }}>
        <button 
          className="btn-primary" 
          style={{width: '100%', maxWidth: '600px', padding: '1.25rem', fontSize: '1.2rem'}}
          onClick={handleStartSmart}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <>Start Smart Interview <ChevronRight size={24} /></>}
        </button>
      </div>
    </div>
  );
}
