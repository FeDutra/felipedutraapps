'use client';

import React from 'react';
import { 
  AlertCircle, Activity, Server, ShieldCheck, 
  Clock, Database, Wifi, Globe, 
  Settings, Play, Pause, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { Alert, Log, SyncJob, Agent, Routine } from '../../types/pulso.types';
import { PriorityBadge } from '../BaseComponents';

export const HealthStatusCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  colorClass = 'text-white/60',
  status = 'healthy'
}: any) => {
  return (
    <div className="py-4 px-2 transition-all flex flex-col justify-between border-b border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className={`opacity-60 ${colorClass}`}>
          <Icon size={14} strokeWidth={1} />
        </div>
        <div className={`w-1.5 h-1.5 rounded-full ${status === 'healthy' ? 'bg-emerald-500' : status === 'attention' ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
      </div>
      <h4 className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase mb-1">{title}</h4>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-light text-white">{value}</span>
        {subtitle && <span className="text-[10px] text-white/20 font-mono tracking-wider">{subtitle}</span>}
      </div>
    </div>
  );
};

export const AlertItemRow = ({ alert, onAction }: { alert: Alert, onAction: (id: string, action: string) => void }) => {
  const severityColors = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-amber-500',
    low: 'text-blue-500',
    info: 'text-white/40'
  };

  return (
    <div className="group py-4 border-b border-white/5 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={14} strokeWidth={1} className={`mt-1 shrink-0 ${severityColors[alert.severity as keyof typeof severityColors]}`} />
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h4 className="text-xs font-light text-white">{alert.name}</h4>
              <span className={`text-[8px] font-mono tracking-wider uppercase ${severityColors[alert.severity as keyof typeof severityColors]}`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-[11px] text-white/40 mb-2 font-light leading-relaxed">{alert.description}</p>
            <div className="flex items-center gap-4 text-[9px] text-white/20 font-mono">
              <span className="flex items-center gap-1"><Clock size={10} strokeWidth={1} /> {new Date(alert.createdAt).toLocaleString()}</span>
              {alert.agentRef && <span className="flex items-center gap-1 uppercase tracking-wider"><Server size={10} strokeWidth={1} /> {alert.agentRef}</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:opacity-0 group-hover:opacity-100 transition-opacity">
          {alert.status === 'open' && (
            <button 
              onClick={() => onAction(alert.id, 'acknowledge')}
              className="text-blue-400 hover:text-white text-[9px] font-mono tracking-wider uppercase bg-transparent border-none cursor-pointer outline-none transition-colors"
            >
              Reconhecer
            </button>
          )}
          <button 
            onClick={() => onAction(alert.id, 'resolve')}
            className="text-emerald-400 hover:text-white text-[9px] font-mono tracking-wider uppercase bg-transparent border-none cursor-pointer outline-none transition-colors"
          >
            Resolver
          </button>
          <button 
            onClick={() => onAction(alert.id, 'ignore')}
            className="text-white/30 hover:text-white text-[9px] font-mono tracking-wider uppercase bg-transparent border-none cursor-pointer outline-none transition-colors"
          >
            Ignorar
          </button>
        </div>
      </div>
    </div>
  );
};

export const SyncJobCard = ({ job }: { job: SyncJob }) => {
  const statusConfig = {
    success: { color: 'text-emerald-400', icon: CheckCircle2, label: 'Sucesso' },
    failed: { color: 'text-red-500', icon: AlertTriangle, label: 'Falhou' },
    running: { color: 'text-blue-400', icon: Activity, label: 'Sincronizando' },
    pending: { color: 'text-white/40', icon: Clock, label: 'Pendente' },
    paused: { color: 'text-amber-500', icon: Pause, label: 'Pausado' },
  };

  const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className="py-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Globe size={14} strokeWidth={1} className="text-white/35 shrink-0" />
          <div>
            <h4 className="text-xs font-light text-white">{job.name}</h4>
            <p className="text-[8px] text-white/20 font-mono tracking-wider uppercase mt-0.5">{job.originSystem} → {job.targetSystem}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 ${config.color}`}>
          <config.icon size={10} strokeWidth={1} />
          <span className="text-[8px] font-mono tracking-widest uppercase">{config.label}</span>
        </div>
      </div>
      
      {job.errorMessage && (
        <div className="mb-3 py-1.5 pl-2 border-l border-red-500/20">
          <p className="text-[10px] text-red-400/80 italic font-mono tracking-wide">{job.errorMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-[9px] text-white/25 font-mono">
        <span>Última: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString() : '---'}</span>
        {job.recordsProcessed !== undefined && <span>{job.recordsProcessed} registros</span>}
      </div>
    </div>
  );
};

export const AgentCard = ({ agent, onClick }: { agent: Agent, onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="py-4 border-b border-white/5 cursor-pointer transition-all group"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Server size={14} strokeWidth={1} className="text-white/35 shrink-0" />
        <div>
          <h4 className="text-xs font-light text-white group-hover:text-blue-400 transition-colors">{agent.name}</h4>
          <p className="text-[8px] text-white/25 font-mono tracking-wider uppercase mt-0.5">{agent.role}</p>
        </div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-white/10'}`} />
    </div>
    
    <p className="text-[11px] text-white/40 mb-4 line-clamp-2 leading-relaxed font-light">
      {agent.description}
    </p>

    <div className="flex flex-wrap gap-2 mb-4">
      {agent.systemsUsed?.map(s => (
        <span key={s} className="text-[8px] font-mono tracking-widest text-white/20 uppercase">
          [{s}]
        </span>
      ))}
    </div>

    <div className="pt-2 flex items-center justify-between text-[9px] text-white/25 font-mono">
       <span className="uppercase tracking-wider">Atividade Recente</span>
       <span className="text-white/40 font-bold">
         {agent.lastActivityAt ? new Date(agent.lastActivityAt).toLocaleTimeString() : 'Ocioso'}
       </span>
    </div>
  </div>
);

export const RoutineCard = ({ routine, onToggleStatus, onClick }: any) => {
  const isBroken = routine.status === 'broken';
  const isPaused = routine.status === 'paused';

  return (
    <div 
      onClick={onClick}
      className="py-4 border-b border-white/5 cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock size={14} strokeWidth={1} className={isBroken ? 'text-red-500' : 'text-white/35'} />
          <div>
            <h4 className="text-xs font-light text-white group-hover:text-blue-400 transition-colors">{routine.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[9px] text-white/30 font-mono">{routine.frequency}</span>
               {isBroken && <span className="text-[8px] font-mono tracking-widest text-red-500 uppercase font-bold">Quebrada</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
           <button 
             onClick={() => onToggleStatus(routine.id, isPaused ? 'active' : 'paused')}
             className="p-1 bg-transparent border-none outline-none cursor-pointer text-white/40 hover:text-white transition-colors"
           >
             {isPaused ? <Play size={12} strokeWidth={1.5} /> : <Pause size={12} strokeWidth={1.5} />}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2 text-[9px] text-white/25 font-mono">
        <div>
          <p className="uppercase tracking-wider mb-0.5">Última Execução</p>
          <p className="text-white/50 font-light">
            {routine.lastRunAt ? new Date(routine.lastRunAt).toLocaleTimeString() : '---'}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-wider mb-0.5">Status</p>
          <div className="flex items-center gap-1.5">
             <div className={`w-1 h-1 rounded-full ${isBroken ? 'bg-red-500' : isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
             <span className="text-white/50 font-light capitalize">{routine.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
