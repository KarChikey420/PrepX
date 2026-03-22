import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { SessionData } from '../types';
import { RefreshCw } from 'lucide-react';

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
    <div className="report-view glass-panel">
      {isPolling ? (
        <div style={{textAlign: 'center', padding: '4rem 0'}}>
          <div className="spinner"></div>
          <h2 style={{color: 'var(--accent-cyan)'}}>Analyzing Session Data...</h2>
          <p className="subtitle">The multi-agent system is compiling your comprehensive evaluation report.</p>
        </div>
      ) : (
        <>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '1rem', marginBottom: '2rem'}}>
            <h1 className="title" style={{margin: 0}}>Interview Report</h1>
            <button className="btn btn-primary" onClick={onRestart}>
              <RefreshCw size={18} /> New Session
            </button>
          </div>
          
          <div className="markdown-body">
            {report ? (
              <ReactMarkdown>{report}</ReactMarkdown>
            ) : (
              <p style={{color: 'var(--accent-rose)'}}>Error loading report. Check backend logs.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
