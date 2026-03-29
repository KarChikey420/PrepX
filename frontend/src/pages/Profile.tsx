import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Briefcase, Zap, Target, BookOpen, ChevronRight } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { useInterviewStore } from '../store/useInterviewStore';

export const Profile: React.FC = () => {
  const { profile, advanceFlowStage } = useInterviewStore();
  const navigate = useNavigate();

  if (!profile) {
    navigate('/upload');
    return null;
  }

  React.useEffect(() => {
    advanceFlowStage('interview');
  }, [advanceFlowStage]);

  const handleStart = () => {
    advanceFlowStage('interview');
    navigate('/interview');
  };

  return (
    <div className="max-w-6xl mx-auto py-4 md:py-6 px-4 md:px-0">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <span className="text-neon-cyan font-bold tracking-widest text-xs uppercase mb-2 block">CANDIDATE ANALYTICS</span>
        <h2 className="text-3xl md:text-4xl font-black text-glow">Profile Insights</h2>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info & DNA animation */}
        <div className="lg:col-span-1 space-y-8">
          <GlassCard className="p-4 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
            
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-neon-cyan/30 flex items-center justify-center mb-4 shadow-neon-glow overflow-hidden">
                <User className="w-12 h-12 text-neon-cyan" />
              </div>
              <h3 className="text-2xl font-bold mb-1">{profile.candidate_name}</h3>
              <p className="text-neon-cyan font-medium text-sm mb-6">{profile.job_title_applying_for}</p>
              
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase block mb-1 tracking-tighter">Experience</span>
                  <span className="text-lg font-bold">{profile.years_of_experience}y+</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase block mb-1 tracking-tighter">Level</span>
                  <span className="text-lg font-bold capitalize">{profile.experience_level}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* DNA-like Visualization Card */}
          <GlassCard className="p-4 md:p-8 h-48 md:h-64 flex flex-col items-center justify-center overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.2, 0.5, 0.2],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                  className="w-1 h-32 bg-neon-cyan/20 mx-1 rounded-full relative"
                >
                   <motion.div 
                     animate={{ top: ['0%', '100%', '0%'] }}
                     transition={{ duration: 3, repeat: Infinity, delay: i * 0.1 }}
                     className="absolute left-0 w-full h-2 bg-neon-cyan rounded-full shadow-neon-glow" 
                   />
                </motion.div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-transparent to-[#0a192f]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-xs font-bold text-neon-cyan opacity-80 tracking-widest uppercase mb-1">DNA Matched</p>
                <p className="text-3xl font-black text-white/90">85%</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Detailed insights */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <GlassCard className="p-6">
              <h4 className="text-sm font-bold text-neon-cyan uppercase tracking-widest flex items-center gap-2 mb-4">
                <Zap size={16} /> Technical Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {profile.technical_skills.map((skill: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full text-xs font-bold text-neon-cyan">
                    {skill}
                  </span>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Briefcase size={16} /> Key JD Matches
              </h4>
              <div className="flex flex-wrap gap-2">
                {profile.matched_skills.map((skill: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-blue-400/10 border border-blue-400/20 rounded-full text-xs font-bold text-blue-400">
                    {skill}
                  </span>
                ))}
              </div>
            </GlassCard>
            
            <GlassCard className="p-6">
              <h4 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Target size={16} /> Skill Gaps Identified
              </h4>
              <div className="flex flex-wrap gap-2">
                {profile.skill_gaps.map((gap: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-red-400/10 border border-red-400/20 rounded-full text-xs font-bold text-red-400">
                    {gap}
                  </span>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h4 className="text-sm font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <BookOpen size={16} /> Focus Areas
              </h4>
              <div className="flex flex-wrap gap-2">
                {profile.interview_focus_areas.map((area: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs font-bold text-yellow-500">
                    {area}
                  </span>
                ))}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-4 md:p-8 border-neon-cyan/20 bg-gradient-to-br from-neon-cyan/5 to-transparent relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h3 className="text-xl md:text-2xl font-black mb-2 flex items-center justify-center md:justify-start gap-3 italic">
                   <ChevronRight className="text-neon-cyan" /> Ready for Assessment?
                </h3>
                <p className="text-gray-400 text-xs md:text-sm max-w-lg mx-auto md:mx-0">
                   The AI is prepped with 10 questions tailored to your {profile.experience_level} level profile. 
                   Focusing on {profile.interview_focus_areas[0]} & your matching skill set.
                </p>
              </div>
              <NeonButton 
                onClick={handleStart} 
                size="lg"
                className="w-full md:w-auto px-12"
              >
                PROCEED TO INTERVIEW
              </NeonButton>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
