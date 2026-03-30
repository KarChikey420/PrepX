import React, { useState, useEffect } from 'react';
import { ensureBackendReady, isRecoverableNetworkError } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { interviewService } from '../services/interviewService';
import { useInterviewStore } from '../store/useInterviewStore';

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_RESUME_EXTENSIONS = new Set(['pdf', 'docx']);

const getResumeExtension = (filename: string) =>
  filename.split('.').pop()?.toLowerCase() ?? '';

const validateResumeFile = async (file: File): Promise<string | null> => {
  const extension = getResumeExtension(file.name);

  if (!SUPPORTED_RESUME_EXTENSIONS.has(extension)) {
    return 'Please upload your resume as a PDF or DOCX file.';
  }

  if (file.size === 0) {
    return 'The selected file appears to be empty or inaccessible from cloud storage. Please download it to your device first.';
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return 'Please upload a resume smaller than 5MB. Mobile browsers often drop larger uploads before they finish.';
  }

  try {
    const chunk = await file.slice(0, Math.min(file.size, 64)).arrayBuffer();
    if (chunk.byteLength === 0) {
      return 'This file could not be read from your device storage. Please re-save it locally and try again.';
    }
  } catch {
    return 'This file could not be read from your device storage. Please re-save it locally and try again.';
  }

  return null;
};

export const Upload: React.FC = () => {
  const [resume, setResume] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparingBackend, setIsPreparingBackend] = useState(true);
  const [isRetryingBackend, setIsRetryingBackend] = useState(false);
  const [backendWakeError, setBackendWakeError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [uploadOverlayTitle, setUploadOverlayTitle] = useState('Analyzing Profile');
  const [uploadOverlayMessage, setUploadOverlayMessage] = useState('Extracting skills from DNA... please wait.');
  const navigate = useNavigate();
  const setSession = useInterviewStore((state: any) => state.setSession);

  // Pre-wake Render backend on component mount
  useEffect(() => {
    let isMounted = true;

    void ensureBackendReady()
      .then(() => {
        if (isMounted) {
          setIsPreparingBackend(false);
          setBackendWakeError(null);
        }
      })
      .catch((error) => {
        console.debug('Backend warm-up did not finish before user interaction:', error);
        if (isMounted) {
          setIsPreparingBackend(false);
          setBackendWakeError('The interview service is still waking up. Start will retry once it is reachable.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedResume = e.target.files?.[0] ?? null;

    if (!selectedResume) {
      setResume(null);
      return;
    }

    const validationError = await validateResumeFile(selectedResume);
    if (validationError) {
      setResume(null);
      setSubmissionError(validationError);
      e.target.value = '';
      return;
    }

    setResume(selectedResume);
    setSubmissionError(null);
  };

  const handleWakeBackendAgain = async () => {
    setIsRetryingBackend(true);
    setIsPreparingBackend(true);
    setBackendWakeError(null);
    setSubmissionError(null);

    try {
      await ensureBackendReady(true);
    } catch (error) {
      console.debug('Manual backend wake-up failed:', error);
      setBackendWakeError('The interview service is still not reachable. Keep this page open for 10 to 15 seconds, then tap Start AI Interview again.');
    } finally {
      setIsPreparingBackend(false);
      setIsRetryingBackend(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume || !jd.trim()) return;

    const validationError = await validateResumeFile(resume);
    if (validationError) {
      setSubmissionError(validationError);
      return;
    }

    setIsUploading(true);
    setBackendWakeError(null);
    setSubmissionError(null);
    setUploadOverlayTitle('Uploading Resume');
    setUploadOverlayMessage('Sending your resume and job description. (This may take up to a minute if the mobile network is slow)');

    try {
      const data = await interviewService.upload(resume, jd);

      setUploadOverlayTitle('Analyzing Profile');
      setUploadOverlayMessage('Upload complete. We are parsing your resume and generating your interview profile in the background.');

      const readyStatus = data.profile
        ? {
            session_id: data.session_id,
            profile: data.profile,
          }
        : await interviewService.waitForUploadReady(data.session_id);

      if (!readyStatus.profile) {
        throw new Error('Your upload finished, but the profile was not ready yet. Please try again.');
      }

      setUploadOverlayTitle('Profile Ready');
      setUploadOverlayMessage('Opening your personalized interview profile...');
      setSession(readyStatus.session_id, readyStatus.profile);
      navigate('/profile');
    } catch (error: any) {
      console.error('Upload failed:', error);
      const detail = error.response?.data?.detail;
      let errorMessage = 'Failed to analyze profile. Please try again.';
      
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI validation errors return an array of objects
        errorMessage = detail.map((d: any) => d.msg || d).join('\n');
      } else if (isRecoverableNetworkError(error)) {
        errorMessage = 'Network Error: The AI service might still be waking up or your mobile connection may have dropped. We are attempting to wake it again now. Please try again soon.';
        // Automatically trigger backend wake so the next try is more likely to succeed
        void handleWakeBackendAgain();
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSubmissionError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadOverlayTitle('Analyzing Profile');
      setUploadOverlayMessage('Extracting skills from DNA... please wait.');
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
              onChange={(e) => {
                setJd(e.target.value);
                setSubmissionError(null);
              }}
              required
            />
          </GlassCard>
        </div>

        <div className="flex justify-center pt-8">
          <NeonButton
            size="lg" 
            isLoading={isUploading} 
            disabled={!resume || !jd.trim() || (isPreparingBackend && !backendWakeError)}
            className="w-full max-w-sm"
          >
            {isUploading
              ? 'Analyzing...'
              : isPreparingBackend && !backendWakeError
                ? 'Preparing Interview...'
                : 'START AI INTERVIEW'}
          </NeonButton>
        </div>

        {isPreparingBackend && !backendWakeError && (
          <p className="text-center text-sm text-cyan-200/80">
            Waking up the interview service so mobile uploads don&apos;t hit a cold server.
          </p>
        )}

        {backendWakeError && (
          <p className="text-center text-sm text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3 max-w-2xl mx-auto">
            {backendWakeError}
          </p>
        )}

        {submissionError && (
          <div className="max-w-2xl mx-auto rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-5 text-rose-100">
            <p className="text-center text-sm md:text-base font-medium">
              {submissionError}
            </p>
            <div className="mt-4 space-y-2 text-sm text-rose-100/90">
              <p>What to do:</p>
              <p>1. Keep this page open for 10 to 15 seconds so the Render backend can wake up fully.</p>
              <p>2. Tap `Wake Service Again`, then tap `Start AI Interview` once more.</p>
              <p>3. If mobile data is unstable, switch to Wi-Fi and try the same resume again.</p>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <NeonButton
                type="button"
                onClick={() => void handleWakeBackendAgain()}
                size="md"
                isLoading={isRetryingBackend}
                className="w-full sm:w-auto"
              >
                {isRetryingBackend ? 'Waking Service...' : 'Wake Service Again'}
              </NeonButton>
              <NeonButton
                type="submit"
                size="md"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Try Upload Again
              </NeonButton>
            </div>
          </div>
        )}
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
            <h2 className="text-2xl font-bold text-glow mb-2">{uploadOverlayTitle}</h2>
            <p className="text-gray-400 max-w-md text-center px-6">{uploadOverlayMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
