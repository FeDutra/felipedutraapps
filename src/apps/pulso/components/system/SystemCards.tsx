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
  const statusColors = {
    healthy: 'border-emerald-500/10 bg-emerald-500/2',
    attention: 'border-amber-500/10 bg-amber-500/2',
    critical: 'border-red-500/10 bg-red-500/2'
  };

  return (
    <div className={`p-6 border rounded-3xl transition-all ${statusColors[status as keyof typeof statusColors] || 'border-white/5 bg-white/2'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl bg-white/5 ${colorClass}`}>
          <Icon size={18} />
        </div>
        <div className={`w-2 h-2 rounded-full ${status === 'healthy' ? 'bg-emerald-500' : status === 'attention' ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
      </div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">{title}</h4>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-white">{value}</span>
        {subtitle && <span className="text-[10px] text-white/20 font-medium">{subtitle}</span>}
      </div>
    </div>
  );
};

export const AlertItemRow = ({ alert, onAction }: { alert: Alert, onAction: (id: string, action: string) => void }) => {
  const severityColors = {
    critical: 'text-red-500 bg-red-500/10 border-red-500/20',
    high: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    medium: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    low: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    info: 'text-white/40 bg-white/5 border-white/10'
  };

  return (
    <div className="group p-5 bg-white/2 border border-white/5 rounded-3xl hover:bg-white/4 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl border ${severityColors[alert.severity as keyof typeof severityColors]}`}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h4 className="text-sm font-bold text-white">{alert.name}</h4>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${severityColors[alert.severity as keyof typeof severityColors]}`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-xs text-white/40 mb-2">{alert.description}</p>
            <div className="flex items-center gap-4 text-[10px] text-white/20">
              <span className="flex items-center gap-1"><Clock size={10} /> {new Date(alert.createdAt).toLocaleString()}</span>
              {alert.agentRef && <span className="flex items-center gap-1 uppercase tracking-tighter"><Server size={10} /> {alert.agentRef}</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
          {alert.status === 'open' && (
            <button 
              onClick={() => onAction(alert.id, 'acknowledge')}
              className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg hover:bg-blue-500/20 transition-all"
            >
              Reconhecer
            </button>
          )}
          <button 
            onClick={() => onAction(alert.id, 'resolve')}
            className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all"
          >
            Resolver
          </button>
          <button 
            onClick={() => onAction(alert.id, 'ignore')}
            className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold rounded-lg hover:bg-white/10 transition-all"
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
    <div className="p-5 bg-white/2 border border-white/5 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-xl text-white/40">
            <Globe size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">{job.name}</h4>
            <p className="text-[9px] text-white/20 uppercase tracking-widest">{job.originSystem} → {job.targetSystem}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 ${config.color}`}>
          <config.icon size={12} />
          <span className="text-[10px] font-black uppercase tracking-widest">{config.label}</span>
        </div>
      </div>
      
      {job.errorMessage && (
        <div className="mb-4 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
          <p className="text-[10px] text-red-400/80 italic line-clamp-1">{job.errorMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-white/20">
        <span>Última: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString() : '---'}</span>
        {job.recordsProcessed !== undefined && <span>{job.recordsProcessed} registros</span>}
      </div>
    </div>
  );
};

export const AgentCard = ({ agent, onClick }: { agent: Agent, onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="p-6 bg-white/2 border border-white/5 rounded-3xl cursor-pointer hover:bg-white/4 transition-all group"
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
          <Server size={20} />
        </div>
        <div>
          <h4 className="text-sm font-black text-white">{agent.name}</h4>
          <p className="text-[10px] text-white/40 font-medium">{agent.role}</p>
        </div>
      </div>
      <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-white/10'}`} />
    </div>
    
    <p className="text-xs text-white/40 mb-6 line-clamp-2 leading-relaxed">
      {agent.description}
    </p>

    <div className="flex flex-wrap gap-2 mb-6">
      {agent.systemsUsed?.map(s => (
        <span key={s} className="text-[9px] font-black text-white/20 border border-white/5 px-2 py-1 rounded-lg uppercase tracking-widest">
          {s}
        </span>
      ))}
    </div>

    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
       <span className="text-[9px] text-white/20 uppercase tracking-widest">Atividade Recente</span>
       <span className="text-[10px] text-white/40 font-bold">
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
      className={`p-6 border rounded-3xl transition-all cursor-pointer group ${
        isBroken ? 'bg-red-500/2 border-red-500/10' : isPaused ? 'bg-white/1 border-white/5' : 'bg-white/2 border-white/5 hover:bg-white/4'
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl border ${
            isBroken ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-white/40'
          }`}>
            <Clock size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">{routine.name}</h4>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-white/30">{routine.frequency}</span>
               {isBroken && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Quebrada</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
           <button 
             onClick={() => onToggleStatus(routine.id, isPaused ? 'active' : 'paused')}
             className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 transition-all"
           >
             {isPaused ? <Play size={14} /> : <Pause size={14} />}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
        <div>
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Última Execução</p>
          <p className="text-xs text-white/60 font-medium">
            {routine.lastRunAt ? new Date(routine.lastRunAt).toLocaleTimeString() : '---'}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Status</p>
          <div className="flex items-center gap-1.5">
             <div className={`w-1.5 h-1.5 rounded-full ${isBroken ? 'bg-red-500' : isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
             <span className="text-xs text-white/60 font-medium capitalize">{routine.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
