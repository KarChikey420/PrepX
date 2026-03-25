import { useState } from 'react';
import { useSmartInterview } from '../hooks/useSmartInterview';
import { Send, Check, ChevronRight, HelpCircle, Loader2 } from 'lucide-react';

interface SmartInterviewViewProps {
  onComplete: () => void;
}

export function SmartInterviewView({ onComplete }: SmartInterviewViewProps) {
  const { 
    questions, currentIndex, setCurrentIndex, submitAnswer, 
    feedbacks, isLoading, finishInterview 
  } = useSmartInterview();

  const [answer, setAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentFeedback = feedbacks[currentIndex];

  const handleSubmit = async () => {
    if (!answer.trim() || isLoading) return;
    await submitAnswer(currentQuestion.id, answer);
    setShowFeedback(true);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setShowFeedback(false);
    } else {
      await finishInterview();
      onComplete();
    }
  };

  if (!currentQuestion) return null;

  return (
    <div className="container" style={{maxWidth: '1200px', display: 'flex', gap: '2rem'}}>
      {/* Sidebar - Progress */}
      <div className="glass-card" style={{width: '300px', padding: '1.5rem', alignSelf: 'flex-start', position: 'sticky', top: '2rem'}}>
        <h4 style={{marginBottom: '1.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem'}}>
          Interview Progress
        </h4>
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
          {questions.map((q, i) => (
            <div key={q.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.75rem', borderRadius: '10px',
              background: i === currentIndex ? 'var(--accent-glow)' : 'transparent',
              border: '1px solid',
              borderColor: i === currentIndex ? 'var(--accent)' : 'transparent'
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', 
                background: i < currentIndex ? 'var(--green)' : (i === currentIndex ? 'var(--accent)' : 'var(--bg-base)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700
              }}>
                {i < currentIndex ? <Check size={14} /> : i + 1}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '0.85rem', fontWeight: i === currentIndex ? 600 : 400}}>
                  Question {i + 1}
                </div>
                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{q.type.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div style={{flex: 1}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
          <div className="badge badge-indigo">QUESTION {currentIndex + 1} OF {questions.length}</div>
          <div className={`badge ${currentQuestion.difficulty === 'hard' ? 'badge-red' : (currentQuestion.difficulty === 'medium' ? 'badge-amber' : 'badge-green')}`}>
            {currentQuestion.difficulty.toUpperCase()}
          </div>
        </div>

        <div className="glass-card" style={{padding: '3rem', marginBottom: '2rem'}}>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '2rem'}}>
            <HelpCircle size={32} color="var(--accent)" style={{marginTop: '4px'}} />
            <div>
              <div className="badge badge-indigo" style={{marginBottom: '0.75rem'}}>{currentQuestion.focus_area}</div>
              <h2 style={{fontSize: '1.6rem', lineHeight: 1.4, fontWeight: 500}}>
                {currentQuestion.question}
              </h2>
            </div>
          </div>

          {!showFeedback ? (
            <>
              <textarea 
                className="form-input"
                style={{height: '240px', background: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem', padding: '1.5rem', fontSize: '1.1rem', lineHeight: 1.6}}
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isLoading}
              />
              <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                <button 
                  className="btn-primary" 
                  style={{padding: '1rem 3rem'}}
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isLoading}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <>Submit Answer <Send size={18} /></>}
                </button>
              </div>
            </>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', 
              borderRadius: 'var(--radius)', padding: '2rem', animation: 'slideUp 0.4s ease'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem'}}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  border: '4px solid', borderColor: currentFeedback.score >= 7 ? 'var(--green)' : (currentFeedback.score >= 4 ? 'var(--amber)' : 'var(--red)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800
                }}>
                  {currentFeedback.score}
                </div>
                <div>
                  <h4 style={{fontSize: '1.1rem', marginBottom: '0.25rem'}}>Evaluation Result</h4>
                  <p style={{color: 'var(--text-secondary)'}}>Your response scored {currentFeedback.score}/10</p>
                </div>
              </div>
              
              <div style={{marginBottom: '2rem', lineHeight: 1.7, color: 'var(--text-primary)'}}>
                {currentFeedback.feedback}
              </div>

              {currentFeedback.follow_up_question && (
                <div style={{
                  padding: '1.25rem', background: 'var(--accent-glow)', borderLeft: '4px solid var(--accent)',
                  borderRadius: '8px', marginBottom: '2rem'
                }}>
                  <div style={{fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--accent)'}}>Follow-up Question</div>
                  <div style={{fontSize: '1.05rem', fontStyle: 'italic'}}>{currentFeedback.follow_up_question}</div>
                </div>
              )}

              <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                <button className="btn-primary" onClick={handleNext}>
                  {currentIndex < questions.length - 1 ? <>Next Question <ChevronRight size={18} /></> : "Finish Interview"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
