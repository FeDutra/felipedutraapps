'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertCircle, 
  CheckSquare, 
  Activity, 
  Inbox,
  ShieldAlert,
  Cpu,
  Clock,
  User,
  Briefcase,
  AlertTriangle,
  Play,
  CheckCircle2,
  ListTodo
} from 'lucide-react';

import { 
  areasService, 
  projectsService,
  tasksService,
  requestsService,
  agentsService,
  routinesService,
  healthService,
  eventsService
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { PulsoHeader } from '../components/BaseComponents';
import { Task, Project, PulsoRequest, Agent, Routine, Alert, PulsoEvent } from '../types/pulso.types';

export default function CockpitPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // States
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [requests, setRequests] = React.useState<PulsoRequest[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [events, setEvents] = React.useState<PulsoEvent[]>([]);

  React.useEffect(() => {
    async function load() {
      try {
        await authService.ensurePulsoAuthReady();
        
        // Fetch all needed datasets directly
        const [
          allTasks, 
          allProjects, 
          allRequests, 
          allAgents, 
          allRoutines, 
          allAlerts,
          allEvents
        ] = await Promise.all([
          tasksService.getAll(),
          projectsService.getAll(),
          requestsService.getRequests(100, false),
          agentsService.getAll(),
          routinesService.getAll(),
          healthService.getAlerts(),
          eventsService.getRecent(100)
        ]);
        
        setTasks(Array.isArray(allTasks) ? allTasks : []);
        setProjects(Array.isArray(allProjects) ? allProjects : []);
        setRequests(Array.isArray(allRequests) ? allRequests : []);
        setAgents(Array.isArray(allAgents) ? allAgents : []);
        setRoutines(Array.isArray(allRoutines) ? allRoutines : []);
        setAlerts(Array.isArray(allAlerts) ? allAlerts : []);
        setEvents(Array.isArray(allEvents) ? allEvents : []);

      } catch (err: any) {
        console.error('Cockpit load error:', err);
        setError(err.message || 'Erro ao carregar ecossistema vivo.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Sintonizando Campo Vivo</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Falha na Sintonização</h2>
        <p className="text-sm text-white/40 max-w-sm mb-8 leading-relaxed">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  // --- DERIVED COMPUTATIONS ---

  // 1. Depende do Fê
  const dependeDoFeItems: any[] = [];
  
  // Tasks (no owner or owned by felipe + open)
  const feTasks = tasks.filter(t => 
    t && !t.archived && 
    t.status !== 'completed' && 
    (!t.ownerRefs || !Array.isArray(t.ownerRefs) || t.ownerRefs.length === 0 || t.ownerRefs.includes('felipe') || t.ownerRefs.includes('Felipe'))
  );
  feTasks.forEach(t => dependeDoFeItems.push({ type: 'task', id: t.id, title: t.title || t.name, detail: 'Tarefa sob sua guarda', urgency: isPast(t.dueAt || t.dueDate || new Date(9999,11,31)) ? 'high' : 'medium', raw: t }));

  // Requests (needs_approval or needs_clarification)
  const pendingRequests = requests.filter(r => r && !r.archived && (r.status === 'needs_approval' || r.status === 'needs_clarification'));
  pendingRequests.forEach(r => dependeDoFeItems.push({ type: 'request', id: r.id, title: r.title, detail: `Aguardando ${r.status === 'needs_approval' ? 'Aprovação' : 'Clarificação'}`, urgency: 'high', raw: r }));

  // Alerts (critical/high open)
  const criticalAlerts = alerts.filter(a => a && !a.archived && a.status === 'open' && (a.severity === 'critical' || a.severity === 'high'));
  criticalAlerts.forEach(a => dependeDoFeItems.push({ type: 'alert', id: a.id, title: a.name, detail: 'Alerta Operacional Crítico', urgency: 'critical', raw: a }));

  // Sort Depende do Fê by urgency (critical > high > medium)
  dependeDoFeItems.sort((a, b) => {
    const val = { critical: 3, high: 2, medium: 1 };
    return (val[b.urgency as keyof typeof val] || 0) - (val[a.urgency as keyof typeof val] || 0);
  });

  const getSafeTime = (date: any) => {
    if (!date) return 0;
    try {
      const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch {
      return 0;
    }
  };

  // 2. Ações recentes da Lótus
  const lotusEvents = events
    .filter(e => e && !e.archived && (e.origin === 'openclaw' || e.actorType === 'agent'))
    .sort((a, b) => getSafeTime(b.createdAt) - getSafeTime(a.createdAt))
    .slice(0, 5);
    
  const lotusRequests = requests
    .filter(r => r && !r.archived && r.status === 'completed' && r.processedBy === 'system')
    .sort((a, b) => getSafeTime(b.updatedAt) - getSafeTime(a.updatedAt))
    .slice(0, 3);

  // 3. Projetos em movimento
  const activeProjects = projects.filter(p => p && !p.archived && p.status === 'active');
  const projectTasksMap = tasks.reduce((acc, t) => { if (!t) return acc;
    if (!t.archived && t.status !== 'completed' && t.projectRef) {
      acc[t.projectRef] = (acc[t.projectRef] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // 4. Tarefas críticas
  const openTasks = tasks.filter(t => t && !t.archived && t.status !== 'completed');
  const criticalTasks = openTasks
    .filter(t => t && (t.priority === 'critical' || t.priority === 'high' || (t.dueDate && isPast(t.dueDate))))
    .sort((a, b) => {
      const timeA = a.dueDate ? getSafeTime(a.dueDate) : 9999999999999;
      const timeB = b.dueDate ? getSafeTime(b.dueDate) : 9999999999999;
      return timeA - timeB;
    })
    .slice(0, 6);

  // 5. Agentes em operação
  const activeAgents = agents.filter(a => a && !a.archived && a.status === 'active');
  const activeRoutines = routines.filter(r => r && !r.archived && r.status === 'active');
  const failingRoutines = routines.filter(r => r && !r.archived && r.status === 'broken');

  // 6. Riscos reais
  const risks: any[] = [];
  agents.filter(a => a && (a.status === 'paused' || a.status === 'broken')).forEach(a => risks.push({ type: 'agent', label: 'Agente Inativo/Falho', desc: a.name || 'Sem nome' }));
  failingRoutines.forEach(r => risks.push({ type: 'routine', label: 'Rotina Falhando', desc: r.name || 'Sem nome' }));
  activeProjects.filter(p => p && !p.nextStep).forEach(p => risks.push({ type: 'project', label: 'Projeto sem Próximo Passo', desc: p.name || 'Sem nome' }));
  const oldRequests = requests.filter(r => r && !r.archived && r.status === 'running');
  oldRequests.forEach(r => risks.push({ type: 'request', label: 'Request Travado', desc: r.title || 'Sem título' }));


  // Formatter and Date helpers
  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch {
      return '';
    }
  };

  const isPast = (date: any) => {
    if (!date) return false;
    try {
      const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
      return d.getTime() < Date.now();
    } catch {
      return false;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full max-w-full min-w-0">
      <PulsoHeader 
        title="Campo Vivo" 
        subtitle="O estado real da operação entre Fê, Lótus e os projetos em movimento."
      />

      {/* Faixa superior de síntese */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <User size={16} className="text-amber-400" />
            <span className="text-2xl font-black text-amber-400 font-mono leading-none">{dependeDoFeItems.length}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 leading-tight">Depende do Fê</span>
        </div>
        
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <Activity size={16} className="text-purple-400" />
            <span className="text-2xl font-black text-purple-400 font-mono leading-none">{lotusEvents.length + lotusRequests.length}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-500/60 leading-tight">Ações Lótus</span>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <Briefcase size={16} className="text-blue-400" />
            <span className="text-2xl font-black text-blue-400 font-mono leading-none">{activeProjects.length}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/60 leading-tight">Projetos Vivos</span>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <CheckSquare size={16} className="text-emerald-400" />
            <span className="text-2xl font-black text-emerald-400 font-mono leading-none">{openTasks.length}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 leading-tight">Tarefas Abertas</span>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <ShieldAlert size={16} className="text-red-400" />
            <span className="text-2xl font-black text-red-400 font-mono leading-none">{risks.length}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-red-500/60 leading-tight">Riscos / Travas</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <Cpu size={16} className="text-white/60" />
            <span className="text-2xl font-black text-white/60 font-mono leading-none">{activeAgents.length}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-tight">Agentes Ativos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full max-w-full min-w-0">
        
        {/* COLUNA ESQUERDA (Maior foco em urgência: Depende do Fê e Tarefas) */}
        <div className="xl:col-span-8 space-y-6 w-full max-w-full min-w-0">
          
          {/* BLOCO: Depende do Fê */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <User size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest truncate">Depende do Fê</h2>
                <p className="text-[10px] text-amber-500/60 truncate">Decisão, aprovação ou execução.</p>
              </div>
            </div>
            
            {dependeDoFeItems.length === 0 ? (
               <div className="text-center py-6 border border-dashed border-amber-500/20 rounded-2xl">
                 <p className="text-xs text-amber-500/60 font-bold">Nenhum gargalo de decisão.</p>
               </div>
            ) : (
              <div className="space-y-3">
                {dependeDoFeItems.slice(0, 10).filter(Boolean).map((item, idx) => (
                  <div key={`${item.type}-${item.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 bg-white/5 border border-white/5 hover:border-amber-500/30 transition-colors rounded-2xl cursor-pointer group w-full min-w-0">
                    <div className="hidden sm:block pt-0.5 shrink-0">
                      {item.type === 'task' ? <CheckSquare size={16} className="text-emerald-400" /> : 
                       item.type === 'request' ? <Inbox size={16} className="text-blue-400" /> :
                       <AlertCircle size={16} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 mb-1 sm:hidden">
                        {item.type === 'task' ? <CheckSquare size={14} className="text-emerald-400" /> : 
                         item.type === 'request' ? <Inbox size={14} className="text-blue-400" /> :
                         <AlertCircle size={14} className="text-red-400" />}
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                          {item.type}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate break-words leading-tight">{item.title || 'Sem título'}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border whitespace-nowrap ${
                          item.urgency === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          item.urgency === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-white/5 text-white/40 border-white/10'
                        }`}>
                          {item.detail}
                        </span>
                        <span className="text-[10px] text-white/30 truncate hidden sm:inline">
                          ID: {item.id ? item.id.substring(0, 6) : '---'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOCO: Projetos em Movimento */}
          <div className="bg-white/2 border border-white/5 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Briefcase size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">Projetos em Movimento</h2>
                <p className="text-[10px] text-white/40 truncate">Frentes de trabalho vivas.</p>
              </div>
            </div>

            {activeProjects.length === 0 ? (
               <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                 <p className="text-xs text-white/40 italic">Nenhum projeto ativo no momento.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeProjects.filter(Boolean).map(p => (
                  <div key={p.id} className="p-4 bg-white/5 border border-white/5 hover:border-blue-500/30 transition-colors rounded-2xl cursor-pointer flex flex-col justify-between w-full min-w-0">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="text-sm font-black text-white line-clamp-2 leading-tight break-words">{p.name}</h4>
                        {projectTasksMap[p.id] ? (
                           <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                             {projectTasksMap[p.id]} tarefas
                           </span>
                        ) : null}
                      </div>
                    </div>
                    {p.nextStep ? (
                      <p className="text-xs text-emerald-400/80 line-clamp-2 mt-3 leading-relaxed flex items-start gap-1.5">
                        <Play size={10} className="mt-0.5 shrink-0" />
                        <span className="break-words">{p.nextStep}</span>
                      </p>
                    ) : (
                      <div className="mt-3">
                        <span className="text-[9px] text-amber-500/60 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded inline-block font-black uppercase tracking-widest whitespace-nowrap">
                          Sem próximo passo
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOCO: Tarefas Críticas */}
          <div className="bg-white/2 border border-white/5 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ListTodo size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">Tarefas Críticas</h2>
                <p className="text-[10px] text-white/40 truncate">Alta prioridade ou vencidas.</p>
              </div>
            </div>

            {criticalTasks.length === 0 ? (
               <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                 <p className="text-xs text-white/40 italic">Sem tarefas críticas no radar.</p>
               </div>
            ) : (
              <div className="space-y-3">
                {criticalTasks.filter(Boolean).map(t => (
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-emerald-500/30 transition-colors group cursor-pointer w-full min-w-0">
                    <div className="min-w-0 flex-1 w-full">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors break-words leading-tight">{t.title || t.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border whitespace-nowrap ${
                          t.priority === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {t.priority}
                        </span>
                        {(!t.ownerRefs || t.ownerRefs.length === 0) && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 whitespace-nowrap">Sem Dono</span>
                        )}
                        {!t.projectRef && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-white/10 text-white/40 border-white/10 whitespace-nowrap">Sem Projeto</span>
                        )}
                      </div>
                    </div>
                    {t.dueDate && (
                      <div className="text-[10px] flex items-center gap-1.5 text-white/40 shrink-0">
                        <Clock size={12} />
                        <span className={isPast(t.dueDate) ? 'text-red-400 font-bold whitespace-nowrap' : 'whitespace-nowrap'}>
                          {formatDate(t.dueDate)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 text-center">
              <button 
                onClick={() => router.push('/pulso/tarefas')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
              >
                Ir para Central de Tarefas →
              </button>
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA (Contexto: Lotus, Riscos, Agentes) */}
        <div className="xl:col-span-4 space-y-6 w-full max-w-full min-w-0">
          
          {/* BLOCO: O que a Lótus fez */}
          <div className="bg-white/2 border border-white/5 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Activity size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">Ações da Lótus</h2>
                <p className="text-[10px] text-white/40 truncate">Movimentação recente.</p>
              </div>
            </div>

            {lotusEvents.length === 0 && lotusRequests.length === 0 ? (
               <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                 <p className="text-xs text-white/40 italic">Nenhum rastro recente.</p>
               </div>
            ) : (
              <div className="space-y-5">
                {lotusRequests.filter(Boolean).map(r => (
                  <div key={`req-${r.id}`} className="relative pl-5 border-l border-purple-500/30">
                    <div className="absolute -left-1 top-1.5 w-2 h-2 rounded-full bg-purple-400" />
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">{formatDate(r.updatedAt || r.requestedAt)}</p>
                    <h5 className="text-xs font-bold text-white leading-snug break-words">{r.title}</h5>
                    <p className="text-[10px] text-emerald-400 font-bold mt-1">Request Completado</p>
                  </div>
                ))}
                {lotusEvents.filter(Boolean).map(e => (
                  <div key={`evt-${e.id}`} className="relative pl-5 border-l border-white/10">
                    <div className="absolute -left-1 top-1.5 w-2 h-2 rounded-full bg-white/20" />
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">{formatDate(e.createdAt)}</p>
                    <h5 className="text-xs font-bold text-white/80 leading-snug break-words">{e.payloadSummary || 'Evento de Sistema'}</h5>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">[{e.eventType}]</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 text-center pt-2 border-t border-white/5">
              <button 
                onClick={() => router.push('/pulso/inbox')}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors"
              >
                Abrir Registro da Lótus →
              </button>
            </div>
          </div>

          {/* BLOCO: Riscos Reais */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-red-400 uppercase tracking-widest truncate">Riscos Reais</h2>
                <p className="text-[10px] text-red-500/60 truncate">Travas operacionais.</p>
              </div>
            </div>

            {risks.length === 0 ? (
               <div className="text-center py-8 border border-dashed border-red-500/10 rounded-2xl bg-red-500/5">
                 <CheckCircle2 size={32} className="mx-auto text-emerald-500/50 mb-3" />
                 <p className="text-xs text-emerald-400/80 font-bold">Operação Saudável</p>
                 <p className="text-[10px] text-white/30 mt-1">Nenhum risco detectado.</p>
               </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {risks.filter(Boolean).map((r, i) => (
                  <div key={i} className="p-3 bg-red-500/10 border border-red-500/10 rounded-xl">
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1.5 block whitespace-nowrap">
                      {r.label}
                    </span>
                    <p className="text-xs text-white/80 leading-snug break-words">{r.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOCO: Agentes em Operação */}
          <div className="bg-white/2 border border-white/5 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 shrink-0">
                <Cpu size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">Agentes</h2>
                <p className="text-[10px] text-white/40 truncate">{activeAgents.length} ativos, {activeRoutines.length} rotinas.</p>
              </div>
            </div>

            {agents.length === 0 ? (
               <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl">
                 <p className="text-xs text-white/40 italic">Sem agentes registrados.</p>
               </div>
            ) : (
              <div className="space-y-2">
                {agents.filter(Boolean).map(a => {
                  const agentRoutines = routines.filter(r => Array.isArray(r.agentRefs) && r.agentRefs.includes(a.id));
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl min-w-0">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'active' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
                        <span className="text-xs font-bold text-white truncate">{a.name}</span>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono shrink-0">{agentRoutines.length} rotinas</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-5 text-center pt-2 border-t border-white/5">
              <button 
                onClick={() => router.push('/pulso/metabolismo')}
                className="text-[10px] uppercase tracking-widest font-black text-white/40 hover:text-white transition-colors"
              >
                Gerenciar Agentes
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
