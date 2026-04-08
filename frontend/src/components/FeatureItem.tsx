import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface FeatureItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FeatureItem: React.FC<FeatureItemProps> = ({ icon: Icon, title, description }) => {
  return (
    <motion.div 
      whileHover={{ x: 8, scale: 1.02 }}
      className="flex items-start gap-5 p-4 rounded-2xl transition-colors duration-500 hover:bg-white/[0.03] group cursor-default"
    >
      <div className="mt-1 p-3 bg-slate-900/80 rounded-xl border border-white/5 group-hover:border-neon-cyan/30 transition-all duration-500 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className="w-5 h-5 text-neon-cyan/80 group-hover:text-neon-cyan transition-colors" />
        </motion.div>
      </div>
      <div className="flex flex-col">
        <h3 className="text-white font-medium text-lg leading-tight mb-1 group-hover:text-neon-cyan/90 transition-colors">
          {title}
        </h3>
        <p className="text-slate-500 group-hover:text-slate-400 transition-colors text-sm leading-relaxed font-light">
          {description}
        </p>
      </div>
    </motion.div>
  );
};
