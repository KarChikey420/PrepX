import React, { useEffect, useEffectEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Loader2, Volume2, Zap } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { MicRipple } from '../components/ui/MicRipple';
import { NeonButton } from '../components/ui/NeonButton';
import { isRecoverableNetworkError } from '../services/api';
import { interviewService } from '../services/interviewService';
import { useInterviewStore } from '../store/useInterviewStore';
import { useRecorder } from '../hooks/useRecorder';

export const Interview: React.FC = () => {
  const { sessionId, currentTurn, setTurn, setStatus, setReport, playAudio } = useInterviewStore();
  const { isRecording, audioBlob, startRecording, stopRecording, setAudioBlob } = useRecorder();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFinish = useEffectEvent(async () => {
    if (!sessionId) return;
    setIsProcessing(true);
    setStatus('finishing');
    
    try {
      const report = await interviewService.finish(sessionId);
      setReport(report);
      navigate('/report');
    } catch (err) {
      console.error('Failed to finish interview:', err);
      navigate('/report'); // Fallback to report page anyway
    } finally {
      setIsProcessing(false);
    }
  });

  const handleSubmitAnswer = useEffectEvent(async (blob: Blob) => {
    if (!sessionId) return;
    setIsProcessing(true);
    setStatus('interviewing');

    try {
      const data = await interviewService.submitTurn(sessionId, blob);
      setTurn(data);
      setAudioBlob(null);

      if (data.is_complete) {
        void handleFinish();
      } else if (data.audio_url) {
        // Auto-play next question
        setTimeout(() => {
          void playAudio(data.audio_url!);
        }, 1500); // Small delay to let user breathe
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      alert('Error submitting answer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  });

  const startInterview = useEffectEvent(async () => {
    if (!sessionId) return;

    setIsInitializing(true);
    setInitializationError(null);

    try {
      const data = await interviewService.start(sessionId);
      setTurn({
        transcription: '',
        mentor_hint: 'Ready to begin when you are.',
        feedback: null,
        question_text: data.question_text,
        audio_base64: data.audio_base64,
        audio_url: data.audio_url,
        question_number: data.question_number,
        total_questions: data.total_questions,
        focus_area: data.focus_area,
        question_type: data.question_type,
        is_complete: false,
      });
      
      // Auto-play the first question if audio is provided
      if (data.audio_url) {
        void playAudio(data.audio_url);
      }
    } catch (err) {
      console.error('Failed to start interview:', err);
      const detail = (err as any)?.response?.data?.detail;

      if (typeof detail === 'string' && detail.trim()) {
        setInitializationError(detail);
      } else if (isRecoverableNetworkError(err)) {
        setInitializationError('The interview service is still waking up or your connection dropped for a moment. Tap retry to continue.');
      } else {
        setInitializationError('We could not start the interview right now. Please try again.');
      }
    } finally {
      setIsInitializing(false);
    }
  });

  // Initialize Interview
  useEffect(() => {
    if (!sessionId) {
      navigate('/upload');
      return;
    }

    void startInterview();
  }, [sessionId, navigate]);

  // Handle recorded audio submission
  useEffect(() => {
    if (audioBlob && sessionId) {
      void handleSubmitAnswer(audioBlob);
    }
  }, [audioBlob, sessionId]);

  // Local playback removed in favor of store.playAudio (supports binary URLs)

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
           animate={{ rotate: 360 }}
           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
           className="w-16 h-16 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full mb-6 shadow-neon-glow"
        />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Initializing Session...</p>
      </div>
    );
  }

  if (initializationError) {
    return (
      <div className="max-w-2xl mx-auto py-8 md:py-12 px-4 md:px-0">
        <GlassCard className="p-6 md:p-8 text-center border-amber-400/20 bg-amber-500/5">
          <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest block mb-3">
            Interview Not Ready Yet
          </span>
          <h2 className="text-2xl md:text-3xl font-black mb-4 text-white">
            We hit a connection problem while starting your session.
          </h2>
          <p className="text-gray-300 mb-8 leading-relaxed">
            {initializationError}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <NeonButton onClick={() => void startInterview()} size="lg">
              Retry Start
            </NeonButton>
            <NeonButton
              onClick={() => navigate('/profile')}
              size="lg"
              variant="outline"
            >
              Back to Profile
            </NeonButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  const progress = currentTurn 
    ? (currentTurn.question_number / currentTurn.total_questions) * 100 
    : 0;

  return (
    <div className="max-w-5xl mx-auto py-4 md:py-6 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <span className="text-neon-cyan font-bold tracking-widest text-xs uppercase block mb-1">LIVE ASSESSMENT</span>
          <h2 className="text-2xl md:text-3xl font-black text-glow">
            {currentTurn?.focus_area || 'Core Interview'}
          </h2>
        </div>
        
        <div className="flex flex-col items-start md:items-end">
          <div className="text-[10px] text-gray-500 uppercase font-black mb-2 tracking-tighter">
            Progress {currentTurn?.question_number}/{currentTurn?.total_questions}
          </div>
          <div className="w-full md:w-48 h-1.5 md:h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-neon-cyan shadow-neon-glow" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Q&A Area */}
        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          <GlassCard className="p-6 md:p-10 relative overflow-hidden min-h-[250px] md:min-h-[300px] flex flex-col justify-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-neon-cyan/20" />
            <Quote className="absolute top-8 left-8 w-12 h-12 text-neon-cyan/5 -scale-x-100" />
            
            <motion.div
              key={currentTurn?.question_number}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-6">
                 <span className="px-3 py-1 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full text-[10px] font-bold text-neon-cyan uppercase">
                    {currentTurn?.question_type}
                 </span>
                 <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => currentTurn?.audio_url && playAudio(currentTurn.audio_url)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neon-cyan transition-colors"
                 >
                    <Volume2 size={16} />
                 </motion.button>
              </div>
              
              <h3 className="text-xl md:text-3xl font-bold leading-relaxed px-4 md:px-8">
                {currentTurn?.question_text}
              </h3>
            </motion.div>
          </GlassCard>

          {/* Transcription / Feedback area */}
          <AnimatePresence mode="wait">
            {isProcessing ? (
               <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0 }}
                 className="flex items-center justify-center py-6 gap-4"
               >
                 <Loader2 className="w-6 h-6 text-neon-cyan animate-spin" />
                 <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Analyzing Response...</span>
               </motion.div>
            ) : currentTurn?.transcription ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key="transcription-card"
                className="space-y-6"
              >
                <GlassCard className="p-4 md:p-6 bg-blue-500/5 border-blue-500/10">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 block">YOUR TRANSCRIPTION</span>
                  <p className="text-gray-300 italic leading-relaxed text-xs md:text-sm">
                    "{currentTurn.transcription}"
                  </p>
                </GlassCard>
                
                {currentTurn.feedback && (
                  <GlassCard className="p-4 md:p-6 bg-green-500/5 border-green-500/10">
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-3 block">CONSTRUCTIVE FEEDBACK</span>
                    <p className="text-gray-300 text-xs md:text-sm">
                      {currentTurn.feedback}
                    </p>
                  </GlassCard>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Sidebar Controls: Record Button / Mentor Hint */}
        <div className="lg:col-span-4 space-y-8">
           <GlassCard className="p-8 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8 block text-center">
                 {isRecording ? 'RECORDING IN PROGRESS' : 'TAP TO ANSWER'}
              </span>
              
              <MicRipple 
                isRecording={isRecording} 
                onClick={isRecording ? stopRecording : startRecording} 
              />
              
              <div className="mt-8 text-center">
                 <p className="text-xs text-gray-500 font-medium">
                    {isRecording ? 'Speak clearly into the microphone' : 'Ready for your response'}
                 </p>
                 {isRecording && (
                   <motion.div 
                     animate={{ opacity: [1, 0.4, 1] }}
                     transition={{ duration: 1, repeat: Infinity }}
                     className="mt-2 text-neon-cyan font-bold text-sm"
                   >
                     00:0{Math.floor(Math.random() * 9)} ...
                   </motion.div>
                 )}
              </div>
           </GlassCard>

           <AnimatePresence>
             {currentTurn?.mentor_hint && (
               <motion.div
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="space-y-4"
               >
                 <GlassCard className="p-4 md:p-6 border-neon-cyan/20 relative overflow-hidden bg-gradient-to-br from-neon-cyan/5 to-transparent">
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-neon-cyan/10 rounded-full blur-xl" />
                    <span className="text-[10px] font-black text-neon-cyan uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Zap size={14} /> AI MENTOR TIP
                    </span>
                    <p className="text-gray-300 text-xs md:text-sm leading-relaxed italic">
                      "{currentTurn.mentor_hint}"
                    </p>
                 </GlassCard>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
