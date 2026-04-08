import React from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileCheck, Mic2, Activity } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { FeatureItem } from '../components/FeatureItem';

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <div className="min-h-screen bg-[#020617] flex selection:bg-neon-cyan/30 text-slate-200 font-sans overflow-hidden relative">
      {/* Animated Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay z-10" />
        
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 120, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-neon-cyan/5 blur-[100px] rounded-full"
        />
        <motion.div
          animate={{
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] right-[20%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full"
        />
      </div>

      <main className="relative z-10 flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto min-h-screen">
        
        {/* Left Section: Hero Content */}
        <div className="flex-1 flex flex-col justify-center px-8 lg:px-20 py-20 border-r border-white/5 bg-gradient-to-r from-[#020617] to-transparent">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-16"
          >
            {/* Badge & Branding */}
            <motion.div variants={itemVariants} className="space-y-8">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/10 text-blue-400/80 text-[10px] font-bold tracking-[0.2em] uppercase backdrop-blur-md">
                <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                AI Interview Coach
              </div>
              
              <div className="flex items-center gap-6">
                <motion.div 
                  whileHover={{ rotate: 5, scale: 1.05 }}
                  className="w-16 h-16 bg-slate-950 rounded-2xl border border-white/[0.08] flex items-center justify-center shadow-2xl relative group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/30 to-neon-cyan/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="text-white font-black text-4xl relative z-10 italic tracking-tighter">P.</span>
                  <div className="absolute bottom-4 right-4 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                </motion.div>
                <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40 tracking-tightest">
                  PrepX
                </h1>
              </div>
              
              <p className="text-slate-400 text-xl max-w-lg leading-relaxed font-light tracking-wide">
                The interview coach that reads your resume, listens to your answers, and tells you <span className="text-white/80 font-normal italic">exactly</span> where you lost the job.
              </p>
            </motion.div>

            {/* Feature List */}
            <motion.div variants={itemVariants} className="space-y-1 max-w-md -ml-2">
              <FeatureItem 
                icon={FileCheck} 
                title="Resume & JD matching" 
                description="Questions tailored to your exact profile and experience."
              />
              <FeatureItem 
                icon={Mic2} 
                title="Live voice interview" 
                description="Speak naturally — AI handles STT/TTS in real time."
              />
              <FeatureItem 
                icon={Activity} 
                title="Multi-agent evaluation" 
                description="Scored professionally on clarity, depth, and role fit."
              />
            </motion.div>

            {/* Layered Waveform Visualizations */}
            <motion.div variants={itemVariants} className="pt-12 relative h-16">
              {/* Secondary Echo Waveform */}
              <div className="flex items-end gap-[4px] h-8 opacity-10 absolute bottom-0 left-0 blur-[1px]">
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={`echo-${i}`}
                    animate={{ height: ['10%', '60%', '20%', '50%', '15%'] }}
                    transition={{
                      duration: 2 + Math.random(),
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.08
                    }}
                    className="w-[2px] bg-indigo-400 rounded-full"
                  />
                ))}
              </div>
              
              {/* Primary Waveform */}
              <div className="flex items-end gap-[4px] h-12 opacity-40 relative z-10">
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={`primary-${i}`}
                    animate={{ height: ['20%', '100%', '30%', '80%', '40%'] }}
                    transition={{
                      duration: 1.5 + Math.random(),
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.04
                    }}
                    className="w-[3px] bg-gradient-to-t from-blue-600 via-neon-cyan to-white/40 rounded-full shadow-[0_0_10px_rgba(0,245,255,0.2)]"
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Right Section: Auth Flow with Glassmorphic Card */}
        <div className="flex-1 flex flex-col justify-center items-center px-8 lg:px-20 py-20 relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="w-full max-w-md p-10 lg:p-12 rounded-[2.5rem] bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.05] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group"
          >
            {/* Subtle Animated Border Glow */}
            <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-1000">
               <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-shimmer" />
            </div>

            <div className="space-y-12 relative z-10">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">Start your first interview</h2>
                <p className="text-slate-400 font-light leading-relaxed text-lg">
                  Sign in with Google — <span className="text-white/60">takes 10 seconds.</span><br />
                  No credit card. Cancel whenever.
                </p>
              </div>

              <div className="space-y-8">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isPreparingLogin}
                  className="w-full h-16 bg-white border border-transparent rounded-[1.25rem] flex items-center justify-center gap-4 text-slate-950 font-bold text-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-all duration-500 group/btn disabled:opacity-50 disabled:cursor-wait"
                >
                  {isPreparingLogin ? (
                    <div className="w-5 h-5 border-[3px] border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <div className="relative flex items-center justify-center transition-transform group-hover/btn:scale-110 duration-500">
                      <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                  <span>Continue with Google</span>
                </button>

                <div className="flex items-center gap-4 px-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isSignInServiceReady ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="text-xs text-slate-500 font-semibold tracking-[0.1em] uppercase">
                    {isSignInServiceReady 
                      ? 'Secure sign-in ready'
                      : 'Initialising secure gateway...'}
                  </span>
                </div>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400/90 text-sm leading-relaxed"
                >
                  {loginError}
                </motion.div>
              )}
            </div>
          </motion.div>
          
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 1.2 }}
             className="mt-16 text-[10px] text-slate-600 font-bold tracking-[0.3em] uppercase"
          >
            Built for professional engineering
          </motion.div>
        </div>
      </main>
    </div>
  );
};
