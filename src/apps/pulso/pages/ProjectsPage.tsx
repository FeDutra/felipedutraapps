'use client';

import React from 'react';
import { PulsoHeader } from '../components/BaseComponents';
import { Layers } from 'lucide-react';

export default function ProjectsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <PulsoHeader />
      
      <div className="bg-white/2 border border-white/5 rounded-3xl p-12 flex flex-col items-center justify-center min-h-[400px] text-center mt-8">
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex items-center justify-center mb-6">
          <Layers size={32} className="text-blue-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Projetos em Destaque</h2>
        <p className="text-sm text-white/40 max-w-md leading-relaxed">
          Esta visão agrupará os projetos por área, status e prioridade, trazendo centralidade operacional. Em construção para a v1.0.
        </p>
      </div>
    </div>
  );
}
