'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Activity, Shield, Users, Layers, MessageSquare, Info, AlertTriangle } from 'lucide-react';
import { areasService, projectsService, sourcesService, peopleService, requestsService } from '../../services/pulsoService';
import { Area, Project, Source, Person, RequestType, Priority } from '../../types/pulso.types';

interface AgentRequestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AgentRequestDrawer = ({ isOpen, onClose, onSuccess }: AgentRequestDrawerProps) => {
  const [loading, setLoading] = React.useState(false);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [sources, setSources] = React.useState<Source[]>([]);
  
  const [formData, setFormData] = React.useState({
    name: '',
    areaRef: '',
    projectRef: '',
    mission: '',
    inputs: '',
    outputs: '',
    sourceRefs: [] as string[],
    autonomy: 'L1',
    cadence: 'Daily',
    notes: '',
    risk: ''
  });

  React.useEffect(() => {
    if (isOpen) {
      Promise.all([
        areasService.getAll(),
        projectsService.getAll(),
        sourcesService.getAll()
      ]).then(([a, p, s]) => {
        setAreas(a);
        setProjects(p);
        setSources(s);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestsService.createRequest({
        requestType: 'create_agent',
        title: `Solicitação: Novo Agente - ${formData.name}`,
        summary: formData.mission,
        status: 'requested',
        priority: 'medium',
        areaRef: formData.areaRef,
        projectRef: formData.projectRef || null,
        requestedBy: 'user_felipe', 
        payload: {
          provisionalName: formData.name,
          mission: formData.mission,
          inputs: formData.inputs || null,
          outputs: formData.outputs || null,
          sourceRefs: formData.sourceRefs.length > 0 ? formData.sourceRefs : null,
          autonomyLevel: formData.autonomy,
          cadence: formData.cadence || null,
          notes: formData.notes || null,
          riskAssessment: formData.risk || null
        }
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating agent request:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <Zap size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Solicitar Novo Agente</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">Camada de Inteligência Lótus</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Nome Provisório</label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
                        placeholder="Ex: Agente de Auditoria Financeira"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Área</label>
                      <select 
                        required
                        value={formData.areaRef}
                        onChange={e => setFormData({ ...formData, areaRef: e.target.value })}
                        className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="">Selecionar Área</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Projeto (Opcional)</label>
                      <select 
                        value={formData.projectRef}
                        onChange={e => setFormData({ ...formData, projectRef: e.target.value })}
                        className="w-full bg-white/2 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="">Selecionar Projeto</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Missão do Agente</label>
                    <textarea 
                      required
                      value={formData.mission}
                      onChange={e => setFormData({ ...formData, mission: e.target.value })}
                      className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white h-32 resize-none focus:border-blue-500/50 outline-none transition-all"
                      placeholder="O que este agente deve resolver no ecossistema?"
                    />
                  </div>
                </div>

                {/* Operation Details */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1 flex items-center gap-2">
                        <Info size={12} className="text-blue-400" /> Entradas Típicas
                      </label>
                      <input 
                        value={formData.inputs}
                        onChange={e => setFormData({ ...formData, inputs: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                        placeholder="Ex: Planilhas, E-mails"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1 flex items-center gap-2">
                        <Zap size={12} className="text-emerald-400" /> Saídas Esperadas
                      </label>
                      <input 
                        value={formData.outputs}
                        onChange={e => setFormData({ ...formData, outputs: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                        placeholder="Ex: Relatórios, Tarefas"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Autonomia (L0-L4)</label>
                      <select 
                        value={formData.autonomy}
                        onChange={e => setFormData({ ...formData, autonomy: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="L0">L0 - Manual Assistido</option>
                        <option value="L1">L1 - Sugestão Automática</option>
                        <option value="L2">L2 - Execução com Confirmação</option>
                        <option value="L3">L3 - Autônomo com Relato</option>
                        <option value="L4">L4 - Autônomo Pleno</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Cadência Desejada</label>
                      <input 
                        value={formData.cadence}
                        onChange={e => setFormData({ ...formData, cadence: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                        placeholder="Ex: Daily 08:00, Real-time"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk & Notes */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-red-500/40 ml-1 flex items-center gap-2">
                      <AlertTriangle size={12} /> Risco se fizer errado
                    </label>
                    <input 
                      value={formData.risk}
                      onChange={e => setFormData({ ...formData, risk: e.target.value })}
                      className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl px-6 py-4 text-sm text-red-200 focus:border-red-500/50 outline-none transition-all"
                      placeholder="O que pode quebrar se o agente falhar?"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap size={14} /> Solicitar Agente
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
