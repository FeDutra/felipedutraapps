'use client';

import React from 'react';
import { Search, Filter, X } from 'lucide-react';

export const InboxFilters = ({ 
  filters, 
  setFilters,
  onSearch 
}: { 
  filters: any, 
  setFilters: (f: any) => void,
  onSearch: (q: string) => void 
}) => {
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar no inbox..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full bg-white/2 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs text-white placeholder:text-white/20 focus:border-blue-500/30 focus:bg-white/5 transition-all outline-none"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {['all', 'new', 'triaged', 'converted'].map(status => (
            <button
              key={status}
              onClick={() => setFilters({ ...filters, status })}
              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                filters.status === status 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                  : 'bg-white/2 border-white/5 text-white/30 hover:border-white/10'
              }`}
            >
              {status === 'all' ? 'Todos' : status === 'new' ? 'Novos' : status === 'triaged' ? 'Triados' : 'Convertidos'}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters (Type/Priority) */}
      <div className="flex items-center gap-6 px-4 py-2">
         <div className="flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/10">Tipo:</span>
            <select 
              value={filters.type || 'all'} 
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors"
            >
              <option value="all">Todos</option>
              <option value="task">Tarefa</option>
              <option value="decision">Decisão</option>
              <option value="laterality">Lateralidade</option>
              <option value="alert">Alerta</option>
            </select>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/10">Prioridade:</span>
            <select 
              value={filters.priority || 'all'} 
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors"
            >
              <option value="all">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
         </div>
      </div>
    </div>
  );
};
