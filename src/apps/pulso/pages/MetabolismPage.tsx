'use client';

import React from 'react';
import { 
  agentsService, 
  routinesService, 
  tasksService, 
  projectsService, 
  requestsService, 
  healthService,
  pulsoService
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { Agent, Routine, Task, Project, PulsoRequest, Log } from '../types/pulso.types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Clock, Activity, Play, 
  Pause, AlertCircle, RefreshCw, Zap,
  CheckCircle2, AlertTriangle, Shield, User,
  FileText, Terminal, X, ArrowRight, ExternalLink, HelpCircle,
  CheckSquare
} from 'lucide-react';
import { formatDate, truncateText } from '../utils/formatters';

// Safe array helper
const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Safe date converters
const safeGetTime = (dateInput: any): number => {
  if (!dateInput) return 0;
  if (dateInput instanceof Date) return dateInput.getTime();
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    return dateInput.toDate().getTime();
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return dateInput.seconds * 1000;
  }
  if (typeof dateInput === 'string') {
    const t = Date.parse(dateInput);
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

const safeConvertToDate = (dateInput: any): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    return dateInput.toDate();
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return new Date(dateInput.seconds * 1000);
  }
  if (typeof dateInput === 'string') {
    const t = Date.parse(dateInput);
    return isNaN(t) ? null : new Date(t);
  }
  return null;
};

