'use client';

import React from 'react';
import { Search, Calendar, Filter } from 'lucide-react';

export const InboxFilters = ({ 
  filters, 
  setFilters,
  onSearch,
  availableAreas = [],
  availableProjects = [],
  availablePeople = [],
  availableSources = []
}: { 
  filters: any, 
  setFilters: (f: any) => void,
  onSearch: (q: string) => void,
  availableAreas?: any[],
  availableProjects?: any[],
  availablePeople?: any[],
  availableSources?: any[]
}) => {
  const primaryStatuses = ['new', 'all', 'triaged', 'converted', 'requests'];

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'new': return 'Novos';
      case 'all': return 'Todos';
      case 'triaged': return 'Triados';
      case 'converted': return 'Convertidos';
      case 'requests': return 'Solicitações Bridge';
      default: return st;
    }
  };

  // Canonical sub-filters for operational requests validation
  const requestStatuses = [
    { id: 'active', label: 'Ativos' },
    { id: 'requested', label: 'Requested' },
    { id: 'running', label: 'Running' },
    { id: 'needs_approval', label: 'Approval' },
    { id: 'needs_clarification', label: 'Clarification' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
    { id: 'test', label: 'Testes' },
    { id: 'archived', label: 'Arquivados' }
  ];

  return (
    <div className="flex flex-col gap-4 mb-8 w-full max-w-full">
      {/* 1. Primary Row: Search & Domain Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full border-b border-white/5 pb-2">
        {/* Search Bar */}
        <div className="relative flex-1 group min-w-0">
          <Search size={14} strokeWidth={1} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text"
            placeholder={filters.status === 'requests' ? "Buscar por título, sumário ou chaves na bridge..." : "Buscar no inbox ou intenções..."}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full bg-transparent border-none py-3 pl-10 pr-4 text-xs text-white placeholder:text-white/20 transition-all outline-none font-light"
          />
        </div>

        {/* Quick Domain Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar flex-nowrap w-full md:w-auto">
          {primaryStatuses.map(status => (
            <button
              key={status}
              onClick={() => setFilters({ ...filters, status, requestStatus: status === 'requests' ? (filters.requestStatus || 'active') : undefined })}
              className={`px-3 py-2 text-[9px] font-mono tracking-widest uppercase transition-all whitespace-nowrap shrink-0 bg-transparent border-none cursor-pointer ${
                filters.status === status 
                  ? 'text-white font-bold' 
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Secondary Row: Dedicated Cockpit Request Status Sub-Filters */}
      {filters.status === 'requests' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1.5 border-t border-white/5 custom-scrollbar flex-nowrap w-full">
          <span className="text-[8px] font-mono tracking-wider text-purple-400/60 mr-2 shrink-0 flex items-center gap-1">
            <Filter size={10} strokeWidth={1} />
            Filtro de Intenções:
          </span>
          {requestStatuses.map(reqSt => {
            const isActive = (filters.requestStatus || 'active') === reqSt.id;
            return (
              <button
                key={reqSt.id}
                onClick={() => setFilters({ ...filters, requestStatus: reqSt.id })}
                className={`px-2 py-1 text-[9px] font-mono tracking-wider transition-all whitespace-nowrap shrink-0 bg-transparent border-none cursor-pointer ${
                  isActive
                    ? 'text-purple-300 font-bold uppercase'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {reqSt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Advanced Filters (Type / Priority / Area / Project / Person / Source / Origin / Date Range) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-2 py-2 border-t border-white/5 pt-3 w-full">
         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Tipo:</span>
            <select 
              value={filters.type || 'all'} 
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none"
            >
              <option value="all" className="bg-[#020617]">Todos</option>
              <option value="task" className="bg-[#020617]">Tarefa</option>
              <option value="decision" className="bg-[#020617]">Decisão</option>
              <option value="person" className="bg-[#020617]">Pessoa</option>
              <option value="source" className="bg-[#020617]">Fonte</option>
              <option value="project" className="bg-[#020617]">Projeto</option>
              <option value="alert" className="bg-[#020617]">Alerta</option>
            </select>
         </div>

         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Prioridade:</span>
            <select 
              value={filters.priority || 'all'} 
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none"
            >
              <option value="all" className="bg-[#020617]">Todas</option>
              <option value="high" className="bg-[#020617]">Alta</option>
              <option value="medium" className="bg-[#020617]">Média</option>
              <option value="low" className="bg-[#020617]">Baixa</option>
            </select>
         </div>

         {/* Area Dropdown */}
         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Área:</span>
            <select 
              value={filters.area || 'all'} 
              onChange={(e) => setFilters({ ...filters, area: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none max-w-[120px] truncate"
            >
              <option value="all" className="bg-[#020617]">Todas</option>
              {availableAreas.map(a => (
                <option key={a.id} value={a.id} className="bg-[#020617]">{a.name}</option>
              ))}
            </select>
         </div>

         {/* Project Dropdown */}
         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Projeto:</span>
            <select 
              value={filters.project || 'all'} 
              onChange={(e) => setFilters({ ...filters, project: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none max-w-[120px] truncate"
            >
              <option value="all" className="bg-[#020617]">Todos</option>
              {availableProjects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#020617]">{p.name}</option>
              ))}
            </select>
         </div>

         {/* Person Dropdown */}
         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Pessoa:</span>
            <select 
              value={filters.person || 'all'} 
              onChange={(e) => setFilters({ ...filters, person: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none max-w-[120px] truncate"
            >
              <option value="all" className="bg-[#020617]">Todas</option>
              {availablePeople.map(p => (
                <option key={p.id} value={p.id} className="bg-[#020617]">{p.name}</option>
              ))}
            </select>
         </div>

         {/* Source Dropdown */}
         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Fonte:</span>
            <select 
              value={filters.source || 'all'} 
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none max-w-[120px] truncate"
            >
              <option value="all" className="bg-[#020617]">Todas</option>
              {availableSources.map(s => (
                <option key={s.id} value={s.id} className="bg-[#020617]">{s.name}</option>
              ))}
            </select>
         </div>

         {/* Origin/Channel Dropdown */}
         <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Origem:</span>
            <select 
              value={filters.origin || 'all'} 
              onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-white/60 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none"
            >
              <option value="all" className="bg-[#020617]">Todas</option>
              <option value="whatsapp" className="bg-[#020617]">WhatsApp</option>
              <option value="voice" className="bg-[#020617]">Voz</option>
              <option value="routine" className="bg-[#020617]">Rotina / Cron</option>
              <option value="system" className="bg-[#020617]">Sistema / UI</option>
            </select>
         </div>

         {/* Required Filter by Date Range */}
         <div className="flex items-center gap-1.5 sm:ml-auto">
            <Calendar size={10} className="text-white/20" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Data:</span>
            <select 
              value={filters.dateRange || 'all'} 
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="bg-transparent border-none text-[10px] font-bold text-blue-400 focus:ring-0 p-0 cursor-pointer hover:text-blue-300 transition-colors outline-none"
            >
              <option value="all" className="bg-[#020617]">Sempre</option>
              <option value="today" className="bg-[#020617]">Hoje</option>
              <option value="7d" className="bg-[#020617]">Últimos 7 dias</option>
              <option value="30d" className="bg-[#020617]">Últimos 30 dias</option>
              <option value="month" className="bg-[#020617]">Este mês</option>
            </select>
         </div>
      </div>
    </div>
  );
};
