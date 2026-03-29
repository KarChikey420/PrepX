import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { interviewService } from '../services/interviewService';
import { useInterviewStore } from '../store/useInterviewStore';

export const Upload: React.FC = () => {
  const [resume, setResume] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const setSession = useInterviewStore((state: any) => state.setSession);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResume(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume || !jd) return;

    setIsUploading(true);
    try {
      const data = await interviewService.upload(resume, jd);
      setSession(data.session_id, data.profile);
      navigate('/profile');
    } catch (error: any) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to analyze profile. Please try again.';
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-10 px-4 md:px-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-black mb-4 text-glow">Analyze Profile</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Upload your candidate profile stage, choice your mams.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Resume Upload */}
          <GlassCard className="p-4 md:p-8 group hover:border-neon-cyan/30 transition-colors">
            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-3">
              <FileText className="text-neon-cyan" /> Resume (PDF/DOCX)
            </h3>
            
            <label className="relative flex flex-col items-center justify-center h-48 md:h-64 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-all group-hover:border-neon-cyan/20">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx"
                onChange={handleFileChange}
              />
              
              <AnimatePresence mode="wait">
                {resume ? (
                  <motion.div
                    key="file-ready"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-neon-cyan"
                  >
                    <CheckCircle2 className="w-16 h-16 mb-4 shadow-neon-glow" />
                    <span className="font-bold text-lg max-w-[200px] truncate">
                      {resume.name}
                    </span>
                    <span className="text-sm opacity-60 mt-2">Ready to analyze</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="upload-prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-gray-500"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UploadIcon className="w-8 h-8 group-hover:text-neon-cyan" />
                    </div>
                    <span className="font-medium group-hover:text-gray-300">Click to upload or drag & drop</span>
                    <span className="text-xs mt-2">Maximum file size 5MB</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </label>
          </GlassCard>

          {/* JD Input */}
          <GlassCard className="p-4 md:p-8 group hover:border-neon-cyan/30 transition-colors">
            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-3">
              <FileText className="text-neon-cyan" /> Job Description
            </h3>
            
            <textarea
              className="w-full h-48 md:h-64 bg-slate-900/50 border border-white/10 rounded-xl p-4 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-neon-cyan/30 focus:ring-1 focus:ring-neon-cyan/20 transition-all resize-none font-medium text-sm md:text-base"
              placeholder="Paste the full job description here..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              required
            />
          </GlassCard>
        </div>

        <div className="flex justify-center pt-8">
          <NeonButton 
            size="lg" 
            isLoading={isUploading} 
            disabled={!resume || !jd}
            className="w-full max-w-sm"
          >
            {isUploading ? 'Analyzing...' : 'START AI INTERVIEW'}
          </NeonButton>
        </div>
      </form>
      
      {/* Loading Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a192f]/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative w-32 h-32 mb-8">
               <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-t-2 border-neon-cyan rounded-full"
               />
               <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-4 border-b-2 border-blue-500/50 rounded-full"
               />
               <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-neon-cyan font-black text-2xl italic">P</span>
               </div>
            </div>
            <h2 className="text-2xl font-bold text-glow mb-2">Analyzing Profile</h2>
            <p className="text-gray-400">Extracting skills from DNA... please wait.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
