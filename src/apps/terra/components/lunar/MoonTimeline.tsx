'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { LunarData } from '@/shared/types';
import MoonPhaseRenderer from './MoonPhaseRenderer';

interface MoonTimelineProps {
  data: LunarData[];
  selectedDate: string; // Using string ISO or simplified date for key
  onSelect: (data: LunarData, index: number) => void;
}

const MoonTimeline: React.FC<MoonTimelineProps> = ({ data, selectedDate, onSelect }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8 px-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em]">Ciclo Mensal</span>
          <h4 className="text-xl font-black text-[var(--text-primary)]">Calendário de Plantio</h4>
        </div>
        <div className="text-[10px] font-bold text-[var(--text-muted)] bg-white/5 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">
          Arraste para navegar
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-8 px-4 no-scrollbar snap-x cursor-grab active:cursor-grabbing">
        {data.map((item, index) => {
          const isSelected = index === 15; // In our mock history, today is at index 15
          
          return (
            <motion.button
              key={index}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(item, index)}
              className={cn(
                "flex-shrink-0 w-24 h-36 rounded-[2rem] flex flex-col items-center justify-between p-4 transition-all snap-center relative border",
                isSelected 
                  ? "bg-indigo-600/20 border-indigo-500/50 shadow-[0_20px_40px_rgba(79,70,229,0.2)] z-10 scale-110" 
                  : "glass border-white/10 opacity-60 hover:opacity-100"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-tighter",
                  isSelected ? "text-indigo-300" : "text-[var(--text-muted)]"
                )}>
                  DIA
                </span>
                <span className="text-lg font-black text-[var(--text-primary)] leading-none">
                  {index + 1}
                </span>
              </div>

              {/* Mini Moon Visual */}
              <div className="relative">
                <MoonPhaseRenderer 
                  moonPhase={item.moonPhase} 
                  size={40} 
                  isMini={true}
                  className="shadow-inner rounded-full overflow-hidden"
                />
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-black uppercase text-indigo-400">RISE</span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{item.moonrise}</span>
              </div>

              {isSelected && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute -bottom-1 w-8 h-1 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" 
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default MoonTimeline;
