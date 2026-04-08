import React from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';

export const Login: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isPreparingLogin, setIsPreparingLogin] = React.useState(false);
  const [isSignInServiceReady, setIsSignInServiceReady] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/upload" replace />;
  }

  React.useEffect(() => {
    let isMounted = true;

    void authService
      .prewarmGoogleLogin()
      .then(() => {
        if (isMounted) {
          setIsSignInServiceReady(true);
          setLoginError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsSignInServiceReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsPreparingLogin(true);
    setLoginError(null);

    try {
      await authService.prewarmGoogleLogin();
      setIsSignInServiceReady(true);
      window.location.href = authService.getGoogleLoginUrl();
    } catch {
      setIsSignInServiceReady(false);
      setLoginError('Google sign-in is taking longer than usual to wake up. Please try again in a moment.');
      setIsPreparingLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a192f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-cyan/10 blur-[150px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[150px] rounded-full -z-10 animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-neon-cyan rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,255,240,0.4)] mb-6"
          >
            <span className="text-slate-950 font-black text-3xl italic">P</span>
          </motion.div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">PrepX</h1>
          <p className="text-gray-300 text-center text-md mb-6 leading-relaxed">
            AI-powered, voice-enabled mock interviews customized to your resume and target job description.
          </p>
          <div className="flex flex-col gap-3 text-sm text-gray-400 text-left w-full mx-auto px-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,255,240,0.8)]" />
              <span>Resume & Job Description Analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,255,240,0.8)]" />
              <span>Real-time Voice Interactions (STT/TTS)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,255,240,0.8)]" />
              <span>Multi-Agent Evaluation & Mentoring</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isPreparingLogin}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white text-slate-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg group disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100"
          >
            {isPreparingLogin ? (
              <div className="w-6 h-6 border-[3px] border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
            )}
            {isPreparingLogin ? 'Opening Google Sign-In...' : 'Sign in with Google'}
          </button>

          {!isSignInServiceReady && !loginError && (
            <p className="text-sm text-cyan-200/80 text-center">
              Waking up secure sign-in so Google opens directly from here.
            </p>
          )}

          {loginError && (
            <p className="text-sm text-amber-200 text-center bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3">
              {loginError}
            </p>
          )}
          
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm uppercase">
              <span className="bg-[#0a192f] px-4 text-gray-500 font-medium">Coming Soon</span>
            </div>
          </div>

          <button
            disabled
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white/5 text-gray-500 rounded-xl font-bold text-lg cursor-not-allowed border border-white/5"
          >
            <LogIn className="w-6 h-6" />
            Enterprise Sign In
          </button>
        </div>

        <footer className="mt-12 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} PrepX. All rights reserved.
        </footer>
      </motion.div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none -z-5" />
    </div>
  );
};
