'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Inbox, Layers, CheckSquare, Activity, User, FileText, ChevronRight } from 'lucide-react';
import { Area, Project, InboxItem, Task, Alert, Log, Routine, Agent } from '../types/pulso.types';
import { SemanticDot, StatusBadge, PriorityBadge } from './BaseComponents';
import { getStatusTheme, getPriorityTheme, semanticColors } from '../utils/pulsoUIHelpers';
import { getStatusLabel, getPriorityLabel } from '../utils/statusHelpers';
import { formatDate, truncateText } from '../utils/formatters';

export const StateCard = ({ title, value, subtitle, icon: Icon, colorClass = 'text-blue-400' }: any) => {
  const safeValue = value !== undefined && value !== null ? value : 0;
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="py-4 px-2 transition-all hover:bg-white/[0.01] flex flex-col justify-between border-b border-white/5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`${colorClass} opacity-60 hover:opacity-100 transition-opacity`}>
          {Icon && <Icon size={14} strokeWidth={1} />}
        </div>
        <span className="text-2xl font-light tracking-tighter text-white">{safeValue}</span>
      </div>
      <h3 className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">{title || 'Indicador'}</h3>
      <p className="text-[10px] font-light text-white/40 mt-0.5">{subtitle || ''}</p>
    </motion.div>
  );
};

