import React from 'react';
import { motion } from 'framer-motion';

interface CircularScoreProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const CircularScore: React.FC<CircularScoreProps> = ({
  score,
  size = 200,
  strokeWidth = 12,
  label = "INTERVIEW SCORE"
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 10) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Ring */}
      <svg className="absolute w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        {/* Progress Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#neonGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: "easeOut" }}
          strokeLinecap="round"
        />
        
        <defs>
          <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f5ff" />
            <stop offset="100%" stopColor="#20c2ce" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Inner Glow */}
      <div className="absolute inset-4 rounded-full bg-neon-cyan/5 blur-2xl" />
      
      {/* Text Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-bold text-glow"
        >
          {score.toFixed(1)}
        </motion.span>
        <span className="text-[10px] tracking-widest text-gray-400 mt-1 uppercase">
          {label}
        </span>
      </div>
    </div>
  );
};
