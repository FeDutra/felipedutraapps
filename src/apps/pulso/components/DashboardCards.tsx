'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Inbox, Layers, CheckSquare, Activity, User, FileText, ChevronRight } from 'lucide-react';
import { Area, Project, InboxItem, Task, Alert, Log, Routine, Agent } from '../types/pulso.types';
import { SemanticDot, StatusBadge, PriorityBadge } from './BaseComponents';
import { getStatusTheme, getPriorityTheme, semanticColors } from '../utils/pulsoUIHelpers';
import { getStatusLabel, getPriorityLabel } from '../utils/statusHelpers';
import { formatDate, truncateText } from '../utils/formatters';

export const StateCard = ({ title, value, subtitle, icon: Icon, colorClass = 'text-blue-400' }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white/2 border border-white/5 rounded-3xl p-6 backdrop-blur-sm"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-xl bg-white/5 border border-white/5 ${colorClass}`}>
        <Icon size={18} />
      </div>
      <span className="text-2xl font-black tracking-tighter text-white">{value}</span>
    </div>
    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">{title}</h3>
    <p className="text-xs text-white/50 mt-1">{subtitle}</p>
  </motion.div>
);

export const AreaPulseCard = ({ 
  area, 
  projectsCount = 0, 
  alertsCount = 0 
}: { 
  area: Area, 
  projectsCount?: number, 
  alertsCount?: number 
}) => {
  const theme = getStatusTheme(area.status);
  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      className="bg-white/2 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group transition-all hover:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${theme.bg} ${theme.border} flex items-center justify-center`}>
            <SemanticDot theme={theme} size="w-1.5 h-1.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{area.name}</h4>
            <p className="text-[9px] text-white/30 font-medium uppercase tracking-wider">
              {getStatusLabel(area.status)}
            </p>
          </div>
        </div>
        <PriorityBadge priority={area.importance} />
      </div>

      <div className="flex items-center gap-4 border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-white/20" />
          <span className="text-[10px] font-bold text-white/60">{projectsCount} <span className="text-white/20 font-medium uppercase tracking-tighter">Projetos</span></span>
        </div>
        {alertsCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-500/50" />
            <span className="text-[10px] font-bold text-red-400/80">{alertsCount} <span className="text-red-400/20 font-medium uppercase tracking-tighter">Alertas</span></span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const AttentionSignalList = ({ alerts, brokenRoutines }: { alerts: Alert[], brokenRoutines: Routine[] }) => (
  <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-6">
    <div className="flex items-center gap-2 mb-6">
      <AlertCircle size={18} className="text-red-500" />
      <h3 className="text-sm font-black uppercase tracking-widest text-red-500/80">Sinais de Atenção</h3>
    </div>
    
    <div className="space-y-4">
      {alerts.map(alert => (
        <div key={alert.id} className="flex items-start gap-4 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <div>
            <h5 className="text-xs font-bold text-white/90">{alert.name}</h5>
            <p className="text-[10px] text-white/40 mt-0.5">{alert.description}</p>
          </div>
        </div>
      ))}
      {brokenRoutines.map(routine => (
        <div key={routine.id} className="flex items-start gap-4 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
          <div>
            <h5 className="text-xs font-bold text-white/90">Rotina em Falha: {routine.name}</h5>
            <p className="text-[10px] text-white/40 mt-0.5">Última execução: {routine.lastRunAt ? formatDate(routine.lastRunAt) : 'N/A'}</p>
          </div>
        </div>
      ))}
      {alerts.length === 0 && brokenRoutines.length === 0 && (
        <p className="text-xs text-white/20 italic text-center py-4">Nenhum sinal crítico detectado.</p>
      )}
    </div>
  </div>
);

export const RecentMovementList = ({ logs }: { logs: Log[] }) => (
  <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
    <div className="flex items-center gap-2 mb-6">
      <Activity size={18} className="text-blue-500" />
      <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Movimento Recente</h3>
    </div>
    
    <div className="space-y-4">
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between group cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
              <FileText size={14} className="text-white/40" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/80">{log.event}</p>
              <p className="text-[9px] text-white/20 font-medium uppercase tracking-wider">{log.system} • {formatDate(log.createdAt)}</p>
            </div>
          </div>
          <ChevronRight size={14} className="text-white/10 group-hover:text-white/40 transition-colors" />
        </div>
      ))}
    </div>
  </div>
);

export const MetabolismPreview = ({ agents, routines }: { agents: Agent[], routines: Routine[] }) => (
  <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
    <div className="flex items-center gap-2 mb-6">
      <Layers size={18} className="text-emerald-500" />
      <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Metabolismo</h3>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 bg-white/3 rounded-2xl border border-white/5">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Agentes</p>
        <p className="text-lg font-black text-white">{agents.length}</p>
        <div className="mt-2 flex -space-x-2">
          {agents.map(a => (
            <div key={a.id} className="w-6 h-6 rounded-full bg-blue-500/20 border border-white/10 flex items-center justify-center overflow-hidden" title={a.name}>
              <User size={10} className="text-blue-400" />
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 bg-white/3 rounded-2xl border border-white/5">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Rotinas</p>
        <p className="text-lg font-black text-white">{routines.length}</p>
        <p className="text-[9px] text-emerald-400/60 font-bold mt-2 uppercase">Batimento Estável</p>
      </div>
    </div>
  </div>
);
