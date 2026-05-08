'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { Plus, ChevronRight, Sun, Droplets, Clock, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { mockAreas } from '@/shared/mocks/data';
import { motion } from 'framer-motion';

export default function AreasPage() {
  return (
    <div className="w-full pb-10">
      <header className="flex flex-col md:flex-row items-center md:justify-between gap-6 mb-12">
        <div className="text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 px-4 py-1.5 rounded-full border border-emerald-500/20 mb-4"
          >
            <MapIcon size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-100">Zoneamento Ativo</span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black font-outfit tracking-tight text-[var(--text-primary)]">Áreas</h1>
          <p className="text-[var(--text-secondary)] font-medium text-base mt-2">Os espaços vitais da sua terra.</p>
        </div>
        <button className="p-5 glass rounded-[2rem] text-[var(--text-primary)] border-[var(--glass-border)] active:scale-90 transition-all flex items-center gap-3 shadow-xl">
          <Plus size={24} strokeWidth={3} />
          <span className="md:hidden font-bold uppercase text-xs tracking-widest">Nova Área</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {mockAreas.map((area, idx) => (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.6 }}
          >
            <GlassCard className="p-0 overflow-hidden border-white/20 hover:border-white/40 transition-all shadow-3xl group">
               <div className="h-56 w-full relative">
                 <img 
                   src={area.image || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800'} 
                   alt={area.name} 
                   className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                 />
                 {/* Premium overlay with subtle color hint */}
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/10 to-transparent"></div>
                 <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                 
                 <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                    <div>
                       <div className="flex items-center gap-2 mb-2">
                         <span className="px-3 py-1 bg-emerald-600/80 backdrop-blur-md text-[10px] font-black uppercase rounded-full text-white tracking-[0.2em] shadow-lg">
                           {area.type}
                         </span>
                       </div>
                       <h2 className="text-4xl font-black font-outfit text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] tracking-tighter">{area.name}</h2>
                    </div>
                    <div className="text-right">
                       <div className="text-3xl font-black text-white drop-shadow-md leading-none">{area.plantsCount}</div>
                       <div className="text-[10px] font-black uppercase text-white/70 tracking-[0.2em] mt-1">Plantas</div>
                    </div>
                 </div>
               </div>
               
               <div className="p-8">
                  <div className="flex gap-8 mb-10">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                          <Sun size={16} className="text-amber-600 dark:text-amber-400" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-black text-[var(--text-secondary)] tracking-tight">Sol Pleno</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                          <Droplets size={16} className="text-blue-600 dark:text-blue-400" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-black text-[var(--text-secondary)] tracking-tight">{area.size} m²</span>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[var(--text-muted)] tracking-[0.3em] opacity-60 border-b border-[var(--text-primary)] border-opacity-5 pb-3">
                        <Clock size={16} strokeWidth={2.5} />
                        <span>Histórico de Atividade</span>
                     </div>
                     
                     <div className="relative pl-7 space-y-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-emerald-500/20">
                        <div className="relative">
                           <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] border-2 border-white"></div>
                           <div className="text-base font-black text-[var(--text-primary)] tracking-tight">Último Manejo</div>
                           <div className="text-xs font-bold text-[var(--text-muted)] mt-1">{area.lastActivity}</div>
                        </div>
                     </div>
                  </div>

                  <button className="w-full mt-10 py-5 glass glass-interactive rounded-3xl text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 text-[var(--text-primary)] shadow-2xl">
                     Acessar Área
                     <ChevronRight size={18} strokeWidth={3} />
                  </button>
               </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
