import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Loader2, Volume2, Zap } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { MicRipple } from '../components/ui/MicRipple';
import { interviewService } from '../services/interviewService';
import { useInterviewStore } from '../store/useInterviewStore';
import { useRecorder } from '../hooks/useRecorder';

export const Interview: React.FC = () => {
  const { sessionId, currentTurn, setTurn, setStatus, setReport } = useInterviewStore();
  const { isRecording, audioBlob, startRecording, stopRecording, setAudioBlob } = useRecorder();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Interview
  useEffect(() => {
    if (!sessionId) {
      navigate('/upload');
      return;
    }

    const startInterview = async () => {
      try {
        const data = await interviewService.start(sessionId);
        setTurn({
          transcription: '',
          mentor_hint: 'Ready to begin when you are.',
          feedback: null,
          question_text: data.question_text,
          audio_base64: data.audio_base64,
          question_number: data.question_number,
          total_questions: data.total_questions,
          focus_area: data.focus_area,
          question_type: data.question_type,
          is_complete: false
        });
        
        // Auto-play the first question if audio is provided
        if (data.audio_base64) {
          playAudio(data.audio_base64);
        }
      } catch (err) {
        console.error('Failed to start interview:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    startInterview();
  }, [sessionId, navigate, setTurn]);

  // Handle recorded audio submission
  useEffect(() => {
    if (audioBlob && sessionId) {
      handleSubmitAnswer(audioBlob);
    }
  }, [audioBlob]);

  const playAudio = (base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audioRef.current = audio;
    audio.play();
  };

  const handleSubmitAnswer = async (blob: Blob) => {
    if (!sessionId) return;
    setIsProcessing(true);
    setStatus('interviewing');

    try {
      const data = await interviewService.submitTurn(sessionId, blob);
      setTurn(data);
      setAudioBlob(null);

      if (data.is_complete) {
        handleFinish();
      } else if (data.audio_base64) {
        // Auto-play next question
        setTimeout(() => {
          playAudio(data.audio_base64!);
        }, 1500); // Small delay to let user breathe
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      alert('Error submitting answer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = async () => {
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
  };

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

  const progress = currentTurn 
    ? (currentTurn.question_number / currentTurn.total_questions) * 100 
    : 0;

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="flex items-center justify-between mb-10">
        <div>
          <span className="text-neon-cyan font-bold tracking-widest text-xs uppercase block mb-1">LIVE ASSESSMENT</span>
          <h2 className="text-3xl font-black text-glow">
            {currentTurn?.focus_area || 'Core Interview'}
          </h2>
        </div>
        
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase font-black mb-2 tracking-tighter">
            Progress {currentTurn?.question_number}/{currentTurn?.total_questions}
          </div>
          <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
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
        <div className="lg:col-span-8 space-y-8">
          <GlassCard className="p-10 relative overflow-hidden min-h-[300px] flex flex-col justify-center">
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
                    onClick={() => currentTurn?.audio_base64 && playAudio(currentTurn.audio_base64)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neon-cyan transition-colors"
                 >
                    <Volume2 size={16} />
                 </motion.button>
              </div>
              
              <h3 className="text-2xl md:text-3xl font-bold leading-relaxed px-4">
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
                <GlassCard className="p-6 bg-blue-500/5 border-blue-500/10">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 block">YOUR TRANSCRIPTION</span>
                  <p className="text-gray-300 italic leading-relaxed text-sm">
                    "{currentTurn.transcription}"
                  </p>
                </GlassCard>
                
                {currentTurn.feedback && (
                  <GlassCard className="p-6 bg-green-500/5 border-green-500/10">
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-3 block">CONSTRUCTIVE FEEDBACK</span>
                    <p className="text-gray-300 text-sm">
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
                 <GlassCard className="p-6 border-neon-cyan/20 relative overflow-hidden bg-gradient-to-br from-neon-cyan/5 to-transparent">
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-neon-cyan/10 rounded-full blur-xl" />
                    <span className="text-[10px] font-black text-neon-cyan uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Zap size={14} /> AI MENTOR TIP
                    </span>
                    <p className="text-gray-300 text-sm leading-relaxed italic">
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
