'use client';

import React, { useState } from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { Sparkles, Send, Camera, Image as ImageIcon, Mic, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

const suggestedQuestions = [
  "Como está o solo após a chuva?",
  "O que plantar na minguante?",
  "Diagnosticar praga na foto",
  "Resumo da semana na horta"
];

export default function IAPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou seu assistente ÉDEN Terra. Posso ajudar a analisar sua propriedade, diagnosticar plantas ou dar sugestões climáticas. O que gostaria de saber hoje?' }
  ]);

  return (
    <div className="w-full pb-10 flex flex-col min-h-[80vh]">
      <header className="mb-12 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 bg-indigo-500/10 dark:bg-indigo-500/20 px-4 py-1.5 rounded-full border border-indigo-500/20 mb-4"
        >
          <Sparkles size={14} className="text-indigo-600 dark:text-indigo-300" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-100">Inteligência da Terra</span>
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black font-outfit mb-3 tracking-tight text-[var(--text-primary)]">Assistente IA</h1>
        <p className="text-[var(--text-secondary)] font-medium text-base">Conhecimento profundo sobre sua terra.</p>
      </header>

      {/* Chat Area */}
      <div className="flex-1 space-y-8 mb-12 overflow-y-auto no-scrollbar pt-4">
        {messages.map((msg, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
              "max-w-[92%] md:max-w-[80%] rounded-[2rem] p-6 text-base leading-relaxed shadow-3xl",
              msg.role === 'assistant' 
                ? "glass border-white/20 self-start text-[var(--text-primary)]" 
                : "bg-emerald-600 self-end ml-auto text-white font-black shadow-emerald-500/30 border-4 border-white/10"
            )}
          >
            {msg.content}
          </motion.div>
        ))}
      </div>

      {/* Suggested */}
      <div className="space-y-6 mb-32">
         <h2 className="text-[11px] uppercase font-black text-[var(--text-muted)] tracking-[0.3em] px-2 opacity-60">Consultas Recomendadas</h2>
         <div className="flex flex-wrap gap-3">
            {suggestedQuestions.map(q => (
              <button key={q} className="glass glass-interactive border-white/20 px-6 py-3 rounded-2xl text-xs font-black text-[var(--text-secondary)] shadow-xl tracking-tight">
                {q}
              </button>
            ))}
         </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-32 left-6 right-6 md:bottom-36 z-40 max-w-4xl mx-auto w-[calc(100%-3rem)]">
         <GlassCard className="p-3 md:p-4 flex items-center gap-4 md:gap-6 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.4)] border-white/30 backdrop-blur-[40px]">
            <button className="p-4 text-[var(--text-muted)] hover:text-emerald-500 transition-all glass glass-interactive rounded-2xl border-white/20">
               <Camera size={28} strokeWidth={2.5} />
            </button>
            <input 
               type="text" 
               placeholder="Pergunte ao ÉDEN..." 
               className="flex-1 bg-transparent border-none outline-none text-lg md:text-xl placeholder:text-[var(--text-muted)] font-black py-2 text-[var(--text-primary)] tracking-tight"
            />
            <button className="p-5 md:p-6 bg-indigo-600 rounded-[1.5rem] text-white shadow-2xl active:scale-95 transition-all border-4 border-white/10 hover:bg-indigo-700">
               <Send size={28} strokeWidth={3} />
            </button>
         </GlassCard>
      </div>
    </div>
  );
}
