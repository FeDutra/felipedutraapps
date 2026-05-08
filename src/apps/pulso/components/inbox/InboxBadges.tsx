'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const ConfidenceBadge = ({ confidence }: { confidence: 'high' | 'medium' | 'low' }) => {
  const colors = {
    high: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    low: 'text-red-400 bg-red-400/10 border-red-400/20'
  };

  const label = {
    high: 'Alta Confiança',
    medium: 'Média Confiança',
    low: 'Baixa Confiança'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${colors[confidence]}`}>
      {label[confidence]}
    </span>
  );
};

export const LateralityBadge = ({ state }: { state?: string }) => {
  if (!state) return null;
  
  return (
    <motion.div 
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ repeat: Infinity, duration: 3 }}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-purple-500/30 bg-purple-500/10 text-purple-400"
    >
      <div className="w-1 h-1 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
      Lateralidade: {state}
    </motion.div>
  );
};

export const InboxTypeBadge = ({ type }: { type: string }) => {
  return (
    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-white/40">
      {type.replace('_', ' ')}
    </span>
  );
};
