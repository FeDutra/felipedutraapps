'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, Calendar, Layers, Shield, Hash, HelpCircle, Tag } from 'lucide-react';

interface UniversalFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    status?: string;
    priority?: string;
    area?: string;
    project?: string;
    type?: string;
    dateRange?: string;
    origin?: string;
  };
  setFilters: (f: any) => void;
  availableAreas?: { id: string; name: string }[];
  availableProjects?: { id: string; name: string }[];
  showType?: boolean;
  showOrigin?: boolean;
}

export const UniversalFilterPanel = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  availableAreas = [],
  availableProjects = [],
  showType = true,
  showOrigin = true,
}: UniversalFilterPanelProps) => {
  if (!isOpen) return null;

  const handleChange = (key: string, val: string) => {
    setFilters({ ...filters, [key]: val });
  };

  const clearAll = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      area: 'all',
      project: 'all',
      type: 'all',
      dateRange: 'all',
      origin: 'all',
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full bg-white/2 border border-white/5 rounded-3xl p-6 mb-8 backdrop-blur-xl relative z-30 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
          <div className="flex items-center gap-2 text-blue-400">
            <SlidersHorizontal size={16} />
            <span className="text-xs font-black uppercase tracking-widest text-white">Filtros Avançados Universais</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={clearAll}
              className="text-[9px] font-bold text-white/30 hover:text-white/60 transition-colors uppercase"
            >
              Limpar
            </button>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/5 rounded-lg text-white/40 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Status */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5 flex items-center gap-1">
              <Tag size={10} /> Status
            </label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-white/80 focus:border-blue-500/30 outline-none"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="completed">Concluídos</option>
              <option value="needs_approval">Aprovação Req.</option>
              <option value="needs_clarification">Esclarecimento</option>
              <option value="failed">Falhas</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5 flex items-center gap-1">
              <Shield size={10} /> Prioridade
            </label>
            <select
              value={filters.priority || 'all'}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-white/80 focus:border-blue-500/30 outline-none"
            >
              <option value="all">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5 flex items-center gap-1">
              <Calendar size={10} /> Recência (Data)
            </label>
            <select
              value={filters.dateRange || 'all'}
              onChange={(e) => handleChange('dateRange', e.target.value)}
              className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-blue-400 focus:border-blue-500/30 outline-none font-bold"
            >
              <option value="all">Sempre</option>
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="month">Este mês</option>
            </select>
          </div>

          {/* Area */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5 flex items-center gap-1">
              <Hash size={10} /> Área de Escopo
            </label>
            <select
              value={filters.area || 'all'}
              onChange={(e) => handleChange('area', e.target.value)}
              className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-white/80 focus:border-blue-500/30 outline-none truncate"
            >
              <option value="all">Todas as Áreas</option>
              {availableAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          {availableProjects.length > 0 && (
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5 flex items-center gap-1">
                <Layers size={10} /> Projeto Vinculado
              </label>
              <select
                value={filters.project || 'all'}
                onChange={(e) => handleChange('project', e.target.value)}
                className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-white/80 focus:border-blue-500/30 outline-none truncate"
              >
                <option value="all">Todos os Projetos</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type */}
          {showType && (
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5">
                Tipo da Entidade
              </label>
              <select
                value={filters.type || 'all'}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-white/80 focus:border-blue-500/30 outline-none"
              >
                <option value="all">Todos</option>
                <option value="business">Negócios/Core</option>
                <option value="personal">Pessoal</option>
                <option value="system">Sistema</option>
              </select>
            </div>
          )}

          {/* Origin */}
          {showOrigin && (
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5">
                Canal / Origem
              </label>
              <select
                value={filters.origin || 'all'}
                onChange={(e) => handleChange('origin', e.target.value)}
                className="w-full bg-[#020617] border border-white/5 rounded-xl py-2 px-3 text-xs text-white/80 focus:border-blue-500/30 outline-none"
              >
                <option value="all">Todas as Origens</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="openclaw">OpenClaw</option>
                <option value="system">Sistema / UI</option>
              </select>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
