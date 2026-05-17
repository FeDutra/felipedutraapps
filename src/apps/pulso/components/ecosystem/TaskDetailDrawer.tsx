'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckSquare, Clock, User, Layers, Tag, Archive, 
  CheckCircle2, RotateCcw, AlertCircle, Shield, AlertTriangle, 
  HelpCircle, Link, Key, Info, Ban
} from 'lucide-react';
import { Task, Project, Area, Person, Agent } from '../../types/pulso.types';

interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
  onComplete?: (taskRef: string) => void;
  onArchive?: (taskRef: string) => void;
  onReopen?: (taskRef: string) => void;
  projects?: Project[];
  areas?: Area[];
  people?: Person[];
  agents?: Agent[];
}

const safeFormatDateTime = (val: any) => {
  if (!val) return 'N/A';
  try {
    let d: Date;
    if (typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (val.seconds) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('pt-BR');
  } catch (e) {
    return 'N/A';
  }
};

export const TaskDetailDrawer = ({ 
  task, 
  onClose, 
  onComplete, 
  onArchive, 
  onReopen,
  projects = [],
  areas = [],
  people = [],
  agents = []
}: TaskDetailDrawerProps) => {
  if (!task) return null;

  const safeDate = (val: any): Date | null => {
    if (!val) return null;
    try {
      if (val instanceof Date) return val;
      if (typeof val.toDate === 'function') return val.toDate();
      if (val.seconds) return new Date(val.seconds * 1000);
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch (e) {
      return null;
    }
  };

  const isOverdue = (): boolean => {
    if (task.status === 'completed' || task.archived) return false;
    const targetDate = safeDate(task.dueDate || task.dueAt);
    if (!targetDate) return false;
    return targetDate.getTime() < Date.now();
  };

  const isOwnedByFe = (): boolean => {
    if (!task.ownerRefs || task.ownerRefs.length === 0) return false;
    return task.ownerRefs.some(owner => {
      const o = owner.toLowerCase();
      return o.includes('felipe') || o.includes('fê') || o === 'fe';
    });
  };

  const getStatusBadge = (status?: string, archived?: boolean) => {
    if (archived) return { label: 'Arquivada', color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' };
    switch (status) {
      case 'completed': return { label: 'Concluída', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'in_progress': return { label: 'Em Andamento', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'blocked': return { label: 'Bloqueada', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      default: return { label: 'Aberta / Nova', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high':
      case 'critical': return { label: priority.toUpperCase(), color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      case 'low': return { label: 'LOW', color: 'text-white/40 bg-white/5 border-white/10' };
      default: return { label: 'MEDIUM', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
  };

  const statusBadge = getStatusBadge(task.status, task.archived);
  const priorityBadge = getPriorityBadge(task.priority);
  const isCompleted = task.status === 'completed';
  const isArchived = !!task.archived;

  // Resolve references
  const resolvedProj = projects.find(p => p.id === task.projectRef);
  const resolvedArea = areas.find(a => a.id === task.areaRef);

  const getOwnerName = (ref: string): string => {
    const person = people.find(p => p.id === ref || p.slug === ref);
    if (person) return `${person.name} (Pessoa)`;
    const agent = agents.find(a => a.id === ref || a.slug === ref);
    if (agent) return `${agent.name} (Agente)`;
    return ref;
  };

  // Custom data fields with fallback
  const nextAction = (task as any).nextAction || (task as any).nextStep || '';
  const blockedBy = (task as any).blockedBy || '';
  const blockReason = (task as any).blockReason || '';
  const originTrail = (task as any).originTrail || (task as any).origin || '';
  const notesText = task.notes || task.description || '';

  // Operational Context Analysis
  const gaps: string[] = [];
  if (!task.projectRef) gaps.push('Tarefa órfã de Projeto.');
  if (!task.areaRef) gaps.push('Tarefa não vinculada a nenhuma Área.');
  if (!task.ownerRefs || task.ownerRefs.length === 0) gaps.push('Sem responsável assinalado.');
  if (isOverdue()) gaps.push('Tarefa está com o prazo vencido.');
  if (task.status === 'blocked') gaps.push(`Tarefa bloqueada por: ${blockReason || 'razão não especificada'}.`);

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] w-full max-w-full"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl sm:max-w-md md:max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar shrink-0"
          >
            <div className="p-6 md:p-8 w-full max-w-full min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-8 pb-2 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 ${statusBadge.bg} rounded-2xl flex items-center justify-center border ${statusBadge.border} shrink-0`}>
                    <CheckSquare size={20} className={statusBadge.color} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base md:text-lg font-black text-white truncate">Detalhes da Tarefa</h2>
                    </div>
                    <p className="text-[9px] font-mono text-white/20 mt-0.5 truncate">ID: {task.id}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-6 w-full max-w-full min-w-0">
                
                {/* Meta Pills */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusBadge.bg} ${statusBadge.border} ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest border ${priorityBadge.color}`}>
                    Prioridade: {priorityBadge.label}
                  </span>
                </div>

                {/* --- CONTEXTO OPERACIONAL (DASHBOARD HIGHLIGHT) --- */}
                <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Info size={14} className="text-blue-400 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Contexto Operacional</h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-4 py-1">
                      <span className="text-white/40">Projeto Âncora:</span>
                      <span className="text-white font-bold truncate max-w-[200px]">
                        {resolvedProj ? resolvedProj.name : <span className="text-orange-400 font-black">Sem projeto</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1 border-t border-white/2">
                      <span className="text-white/40">Área Responsável:</span>
                      <span className="text-white font-bold truncate max-w-[200px]">
                        {resolvedArea ? resolvedArea.name : <span className="text-blue-400/60 font-semibold">Sem área</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1 border-t border-white/2">
                      <span className="text-white/40">Responsável Direto:</span>
                      <span className="text-white font-bold truncate max-w-[200px]">
                        {task.ownerRefs && task.ownerRefs.length > 0 ? (
                          getOwnerName(task.ownerRefs[0])
                        ) : (
                          <span className="text-purple-400 font-bold">Sem responsável</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1 border-t border-white/2">
                      <span className="text-white/40">Status de Prazo:</span>
                      <span className="font-bold">
                        {isOverdue() ? (
                          <span className="text-red-400 font-black">⚠️ VENCIDA</span>
                        ) : task.dueDate || task.dueAt ? (
                          <span className="text-emerald-400">Dentro do prazo</span>
                        ) : (
                          <span className="text-white/30">Sem data limite</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Diagnóstico de integridade do cockpit */}
                  {gaps.length > 0 && (
                    <div className="mt-3 p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/80 block">⚠️ Diagnóstico de Governança ({gaps.length})</span>
                      <ul className="space-y-1">
                        {gaps.map((gap, i) => (
                          <li key={i} className="text-[11px] text-white/50 flex items-center gap-1.5 leading-snug">
                            <div className="w-1 h-1 rounded-full bg-amber-500/60 shrink-0" />
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Title & Desc */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Título da Tarefa</label>
                    <p className="text-sm font-bold text-white break-words">{task.title || task.name || 'Sem Título'}</p>
                  </div>

                  {notesText && (
                    <div className="pt-3 border-t border-white/5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Descrição / Notas</label>
                      <p className="text-xs text-white/60 leading-relaxed font-sans break-words whitespace-pre-wrap">
                        {notesText}
                      </p>
                    </div>
                  )}
                </div>

                {/* Próximo Passo & Bloqueios */}
                {(nextAction || blockedBy || blockReason) && (
                  <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                      <Ban size={14} className="text-amber-500 shrink-0" />
                      <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Ação & Impedimentos</h3>
                    </div>

                    {nextAction && (
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Próximo Passo / Ação Imediata</label>
                        <p className="text-xs text-amber-400 font-bold">{nextAction}</p>
                      </div>
                    )}

                    {(blockedBy || blockReason) && (
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        {blockedBy && (
                          <div>
                            <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Bloqueado Por</label>
                            <span className="text-xs font-bold text-red-400 block">{blockedBy}</span>
                          </div>
                        )}
                        {blockReason && (
                          <div>
                            <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Motivo do Bloqueio</label>
                            <p className="text-xs text-white/60 bg-red-500/5 border border-red-500/10 p-3 rounded-xl leading-relaxed">{blockReason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Ancoragem Técnica Completa */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Layers size={14} className="text-blue-400 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Vínculos & Rastreabilidade</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Área de Negócio</label>
                      <span className="text-xs font-bold text-blue-400 truncate block">
                        {resolvedArea ? resolvedArea.name : task.areaRef || 'N/A'}
                      </span>
                      <span className="text-[8px] font-mono text-white/25 truncate block">Ref: {task.areaRef || 'Nenhum'}</span>
                    </div>
                    <div className="min-w-0">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Projeto Vinculado</label>
                      <span className="text-xs font-bold text-emerald-400 truncate block">
                        {resolvedProj ? resolvedProj.name : task.projectRef || 'N/A'}
                      </span>
                      <span className="text-[8px] font-mono text-white/25 truncate block">Ref: {task.projectRef || 'Nenhum'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 min-w-0">
                    <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5">Membros Responsáveis (ownerRefs)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {task.ownerRefs && task.ownerRefs.length > 0 ? (
                        task.ownerRefs.map((owner: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 bg-white/5 rounded-xl text-[9px] font-mono text-white/80 border border-white/5 truncate max-w-full">
                            {getOwnerName(owner)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-white/30 italic">Nenhum proprietário assinalado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Datas & Histórico */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Clock size={14} className="text-purple-400 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Ciclo de Vida e Datas</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block">Criado em</span>
                      <span className="text-white/80 font-mono truncate block">{safeFormatDateTime(task.createdAt)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block">Atualizado em</span>
                      <span className="text-white/60 font-mono truncate block">{safeFormatDateTime(task.updatedAt)}</span>
                    </div>
                    <div className="min-w-0 pt-2 border-t border-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block">Prazo (DueDate)</span>
                      <span className={`font-mono font-bold truncate block ${isOverdue() ? 'text-red-400' : 'text-amber-400'}`}>
                        {safeFormatDateTime(task.dueDate || task.dueAt)}
                      </span>
                    </div>
                    <div className="min-w-0 pt-2 border-t border-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block">Concluído em</span>
                      <span className="text-emerald-400 font-mono truncate block">
                        {task.completedAt ? safeFormatDateTime(task.completedAt) : 'Pendente'}
                      </span>
                    </div>
                  </div>

                  {originTrail && (
                    <div className="pt-2 border-t border-white/5 text-[9px] font-mono text-white/40 space-y-0.5">
                      <p className="truncate flex items-center gap-1">
                        <Key size={10} className="text-white/20" />
                        <span>Origem / Rastro: {originTrail}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Discreta Seção de Manutenção / Ações Operacionais */}
                <div className="pt-4 border-t border-white/5 space-y-2 w-full max-w-full">
                  <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Ações Rápidas do Cockpit</label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {onComplete && !isCompleted && !isArchived && (
                      <button 
                        onClick={() => onComplete(task.id)}
                        className="py-2.5 px-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 transition-all flex flex-col items-center justify-center gap-1 shrink-0"
                      >
                        <CheckCircle2 size={12} />
                        <span>Concluir</span>
                      </button>
                    )}

                    {onReopen && (isCompleted || isArchived) && (
                      <button 
                        onClick={() => onReopen(task.id)}
                        className="py-2.5 px-1 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-blue-300 hover:bg-blue-500/20 transition-all flex flex-col items-center justify-center gap-1 shrink-0"
                      >
                        <RotateCcw size={12} />
                        <span>Reabrir</span>
                      </button>
                    )}

                    {onArchive && !isArchived && (
                      <button 
                        onClick={() => onArchive(task.id)}
                        className="py-2.5 px-1 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-1 shrink-0"
                      >
                        <Archive size={12} />
                        <span>Arquivar</span>
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={onClose}
                    className="w-full py-2.5 bg-white/2 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all mt-2"
                  >
                    Fechar Painel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
