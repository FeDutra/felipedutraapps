'use client';

import React from 'react';
import GlassCard from '@/shared/components/GlassCard';
import { User, MapPin, Bell, Moon, Database, LogOut, ChevronRight, Globe, Settings as SettingsIcon } from 'lucide-react';
import { mockProperty } from '@/shared/mocks/data';
import { motion } from 'framer-motion';

const sections = [
  { 
    title: 'Propriedade', 
    items: [
      { icon: MapPin, label: 'Dados do Sítio', value: mockProperty.name },
      { icon: Globe, label: 'Localização Fixa', value: mockProperty.location },
    ]
  },
  { 
    title: 'Preferências', 
    items: [
      { icon: Bell, label: 'Notificações', value: 'Ativas' },
      { icon: Moon, label: 'Ciclo Lunar', value: 'Tradição Agrícola' },
    ]
  },
  { 
    title: 'Conta', 
    items: [
      { icon: User, label: 'Meu Perfil', value: 'Felipe Dutra' },
      { icon: Database, label: 'Exportar Dados', value: 'CSV / JSON' },
    ]
  }
];

export default function ConfiguracoesPage() {
  return (
    <div className="w-full pb-10">
      <header className="mb-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8">
         <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-tr from-emerald-500 to-sky-500 rounded-full flex items-center justify-center text-4xl md:text-6xl font-black font-outfit shadow-2xl border-4 border-white/30 relative"
         >
            <span className="text-white">FD</span>
            <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center text-slate-900 border-2 border-slate-900 shadow-lg">
              <SettingsIcon size={20} strokeWidth={3} />
            </div>
         </motion.div>
         <div>
           <h1 className="text-4xl md:text-5xl font-black font-outfit tracking-tight text-[var(--text-primary)]">Felipe Dutra</h1>
           <p className="text-[var(--text-muted)] font-bold text-sm uppercase tracking-widest mt-2">felipe@eden.com</p>
           <p className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest mt-4 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 w-fit mx-auto md:mx-0">Plano Guardião da Terra</p>
         </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
        {sections.map((section, i) => (
          <div key={i} className="space-y-4">
             <h2 className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-[0.2em] px-1">{section.title}</h2>
             <GlassCard className="p-0 overflow-hidden divide-y divide-[var(--text-muted)] divide-opacity-10 border-[var(--glass-border)] shadow-xl">
                {section.items.map((item, j) => (
                   <button key={j} className="w-full flex items-center justify-between p-6 hover:bg-[var(--text-muted)] hover:bg-opacity-5 transition-all active:bg-[var(--text-muted)] active:bg-opacity-10">
                      <div className="flex items-center gap-5">
                         <div className="p-2.5 bg-[var(--text-muted)] bg-opacity-10 rounded-xl text-[var(--text-secondary)]">
                           <item.icon size={22} strokeWidth={2.5} />
                         </div>
                         <div className="text-left">
                            <div className="text-sm font-black text-[var(--text-primary)] tracking-tight">{item.label}</div>
                            <div className="text-xs font-bold text-[var(--text-muted)] mt-0.5">{item.value}</div>
                         </div>
                      </div>
                      <ChevronRight size={18} className="text-[var(--text-muted)]" />
                   </button>
                ))}
             </GlassCard>
          </div>
        ))}

        <button className="w-full flex items-center justify-center gap-3 p-6 text-red-500 font-black glass rounded-2xl active:scale-[0.98] transition-all border-red-500/10 shadow-xl mt-4">
           <LogOut size={22} strokeWidth={3} />
           <span className="uppercase text-xs tracking-widest">Sair da Conta</span>
        </button>

        <div className="text-center mt-12 pb-8 md:col-span-2 lg:col-span-3">
           <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em]">ÉDEN Terra</p>
           <p className="text-[10px] text-[var(--text-muted)] opacity-50 font-bold mt-2">Versão 1.0.4-Refinement • 2024</p>
        </div>
      </div>
    </div>
  );
}