// Safe local ErrorBoundary for granular fallbacks
class SafeBlock extends React.Component<{ children: React.ReactNode, name: string }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.error(`[SafeBlock Error] ${this.props.name}:`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 border border-dashed border-red-500/20 rounded-3xl bg-red-500/5 backdrop-blur-sm flex flex-col items-center justify-center text-center">
          <AlertCircle size={20} className="text-red-400 mb-2" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400">Não foi possível carregar este bloco</h4>
          <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{this.props.name}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MetabolismPage() {
  const [loading, setLoading] = React.useState(true);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [requests, setRequests] = React.useState<PulsoRequest[]>([]);
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [selectedEntity, setSelectedEntity] = React.useState<{ type: 'agent' | 'routine', data: any } | null>(null);
  const [isRequestDrawerOpen, setIsRequestDrawerOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      
      const [allAgents, allRoutines, allTasks, allProjects, allRequests, allLogs] = await Promise.all([
        agentsService.getAll().catch(e => { console.error(e); return []; }),
        routinesService.getAll().catch(e => { console.error(e); return []; }),
        tasksService.getAll().catch(e => { console.error(e); return []; }),
        projectsService.getAll().catch(e => { console.error(e); return []; }),
        requestsService.getRequests(50).catch(e => { console.error(e); return []; }),
        healthService.getLogs(50).catch(e => { console.error(e); return []; })
      ]);

      // Soft filters for active, non-archived items
      setAgents(safeArray(allAgents).filter(a => a && a.archived !== true));
      setRoutines(safeArray(allRoutines).filter(r => r && r.archived !== true));
      setTasks(safeArray(allTasks).filter(t => t && t.archived !== true));
      setProjects(safeArray(allProjects).filter(p => p && p.archived !== true));
      setRequests(safeArray(allRequests).filter(req => req && req.archived !== true));
      setLogs(safeArray(allLogs));
    } catch (err: any) {
      console.error('Error loading metabolism data:', err);
      setError(err.message || 'Erro ao sintonizar ecossistema dos agentes.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper bindings
  const getAgentRoutines = (agentId: string, agentSlug: string) => {
    return routines.filter((r: any) => {
      const refs = r.agentRefs || r.agentRef || [];
      const idStr = agentId.toLowerCase();
      const slugStr = agentSlug.toLowerCase();
      if (Array.isArray(refs)) {
        return refs.some(ref => typeof ref === 'string' && (ref.toLowerCase() === idStr || ref.toLowerCase() === slugStr));
      }
      if (typeof refs === 'string') {
        return refs.toLowerCase() === idStr || refs.toLowerCase() === slugStr;
      }
      return false;
    });
  };

  const getAgentTasks = (agentId: string, agentSlug: string) => {
    return tasks.filter((t: any) => {
      if (t.status === 'completed') return false;
      const createdBy = t.requestedBy || '';
      const owners = t.ownerRefs || [];
      const idStr = agentId.toLowerCase();
      const slugStr = agentSlug.toLowerCase();
      const match = (val: string) => {
        const v = val.toLowerCase();
        return v.includes(idStr) || v.includes(slugStr);
      };
      if (match(createdBy)) return true;
      if (Array.isArray(owners)) {
        return owners.some(o => typeof o === 'string' && match(o));
      }
      return false;
    });
  };

  const getAgentRequests = (agentId: string, agentSlug: string) => {
    return requests.filter((req: any) => {
      const requestedBy = req.requestedBy || '';
      const processedBy = req.processedBy || '';
      const idStr = agentId.toLowerCase();
      const slugStr = agentSlug.toLowerCase();
      const match = (val: string) => {
        const v = val.toLowerCase();
        return v.includes(idStr) || v.includes(slugStr);
      };
      return match(requestedBy) || match(processedBy);
    });
  };

  const getAgentLogs = (agentId: string, agentSlug: string) => {
    return logs.filter((log: any) => {
      const ref = log.agentRef || '';
      const text = (log.event || '').toLowerCase();
      const idStr = agentId.toLowerCase();
      const slugStr = agentSlug.toLowerCase();
      const matchRef = ref.toLowerCase() === idStr || ref.toLowerCase() === slugStr;
      const matchText = text.includes(idStr) || text.includes(slugStr);
      return matchRef || matchText;
    });
  };

  const getAgentLastActivity = (agent: any) => {
    let lastTime = 0;
    if (agent.lastActivityAt) {
      lastTime = Math.max(lastTime, safeGetTime(agent.lastActivityAt));
    }
    const linkedRoutines = getAgentRoutines(agent.id, agent.slug || '');
    linkedRoutines.forEach(r => {
      if (r.lastRunAt) {
        lastTime = Math.max(lastTime, safeGetTime(r.lastRunAt));
      }
    });
    const linkedRequests = getAgentRequests(agent.id, agent.slug || '');
    linkedRequests.forEach(req => {
      const t = safeGetTime(req.requestedAt || req.updatedAt);
      lastTime = Math.max(lastTime, t);
    });
    const linkedLogs = getAgentLogs(agent.id, agent.slug || '');
    linkedLogs.forEach(log => {
      lastTime = Math.max(lastTime, safeGetTime(log.createdAt));
    });
    return lastTime > 0 ? new Date(lastTime) : null;
  };

  const handleToggleStatus = async (id: string, newStatus: string) => {
    try {
      if (newStatus === 'paused') await routinesService.pause(id);
      else await routinesService.resume(id);
      loadData();
    } catch (e) {
      console.error('Failed to toggle routine:', e);
    }
  };

  // --- STATS CALCULATION ---
  const activeAgents = agents.filter(a => a.status === 'active');
  const activeRoutines = routines.filter(r => r.status === 'active');
  const brokenRoutines = routines.filter(r => r.status === 'broken' || r.status === 'failed');

  // Attention Items calculation
  const attentionItems: Array<{ id: string; type: string; title: string; subtitle: string; severity: 'critical' | 'warning' }> = [];
  
  // 1. Failed Agents
  agents.forEach(a => {
    if (a.status === 'broken' || a.status === 'failed' || (a.status as string) === 'error') {
      attentionItems.push({
        id: `agent-fail-${a.id}`,
        type: 'agent_fail',
        title: `Agente em Falha: ${a.name}`,
        subtitle: `O agente reportou travamento ou execução com falha crônica.`,
        severity: 'critical'
      });
    }
  });

  // 2. Failed Routines
  routines.forEach(r => {
    if (r.status === 'broken' || r.status === 'failed') {
      attentionItems.push({
        id: `routine-fail-${r.id}`,
        type: 'routine_fail',
        title: `Rotina Quebrada: ${r.name}`,
        subtitle: `Falha registrada no último batimento automático.`,
        severity: 'critical'
      });
    }
  });

  // 3. Needs approval without active status
  agents.forEach(a => {
    if ((a as any).requiresApproval === true && (a.status as string) === 'needs_approval') {
      attentionItems.push({
        id: `agent-approve-${a.id}`,
        type: 'agent_approve',
        title: `Aprovação Pendente: ${a.name}`,
        subtitle: `O agente necessita de chancela no Cockpit para iniciar.`,
        severity: 'warning'
      });
    }
  });

  // 4. Agents with no activity
  agents.forEach(a => {
    const act = getAgentLastActivity(a);
    if (!act) {
      attentionItems.push({
        id: `agent-noact-${a.id}`,
        type: 'agent_noact',
        title: `Sem Atividade: ${a.name}`,
        subtitle: `Agente ocioso ou sem nenhuma rotina executada.`,
        severity: 'warning'
      });
    }
  });

  // 5. Overdue routines
  const now = Date.now();
  routines.forEach(r => {
    if (r.status === 'active' && r.nextRunAt) {
      const nextTime = safeGetTime(r.nextRunAt);
      if (nextTime > 0 && nextTime < now) {
        attentionItems.push({
          id: `routine-overdue-${r.id}`,
          type: 'routine_overdue',
          title: `Rotina Atrasada: ${r.name}`,
          subtitle: `Próxima execução agendada está vencida desde ${formatDate(r.nextRunAt)}.`,
          severity: 'warning'
        });
      }
    }
  });

  const topAttentionItems = attentionItems.slice(0, 5);

  // Agents in Attention count (unique agents with issues)
  const agentsInAttention = agents.filter(a => {
    const isFailed = a.status === 'broken' || a.status === 'failed' || (a.status as string) === 'error';
    const isPending = (a as any).requiresApproval === true && (a.status as string) === 'needs_approval';
    const isIdle = !getAgentLastActivity(a);
    const hasBrokenRoutines = getAgentRoutines(a.id, a.slug || '').some(r => r.status === 'broken' || r.status === 'failed');
    return isFailed || isPending || isIdle || hasBrokenRoutines;
  });

  // Latest Activity globally
  let latestActivityTime = 0;
  agents.forEach(a => {
    const act = getAgentLastActivity(a);
    if (act) latestActivityTime = Math.max(latestActivityTime, act.getTime());
  });
  const globalLastActivity = latestActivityTime > 0 ? new Date(latestActivityTime) : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Agentes</h1>
          <p className="text-sm text-white/40 max-w-lg leading-relaxed">
            Central de trabalho dos agentes, rotinas, estado e execução.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            className="p-4 bg-white/2 border border-white/5 rounded-2xl text-white/40 hover:bg-white/5 hover:text-white transition-all"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-white/2 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Agentes Ativos</p>
          <p className="text-2xl font-black text-white">{activeAgents.length}</p>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/40 mb-2">Agentes Em Atenção</p>
          <p className="text-2xl font-black text-amber-400">{agentsInAttention.length}</p>
        </div>
        <div className="bg-white/2 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Rotinas Ativas</p>
          <p className="text-2xl font-black text-emerald-400">{activeRoutines.length}</p>
        </div>
        <div className="bg-white/2 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Última Atividade</p>
          <p className="text-sm font-bold text-white/60 mt-2 truncate">
            {globalLastActivity ? formatDate(globalLastActivity) : 'Sem atividade registrada'}
          </p>
        </div>
      </div>

      {/* Main Command Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        
        {/* Left/Center Column: Agents & Routines */}
        <div className="lg:col-span-8 space-y-12 min-w-0">
          
          {/* Agents List Section */}
          <SafeBlock name="Central de Agentes">
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                  <Server size={14} className="text-blue-400" /> Camada de Inteligência (Agentes)
                </h3>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{agents.length} Agentes</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map(agent => {
                  const routinesList = getAgentRoutines(agent.id, agent.slug || '');
                  const tasksList = getAgentTasks(agent.id, agent.slug || '');
                  const lastAct = getAgentLastActivity(agent);
                  const isBroken = agent.status === 'broken' || agent.status === 'failed' || (agent.status as string) === 'error';
                  const isPaused = agent.status === 'paused';
                  const needsApproval = (agent as any).requiresApproval === true && (agent.status as string) === 'needs_approval';
                  const isIdle = !lastAct;

                  // Define exact badge to show
                  let badgeText = 'Ativo';
                  let badgeClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                  let dotClass = 'bg-emerald-400 animate-pulse';

                  if (isBroken) {
                    badgeText = 'Em falha';
                    badgeClass = 'text-red-500 bg-red-500/10 border-red-500/20';
                    dotClass = 'bg-red-500';
                  } else if (isPaused) {
                    badgeText = 'Pausado';
                    badgeClass = 'text-white/40 bg-white/5 border-white/10';
                    dotClass = 'bg-white/30';
                  } else if (needsApproval) {
                    badgeText = 'Requer aprovação';
                    badgeClass = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
                    dotClass = 'bg-amber-500';
                  } else if (isIdle) {
                    badgeText = 'Sem atividade recente';
                    badgeClass = 'text-amber-400 bg-amber-500/5 border-amber-500/10';
                    dotClass = 'bg-amber-400/50';
                  }

                  return (
                    <div 
                      key={agent.id}
                      onClick={() => setSelectedEntity({ type: 'agent', data: agent })}
                      className="p-6 bg-white/2 border border-white/5 rounded-3xl cursor-pointer hover:bg-white/4 transition-all group relative flex flex-col justify-between min-h-[220px]"
                    >
                      <div>
                        {/* Upper row */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
                              <Server size={18} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-white truncate">{agent.name}</h4>
                              <p className="text-[10px] text-white/40 truncate font-semibold uppercase tracking-widest mt-0.5">{agent.role}</p>
                            </div>
                          </div>
                          
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 ${badgeClass}`}>
                            <div className={`w-1 h-1 rounded-full ${dotClass}`} />
                            {badgeText}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-white/40 mb-6 line-clamp-2 leading-relaxed">
                          {agent.description || 'Nenhuma descrição fornecida para este agente operacional.'}
                        </p>
                      </div>

                      {/* Footer meta row */}
                      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20">
                        <div className="flex items-center gap-4">
                          <span>{routinesList.length} rotinas</span>
                          {tasksList.length > 0 && <span>{tasksList.length} tarefas</span>}
                        </div>
                        <span className="font-bold text-white/40">
                          {lastAct ? formatDate(lastAct) : 'Sem atividade registrada'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </SafeBlock>

          {/* Routines List Section */}
          <SafeBlock name="Central de Rotinas">
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                  <Clock size={14} className="text-emerald-400" /> Rotinas Operacionais dos Agentes
                </h3>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{routines.length} Rotinas</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {routines.map(routine => {
                  const isBroken = routine.status === 'broken' || routine.status === 'failed';
                  const isPaused = routine.status === 'paused';
                  const hasNeverRun = !routine.lastRunAt;
                  const noNext = !routine.nextRunAt;

                  let badgeText = 'Estável';
                  let badgeClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                  let dotClass = 'bg-emerald-400';

                  if (isBroken) {
                    badgeText = 'Em falha';
                    badgeClass = 'text-red-500 bg-red-500/10 border-red-500/20';
                    dotClass = 'bg-red-500';
                  } else if (isPaused) {
                    badgeText = 'Pausado';
                    badgeClass = 'text-white/40 bg-white/5 border-white/10';
                    dotClass = 'bg-white/30';
                  } else if (hasNeverRun) {
                    badgeText = 'Nunca executada';
                    badgeClass = 'text-amber-500 bg-amber-500/5 border-amber-500/10';
                    dotClass = 'bg-amber-500';
                  } else if (noNext) {
                    badgeText = 'Sem próxima execução';
                    badgeClass = 'text-white/30 bg-white/2 border border-white/5';
                    dotClass = 'bg-white/10';
                  }

                  return (
                    <div 
                      key={routine.id}
                      onClick={() => setSelectedEntity({ type: 'routine', data: routine })}
                      className={`p-6 border rounded-3xl transition-all cursor-pointer group flex flex-col justify-between min-h-[200px] ${
                        isBroken ? 'bg-red-500/2 border-red-500/10' : isPaused ? 'bg-white/1 border-white/5' : 'bg-white/2 border-white/5 hover:bg-white/4'
                      }`}
                    >
                      <div>
                        {/* Upper */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl border ${
                              isBroken ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-white/40'
                            }`}>
                              <Clock size={16} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{routine.name}</h4>
                              <p className="text-[10px] text-white/30 mt-0.5">{routine.frequency} • {routine.triggerType}</p>
                            </div>
                          </div>
                          
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 ${badgeClass}`}>
                            <div className={`w-1 h-1 rounded-full ${dotClass}`} />
                            {badgeText}
                          </span>
                        </div>

                        {/* Tool detail if available */}
                        {routine.tool && (
                          <div className="mb-4">
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest border border-white/5 px-2.5 py-1 rounded-xl">
                              Tool: {routine.tool}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Run Info */}
                      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5 text-[10px] text-white/20">
                        <div>
                          <span className="uppercase text-[8px] font-bold tracking-widest text-white/20 block mb-1">Última Execução</span>
                          <span className="text-white/60 font-semibold">{routine.lastRunAt ? formatDate(routine.lastRunAt) : '---'}</span>
                        </div>
                        <div>
                          <span className="uppercase text-[8px] font-bold tracking-widest text-white/20 block mb-1">Esperado</span>
                          <span className="text-white/60 font-semibold truncate block">{routine.outputExpected || 'Log sistêmico'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </SafeBlock>

        </div>

        {/* Right Column: Attention block */}
        <div className="lg:col-span-4 space-y-8 min-w-0">
          
          <SafeBlock name="Atenção dos Agentes">
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle size={18} className="text-amber-500 animate-bounce" />
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-500/80">Atenção dos Agentes</h3>
              </div>

              <div className="space-y-4">
                {topAttentionItems.map(item => {
                  const bgClass = item.severity === 'critical' ? 'bg-red-500/5 border-red-500/10 text-red-400' : 'bg-amber-500/5 border-amber-500/10 text-amber-400';
                  const dotClass = item.severity === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-amber-500';

                  return (
                    <div key={item.id} className={`flex items-start gap-4 p-3 border rounded-2xl ${bgClass}`}>
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
                      <div>
                        <h5 className="text-xs font-bold text-white">{item.title}</h5>
                        <p className="text-[10px] text-white/40 mt-1 leading-normal">{item.subtitle}</p>
                      </div>
                    </div>
                  );
                })}

                {topAttentionItems.length === 0 && (
                  <p className="text-xs text-white/20 italic text-center py-6">
                    Agentes sem bloqueios críticos no momento.
                  </p>
                )}
              </div>
            </div>
          </SafeBlock>

        </div>

      </div>

      {/* STATE-OF-THE-ART INTERACTIVE CUSTOM DRAWER */}
      <AnimatePresence>
        {selectedEntity && (
          <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEntity(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
            />

            {/* Panel */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 210 }}
              className="relative w-full max-w-xl bg-slate-950 border-l border-white/10 h-full overflow-y-auto pointer-events-auto shadow-2xl flex flex-col"
            >
              <div className="p-8 md:p-10 flex-1">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-blue-400">
                      {selectedEntity.type === 'agent' ? <Server size={26} /> : <Clock size={26} />}
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/20">
                        {selectedEntity.type === 'agent' ? 'Ficha Operacional do Agente' : 'Ficha da Rotina'}
                      </span>
                      <h2 className="text-xl font-black text-white mt-0.5">{selectedEntity.data?.name}</h2>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedEntity(null)}
                    className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* --- AGENT DRAWER CONTENT --- */}
                {selectedEntity.type === 'agent' && (() => {
                  const agent = selectedEntity.data;
                  const routinesList = getAgentRoutines(agent.id, agent.slug || '');
                  const tasksList = getAgentTasks(agent.id, agent.slug || '');
                  const requestsList = getAgentRequests(agent.id, agent.slug || '');
                  const logsList = getAgentLogs(agent.id, agent.slug || '').slice(0, 5); // limit to 5 logs

                  return (
                    <div className="space-y-8">
                      {/* Status and Objective */}
                      <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4 text-[10px] uppercase font-bold tracking-widest text-white/20">
                          <span>Status do Sistema</span>
                          <span className="text-white/40">Autonomia</span>
                        </div>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                            <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-xs font-bold text-white capitalize">{agent.status || 'inactive'}</span>
                          </div>
                          
                          <span className="text-xs font-black uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
                            Autonomia: {(agent as any).autonomyLevel || 'Assistida'}
                          </span>
                        </div>

                        <span className="text-[9px] uppercase tracking-widest text-white/20 font-bold block mb-2">Objetivo Operacional</span>
                        <p className="text-xs text-white/60 leading-relaxed italic bg-black/40 p-4 border border-white/5 rounded-2xl">
                          "{agent.description || 'Sem descrição fornecida.'}"
                        </p>
                      </div>

                      {/* Role Details */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <Terminal size={12} />
                          <span>Instruções & Escopo</span>
                        </div>
                        <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4">
                          <div>
                            <span className="text-[9px] text-white/20 block mb-1 font-bold">FUNÇÃO DEFINIDA</span>
                            <span className="text-xs text-white/80 font-semibold">{agent.role || 'Geral'}</span>
                          </div>
                          {agent.systemsUsed && agent.systemsUsed.length > 0 && (
                            <div>
                              <span className="text-[9px] text-white/20 block mb-2 font-bold">SISTEMAS E INTERFACES INTEGRADOS</span>
                              <div className="flex flex-wrap gap-1.5">
                                {agent.systemsUsed.map((sys: string) => (
                                  <span key={sys} className="px-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-white/40 uppercase tracking-widest">
                                    {sys}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {agent.limitations && agent.limitations.length > 0 && (
                            <div>
                              <span className="text-[9px] text-white/20 block mb-2 font-bold">LIMITAÇÕES OPERACIONAIS</span>
                              <ul className="text-xs text-white/40 list-disc pl-4 space-y-1 leading-relaxed">
                                {agent.limitations.map((limit: string) => <li key={limit}>{limit}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Linked Routines list */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <Clock size={12} />
                          <span>Rotinas Vinculadas ({routinesList.length})</span>
                        </div>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                          {routinesList.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/5 transition-all text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Clock size={14} className="text-white/20 shrink-0" />
                                <span className="font-bold text-white truncate">{r.name}</span>
                              </div>
                              <span className="text-[9px] text-white/30 uppercase tracking-widest shrink-0">{r.frequency}</span>
                            </div>
                          ))}
                          {routinesList.length === 0 && (
                            <p className="text-xs text-white/20 italic p-3 text-center bg-white/1 border border-white/5 border-dashed rounded-2xl">
                              Nenhuma rotina associada a este agente.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Linked Tasks list */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <CheckSquare size={12} />
                          <span>Tarefas Ativas Vinculadas ({tasksList.length})</span>
                        </div>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                          {tasksList.map(t => (
                            <div key={t.id} className="flex items-start gap-2.5 p-3 bg-white/2 border border-white/5 rounded-2xl text-xs">
                              <CheckSquare size={14} className="text-amber-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="font-bold text-white leading-normal truncate block">{t.title || t.name}</span>
                                <span className="text-[8px] font-bold text-white/20 uppercase block tracking-wider mt-0.5">Prioridade: {t.priority}</span>
                              </div>
                            </div>
                          ))}
                          {tasksList.length === 0 && (
                            <p className="text-xs text-white/20 italic p-3 text-center bg-white/1 border border-white/5 border-dashed rounded-2xl">
                              Nenhuma tarefa ativa mapeada para este agente.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Recent Bridge Requests list */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <Zap size={12} />
                          <span>Solicitações de Governança Recentes ({requestsList.length})</span>
                        </div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                          {requestsList.slice(0, 5).map(req => {
                            const reqDate = safeConvertToDate(req.requestedAt);
                            return (
                              <div key={req.id} className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-2xl text-xs">
                                <div className="min-w-0">
                                  <span className="font-bold text-white truncate block">{req.title || req.requestType}</span>
                                  <span className="text-[8px] font-bold text-white/20 block uppercase tracking-wider mt-0.5">
                                    {reqDate ? formatDate(reqDate) : '---'}
                                  </span>
                                </div>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 text-white/40 shrink-0">
                                  {req.status}
                                </span>
                              </div>
                            );
                          })}
                          {requestsList.length === 0 && (
                            <p className="text-xs text-white/20 italic p-3 text-center bg-white/1 border border-white/5 border-dashed rounded-2xl">
                              Nenhuma solicitação trafegada pela Requests Bridge.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Agent logs */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <Activity size={12} />
                          <span>Logs Operacionais Recentes</span>
                        </div>
                        <div className="space-y-2">
                          {logsList.map(log => {
                            const logDate = safeConvertToDate(log.createdAt);
                            return (
                              <div key={log.id} className="p-3 bg-white/2 border border-white/5 rounded-2xl text-xs">
                                <p className="text-white/80 font-semibold leading-normal">{log.event}</p>
                                <span className="text-[8px] font-bold text-white/20 uppercase block mt-1">
                                  {logDate ? formatDate(logDate) : ''} • {log.system || 'AGENT'}
                                </span>
                              </div>
                            );
                          })}
                          {logsList.length === 0 && (
                            <p className="text-xs text-white/20 italic p-3 text-center bg-white/1 border border-white/5 border-dashed rounded-2xl">
                              Nenhum log operacional gravado para este agente.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* --- ROUTINE DRAWER CONTENT --- */}
                {selectedEntity.type === 'routine' && (() => {
                  const routine = selectedEntity.data;
                  return (
                    <div className="space-y-8">
                      {/* Status details */}
                      <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4 text-[10px] uppercase font-bold tracking-widest text-white/20">
                          <span>Status da Rotina</span>
                          <span>Frequência</span>
                        </div>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                            <div className={`w-1.5 h-1.5 rounded-full ${routine.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-xs font-bold text-white capitalize">{routine.status || 'inactive'}</span>
                          </div>
                          
                          <span className="text-xs font-bold text-white/60 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                            {routine.frequency || 'N/A'}
                          </span>
                        </div>

                        <span className="text-[9px] uppercase tracking-widest text-white/20 font-bold block mb-2">Descrição & Saída Esperada</span>
                        <p className="text-xs text-white/60 leading-relaxed italic bg-black/40 p-4 border border-white/5 rounded-2xl mb-4">
                          "{routine.description || 'Sem descrição cadastrada.'}"
                        </p>
                        {routine.outputExpected && (
                          <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[10px]">
                            <span className="font-bold text-emerald-400 uppercase tracking-widest block mb-1">Resultado Esperado</span>
                            <p className="text-white/60 leading-normal">{routine.outputExpected}</p>
                          </div>
                        )}
                      </div>

                      {/* Technical Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <Terminal size={12} />
                          <span>Especificações Técnicas</span>
                        </div>
                        <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4">
                          <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                            <span className="text-[9px] text-white/25 font-bold uppercase">GATILHO</span>
                            <span className="text-white/80 font-bold uppercase tracking-wider">{routine.triggerType}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                            <span className="text-[9px] text-white/25 font-bold uppercase">FERRAMENTA</span>
                            <span className="text-white/80 font-bold uppercase tracking-wider">{routine.tool || 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                            <span className="text-[9px] text-white/25 font-bold uppercase">ÚLTIMA EXECUÇÃO</span>
                            <span className="text-white/80 font-bold">{routine.lastRunAt ? formatDate(routine.lastRunAt) : 'Nunca executada'}</span>
                          </div>
                          {routine.nextRunAt && (
                            <div className="flex items-center justify-between py-2 text-xs">
                              <span className="text-[9px] text-white/25 font-bold uppercase">PRÓXIMA EXECUÇÃO</span>
                              <span className="text-emerald-400 font-bold">{formatDate(routine.nextRunAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Risks management */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-black uppercase text-white/30">
                          <AlertCircle size={12} />
                          <span>Gestão de Risco</span>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-5 text-xs">
                          <p className="text-white/60 leading-relaxed italic">
                            {routine.riskSummary || 'Nenhum risco operacional ou técnico reportado para esta rotina.'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 pt-6 border-t border-white/5">
                        <button 
                          onClick={() => handleToggleStatus(routine.id, routine.status === 'paused' ? 'active' : 'paused')}
                          className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/2 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white/40 hover:bg-white/5 hover:text-white transition-all"
                        >
                          {routine.status === 'paused' ? <Play size={14} className="text-emerald-400" /> : <Pause size={14} className="text-amber-500" />}
                          {routine.status === 'paused' ? 'Reativar' : 'Pausar'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
