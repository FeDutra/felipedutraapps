'use client';

import React from 'react';
import { routinesService } from '../services/routinesService';
import { agentsService, healthService } from '../services/pulsoService';
import { Agent, Routine } from '../types/pulso.types';
import { AgentCard, RoutineCard } from '../components/system/SystemCards';
import { SystemDetailDrawer } from '../components/system/SystemDetailDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Clock, Activity, Play, 
  Pause, AlertCircle, RefreshCw, Zap 
} from 'lucide-react';

export default function MetabolismPage() {
  const [loading, setLoading] = React.useState(true);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [selectedEntity, setSelectedEntity] = React.useState<{ type: 'agent' | 'routine', data: any } | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [allAgents, allRoutines] = await Promise.all([
        agentsService.getAll(),
        routinesService.getAll()
      ]);
      setAgents(allAgents);
      setRoutines(allRoutines);
    } catch (error) {
      console.error('Error loading metabolism data:', error);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'paused') await routinesService.pause(id);
    else await routinesService.resume(id);
    loadData();
  };

  const activeAgents = agents.filter(a => a.status === 'active');
  const activeRoutines = routines.filter(r => r.status === 'active');
  const brokenRoutines = routines.filter(r => r.status === 'broken');

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Sintonizando Metabolismo</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Metabolismo</h1>
          <p className="text-sm text-white/40 max-w-lg">
            Gestão dos agentes, rotinas e crons que mantêm o ecossistema ÉDEN em movimento e sincronia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            className="p-4 bg-white/2 border border-white/5 rounded-2xl text-white/40 hover:bg-white/5 transition-all"
          >
            <RefreshCw size={18} />
          </button>
          <button className="px-6 py-4 bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
            <Zap size={14} /> Novo Agente
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-white/2 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Agentes Ativos</p>
          <p className="text-2xl font-black text-white">{activeAgents.length}</p>
        </div>
        <div className="bg-white/2 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Rotinas Ativas</p>
          <p className="text-2xl font-black text-emerald-400">{activeRoutines.length}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500/40 mb-2">Falhas Críticas</p>
          <p className="text-2xl font-black text-red-500">{brokenRoutines.length}</p>
        </div>
        <div className="bg-white/2 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Total Execuções (24h)</p>
          <p className="text-2xl font-black text-white">128</p>
        </div>
      </div>

      <div className="space-y-16">
        {/* Agents Section */}
        <section>
          <div className="flex items-center justify-between mb-8 px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Server size={14} /> Camada de Inteligência (Agentes)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onClick={() => setSelectedEntity({ type: 'agent', data: agent })} 
              />
            ))}
          </div>
        </section>

        {/* Routines Section */}
        <section>
          <div className="flex items-center justify-between mb-8 px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Clock size={14} /> Rotinas Operacionais
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routines.map(routine => (
              <RoutineCard 
                key={routine.id} 
                routine={routine} 
                onToggleStatus={handleToggleStatus}
                onClick={() => setSelectedEntity({ type: 'routine', data: routine })}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Detail Drawer */}
      <SystemDetailDrawer 
        type={selectedEntity?.type || null}
        data={selectedEntity?.data || null}
        onClose={() => setSelectedEntity(null)}
        onAction={(id, action) => {
          if (action === 'pause' || action === 'resume') handleToggleStatus(id, action);
        }}
      />
    </div>
  );
}
