'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  pulsoService, 
  areasService, 
  routinesService, 
  agentsService, 
  healthService,
  tasksService
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { ontologyHelpers } from '../utils/ontologyHelpers';
import { PulsoHeader } from '../components/BaseComponents';
import { PulseRadar } from '../components/PulseRadar';
import { 
  StateCard, 
  AreaPulseCard, 
  AttentionSignalList, 
  RecentMovementList, 
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
  Clock 
} from 'lucide-react';

// Safe array helper
const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

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
        const allLogs = await healthService.getLogs(5).catch(e => { console.error(e); return []; });
        const allAreas = await areasService.getAll().catch(e => { console.error(e); return []; });
        
        setState({
          ...dashboardState,
          allRoutines: safeArray(allRoutines),
          allAgents: safeArray(allAgents),
          allLogs: safeArray(allLogs),
          allAreas: safeArray(allAreas)
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

  // Pre-extract collections with strict array guarantees
  const activeAlerts = safeArray(state?.activeAlerts);
  const activeProjects = safeArray(state?.activeProjects);
  const openTasks = safeArray(state?.openTasks);
  const pendingInbox = safeArray(state?.pendingInbox);
  const allAreas = safeArray(state?.allAreas);
  const allRoutines = safeArray(state?.allRoutines);
  const allAgents = safeArray(state?.allAgents);
  const allLogs = safeArray(state?.allLogs);

  // Generate Radar Blips safely
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
    if (!refs || !Array.isArray(refs) || refs.length === 0) return true;
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
                colorClass="text-amber-400"
              />
              <StateCard 
                title="Projetos Vivos" 
                value={activeProjects.length} 
                subtitle="Frentes em movimento" 
                icon={Layers} 
                colorClass="text-blue-400"
              />
              <StateCard 
                title="Depende do Fe" 
                value={feTasks.length} 
                subtitle="Tarefas ativas para você" 
                icon={CheckSquare} 
                colorClass="text-emerald-400"
              />
              <StateCard 
                title="Riscos & Travas" 
                value={activeAlerts.length} 
                subtitle="Sinais que pedem atenção" 
                icon={AlertCircle} 
                colorClass="text-red-500"
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
            <AttentionSignalList 
              alerts={activeAlerts} 
              brokenRoutines={ontologyHelpers.getBrokenRoutines(allRoutines)} 
            />
          </SafeBlock>

          {/* New secondary Block: Depende do Fê */}
          {feTasks.length > 0 && (
            <SafeBlock name="Lista de Tarefas do Fê">
              <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-amber-400" />
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
                        <CheckSquare size={14} className="text-amber-400 mt-0.5 shrink-0" />
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
            <RecentMovementList 
              logs={allLogs} 
            />
          </SafeBlock>

          <SafeBlock name="Registro da Lótus Link">
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                 <Activity size={20} className="text-white/40" />
              </div>
              <h4 className="text-sm font-bold text-white mb-2">Registro da Lótus</h4>
              <p className="text-[10px] text-white/40 mb-4 px-4 leading-relaxed">
                Veja as últimas percepções, rascunhos e ações realizadas.
              </p>
              <button 
                onClick={() => router.push('/pulso/inbox')}
                className="w-full py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-500/20 transition-all backdrop-blur-sm flex items-center justify-center gap-2 group animate-pulse"
              >
                Abrir Registro
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </SafeBlock>
        </div>

      </div>
    </div>
  );
}
