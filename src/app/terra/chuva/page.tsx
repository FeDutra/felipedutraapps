'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { CloudRain, Info, History, TrendingUp, Droplet, ChevronRight } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { mockRainLogs } from '@/shared/mocks/data';
import { motion } from 'framer-motion';

export default function ChuvaPage() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="w-full pb-10">
      <header className="mb-12 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 px-4 py-1.5 rounded-full border border-blue-500/20 mb-4"
        >
          <TrendingUp size={14} className="text-blue-600 dark:text-blue-300" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-100">Tendência de Umidade</span>
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black font-outfit mb-3 tracking-tight text-[var(--text-primary)]">Memória da Chuva</h1>
        <p className="text-[var(--text-secondary)] font-medium text-base mt-1">Onde a previsão encontra a realidade da sua terra.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
        {/* Today Summary */}
        <GlassCard className="relative overflow-hidden border-blue-400/20 p-8 shadow-2xl group">
          {/* Atmospheric localized glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
          
          <div className="relative z-10 flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-10 font-black uppercase text-[10px] tracking-[0.3em]">
            <CloudRain size={20} strokeWidth={3} className="animate-pulse" />
            <span>Hoje na Propriedade</span>
          </div>
          
          <div className="relative z-10 flex justify-between items-end">
            <div>
              <div className="text-7xl font-black font-outfit text-[var(--text-primary)] leading-none tracking-tighter">12<span className="text-3xl ml-1 font-bold text-blue-600 dark:text-blue-300">mm</span></div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700/60 dark:text-blue-300/80 mt-4">Realidade registrada</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-[var(--text-secondary)] opacity-80">5<span className="text-lg ml-1 font-bold text-[var(--text-muted)]">mm</span></div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-2">Previsão esperada</div>
            </div>
          </div>

          <div className="relative z-10 mt-10 pt-8 border-t border-[var(--text-primary)] border-opacity-5 flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Info size={18} className="text-blue-600 dark:text-blue-300" />
            </div>
            <p className="text-sm md:text-base font-medium text-[var(--text-secondary)] leading-relaxed">
              Hoje choveu <span className="text-[var(--text-primary)] font-black decoration-blue-500/30 underline underline-offset-4 decoration-4">140% a mais</span> do que o previsto. Solo em saturação ideal para plantio.
            </p>
          </div>
        </GlassCard>

        {/* Chart */}
        <GlassCard className="p-6 border-[var(--glass-border)]">
           <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-2 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">
               <TrendingUp size={18} />
               <span>Histórico Semanal</span>
             </div>
             <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                   <span className="text-[var(--text-primary)]">Real</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] opacity-30"></div>
                   <span className="text-[var(--text-muted)]">Prev</span>
                </div>
             </div>
           </div>

           <div className="h-64 w-full">
             {mounted && (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mockRainLogs} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" className="dark:stroke-white/5" />
                   <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 700 }} 
                      dy={12}
                   />
                   <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
                   />
                   <Tooltip 
                      cursor={{ fill: 'var(--chart-secondary)' }}
                      contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', backdropFilter: 'blur(10px)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                   />
                   <Bar dataKey="forecast" fill="var(--text-muted)" opacity={0.2} radius={[6, 6, 0, 0]} barSize={12} />
                   <Bar dataKey="reality" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={12} />
                 </BarChart>
               </ResponsiveContainer>
             )}
           </div>
        </GlassCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
           <GlassCard className="flex flex-col gap-3 border-[var(--glass-border)] p-5">
              <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">Acumulado Mês</span>
              <div className="text-3xl font-black text-[var(--text-primary)]">142<span className="text-sm font-bold text-[var(--text-muted)] ml-1">mm</span></div>
              <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter bg-emerald-500/10 w-fit px-2 py-0.5 rounded-md">+12% vs média</div>
           </GlassCard>
           <GlassCard className="flex flex-col gap-3 border-[var(--glass-border)] p-5">
              <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">Dias Sem Chuva</span>
              <div className="text-3xl font-black text-[var(--text-primary)]">4 <span className="text-sm font-bold text-[var(--text-muted)] ml-1">dias</span></div>
              <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tighter bg-amber-500/10 w-fit px-2 py-0.5 rounded-md">Solo em alerta</div>
           </GlassCard>
        </div>

        {/* Recent History */}
        <div className="md:col-span-2 mt-4 md:mt-0">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">
               <History size={18} strokeWidth={2.5} />
               <span>Registros Recentes</span>
             </div>
             <button className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">Ver Todos</button>
           </div>
           
           <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <GlassCard key={i} className="flex items-center justify-between p-4 border-[var(--glass-border)] hover:border-[var(--text-muted)] transition-all cursor-pointer shadow-lg">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-300 border border-blue-500/20">
                        <Droplet size={22} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="font-black text-[var(--text-primary)] tracking-tight">Ontem, 14:30</div>
                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Chuva moderada • 2.5h</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                    <div className="text-xl font-black text-[var(--text-primary)]">8mm</div>
                    <ChevronRight size={16} className="text-[var(--text-muted)]" />
                   </div>
                </GlassCard>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
