import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Zap, 
  AlertTriangle, 
  MessageSquare, 
  Download,
  Share2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { CircularScore } from '../components/ui/CircularScore';
import { useInterviewStore } from '../store/useInterviewStore';
import { interviewService } from '../services/interviewService';

export const Report: React.FC = () => {
  const { report, sessionId, setReport, reset } = useInterviewStore();
  const [isLoading, setIsLoading] = useState(!report);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    const fetchReport = async () => {
      if (report) return;
      try {
        const data = await interviewService.finish(sessionId);
        setReport(data);
      } catch (err) {
        console.error('Failed to fetch report:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [sessionId, report, setReport, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
           animate={{ rotate: 360 }}
           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
           className="w-16 h-16 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full mb-6"
        />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Generating Final Report...</p>
      </div>
    );
  }

  if (!report) return null;

  const verdictStyles = {
    'Hire': { color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', icon: CheckCircle2 },
    'Borderline': { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: AlertCircle },
    'Needs Improvement': { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', icon: XCircle },
  };

  const currentVerdict = verdictStyles[report.verdict as keyof typeof verdictStyles] || verdictStyles['Borderline'];
  const VerdictIcon = currentVerdict.icon;

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
        >
          <span className="text-neon-cyan font-bold tracking-widest text-xs uppercase block mb-1">PERFORMANCE ANALYTICS</span>
          <h2 className="text-4xl font-black text-glow">Interview Report</h2>
        </motion.div>
        
        <div className="flex gap-4">
           <NeonButton variant="outline" size="sm" className="px-5">
              <Download size={18} /> Export PDF
           </NeonButton>
           <NeonButton variant="outline" size="sm" className="px-5">
              <Share2 size={18} /> Share Results
           </NeonButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        {/* Main Score & Verdict */}
        <GlassCard className="lg:col-span-8 p-10 flex flex-col md:flex-row items-center gap-12 bg-gradient-to-br from-slate-900/60 to-transparent">
          <CircularScore score={report.overall_score} size={240} />
          
          <div className="flex-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${currentVerdict.bg} ${currentVerdict.border} ${currentVerdict.color}`}
            >
              <VerdictIcon size={20} />
              <span className="text-sm font-black uppercase tracking-widest italic">AI VERDICT: {report.verdict}</span>
            </motion.div>
            
            <div className="space-y-4">
               <h3 className="text-2xl font-bold flex items-center gap-3">
                 <Trophy className="text-neon-cyan" /> Executive Summary
               </h3>
               <p className="text-gray-400 leading-relaxed italic">
                 "{report.overall_summary}"
               </p>
            </div>
          </div>
        </GlassCard>

        {/* Breakdown Summary */}
        <GlassCard className="lg:col-span-4 p-8 flex flex-col justify-center gap-8">
           <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                 <span>Technical</span>
                 <span className="text-neon-cyan">8.5 / 10</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                 <motion.div
                   initial={{ width: 0 }}
                   animate={{ width: '85%' }}
                   className="h-full bg-neon-cyan"
                 />
              </div>
           </div>
           
           <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                 <span>Behavioral</span>
                 <span className="text-blue-400">7.2 / 10</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                 <motion.div
                   initial={{ width: 0 }}
                   animate={{ width: '72%' }}
                   className="h-full bg-blue-400"
                 />
              </div>
           </div>
           
           <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                 <span>Communication</span>
                 <span className="text-yellow-500">9.0 / 10</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                 <motion.div
                   initial={{ width: 0 }}
                   animate={{ width: '90%' }}
                   className="h-full bg-yellow-500"
                 />
              </div>
           </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {/* Strong Areas */}
        <GlassCard className="p-8 border-green-400/10">
           <h4 className="text-green-400 font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <Zap size={16} /> Key Strengths
           </h4>
           <ul className="space-y-4">
              {report.strong_areas.map((area: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                   <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                   <span>{area}</span>
                </li>
              ))}
           </ul>
        </GlassCard>

        {/* Weak Areas */}
        <GlassCard className="p-8 border-red-400/10">
           <h4 className="text-red-400 font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <AlertTriangle size={16} /> Areas For Growth
           </h4>
           <ul className="space-y-4">
              {report.weak_areas.map((area: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                   <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                   <span>{area}</span>
                </li>
              ))}
           </ul>
        </GlassCard>

        {/* Communication */}
        <GlassCard className="p-8 border-blue-400/10">
           <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <MessageSquare size={16} /> Communication
           </h4>
           <p className="text-sm text-gray-300 italic leading-relaxed">
              "{report.communication_assessment}"
           </p>
        </GlassCard>
      </div>

      {/* Recommendations */}
      <GlassCard className="p-8 border-neon-cyan/20 mb-8 overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
         
         <h3 className="text-xl font-black mb-8 flex items-center gap-3">
            <Target className="text-neon-cyan" /> Actionable Recommendations
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {report.recommendations.map((rec: string, i: number) => (
              <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-start gap-4 hover:border-neon-cyan/20 transition-all group-hover:bg-white/[0.07]">
                 <div className="w-8 h-8 rounded-full bg-neon-cyan/10 flex items-center justify-center shrink-0">
                    <span className="text-neon-cyan font-bold text-xs">{i + 1}</span>
                 </div>
                 <p className="text-sm text-gray-400 font-medium">{rec}</p>
              </div>
            ))}
         </div>
      </GlassCard>

      <div className="flex justify-center pt-8">
         <NeonButton onClick={() => { reset(); navigate('/'); }} size="lg">
            BACK TO DASHBOARD
         </NeonButton>
      </div>
    </div>
  );
};
