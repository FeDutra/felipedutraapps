'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  pulsoService, 
  areasService, 
  routinesService, 
  agentsService, 
  healthService,
  tasksService,
  requestsService
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { ontologyHelpers } from '../utils/ontologyHelpers';
import { PulsoHeader } from '../components/BaseComponents';
import { PulseRadar } from '../components/PulseRadar';
import { 
  StateCard, 
  AreaPulseCard, 
  MetabolismPreview 
} from '../components/DashboardCards';
import { 
  AlertCircle, 
  Inbox, 
  Layers, 
  CheckSquare, 
  Activity, 
  ArrowRight, 
  User, 
  Clock,
  ChevronRight
} from 'lucide-react';
import { formatDate, truncateText } from '../utils/formatters';

// Safe array helper
const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Safe date/time helper for Firestore Timestamp, string or Date
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

// Safe converter to JS Date or null
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
        <div className="p-5 border border-dashed border-red-500/20 rounded-3xl bg-red-500/5 backdrop-blur-sm flex flex-col items-center justify-center text-center">
          <AlertCircle size={20} className="text-red-400 mb-2" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400">Não foi possível carregar este bloco</h4>
          <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{this.props.name}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CockpitPage() {
  const router = useRouter();
  const [state, setState] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        // Ensure authentication is ready before any Firestore call
        await authService.ensurePulsoAuthReady();
        
        const dashboardState = await pulsoService.getDashboardState();
        const allRoutines = await routinesService.getAll().catch(e => { console.error(e); return []; });
        const allAgents = await agentsService.getAll().catch(e => { console.error(e); return []; });
        const allLogs = await healthService.getLogs(15).catch(e => { console.error(e); return []; }); // Fetch more logs for operational filtering
        const allAreas = await areasService.getAll().catch(e => { console.error(e); return []; });
        const allRequests = await requestsService.getRequests(15).catch(e => { console.error(e); return []; });
        
        setState({
          ...dashboardState,
          allRoutines: safeArray(allRoutines),
          allAgents: safeArray(allAgents),
          allLogs: safeArray(allLogs),
          allAreas: safeArray(allAreas),
          allRequests: safeArray(allRequests)
        });
      } catch (err: any) {
        console.error('Dashboard load error:', err);
        setError(err?.message || 'Erro desconhecido ao sintonizar ecossistema.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
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

  // Pre-extract collections with strict array guarantees and client-side soft filters
  const activeAlerts = safeArray(state?.activeAlerts).filter((a: any) => a && a.archived !== true);
  const activeProjects = safeArray(state?.activeProjects).filter((p: any) => p && p.archived !== true);
  const openTasks = safeArray(state?.openTasks).filter((t: any) => t && t.archived !== true);
  const pendingInbox = safeArray(state?.pendingInbox).filter((i: any) => i && i.archived !== true);
  const allAreas = safeArray(state?.allAreas).filter((a: any) => a && a.archived !== true && a.status === 'active');
  const allRoutines = safeArray(state?.allRoutines).filter((r: any) => r && r.archived !== true);
  const allAgents = safeArray(state?.allAgents).filter((ag: any) => ag && ag.archived !== true);
  const allLogs = safeArray(state?.allLogs);

  // --- CALCULATION OF RISKS & TRAVAS AND SINAIS DE ATENÇÃO ---
  // 1. Open Alerts
  const openAlertsList = activeAlerts.filter((a: any) => a && a.status === 'open');

  // 2. Broken/Failed Routines
  const brokenRoutinesList = allRoutines.filter((r: any) => r && (r.status === 'broken' || r.status === 'failed'));

  // 3. Overdue active tasks
  const nowTime = Date.now();
  const overdueTasksList = openTasks.filter((t: any) => {
    if (!t || t.status === 'completed' || t.archived === true) return false;
    const due = t.dueDate || t.dueAt;
    if (!due) return false;
    const dueTime = safeGetTime(due);
    return dueTime > 0 && dueTime < nowTime;
  });

  // 4. Active tasks without ownerRefs
  const unownedTasksList = openTasks.filter((t: any) => {
    if (!t || t.status === 'completed' || t.archived === true) return false;
    const refs = t.ownerRefs;
    return !refs || !Array.isArray(refs) || refs.length === 0;
  });

  // 5. Active projects without nextStep
  const stepLessProjectsList = activeProjects.filter((p: any) => {
    if (!p || p.status !== 'active' || p.archived === true) return false;
    return !p.nextStep || typeof p.nextStep !== 'string' || p.nextStep.trim() === '';
  });

  // Consolidated count
  const totalRisksCount = 
    openAlertsList.length + 
    brokenRoutinesList.length + 
    overdueTasksList.length + 
    unownedTasksList.length + 
    stepLessProjectsList.length;

  // Build unified priority-ordered list of Attention Signals
  const attentionSignals: Array<{ id: string; type: string; title: string; subtitle: string; severity: 'critical' | 'warning' }> = [];

  // Order 1: Critical open alerts
  openAlertsList.forEach((a: any) => {
    attentionSignals.push({
      id: a.id || `alert-sig-${Math.random()}`,
      type: 'alert',
      title: a.name || 'Alerta Ativo',
      subtitle: a.description || 'Instabilidade operacional de sistema.',
      severity: a.severity === 'critical' ? 'critical' : 'warning'
    });
  });

  // Order 2: Broken routines
  brokenRoutinesList.forEach((r: any) => {
    attentionSignals.push({
      id: r.id || `routine-sig-${Math.random()}`,
      type: 'routine',
      title: `Rotina em Falha: ${r.name || 'Sem nome'}`,
      subtitle: 'Batimento interrompido ou falha na execução recente.',
      severity: 'warning'
    });
  });

  // Order 3: Overdue tasks
  overdueTasksList.forEach((t: any) => {
    attentionSignals.push({
      id: t.id || `task-overdue-sig-${Math.random()}`,
      type: 'task_overdue',
      title: `Prazo Expirado: ${t.title || t.name || 'Tarefa'}`,
      subtitle: `Expirou em: ${t.dueDate || t.dueAt ? formatDate(t.dueDate || t.dueAt) : 'data desconhecida'}.`,
      severity: 'critical'
    });
  });

  // Order 4: Tasks without owners
  unownedTasksList.forEach((t: any) => {
    attentionSignals.push({
      id: t.id || `task-unowned-sig-${Math.random()}`,
      type: 'task_unowned',
      title: `Tarefa Sem Responsável: ${t.title || t.name || 'Tarefa'}`,
      subtitle: 'Tarefa ativa precisa de dono no ecossistema.',
      severity: 'warning'
    });
  });

  // Order 5: Projects without nextStep
  stepLessProjectsList.forEach((p: any) => {
    attentionSignals.push({
      id: p.id || `project-stepless-sig-${Math.random()}`,
      type: 'project_stepless',
      title: `Projeto Travado: ${p.name || 'Projeto'}`,
      subtitle: 'Projeto ativo sem próximo passo configurado.',
      severity: 'warning'
    });
  });

  const topAttentionSignals = attentionSignals.slice(0, 3); // showing maximum of 3 signals

  // --- CALCULATION OF MOVIMENTO RECENTE (HUMAN OPERATIONAL FEED) ---
  // 1. Map Inbox items to human actions
  const inboxEvents = pendingInbox.map((item: any) => ({
    id: item.id || `inbox-evt-${Math.random()}`,
    event: `Lótus registrou ${item.type || 'sinal'}: ${item.name || truncateText(item.body || '', 35)}`,
    system: 'LÓTUS / INBOX',
    time: safeConvertToDate(item.createdAt || item.updatedAt)
  }));

  // 2. Map Requests to human actions
  const requestEvents = safeArray(state?.allRequests)
    .filter((req: any) => req && req.archived !== true)
    .map((req: any) => {
      let desc = '';
      const type = req.requestType || '';
      const title = req.title || req.summary || '';
      
      switch (req.status) {
        case 'requested':
          desc = `Solicitada ação: ${title || type}`;
          break;
        case 'needs_approval':
          desc = `Aguardando sua aprovação: ${title || type}`;
          break;
        case 'needs_clarification':
          desc = `Aguardando esclarecimento: ${title || type}`;
          break;
        case 'completed':
          desc = `Concluída solicitação: ${title || type}`;
          break;
        case 'failed':
          desc = `Falhou solicitação: ${title || type}`;
          break;
        default:
          desc = `Solicitação em estado ${req.status}: ${title || type}`;
      }

      return {
        id: req.id || `req-evt-${Math.random()}`,
        event: desc,
        system: 'LÓTUS / BRIDGE',
        time: safeConvertToDate(req.requestedAt || req.updatedAt)
      };
    });

  // 3. Fallback Logs (filter out technical infrastructure noise)
  const systemLogs = allLogs
    .filter((log: any) => {
      if (!log || !log.event) return false;
      const text = log.event.toLowerCase();
      if (text.includes('user login') || text.includes('seed applied') || text.includes('firebase project') || text.includes('auth gate')) {
        return false;
      }
      return true;
    })
    .map((log: any) => ({
      id: log.id || `log-evt-${Math.random()}`,
      event: log.event,
      system: log.system || 'PULSO / HEALTH',
      time: safeConvertToDate(log.createdAt)
    }));

  // Combine and sort by date descending
  const unifiedMovement = [...inboxEvents, ...requestEvents, ...systemLogs]
    .filter(e => e.time !== null)
    .sort((a, b) => {
      const timeA = a.time ? a.time.getTime() : 0;
      const timeB = b.time ? b.time.getTime() : 0;
      return timeB - timeA;
    });

  // Fallback strictly to complete logs in case of total vacuum, filtered to avoid empty slots
  const finalLogsToExhibit = unifiedMovement.length > 0 
    ? unifiedMovement.slice(0, 5) 
    : allLogs.map((log: any) => ({
        id: log.id || `fallback-log-${Math.random()}`,
        event: log.event || 'Ação operacional registrada',
        system: log.system || 'SISTEMA',
        time: safeConvertToDate(log.createdAt)
      })).slice(0, 5);

  // Radar Blips Plot
  const radarBlips = [
    // Alerts (Red)
    ...activeAlerts.map((a: any, i: number) => ({
      id: a?.id || `alert-${i}`,
      angle: 45 + (i * 30),
      distance: 80,
      color: 'bg-red-500',
      label: `ALERT: ${a?.name || 'Alerta'}`
    })),
    // Projects (Blue)
    ...activeProjects.slice(0, 4).map((p: any, i: number) => ({
      id: p?.id || `proj-${i}`,
      angle: 180 + (i * 40),
      distance: 60,
      color: 'bg-blue-400',
      label: `PROJ: ${p?.name || 'Projeto'}`
    })),
    // Critical Areas (Emerald)
    ...ontologyHelpers.getCriticalAreas(allAreas).map((a: any, i: number) => ({
      id: a?.id || `area-${i}`,
      angle: 280 + (i * 20),
      distance: 40,
      color: 'bg-emerald-400',
      label: `AREA: ${a?.name || 'Área'}`
    }))
  ];

  // Calculate Felipe Tasks safely
  const feTasks = openTasks.filter((t: any) => {
    if (!t || t.status === 'completed' || t.archived === true) return false;
    const refs = t.ownerRefs;
    if (!refs || !Array.isArray(refs) || refs.length === 0) return true; // Default fallback if no owners
    return refs.includes('felipe') || refs.includes('Felipe');
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full max-w-full min-w-0">
      <PulsoHeader 
        title="Campo Vivo" 
        subtitle="Central viva do ecossistema de Felipe Dutra"
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-full min-w-0">
        
        {/* Left Column: Stats & Radar */}
        <div className="lg:col-span-4 space-y-8 min-w-0">
          <SafeBlock name="Cards de Estado">
            <div className="grid grid-cols-2 gap-4">
              <StateCard 
                title="Ações da Lótus" 
                value={pendingInbox.length} 
                subtitle="Aguardando sua decisão" 
                icon={Inbox} 
                colorClass="text-[#dfcfbc]"
              />
              <StateCard 
                title="Projetos Vivos" 
                value={activeProjects.length} 
                subtitle="Frentes em movimento" 
                icon={Layers} 
                colorClass="text-[#b8c6d4]"
              />
              <StateCard 
                title="Depende do Fe" 
                value={feTasks.length} 
                subtitle="Tarefas ativas para você" 
                icon={CheckSquare} 
                colorClass="text-[#a5b5a2]"
              />
              <StateCard 
                title="Riscos & Travas" 
                value={totalRisksCount} 
                subtitle="Alertas, falhas e atrasos" 
                icon={AlertCircle} 
                colorClass="text-[#e89083]"
              />
            </div>
          </SafeBlock>

          <SafeBlock name="Radar Operacional">
            <div className="bg-white/2 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px]">
               <div className="text-center mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">O que está vivo agora</h3>
                  <p className="text-xs text-white/50 mt-1">Radar operacional em tempo real</p>
               </div>
               <PulseRadar blips={radarBlips} />
            </div>
          </SafeBlock>
        </div>

        {/* Center Column: Attention, Felipe Tasks & Areas Map */}
        <div className="lg:col-span-5 space-y-8 min-w-0">
          <SafeBlock name="Sinais de Atenção">
            <div className="bg-[#d81842]/5 border border-[#d81842]/15 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertCircle size={18} className="text-[#e89083]" />
                <h3 className="text-sm font-black uppercase tracking-widest text-[#e89083]/80">Sinais de Atenção</h3>
              </div>
              
              <div className="space-y-4">
                {topAttentionSignals.map((sig) => {
                  const bgClass = sig.severity === 'critical' ? 'bg-[#d81842]/5 border-[#d81842]/15' : 'bg-[#cbb291]/5 border-[#cbb291]/15';
                  const dotClass = sig.severity === 'critical' ? 'bg-[#d81842] shadow-[0_0_8px_rgba(216, 24, 66,0.4)]' : 'bg-[#cbb291]';
                  
                  return (
                    <div key={sig.id} className={`flex items-start gap-4 p-3 rounded-xl border ${bgClass}`}>
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
                      <div>
                        <h5 className="text-xs font-bold text-white/90">{sig.title}</h5>
                        <p className="text-[10px] text-white/40 mt-0.5">{sig.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
                {topAttentionSignals.length === 0 && (
                  <p className="text-xs text-white/20 italic text-center py-4">Nenhum risco crítico no momento.</p>
                )}
              </div>
            </div>
          </SafeBlock>

          {/* New secondary Block: Depende do Fê */}
          {feTasks.length > 0 && (
            <SafeBlock name="Lista de Tarefas do Fê">
              <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-[#dfcfbc]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Depende do Fê</h3>
                  </div>
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    {feTasks.length} Tarefas
                  </span>
                </div>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {feTasks.slice(0, 5).map((t: any, idx: number) => {
                    const safeId = t?.id || `task-${idx}`;
                    const title = t?.title || t?.name || 'Tarefa sem nome';
                    return (
                      <div key={safeId} className="flex items-start gap-3 p-3 bg-white/2 hover:bg-white/5 border border-white/5 rounded-2xl transition-all">
                        <CheckSquare size={14} className="text-[#dfcfbc] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white leading-tight truncate">{title}</p>
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/20">
                            Prioridade: {t?.priority || 'média'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SafeBlock>
          )}

          <SafeBlock name="Mapa da Operação">
            <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Mapa da Operação</h3>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Total {allAreas.length} Áreas</span>
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {allAreas.map((area: any) => (
                  <AreaPulseCard 
                    key={area?.id || Math.random().toString()} 
                    area={area} 
                    projectsCount={ontologyHelpers.getProjectsByArea(activeProjects, area?.id).length}
                    alertsCount={ontologyHelpers.getAlertsByArea(activeAlerts, area?.id).length}
                  />
                ))}
              </div>
            </div>
          </SafeBlock>
        </div>

        {/* Right Column: Metabolism & Movement */}
        <div className="lg:col-span-3 space-y-8 min-w-0">
          <SafeBlock name="Metabolismo">
            <MetabolismPreview 
              agents={allAgents} 
              routines={allRoutines} 
            />
          </SafeBlock>
          
          <SafeBlock name="Movimento Recente">
            <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Activity size={18} className="text-white/40" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Movimento Recente</h3>
              </div>
              
              <div className="space-y-4">
                {finalLogsToExhibit.map((log) => {
                  const timeText = log.time ? formatDate(log.time) : '';
                  return (
                    <div key={log.id} className="flex items-center justify-between group cursor-default">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
                          <Activity size={14} className="text-white/40" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white/80 truncate">{log.event}</p>
                          <p className="text-[9px] text-white/20 font-medium uppercase tracking-wider">
                            {log.system} {timeText ? `• ${timeText}` : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/10 group-hover:text-white/40 transition-colors shrink-0" />
                    </div>
                  );
                })}
                {finalLogsToExhibit.length === 0 && (
                  <p className="text-xs text-white/20 italic text-center py-4">Sem movimento operacional recente.</p>
                )}
              </div>
            </div>
          </SafeBlock>

          <SafeBlock name="Registro da Lótus Link">
            <div className="bg-white/2 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                 <Activity size={20} className="text-white/40" />
              </div>
              <h4 className="text-sm font-bold text-white mb-2">Registro da Lótus</h4>
              <p className="text-[10px] text-white/40 mb-4 px-4 leading-relaxed">
                Veja as últimas percepções, rascunhos e ações realizadas.
              </p>
              <button 
                onClick={() => router.push('/pulso/inbox')}
                className="w-full py-3 bg-white/10 border border-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm flex items-center justify-center gap-2 group cursor-pointer outline-none"
              >
                <span>Abrir Registro</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </SafeBlock>
        </div>

      </div>
    </div>
  );
}
