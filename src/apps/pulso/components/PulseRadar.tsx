'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * @file PulseRadar.tsx
 * @description Safe central radial visualization for the PULSO dashboard.
 */

interface RadarBlip {
  id: string;
  angle: number;
  distance: number;
  color: string;
  label: string;
  size?: number;
}

export const PulseRadar = ({ blips = [] }: { blips?: RadarBlip[] }) => {
  const safeBlips = Array.isArray(blips) ? blips.filter(Boolean) : [];

  return (
    <div className="relative w-full aspect-square max-w-[400px] mx-auto flex items-center justify-center overflow-visible">
      {/* Background Rings */}
      {[1, 2, 3, 4].map((ring) => (
        <motion.div
          key={ring}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: ring * 0.1, duration: 1 }}
          className="absolute border border-white/10 rounded-full"
          style={{
            width: `${ring * 25}%`,
            height: `${ring * 25}%`,
          }}
        />
      ))}

      {/* Axis Lines */}
      <div className="absolute w-[100%] h-[1px] bg-white/5 top-1/2 left-0 -translate-y-1/2" />
      <div className="absolute h-[100%] w-[1px] bg-white/5 left-1/2 top-0 -translate-x-1/2" />

      {/* Pulsing Core */}
      <div className="absolute w-3 h-3 bg-red-600 rounded-full z-10 shadow-[0_0_20px_rgba(220,38,38,0.8)] border border-white/20" />
      <motion.div 
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute w-24 h-24 bg-red-500/10 rounded-full blur-xl" 
      />

      {/* Radar Scan Line */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
        className="absolute inset-0 z-0 origin-center opacity-20"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.1) 60deg, transparent 90deg)',
        }}
      />

      {/* Blips */}
      {safeBlips.map((blip, idx) => {
        const id = blip.id || `blip-${idx}`;
        const distance = typeof blip.distance === 'number' ? blip.distance : 0;
        const angle = typeof blip.angle === 'number' ? blip.angle : 0;
        const color = blip.color || 'bg-blue-400';
        const label = blip.label || '';

        const x = 50 + (distance / 2) * Math.cos((angle * Math.PI) / 180);
        const y = 50 + (distance / 2) * Math.sin((angle * Math.PI) / 180);

        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute z-20 group"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div 
              className={`w-2 h-2 rounded-full ${color} shadow-lg`} 
              style={{ boxShadow: `0 0 10px ${color.replace('bg-', '')}` }}
            />
            
            {/* Tooltip-like Label */}
            {label && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="bg-black/80 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                  {label}
                </span>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Legend */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-white/2 border border-white/5 px-6 py-2 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Alerta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Projeto</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Área</span>
        </div>
      </div>

      {/* Coordinate Labels */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/10 uppercase tracking-widest">Estratégico</div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/10 uppercase tracking-widest">Operacional</div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-black text-white/10 uppercase tracking-widest">Interno</div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-[8px] font-black text-white/10 uppercase tracking-widest">Externo</div>
    </div>
  );
};
