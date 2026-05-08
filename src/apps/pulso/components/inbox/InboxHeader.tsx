'use client';

import React from 'react';
import { Plus, Inbox, Filter } from 'lucide-react';

export const InboxHeader = ({ 
  stats,
  onCreateNew
}: { 
  stats: { total: number, new: number, triaged: number },
  onCreateNew: () => void
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Inbox size={20} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">Inbox Universal</h1>
        </div>
        <p className="text-xs text-white/40 max-w-md leading-relaxed">
          Central de captura e triagem. Transforme sinais brutos em ações estruturadas no seu ecossistema.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-6 px-6 py-3 bg-white/2 border border-white/5 rounded-2xl">
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/20">Total</p>
            <p className="text-sm font-black text-white">{stats.total}</p>
          </div>
          <div className="w-[1px] h-6 bg-white/5" />
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/20 text-blue-400/50">Novos</p>
            <p className="text-sm font-black text-blue-400">{stats.new}</p>
          </div>
        </div>

        <button 
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-xl hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
        >
          <Plus size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Novo Registro</span>
        </button>
      </div>
    </div>
  );
};
