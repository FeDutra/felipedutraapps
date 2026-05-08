'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { BarChart3, Download, ChevronRight, FileText, Calendar, CloudRain, Sprout, TrendingUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { motion } from 'framer-motion';

const reportTypes = [
  { title: 'Resumo Semanal', period: '12 - 18 Maio', icon: Calendar, color: 'text-emerald-400' },
  { title: 'Balanço Hídrico', period: 'Maio 2024', icon: CloudRain, color: 'text-blue-400' },
  { title: 'Produção e Colheita', period: 'Trimestre 1', icon: Sprout, color: 'text-orange-400' },
];

export default function RelatoriosPage() {
  return (
    <div className="w-full pb-10 text-white">
      <header className="mb-12 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center gap-2 bg-indigo-500/20 px-4 py-1.5 rounded-full border border-indigo-400/20 mb-4"
        >
          <BarChart3 size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Inteligência de Dados</span>
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black font-outfit mb-3 tracking-tight">Relatórios</h1>
        <p className="text-white/70 font-medium text-base mt-1">Análise profunda para decisões melhores na terra.</p>
      </header>

      {/* Featured Report Card */}
      <GlassCard className="bg-gradient-to-br from-emerald-600/30 to-blue-600/30 border-white/20 mb-10 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
         <div className="flex items-center gap-2 text-white font-black uppercase text-[10px] tracking-[0.2em] mb-8 bg-black/20 w-fit px-3 py-1 rounded-md">
            <TrendingUp size={16} strokeWidth={3} />
            <span>Resumo da Estação</span>
         </div>
         
         <h2 className="text-3xl font-black font-outfit mb-4 tracking-tight leading-tight">Vigor de Produção em Alta</h2>
         <p className="text-base text-white/90 mb-10 leading-relaxed font-medium">
            Seu <span className="font-black text-emerald-300 underline underline-offset-4 decoration-emerald-500/50">Canteiro 01</span> produziu <span className="font-black text-white underline underline-offset-4 decoration-blue-500/50">15% mais</span> tomates do que no ano passado sob as mesmas condições.
         </p>

         <button className="w-full py-5 bg-white text-slate-950 font-black rounded-2xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all hover:bg-slate-100">
            <Download size={22} strokeWidth={3} />
            <span className="uppercase text-xs tracking-widest">Exportar Relatório PDF</span>
         </button>
      </GlassCard>

      <div className="space-y-6">
         <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em] px-1">Histórico de Análises</h3>
         
         <div className="space-y-4">
           {reportTypes.map((report, i) => (
              <GlassCard key={i} className="flex items-center gap-5 p-5 border-white/10 hover:border-white/30 transition-all cursor-pointer group shadow-xl">
                 <div className={cn("p-3.5 rounded-2xl bg-white/5 border border-white/10", report.color)}>
                    <report.icon size={26} strokeWidth={2.5} />
                 </div>
                 <div className="flex-1">
                    <div className="font-black text-white tracking-tight">{report.title}</div>
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wide mt-1">{report.period}</div>
                 </div>
                 <button className="p-2 text-white/20 group-hover:text-white/50 transition-colors">
                    <ChevronRight size={20} strokeWidth={3} />
                 </button>
              </GlassCard>
           ))}
         </div>
      </div>

      {/* Future Annual Report Teaser */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.5 }}
        className="mt-16 p-10 border-2 border-dashed border-white/10 rounded-[2.5rem] text-center"
      >
         <FileText size={48} className="mx-auto mb-6 text-white/40" strokeWidth={1.5} />
         <h4 className="font-black text-white mb-2 tracking-tight">Relatório Anual da Terra</h4>
         <p className="text-xs font-bold text-white/40 px-6 leading-relaxed uppercase tracking-widest">
          Disponível ao completar o primeiro ciclo anual de registros.
         </p>
      </motion.div>
    </div>
  );
}
