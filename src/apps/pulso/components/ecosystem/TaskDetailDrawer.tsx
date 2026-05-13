'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckSquare, Clock, User, Layers, Tag, Archive, CheckCircle2, RotateCcw, HelpCircle, Code } from 'lucide-react';
import { Task } from '../../types/pulso.types';

interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
  onComplete?: (taskRef: string) => void;
  onArchive?: (taskRef: string) => void;
  onReopen?: (taskRef: string) => void;
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
    return d.toLocaleString();
  } catch (e) {
    return 'N/A';
  }
};

export const TaskDetailDrawer = ({ task, onClose, onComplete, onArchive, onReopen }: TaskDetailDrawerProps) => {
  if (!task) return null;

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

                {/* Title & Desc */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Título da Tarefa</label>
                    <p className="text-base font-bold text-white break-words">{task.title || task.name || 'Sem Título'}</p>
                  </div>

                  {(task.description || task.notes) && (
                    <div className="pt-2 border-t border-white/5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Descrição / Notas</label>
                      <p className="text-xs text-white/60 leading-relaxed font-sans break-words whitespace-pre-wrap">
                        {task.description || task.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Context / Ancoragem */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Layers size={14} className="text-blue-400 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Ancoragem de Negócio</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Área (areaRef)</label>
                      <span className="text-xs font-mono font-bold text-blue-400 truncate block">
                        {task.areaRef || 'N/A'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-0.5">Projeto (projectRef)</label>
                      <span className="text-xs font-mono font-bold text-emerald-400 truncate block">
                        {task.projectRef || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 min-w-0">
                    <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Responsáveis (ownerRefs)</label>
                    <div className="flex flex-wrap gap-1">
                      {task.ownerRefs && task.ownerRefs.length > 0 ? (
                        task.ownerRefs.map((owner: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-mono text-white/80 border border-white/5 truncate max-w-full">
                            {owner}
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

                  <div className="grid grid-cols-2 gap-3 text-xs">
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
                      <span className="text-amber-400/90 font-mono truncate block">{safeFormatDateTime(task.dueDate)}</span>
                    </div>
                    <div className="min-w-0 pt-2 border-t border-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block">Concluído em</span>
                      <span className="text-emerald-400 font-mono truncate block">{task.completedAt ? safeFormatDateTime(task.completedAt) : 'Pendente'}</span>
                    </div>
                  </div>

                  {((task as any).origin || (task as any).requestId) && (
                    <div className="pt-2 border-t border-white/5 text-[9px] font-mono text-white/40 space-y-0.5">
                      {(task as any).origin && <p className="truncate">Origem: {(task as any).origin}</p>}
                      {(task as any).requestId && <p className="truncate">ReqID: {(task as any).requestId}</p>}
                    </div>
                  )}
                </div>

                {/* Discreta Seção de Manutenção / Ações Operacionais */}
                <div className="pt-4 border-t border-white/5 space-y-2 w-full max-w-full">
                  <label className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Manutenção e Ações Rápidas</label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {onComplete && !isCompleted && !isArchived && (
                      <button 
                        onClick={() => onComplete(task.id)}
                        className="py-2 px-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 transition-all flex flex-col items-center justify-center gap-1 shrink-0"
                      >
                        <CheckCircle2 size={12} />
                        <span>Concluir</span>
                      </button>
                    )}

                    {onReopen && (isCompleted || isArchived) && (
                      <button 
                        onClick={() => onReopen(task.id)}
                        className="py-2 px-1 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-blue-300 hover:bg-blue-500/20 transition-all flex flex-col items-center justify-center gap-1 shrink-0"
                      >
                        <RotateCcw size={12} />
                        <span>Reabrir</span>
                      </button>
                    )}

                    {onArchive && !isArchived && (
                      <button 
                        onClick={() => onArchive(task.id)}
                        className="py-2 px-1 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-1 shrink-0"
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
