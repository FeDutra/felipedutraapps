'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Server, Clock, Shield, Activity, 
  Database, Terminal, AlertCircle, Play, 
  Pause, RefreshCw, Layers, ExternalLink 
} from 'lucide-react';
import { Agent, Routine, RoutineRun, Alert, Log } from '../../types/pulso.types';
import { getStatusLabel } from '../../utils/statusHelpers';

export const SystemDetailDrawer = ({ 
  type, 
  data, 
  onClose,
  onAction
}: { 
  type: 'agent' | 'routine' | null, 
  data: any | null, 
  onClose: () => void,
  onAction?: (id: string, action: string) => void
}) => {
  if (!type || !data) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"
        />

        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-xl bg-slate-950 border-l border-white/10 h-full overflow-y-auto pointer-events-auto shadow-2xl flex flex-col"
        >
          <div className="p-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-blue-400">
                  {type === 'agent' ? <Server size={28} /> : <Clock size={28} />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{type === 'agent' ? 'Agente' : 'Rotina Operacional'}</p>
                  <h2 className="text-2xl font-black text-white">{data.name}</h2>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Status Row */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Status do Sistema</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${data.status === 'active' ? 'bg-emerald-500' : data.status === 'broken' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-bold text-white/80 capitalize">{data.status}</span>
                </div>
              </div>
              <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Prioridade / Risco</p>
                <div className="flex items-center gap-2">
                   <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{data.priority}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-12">
               <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4">Objetivo Operacional</p>
               <p className="text-sm text-white/60 leading-relaxed bg-white/2 p-6 rounded-3xl border border-white/5 italic">
                 "{data.description}"
               </p>
            </div>

            {/* Tech Metadata */}
            <div className="space-y-8">
              {type === 'agent' && (
                <>
                  <MetaGroup title="Função e Sistemas" icon={Terminal}>
                    <div className="grid grid-cols-1 gap-2">
                      <MetaItem label="Organização" value={data.role} />
                      <MetaItem label="Sistemas" value={data.systemsUsed?.join(', ') || 'Nenhum'} />
                    </div>
                  </MetaGroup>

                  <MetaGroup title="Capacidades e Limites" icon={Shield}>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[9px] font-black text-white/20 uppercase mb-2">Inputs Aceitos</p>
                        <div className="flex flex-wrap gap-2">
                          {data.inputTypes?.map((t: string) => <Tag key={t}>{t}</Tag>) || <span className="text-xs text-white/20 italic">Nenhum definido</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-white/20 uppercase mb-2">Limitações Conhecidas</p>
                        <ul className="text-xs text-white/40 space-y-1 list-disc pl-4">
                          {data.limitations?.map((l: string) => <li key={l}>{l}</li>) || <li>Nenhuma limitação reportada.</li>}
                        </ul>
                      </div>
                    </div>
                  </MetaGroup>
                </>
              )}

              {type === 'routine' && (
                <>
                  <MetaGroup title="Configuração de Gatilho" icon={Activity}>
                    <div className="grid grid-cols-1 gap-2">
                      <MetaItem label="Frequência" value={data.frequency} />
                      <MetaItem label="Gatilho" value={data.triggerType} />
                      <MetaItem label="Ferramenta" value={data.tool} />
                    </div>
                  </MetaGroup>

                  <MetaGroup title="Gestão de Risco" icon={AlertCircle}>
                    <p className="text-xs text-white/40 leading-relaxed italic">
                      {data.riskSummary || 'Nenhum risco crítico mapeado para esta rotina.'}
                    </p>
                  </MetaGroup>

                  <div className="flex items-center gap-3 pt-6 border-t border-white/5">
                    <button 
                      onClick={() => onAction?.(data.id, data.status === 'paused' ? 'resume' : 'pause')}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/2 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
                    >
                      {data.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                      {data.status === 'paused' ? 'Reativar' : 'Pausar'}
                    </button>
                    <button 
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all"
                    >
                      <RefreshCw size={14} />
                      Executar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const MetaGroup = ({ title, icon: Icon, children }: any) => (
  <div>
    <div className="flex items-center gap-2 mb-4 px-2">
      <Icon size={14} className="text-white/20" />
      <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30">{title}</h5>
    </div>
    <div className="bg-white/2 border border-white/5 rounded-3xl p-6">
      {children}
    </div>
  </div>
);

const MetaItem = ({ label, value }: { label: string, value: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-[10px] text-white/20 font-bold uppercase">{label}</span>
    <span className="text-xs text-white/60 font-medium">{value}</span>
  </div>
);

const Tag = ({ children }: any) => (
  <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-white/40 uppercase tracking-widest">
    {children}
  </span>
);
