import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, X, Loader2 } from 'lucide-react';
import { useSmartInterview } from '../hooks/useSmartInterview';

interface ResumeSetupViewProps {
  onAnalyzed: (sessionId: string) => void;
}

export function ResumeSetupView({ onAnalyzed }: ResumeSetupViewProps) {
  const { uploadResume, isLoading, error } = useSmartInterview();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState('');
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setResumeFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jdText) return;
    try {
      const data = await uploadResume(resumeFile, jdText);
      onAnalyzed(data.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container" style={{maxWidth: '1000px'}}>
      <div style={{textAlign: 'center', marginBottom: '3rem'}}>
        <h1 className="title" style={{fontSize: '3rem'}}>Smart Setup</h1>
        <p className="subtitle">Upload your background to generate a custom interview experience</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem'}}>
        {/* Left - Resume Upload */}
        <div className="glass-card" style={{padding: '2rem'}}>
          <h3 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <FileText size={20} color="var(--accent)" /> Resume Upload
          </h3>
          
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius)',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: resumeFile ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
              borderColor: resumeFile ? 'var(--green)' : 'var(--border)'
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf,.docx" 
              style={{display: 'none'}} 
            />
            {resumeFile ? (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
                <CheckCircle size={48} color="var(--green)" />
                <div>
                  <div style={{fontWeight: 600}}>{resumeFile.name}</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                    {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Ready
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                  className="btn-icon"
                  style={{width: '32px', height: '32px'}}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
                <Upload size={48} color="var(--text-muted)" />
                <div>
                  <div style={{fontWeight: 600}}>Drop your resume here</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>PDF or DOCX, max 5MB</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right - Job Description */}
        <div className="glass-card" style={{padding: '2rem'}}>
          <h3 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <Briefcase size={20} color="var(--accent)" /> Job Description
          </h3>

          <div style={{display: 'flex', gap: '1rem', marginBottom: '1.25rem'}}>
            <button 
              onClick={() => setActiveTab('paste')}
              style={{
                background: activeTab === 'paste' ? 'var(--accent-glow)' : 'transparent',
                border: 'none', color: activeTab === 'paste' ? 'var(--accent)' : 'var(--text-secondary)',
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
              }}
            >
              Paste Text
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              style={{
                background: activeTab === 'upload' ? 'var(--accent-glow)' : 'transparent',
                border: 'none', color: activeTab === 'upload' ? 'var(--accent)' : 'var(--text-secondary)',
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
              }}
            >
              Upload JD
            </button>
          </div>

          {activeTab === 'paste' ? (
            <div style={{position: 'relative'}}>
              <textarea 
                className="form-input"
                style={{height: '200px', resize: 'none', padding: '1rem', fontSize: '0.9rem'}}
                placeholder="Paste the target job description here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <div style={{position: 'absolute', bottom: '10px', right: '10px', fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                {jdText.length} characters
              </div>
            </div>
          ) : (
            <div style={{height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)'}}>
              JD File Upload coming soon
            </div>
          )}
        </div>
      </div>

      <div style={{marginTop: '3rem', textAlign: 'center'}}>
        {error && <div style={{color: 'var(--red)', marginBottom: '1.5rem'}}>{error}</div>}
        
        <button 
          className="btn-primary" 
          style={{padding: '1rem 4rem', fontSize: '1.1rem'}}
          disabled={!resumeFile || !jdText || isLoading}
          onClick={handleAnalyze}
        >
          {isLoading ? (
            <span style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
              <Loader2 className="animate-spin" /> Analyzing Profile...
            </span>
          ) : (
            "Analyze My Profile →"
          )}
        </button>
      </div>
    </div>
  );
}

// Minimal Briefcase icon if lucide doesn't have it exactly
function Briefcase({ size, color, style }: any) {
  return (
    <svg 
      width={size} height={size} viewBox="0 0 24 24" fill="none" 
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      style={style}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  );
}
