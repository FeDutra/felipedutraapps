'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CloudRain, Sprout, Scissors, Droplets, ArrowRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { motion } from 'framer-motion';

const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const days = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1,
  events: i === 5 ? ['chuva'] : i === 12 ? ['plantio'] : i === 18 ? ['poda', 'chuva'] : i === 24 ? ['irrigacao'] : []
}));

export default function CalendarioPage() {
  return (
    <div className="w-full pb-10 text-white">
      <header className="flex flex-col md:flex-row items-center md:justify-between gap-6 mb-12 text-center md:text-left">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 bg-indigo-500/20 px-4 py-1.5 rounded-full border border-indigo-400/20 mb-4"
          >
            <CalendarIcon size={14} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Ciclo Solar</span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black font-outfit tracking-tight">Calendário</h1>
          <p className="text-white/70 font-bold text-sm uppercase tracking-widest mt-2">Maio 2024</p>
        </div>
        <div className="flex gap-4">
           <button className="p-4 glass rounded-[1.5rem] active:scale-90 transition-all border-white/10 hover:bg-white/10"><ChevronLeft size={24} strokeWidth={3} /></button>
           <button className="p-4 glass rounded-[1.5rem] active:scale-90 transition-all border-white/10 hover:bg-white/10"><ChevronRight size={24} strokeWidth={3} /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-start">
        <GlassCard className="p-6 md:p-8 border-white/20 shadow-2xl lg:col-span-2">
          <div className="grid grid-cols-7 gap-2 md:gap-4 mb-6">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] md:text-xs font-black text-white/50 py-3 uppercase tracking-widest">{d}</div>
            ))}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square"></div>
            ))}
            {days.map(d => (
              <div key={d.day} className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-2xl md:rounded-[1.5rem] transition-all relative group",
                d.day === 6 ? "bg-white text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.4)] scale-110 z-10" : "hover:bg-white/10"
              )}>
                <span className={cn("text-sm md:text-lg font-black", d.day === 6 ? "text-slate-950" : "text-white")}>{d.day}</span>
                <div className="flex gap-1 mt-1">
                  {d.events.includes('chuva') && <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                  {d.events.includes('plantio') && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>}
                  {d.events.includes('poda') && <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-8">
           <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em]">Atividades de Hoje</h2>
            <button className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">Ver Todos</button>
           </div>
           
           <div className="space-y-4">
             <GlassCard className="flex items-center gap-5 p-5 border-white/10 hover:border-white/30 transition-all cursor-pointer group shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-300 border border-blue-400/10">
                   <CloudRain size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                   <div className="font-black text-white tracking-tight">Chuva Registrada</div>
                   <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide mt-0.5">12mm às 15:30 • Sítio</div>
                </div>
                <div className="text-white/20 group-hover:text-white/40 transition-colors">
                   <ChevronRight size={20} strokeWidth={3} />
                </div>
             </GlassCard>

             <GlassCard className="flex items-center gap-5 p-5 border-white/10 hover:border-white/30 transition-all cursor-pointer group shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 border border-emerald-400/10">
                   <Droplets size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                   <div className="font-black text-white tracking-tight">Irrigação Horta</div>
                   <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide mt-0.5">Canteiros 01-03 às 08:00</div>
                </div>
                <div className="text-white/20 group-hover:text-white/40 transition-colors">
                   <ChevronRight size={20} strokeWidth={3} />
                </div>
             </GlassCard>
           </div>
        </div>
      </div>
    </div>
  );
}
