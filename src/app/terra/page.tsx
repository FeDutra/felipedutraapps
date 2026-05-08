'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { 
  CloudRain, 
  Moon, 
  Sun, 
  Droplets, 
  Wind, 
  TreePine, 
  MapPin,
  ChevronRight,
  Lightbulb,
  AlertCircle,
  Clock,
  Plus
} from 'lucide-react';
import { mockHomeSummary } from '@/shared/mocks/data';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import MoonPhaseRenderer from '@/apps/terra/components/lunar/MoonPhaseRenderer';

export default function HojePage() {
  const router = useRouter();
  const { 
    property, 
    weather, 
    rainComparison, 
    moon, 
    sunlight, 
    humidity, 
    wind, 
    landSummary, 
    dailySuggestion 
  } = mockHomeSummary;

  const today = new Date();

  return (
    <div className="w-full pb-20">
      {/* Header */}
      <header className="mb-8 text-center pt-4">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 text-[var(--text-secondary)] mb-2 glass w-fit mx-auto px-4 py-1.5 rounded-full border border-white/10"
        >
          <MapPin size={14} className="text-emerald-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">{property.name}</h2>
        </motion.div>
        <h1 className="text-4xl font-black mb-1 tracking-tighter text-[var(--text-primary)]">{property.location}</h1>
        <p className="text-[var(--text-muted)] text-xs font-black uppercase tracking-widest">
          {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </header>

      {/* Hero Section - current Sky */}
      <section className="mb-10 text-center relative py-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-400/10 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="text-[11rem] font-thin font-outfit mb-0 leading-[0.8] tracking-tighter text-[var(--text-primary)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-start">
            {weather.temp}<span className="text-5xl font-black mt-8">°</span>
          </div>
          <div className="text-2xl font-black mt-2 text-[var(--text-primary)] tracking-tight">Céu Limpo</div>
          
          <div className="mt-8 flex gap-8 text-[var(--text-primary)] font-bold glass px-8 py-3 rounded-full border border-white/10 shadow-2xl">
            <span className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] text-[8px] font-black uppercase tracking-widest">Máx</span> 
              <span className="text-lg">{weather.temp + 3}°</span>
            </span>
            <div className="w-px h-6 bg-white/10" />
            <span className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] text-[8px] font-black uppercase tracking-widest">Mín</span> 
              <span className="text-lg">{weather.temp - 5}°</span>
            </span>
          </div>
        </motion.div>
      </section>

      {/* Decision Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        
        {/* Daily Suggestion - NEW */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-2"
        >
          <GlassCard className="h-full border-indigo-500/20 bg-indigo-500/5 flex items-start gap-4 p-5 hover:bg-indigo-500/10 transition-colors">
            <div className="p-2.5 bg-indigo-500/20 rounded-2xl">
              <Lightbulb className="text-indigo-300" size={20} />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1 block">Orientação do ÉDEN</span>
              <p className="text-sm font-bold text-indigo-50/90 leading-tight">
                {dailySuggestion}
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* Card Chuva - Forecast vs Reality */}
        <GlassCard 
          className="col-span-2 relative overflow-hidden group border-white/10 hover:border-blue-500/50 transition-all cursor-pointer"
          onClick={() => router.push('/terra/chuva')}
        >
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 text-blue-400">
              <CloudRain size={20} strokeWidth={2.5} />
              <span className="font-black uppercase text-[10px] tracking-widest">Memória da Chuva</span>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-blue-400 transition-colors" />
          </div>

          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-5xl font-black font-outfit text-white leading-none">
                {rainComparison.registered === 0 ? '--' : `${rainComparison.registered}mm`}
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest text-blue-300/80 mt-2">Realidade hoje</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-white/60 leading-none">{rainComparison.forecast}mm</div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">Previsão</div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center gap-2">
            {rainComparison.status === 'pending' ? (
              <button 
                onClick={(e) => { e.stopPropagation(); router.push('/terra/registrar'); }}
                className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/40 px-3 py-1.5 rounded-full transition-colors"
              >
                <Plus size={12} className="text-blue-300" />
                <span className="text-[9px] font-black uppercase text-blue-100">Registrar Chuva</span>
              </button>
            ) : (
              <span className="text-[10px] font-bold text-blue-200/60 flex items-center gap-1.5">
                <AlertCircle size={12} className="text-blue-400" />
                {rainComparison.message}
              </span>
            )}
          </div>
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
        </GlassCard>

        {/* Card Lua */}
        <GlassCard 
          className="aspect-square flex flex-col justify-between border-white/10 hover:border-indigo-500/50 transition-all cursor-pointer group"
          onClick={() => router.push('/terra/lua')}
        >
          <div className="flex items-center gap-2 text-indigo-400">
            <Moon size={18} strokeWidth={2.5} />
            <span className="font-black uppercase text-[10px] tracking-widest">Céu</span>
          </div>
          <div className="flex-1 flex items-center justify-center py-2">
             <MoonPhaseRenderer 
              moonPhase={moon.moonPhase} 
              size={80} 
              isMini={true} 
              className="group-hover:scale-110 transition-transform duration-700" 
             />
          </div>
          <div>
            <div className="text-lg font-black text-white leading-tight">{moon.phase}</div>
            <div className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">Influência: {moon.agriculturalImpact.split(' ')[0]}...</div>
          </div>
        </GlassCard>

        {/* Card Sol */}
        <GlassCard 
          className="aspect-square flex flex-col justify-between border-white/10 hover:border-amber-500/50 transition-all cursor-pointer group"
          onClick={() => router.push('/terra/ia')} // Detail view could be AI or Sun specific later
        >
          <div className="flex items-center gap-2 text-amber-400">
            <Sun size={18} strokeWidth={2.5} />
            <span className="font-black uppercase text-[10px] tracking-widest">Luz</span>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-3">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-white/40">
              <span>{sunlight.sunrise}</span>
              <span>{sunlight.sunset}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full relative overflow-hidden">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${sunlight.daylightProgress}%` }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
               />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-white leading-tight">UV {sunlight.uvIndex}</div>
            <div className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">{sunlight.risk}</div>
          </div>
        </GlassCard>

        {/* Mini Stats Grid */}
        <GlassCard 
          className="flex flex-col justify-between gap-3 border-white/10 hover:border-white/30 transition-all cursor-pointer"
          onClick={() => router.push('/terra/ia')}
        >
          <div className="flex items-center gap-2 text-sky-400">
            <Droplets size={16} strokeWidth={2.5} />
            <span className="font-black uppercase text-[10px] tracking-widest">Umidade</span>
          </div>
          <div>
            <div className="text-3xl font-black text-white">{humidity.percentage}%</div>
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-tighter leading-tight mt-1">{humidity.dewPoint}</div>
          </div>
        </GlassCard>

        <GlassCard 
          className="flex flex-col justify-between gap-3 border-white/10 hover:border-white/30 transition-all cursor-pointer"
          onClick={() => router.push('/terra/ia')}
        >
          <div className="flex items-center gap-2 text-slate-400">
            <Wind size={16} strokeWidth={2.5} />
            <span className="font-black uppercase text-[10px] tracking-widest">Vento</span>
          </div>
          <div>
            <div className="text-3xl font-black text-white">{wind.speed} <span className="text-xs font-bold text-white/30">km/h</span></div>
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-tighter leading-tight mt-1">Rajadas {wind.gusts}</div>
          </div>
        </GlassCard>

        {/* Card Vida na Terra - Refactored */}
        <GlassCard 
          className="col-span-2 md:col-span-4 lg:col-span-6 border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => router.push('/terra/areas')}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <TreePine className="text-emerald-400" size={24} strokeWidth={2.5} />
              </div>
              <div>
                <div className="font-black text-xl text-white tracking-tight flex items-center gap-2">
                  Vida na Terra
                  <ChevronRight size={18} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="text-sm font-bold text-white/60">
                  {landSummary.plantsCount} plantas em {landSummary.areasCount} áreas ativas
                </div>
              </div>
            </div>

            <div className="flex flex-col md:items-end gap-3 relative z-10">
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                <Clock size={14} className="text-emerald-400" />
                <span className="text-[10px] font-black uppercase text-emerald-100/70 tracking-widest">
                  Última atividade: <span className="text-white">{landSummary.lastActivity}</span>
                </span>
              </div>
              
              {landSummary.alert && (
                <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20">
                  <AlertCircle size={14} className="text-amber-400" />
                  <span className="text-[10px] font-black uppercase text-amber-100/70 tracking-widest">
                    Atenção: <span className="text-amber-200">{landSummary.alert}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
        </GlassCard>
      </div>

      {/* Footer Quote */}
      <footer className="mt-16 mb-8 text-center opacity-40">
        <p className="text-white italic text-[11px] font-black uppercase tracking-[0.4em]">
          ÉDEN TERRA • SENTINELA DA PROPRIEDADE
        </p>
      </footer>
    </div>
  );
}