export const AreaPulseCard = ({ 
  area, 
  projectsCount = 0, 
  alertsCount = 0 
}: { 
  area: Area, 
  projectsCount?: number, 
  alertsCount?: number 
}) => {
  if (!area) return null;
  const status = area.status || 'active';
  const theme = getStatusTheme(status);
  const name = area.name || 'Área sem nome';
  const importance = area.importance || 'medium';

  return (
    <motion.div 
      whileHover={{ x: 2 }}
      className="py-3 flex flex-col gap-2 group transition-all border-b border-white/5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white/60 transition-colors" />
          <div>
            <h4 className="text-xs font-light text-white group-hover:text-white/80 transition-colors">{name}</h4>
            <p className="text-[9px] text-white/20 font-mono tracking-[0.1em] uppercase mt-0.5">
              {getStatusLabel(status)}
            </p>
          </div>
        </div>
        <PriorityBadge priority={importance} />
      </div>

      <div className="flex items-center gap-4 text-white/40 pl-4.5">
        <div className="flex items-center gap-1.5">
          <Layers size={10} strokeWidth={1} />
          <span className="text-[9px] font-mono tracking-wider">{projectsCount} projetos</span>
        </div>
        {alertsCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={10} strokeWidth={1} className="text-red-500/70" />
            <span className="text-[9px] font-mono tracking-wider text-red-500/70">{alertsCount} alertas</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const AttentionSignalList = ({ alerts, brokenRoutines }: { alerts: Alert[], brokenRoutines: Routine[] }) => {
  const safeAlerts = Array.isArray(alerts) ? alerts.filter(Boolean) : [];
  const safeBrokenRoutines = Array.isArray(brokenRoutines) ? brokenRoutines.filter(Boolean) : [];

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-6 pl-1">
        <AlertCircle size={14} strokeWidth={1} className="text-red-500" />
        <h3 className="text-xs font-mono tracking-[0.2em] text-red-500/70 uppercase">Sinais de Atenção</h3>
      </div>
      
      <div className="space-y-3">
        {safeAlerts.map((alert, idx) => {
          const id = alert.id || `alert-${idx}`;
          const name = alert.name || 'Alerta sem título';
          const desc = alert.description || 'Descrição não informada';
          return (
            <div key={id} className="flex items-start gap-3 py-2 pl-2 border-l border-red-500/20">
              <div className="w-1 h-1 rounded-full bg-red-500 mt-1.5 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div>
                <h5 className="text-xs font-light text-white/90">{name}</h5>
                <p className="text-[10px] text-white/40 mt-0.5">{desc}</p>
              </div>
            </div>
          );
        })}
        {safeBrokenRoutines.map((routine, idx) => {
          const id = routine.id || `routine-${idx}`;
          const name = routine.name || 'Rotina sem nome';
          const lastRun = routine.lastRunAt ? formatDate(routine.lastRunAt) : 'N/A';
          return (
            <div key={id} className="flex items-start gap-3 py-2 pl-2 border-l border-amber-500/20">
              <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5" />
              <div>
                <h5 className="text-xs font-light text-white/90">Rotina em Falha: {name}</h5>
                <p className="text-[10px] text-white/40 mt-0.5">Última execução: {lastRun}</p>
              </div>
            </div>
          );
        })}
        {safeAlerts.length === 0 && safeBrokenRoutines.length === 0 && (
          <p className="text-xs text-white/20 italic text-center py-4 font-mono tracking-wider">Nenhum sinal crítico detectado.</p>
        )}
      </div>
    </div>
  );
};

export const RecentMovementList = ({ logs }: { logs: Log[] }) => {
  const safeLogs = Array.isArray(logs) ? logs.filter(Boolean) : [];

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={14} strokeWidth={1} className="text-blue-500/70" />
        <h3 className="text-xs font-mono tracking-[0.2em] text-white/30 uppercase">Movimento Recente</h3>
      </div>
      
      <div className="space-y-4">
        {safeLogs.map((log, idx) => {
          const id = log.id || `log-${idx}`;
          const eventText = log.event || 'Evento de Sistema';
          const systemText = log.system || 'PULSO';
          const timeText = log.createdAt ? formatDate(log.createdAt) : '';
          return (
            <div key={id} className="flex items-center justify-between group cursor-default py-1">
              <div className="flex items-center gap-3">
                <FileText size={12} strokeWidth={1} className="text-white/20 group-hover:text-white/40 transition-colors" />
                <div>
                  <p className="text-xs font-light text-white/80">{eventText}</p>
                  <p className="text-[9px] text-white/20 font-mono tracking-wider uppercase">
                    {systemText} {timeText ? `• ${timeText}` : ''}
                  </p>
                </div>
              </div>
              <ChevronRight size={12} strokeWidth={1} className="text-white/10 group-hover:text-white/40 transition-colors" />
            </div>
          );
        })}
        {safeLogs.length === 0 && (
          <p className="text-xs text-white/20 italic text-center py-4 font-mono tracking-wider">Nenhum movimento recente registrado.</p>
        )}
      </div>
    </div>
  );
};

export const MetabolismPreview = ({ agents, routines }: { agents: Agent[], routines: Routine[] }) => {
  const safeAgents = Array.isArray(agents) ? agents.filter(Boolean) : [];
  const safeRoutines = Array.isArray(routines) ? routines.filter(Boolean) : [];

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-6">
        <Layers size={14} strokeWidth={1} className="text-[#a5b5a2]" />
        <h3 className="text-xs font-mono tracking-[0.2em] text-white/30 uppercase">Metabolismo</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-6 pl-1">
        <div>
          <p className="text-[9px] font-mono tracking-[0.2em] text-white/20 uppercase mb-1">Agentes</p>
          <p className="text-lg font-light text-white">{safeAgents.length}</p>
          <div className="mt-2 flex -space-x-1 overflow-hidden">
            {safeAgents.map((a, idx) => {
              const id = a.id || `agent-${idx}`;
              const name = a.name || 'Agente';
              return (
                <div key={id} className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0" title={name}>
                  <User size={8} className="text-white/40" />
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[9px] font-mono tracking-[0.2em] text-white/20 uppercase mb-1">Rotinas</p>
          <p className="text-lg font-light text-white">{safeRoutines.length}</p>
          <p className="text-[9px] text-[#a5b5a2]/60 font-mono tracking-wider mt-2 uppercase">Batimento Estável</p>
        </div>
      </div>
    </div>
  );
};
