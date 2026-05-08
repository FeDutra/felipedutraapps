'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Leaf, CheckCircle2, Home, ArrowRight, User, Settings, Sparkles, Activity } from 'lucide-react';
import GlassCard from '@/shared/components/GlassCard';

export default function EdenCentral() {
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const apps = [
    {
      id: 'terra',
      title: 'ÉDEN Terra',
      description: 'Gestão regenerativa e monitoramento ambiental da sua propriedade.',
      icon: Leaf,
      href: '/terra',
      color: 'from-emerald-500 to-teal-600',
      status: 'Ativo',
      image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 'pulso',
      title: 'PULSO',
      description: 'Projetos, rotinas, agentes, fontes, decisões, lateralidades e estados vivos do ecossistema.',
      icon: Activity,
      href: '/pulso',
      color: 'from-blue-600 to-indigo-700',
      status: 'Ativo',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 'habitos',
      title: 'ÉDEN Hábitos',
      description: 'Sincronize sua rotina com os ciclos naturais e rituais diários.',
      icon: CheckCircle2,
      href: '/habitos',
      color: 'from-amber-400 to-orange-500',
      status: 'Em Construção',
      image: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&q=80&w=800'
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 backdrop-blur-md">
              <Sparkles size={20} className="text-emerald-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Ecossistema ÉDEN</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black font-outfit tracking-tighter leading-none mb-6"
          >
            ÉDEN <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">Central</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/50 font-medium max-w-2xl leading-relaxed"
          >
            Acesse seus aplicativos pessoais de gestão de vida, terra e consciência. 
            Tudo em um só lugar, integrado e natural.
          </motion.p>
        </header>

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {apps.map((app, idx) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
            >
              <Link href={app.href}>
                <GlassCard className="p-0 overflow-hidden border-white/10 hover:border-white/20 group h-full flex flex-col">
                  <div className="h-48 w-full relative">
                    <img 
                      src={app.image} 
                      alt={app.title} 
                      className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />
                    
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border ${
                        app.status === 'Ativo' 
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                          : 'bg-white/10 border-white/20 text-white/40'
                      }`}>
                        {app.status}
                      </span>
                    </div>

                    <div className="absolute bottom-6 left-8">
                       <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg mb-4`}>
                          <app.icon size={24} className="text-white" />
                       </div>
                    </div>
                  </div>

                  <div className="p-8 flex-1 flex flex-col">
                    <h2 className="text-3xl font-black font-outfit mb-3 group-hover:text-emerald-400 transition-colors tracking-tight">
                      {app.title}
                    </h2>
                    <p className="text-white/50 text-sm font-medium leading-relaxed mb-8 flex-1">
                      {app.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 group-hover:gap-4 transition-all">
                      {app.status === 'Ativo' ? (
                        <>
                          <span>Acessar App</span>
                          <ArrowRight size={14} className="text-emerald-400" />
                        </>
                      ) : (
                        <>
                          <span>Acessar Prévia</span>
                          <ArrowRight size={14} className="text-white/20" />
                        </>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Secondary Links */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap gap-4 pt-12 border-t border-white/5"
        >
          <button className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
            <User size={18} className="text-white/40" />
            <span className="text-xs font-black uppercase tracking-widest">Perfil</span>
          </button>
          <button className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
            <Settings size={18} className="text-white/40" />
            <span className="text-xs font-black uppercase tracking-widest">Configurações Gerais</span>
          </button>
        </motion.div>

        {/* Footer */}
        <footer className="mt-32 text-center">
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10">
             ÉDEN OS &copy; 2026 • Design by Felipe Dutra
           </p>
        </footer>
      </div>
    </div>
  );
}
