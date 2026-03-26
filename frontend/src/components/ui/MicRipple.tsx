import React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

interface MicRippleProps {
  isRecording: boolean;
  onClick: () => void;
}

export const MicRipple: React.FC<MicRippleProps> = ({ isRecording, onClick }) => {
  return (
    <div className="relative flex items-center justify-center">
      {isRecording && (
        <>
          <motion.div
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            className="absolute w-32 h-32 rounded-full bg-neon-cyan/20 blur-xl"
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            className="absolute w-32 h-32 rounded-full bg-neon-cyan/10 blur-2xl"
          />
        </>
      )}
      
      <button
        onClick={onClick}
        className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
          isRecording 
            ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110' 
            : 'bg-neon-cyan shadow-neon-glow hover:scale-105 active:scale-95'
        }`}
      >
        <Mic className={`w-10 h-10 ${isRecording ? 'text-white' : 'text-slate-950'}`} />
      </button>
    </div>
  );
};
