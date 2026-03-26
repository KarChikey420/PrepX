import React from 'react';
import { cn } from '../../utils/cn';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, glow = false }) => {
  return (
    <div className={cn(
      "bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden",
      glow && "after:absolute after:inset-0 after:rounded-2xl after:shadow-[inset_0_0_20px_rgba(0,245,255,0.1)]",
      className
    )}>
      {children}
    </div>
  );
};
