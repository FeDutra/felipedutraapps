'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import GlassCard from '@/shared/components/GlassCard';

export default function HabitosPlaceholder() {
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <GlassCard className="p-12 text-center border-white/10">
          <div className="w-20 h-20 bg-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-amber-500/30">
            <Clock size={32} className="text-amber-400" />
          </div>
          
          <h1 className="text-4xl font-black font-outfit tracking-tighter mb-4">ÉDEN Hábitos</h1>
          <p className="text-white/50 text-sm font-medium leading-relaxed mb-10">
            Estamos cultivando esta experiência. Em breve, você poderá gerenciar sua rotina e rituais diários aqui.
          </p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-12">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Em Construção</span>
          </div>

          <Link href="/" className="flex items-center justify-center gap-3 w-full py-5 bg-white text-slate-900 rounded-3xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-colors">
            <ArrowLeft size={16} />
            Voltar ao Central
          </Link>
        </GlassCard>
      </motion.div>
    </div>
  );
}
