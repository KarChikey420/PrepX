import React from 'react';
import { cn } from '../../utils/cn';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  ...props
}) => {
  const variants = {
    primary: "bg-neon-cyan text-slate-950 shadow-neon-glow hover:bg-white hover:text-slate-950",
    secondary: "bg-slate-800 text-neon-cyan border border-neon-cyan/50 hover:bg-slate-700",
    outline: "bg-transparent border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-8 py-3 text-base",
    lg: "px-10 py-4 text-lg",
  };

  return (
    <button
      className={cn(
        "relative rounded-full font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};
