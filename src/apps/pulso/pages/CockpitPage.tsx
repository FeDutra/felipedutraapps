'use client';

import React from 'react';
import { 
  pulsoService, 
  areasService, 
  routinesService, 
  agentsService, 
  healthService 
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
import { AlertCircle, Inbox, Layers, CheckSquare, Activity, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * @file CockpitPage.tsx
 * @description Main entry for the PULSO cockpit (Campo Vivo).
 */

export default function CockpitPage() {
  const router = useRouter();
  const [state, setState] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        // Ensure auth is ready before any Firestore calls
        await authService.ensurePulsoAuthReady();
        
        const dashboardState = await pulsoService.getDashboardState();
        const allRoutines = await routinesService.getAll();
        const allAgents = await agentsService.getAll();
        const allLogs = await healthService.getLogs(5);
        const allAreas = await areasService.getAll();
        
        setState({
          ...dashboardState,
          allRoutines,
          allAgents,
          allLogs,
          allAreas
        });
      } catch (err: any) {
        console.error('Dashboard load error:', err);
        setError(err.message || 'Erro desconhecido ao sintonizar ecossistema.');
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
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Sintonizando Ecossistema</p>
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

  // Generate Radar Blips
  const radarBlips = [
    // Alerts (Red)
    ...state.activeAlerts.map((a: any, i: number) => ({
      id: a.id,
      angle: 45 + (i * 30),
      distance: 80,
      color: 'bg-red-500',
      label: `ALERT: ${a.name}`
    })),
    // Projects (Blue)
    ...state.activeProjects.slice(0, 4).map((p: any, i: number) => ({
      id: p.id,
      angle: 180 + (i * 40),
      distance: 60,
      color: 'bg-blue-400',
      label: `PROJ: ${p.name}`
    })),
    // Critical Areas (Emerald)
    ...ontologyHelpers.getCriticalAreas(state.allAreas).map((a: any, i: number) => ({
      id: a.id,
      angle: 280 + (i * 20),
      distance: 40,
      color: 'bg-emerald-400',
      label: `AREA: ${a.name}`
    }))
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <PulsoHeader title="Campo Vivo" />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Stats & Radar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <StateCard 
              title="Ações da Lótus" 
              value={state.pendingInbox.length} 
              subtitle="Aguardando sua decisão" 
              icon={Inbox} 
              colorClass="text-amber-400"
            />
            <StateCard 
              title="Projetos Vivos" 
              value={state.activeProjects.length} 
              subtitle="Frentes em movimento" 
              icon={Layers} 
              colorClass="text-blue-400"
            />
            <StateCard 
              title="Depende do Fe" 
              value={state.openTasks.length} 
              subtitle="Tarefas ativas para você" 
              icon={CheckSquare} 
              colorClass="text-emerald-400"
            />
            <StateCard 
              title="Riscos & Travas" 
              value={state.activeAlerts.length} 
              subtitle="Sinais que pedem atenção" 
              icon={AlertCircle} 
              colorClass="text-red-500"
            />
          </div>

          <div className="bg-white/2 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px]">
             <div className="text-center mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">O que está vivo agora</h3>
                <p className="text-xs text-white/50 mt-1">Radar operacional em tempo real</p>
             </div>
             <PulseRadar blips={radarBlips} />
          </div>
        </div>

        {/* Center Column: Attention & Areas */}
        <div className="lg:col-span-5 space-y-8">
          <AttentionSignalList 
            alerts={state.activeAlerts} 
            brokenRoutines={ontologyHelpers.getBrokenRoutines(state.allRoutines)} 
          />

          <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/30">Mapa da Operação</h3>
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Total {state.allAreas.length} Áreas</span>
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {state.allAreas.map((area: any) => (
                <AreaPulseCard 
                  key={area.id} 
                  area={area} 
                  projectsCount={ontologyHelpers.getProjectsByArea(state.activeProjects, area.id).length}
                  alertsCount={ontologyHelpers.getAlertsByArea(state.activeAlerts, area.id).length}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Metabolism & Movement */}
        <div className="lg:col-span-3 space-y-8">
          <MetabolismPreview 
            agents={state.allAgents} 
            routines={state.allRoutines} 
          />
          
          <RecentMovementList 
            logs={state.allLogs} 
          />

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
              className="w-full py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-500/20 transition-all backdrop-blur-sm flex items-center justify-center gap-2 group"
            >
              Abrir Registro
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
