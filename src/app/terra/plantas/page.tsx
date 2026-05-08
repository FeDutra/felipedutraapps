'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { TreePine, Plus, Search, Filter, Calendar, Camera, ChevronRight, Tag, MapPin } from 'lucide-react';
import { mockPlants, mockAreas } from '@/shared/mocks/data';
import { motion } from 'framer-motion';

export default function PlantasPage() {
  return (
    <div className="w-full pb-10">
      <header className="mb-12 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 px-4 py-1.5 rounded-full border border-emerald-500/20 mb-4"
        >
          <TreePine size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-100">Biodiversidade Registrada</span>
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black font-outfit mb-3 tracking-tight text-[var(--text-primary)]">Plantas</h1>
        <p className="text-[var(--text-secondary)] font-medium text-base mt-1">Acompanhe o ciclo de vida da sua produção.</p>
      </header>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-6 mb-16">
        <div className="flex-1 glass glass-interactive rounded-[2.5rem] flex items-center px-8 py-6 gap-5 border-white/20 shadow-2xl">
          <Search size={24} className="text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou área..." 
            className="bg-transparent border-none outline-none text-lg md:text-xl w-full placeholder:text-[var(--text-muted)] font-black tracking-tight text-[var(--text-primary)]"
          />
        </div>
        <div className="flex gap-4">
          <button className="flex-1 md:flex-none glass glass-interactive p-6 rounded-[2rem] border-white/20 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4">
            <Filter size={24} className="text-[var(--text-secondary)]" />
            <span className="md:hidden font-black uppercase text-[10px] tracking-[0.3em] text-[var(--text-primary)]">Filtros</span>
          </button>
          <button className="flex-1 md:flex-none bg-emerald-600 text-white p-6 rounded-[2rem] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 border-4 border-white/20">
            <Plus size={24} strokeWidth={3} />
            <span className="md:hidden font-black uppercase text-[10px] tracking-[0.3em]">Novo</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {mockPlants.map((plant, idx) => {
          const area = mockAreas.find(a => a.id === plant.areaId);
          return (
            <motion.div
              key={plant.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
            >
              <GlassCard className="flex gap-6 p-6 border-white/20 hover:border-white/40 transition-all cursor-pointer group shadow-3xl">
                 <div className="w-32 h-32 rounded-3xl overflow-hidden flex-shrink-0 border border-white/20 shadow-2xl relative">
                    <img 
                      src={plant.image || 'https://images.unsplash.com/photo-1416870230247-d0e90ec7d036?auto=format&fit=crop&q=80&w=400'} 
                      alt={plant.name} 
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-125"
                    />
                    <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
                 
                 <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                       <div className="flex justify-between items-start mb-2">
                          <h2 className="text-2xl font-black font-outfit leading-none tracking-tighter text-[var(--text-primary)]">{plant.name}</h2>
                          <ChevronRight size={20} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                       </div>
                       <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 w-fit px-3 py-1 rounded-full mb-3">
                          {plant.phase}
                       </div>
                       <div className="flex items-center gap-2 text-xs font-black text-[var(--text-secondary)] opacity-70">
                          <MapPin size={14} className="text-emerald-500" />
                          <span>{area?.name || 'Área não definida'}</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-5 mt-4">
                       <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">
                          <Calendar size={14} strokeWidth={3} />
                          <span>{plant.plantedAt}</span>
                       </div>
                       <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">
                          <Camera size={14} strokeWidth={3} />
                          <span>4 Fotos</span>
                       </div>
                    </div>
                 </div>
              </GlassCard>
            </motion.div>
          );
        })}

        {/* Add New Plant Card */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full border-4 border-dashed border-white/20 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-5 text-[var(--text-muted)] hover:bg-white/5 hover:border-emerald-500/30 transition-all aspect-square md:aspect-auto group"
        >
           <div className="p-6 bg-white/5 rounded-full border border-white/10 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
            <Plus size={40} strokeWidth={3} className="group-hover:text-emerald-500 transition-colors" />
           </div>
           <span className="font-black uppercase tracking-[0.4em] text-[11px]">Adicionar Planta</span>
        </motion.button>
      </div>
    </div>
  );
}
