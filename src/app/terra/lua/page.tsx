'use client';

import React, { useState, useEffect } from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { Info, Orbit, Zap, Wind, Waves, MapPin, Share2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MoonPhaseRenderer from '@/apps/terra/components/lunar/MoonPhaseRenderer';
import MoonTimeline from '@/apps/terra/components/lunar/MoonTimeline';
import { lunarService } from '@/shared/services/lunarService';
import { LunarData } from '@/shared/types';
import { cn } from '@/shared/lib/utils';

export default function LuaPage() {
  const [currentLunar, setCurrentLunar] = useState<LunarData | null>(null);
  const [history, setHistory] = useState<LunarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Layered Loading Strategy
  useEffect(() => {
    // 1. Synchronous Cache Check (Runs immediately on mount in client)
    const cachedCurrent = localStorage.getItem('last_lunar_current');
    const cachedHistory = localStorage.getItem('last_lunar_history');

    if (cachedCurrent && cachedHistory) {
      try {
        const parsedCurrent = JSON.parse(cachedCurrent);
        const parsedHistory = JSON.parse(cachedHistory);
        setCurrentLunar(parsedCurrent);
        setHistory(parsedHistory);
        setLoading(false); // Content found, stop loader
        setIsSyncing(true);
      } catch (e) {
        console.error("Cache error", e);
      }
    }

    async function fetchData() {
      try {
        const [today, monthHistory] = await Promise.all([
          lunarService.getLunarData(),
          lunarService.getLunarHistory(30)
        ]);

        setCurrentLunar(today);
        setHistory(monthHistory);

        localStorage.setItem('last_lunar_current', JSON.stringify(today));
        localStorage.setItem('last_lunar_history', JSON.stringify(monthHistory));
      } catch (error) {
        console.error("Fetch error", error);
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    }
    
    fetchData();
  }, []);

  const handleSelectDay = (data: LunarData) => {
    setCurrentLunar(data);
  };

  // Structured Skeleton/Preview State
  if (loading && !currentLunar) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-12">
           <div className="w-64 h-64 rounded-full bg-white/5 border border-white/10 animate-pulse" />
           <div className="absolute inset-0 flex items-center justify-center">
              <Orbit className="w-12 h-12 text-indigo-400 animate-spin opacity-50" />
           </div>
        </div>
        <h2 className="text-3xl font-black text-white mb-3">Sincronizando Ciclo Lunar</h2>
        <p className="text-indigo-200/60 font-bold uppercase tracking-widest text-[10px]">Lendo dados astronômicos em tempo real...</p>
      </div>
    );
  }

  // If we have content (from cache or API), render the full layout
  return (
    <div className="w-full pb-24 relative">
      {/* Syncing Indicator (Discrete) */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-0 right-14 z-50 flex items-center gap-1.5 bg-indigo-500/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-indigo-500/30"
          >
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-[0.1em] text-indigo-100">Sincronizando</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Header */}
      <header className="mb-12 relative">
        <div className="flex items-center justify-between mb-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 bg-indigo-500/20 px-4 py-1.5 rounded-full border border-indigo-500/30"
          >
            <Orbit size={14} className="text-indigo-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Google Weather API</span>
          </motion.div>
          <div className="flex gap-2">
            <button className="p-2 glass rounded-full hover:bg-white/10 transition-colors">
              <Share2 size={16} className="text-white" />
            </button>
            <button className="p-2 glass rounded-full hover:bg-white/10 transition-colors">
              <Info size={16} className="text-white" />
            </button>
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black font-outfit mb-2 tracking-tight text-white">
          Ciclo Lunar
        </h1>
        <div className="flex items-center gap-2 text-indigo-100/70 font-bold text-sm">
          <MapPin size={14} className="text-indigo-400" />
          <span>São Lourenço da Serra, SP • Hemisfério Sul</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Visual Section */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center py-10 relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px]" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentLunar?.moonPhase}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="relative z-10"
            >
              {currentLunar && (
                <MoonPhaseRenderer moonPhase={currentLunar.moonPhase} size={380} />
              )}
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute -top-4 -right-12 glass-dark px-4 py-2 rounded-2xl border-white/20 shadow-2xl backdrop-blur-xl"
              >
                <div className="text-[8px] font-black uppercase text-indigo-300 tracking-widest">Iluminação</div>
                <div className="text-xl font-black text-white">{currentLunar ? Math.round(currentLunar.illumination) : 0}%</div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-16 text-center z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-dark px-10 py-6 rounded-[2.5rem] border-white/20 shadow-3xl backdrop-blur-2xl"
            >
              <h2 className="text-5xl font-black font-outfit mb-1 tracking-tighter text-white">
                {currentLunar?.phase || "Nova"}
              </h2>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300">
                Dia {currentLunar ? Math.floor(currentLunar.moonPhase * 30) : 0} do Ciclo
              </div>
            </motion.div>
          </div>
        </div>

        {/* Info Section */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <GlassCard className="p-8 border-indigo-500/20 bg-indigo-950/30 overflow-hidden relative group">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
            
            <div className="flex items-center gap-3 text-indigo-300 mb-6 font-black uppercase text-[10px] tracking-[0.3em]">
              <Zap size={18} strokeWidth={3} className="text-indigo-400 animate-pulse" />
              <span>Bio-Influência</span>
            </div>
            
            <h3 className="text-3xl font-black mb-4 tracking-tight text-white leading-tight">
              {currentLunar?.agriculturalImpact.split('.')[0]}.
            </h3>
            <p className="text-indigo-100/70 font-medium leading-relaxed text-lg mb-8">
              {currentLunar?.agriculturalImpact.split('.')[1] || "A energia gravitacional favorece o movimento de seiva nas plantas."}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-3xl p-5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Waves size={14} className="text-indigo-300" />
                  <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Marés</span>
                </div>
                <div className="text-xl font-black text-white">Alta Intensidade</div>
              </div>
              <div className="bg-white/5 rounded-3xl p-5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Wind size={14} className="text-indigo-300" />
                  <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Estabilidade</span>
                </div>
                <div className="text-xl font-black text-white">Equilibrada</div>
              </div>
            </div>
          </GlassCard>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Nascer', value: currentLunar?.moonrise || '--:--' },
              { label: 'Ocaso', value: currentLunar?.moonset || '--:--' },
              { label: 'Próxima Cheia', value: '23 Mai' }
            ].map((stat, i) => (
              <div key={i} className="glass p-5 rounded-3xl border-white/10 flex flex-col gap-1">
                <span className="text-[8px] font-black uppercase text-indigo-300 tracking-widest">{stat.label}</span>
                <span className="text-lg font-black text-white">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <section className="mt-20">
        <MoonTimeline 
          data={history} 
          selectedDate={""} 
          onSelect={handleSelectDay} 
        />
      </section>
    </div>
  );
}

