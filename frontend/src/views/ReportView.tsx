import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { SessionData } from '../types';

interface ReportViewProps {
  session: SessionData;
  onRestart: () => void;
}

export function ReportView({ session, onRestart }: ReportViewProps) {
  const [report, setReport] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const fetchReport = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/interview/${session.session_id}/report`);
        const data = await res.json();
        
        if (data.status === 'ready') {
          setReport(data.report_markdown);
          setIsPolling(false);
        } else {
          // Poll every 3 seconds
          timeoutId = setTimeout(fetchReport, 3000);
        }
      } catch (e) {
        console.error("Report fetch error:", e);
        setIsPolling(false);
      }
    };

    fetchReport();
    return () => clearTimeout(timeoutId);
  }, [session.session_id]);

  return (
    <div className="report-view">
      {isPolling ? (
        <div className="glass-card" style={{textAlign: 'center', padding: '6rem 2rem', maxWidth: '800px', margin: '0 auto'}}>
          <div className="spinner" style={{width: '50px', height: '50px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 2rem'}}></div>
          <h2 style={{color: 'var(--accent)', marginBottom: '1rem'}}>Analyzing Session Data...</h2>
          <p className="subtitle">Our multi-agent system is compiling your comprehensive evaluation report.</p>
        </div>
      ) : (
        <div className="container" style={{maxWidth: '800px', margin: '0 auto'}}>
          <div className="glass-card" style={{padding: '3.5rem', marginBottom: '3rem'}}>
            <div style={{textAlign: 'center', marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '2rem'}}>
              <div style={{color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem'}}>Performance Report</div>
              <h1 style={{fontSize: '2.5rem', fontWeight: 800}}>{session.role}</h1>
              <div style={{color: 'var(--text-secondary)'}}>{session.level.toUpperCase()} LEVEL</div>
            </div>
            
            <div className="markdown-body" style={{fontSize: '1.1rem', lineHeight: 1.8}}>
              {report ? (
                <ReactMarkdown>{report}</ReactMarkdown>
              ) : (
                <p style={{color: 'var(--red)'}}>Error loading report. Check backend logs.</p>
              )}
            </div>
          </div>

          <div style={{textAlign: 'center', marginBottom: '5rem'}}>
            <button className="btn-primary" style={{padding: '1rem 3rem'}} onClick={onRestart}>
              Start New Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
