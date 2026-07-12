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
 * @file DashboardPage.tsx
 * @description Main entry for the PULSO cockpit.
 */

export default function DashboardPage() {
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
      <PulsoHeader />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Stats & Radar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <StateCard 
              title="Inbox Pendente" 
              value={state.pendingInbox.length} 
              subtitle="Registros aguardando triagem" 
              icon={Inbox} 
              colorClass="text-amber-400"
            />
            <StateCard 
              title="Projetos Ativos" 
              value={state.activeProjects.length} 
              subtitle="Frentes em movimento" 
              icon={Layers} 
              colorClass="text-blue-400"
            />
            <StateCard 
              title="Tarefas Abertas" 
              value={state.openTasks.length} 
              subtitle="Itens de execução" 
              icon={CheckSquare} 
              colorClass="text-emerald-400"
            />
            <StateCard 
              title="Alertas Críticos" 
              value={state.activeAlerts.length} 
              subtitle="Sinais pedem atenção" 
              icon={AlertCircle} 
              colorClass="text-red-500"
            />
          </div>

          <div className="py-6 flex flex-col items-center justify-center min-h-[380px]">
             <div className="text-center mb-6">
                <h3 className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">Estado Radial</h3>
                <p className="text-xs text-white/40 mt-1">Visão sistêmica do ecossistema</p>
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

          <div className="py-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-mono tracking-[0.2em] text-white/30 uppercase">Áreas em Pulso</h3>
              <span className="text-[9px] font-mono tracking-widest text-white/20 uppercase">Total {state.allAreas.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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

          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 flex items-center justify-center mb-3">
               <Activity size={16} strokeWidth={1} className="text-white/30" />
            </div>
            <h4 className="text-xs font-light text-white mb-1 uppercase tracking-wider">Novo Registro</h4>
            <p className="text-[10px] text-white/40 mb-4 px-4 leading-relaxed">
              Capture uma tarefa, semente ou decisão instantaneamente.
            </p>
            <button 
              onClick={() => router.push('/pulso/inbox')}
              className="w-full py-2.5 text-blue-400/80 hover:text-white text-xs font-mono tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-2 group cursor-pointer"
            >
              Abrir Inbox
              <ArrowRight size={12} strokeWidth={1} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
