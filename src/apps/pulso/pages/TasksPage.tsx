'use client';

import React from 'react';
import { tasksService } from '../services/tasksService';
import { authService } from '../../../shared/services/authService';
import { requestsService } from '../services/requestsService';
import { Task } from '../types/pulso.types';
import { motion } from 'framer-motion';
import { 
  CheckSquare, Clock, Plus, Search, Filter, Layers, 
  Tag, Archive, CheckCircle2, RotateCcw, AlertCircle, 
  ChevronRight, Calendar
} from 'lucide-react';
import { TaskDetailDrawer } from '../components/ecosystem/TaskDetailDrawer';

export default function TasksPage() {
  const [loading, setLoading] = React.useState(true);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = React.useState<'open' | 'completed' | 'archived' | 'all'>('open');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      // Load all tasks (including archived) into state for lightning fast responsive client side filtering
      const allTasks = await tasksService.getAll(true);
      setTasks(allTasks);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError('Falha ao carregar tarefas. Verifique permissões do Firestore ou autenticação.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle actions via Requests Bridge contract
  const handleComplete = async (taskRef: string) => {
    try {
      setFeedbackMsg('Enviando intenção para concluir tarefa...');
      const target = tasks.find(t => t.id === taskRef);
      await requestsService.createRequest({
        requestType: 'complete_task',
        title: `Concluir Tarefa: ${target?.title || target?.name || taskRef}`,
        status: 'requested',
        priority: 'medium',
        requestedBy: 'user_cockpit',
        payload: {
          taskRef,
          reason: 'Conclusão manual via Cockpit PULSO.'
        }
      });
      // Optimistic local update
      setTasks(prev => prev.map(t => t.id === taskRef ? { ...t, status: 'completed', completedAt: new Date() } : t));
      if (selectedTask?.id === taskRef) {
        setSelectedTask(prev => prev ? { ...prev, status: 'completed', completedAt: new Date() } : null);
      }
      setFeedbackMsg('Solicitação de conclusão registrada com sucesso na ponte!');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (e: any) {
      console.error(e);
      setError('Erro ao registrar intenção operacional na Requests Bridge.');
    }
  };

  const handleArchive = async (taskRef: string) => {
    try {
      setFeedbackMsg('Enviando intenção para arquivar tarefa...');
      const target = tasks.find(t => t.id === taskRef);
      await requestsService.createRequest({
        requestType: 'archive_task',
        title: `Arquivar Tarefa: ${target?.title || target?.name || taskRef}`,
        status: 'requested',
        priority: 'medium',
        requestedBy: 'user_cockpit',
        payload: {
          taskRef,
          reason: 'Arquivamento manual via Cockpit PULSO.'
        }
      });
      setTasks(prev => prev.map(t => t.id === taskRef ? { ...t, archived: true } : t));
      if (selectedTask?.id === taskRef) {
        setSelectedTask(prev => prev ? { ...prev, archived: true } : null);
      }
      setFeedbackMsg('Solicitação de arquivamento registrada na ponte!');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (e: any) {
      console.error(e);
      setError('Erro ao registrar intenção operacional na Requests Bridge.');
    }
  };

  const handleReopen = async (taskRef: string) => {
    try {
      setFeedbackMsg('Enviando intenção para reabrir tarefa...');
      const target = tasks.find(t => t.id === taskRef);
      await requestsService.createRequest({
        requestType: 'update_task',
        title: `Reabrir Tarefa: ${target?.title || target?.name || taskRef}`,
        status: 'requested',
        priority: 'medium',
        requestedBy: 'user_cockpit',
        payload: {
          taskRef,
          patch: {
            status: 'in_progress',
            completedAt: null,
            archived: false
          },
          reason: 'Reabertura manual via Cockpit PULSO.'
        }
      });
      setTasks(prev => prev.map(t => t.id === taskRef ? { ...t, status: 'in_progress', completedAt: undefined, archived: false } : t));
      if (selectedTask?.id === taskRef) {
        setSelectedTask(prev => prev ? { ...prev, status: 'in_progress', completedAt: undefined, archived: false } : null);
      }
      setFeedbackMsg('Solicitação de reabertura registrada na ponte!');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (e: any) {
      console.error(e);
      setError('Erro ao registrar intenção operacional na Requests Bridge.');
    }
  };

  // Filtering logic
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      // Status filtering logic
      const isArchived = !!task.archived;
      const isCompleted = task.status === 'completed';

      if (statusFilter === 'open') {
        if (isArchived || isCompleted) return false;
      } else if (statusFilter === 'completed') {
        if (isArchived || !isCompleted) return false;
      } else if (statusFilter === 'archived') {
        if (!isArchived) return false;
      } else if (statusFilter === 'all') {
        // Show everything including archived
      }

      // Priority Filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // Search term filtering
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const tTitle = (task.title || task.name || '').toLowerCase();
        const tDesc = (task.description || task.notes || '').toLowerCase();
        const tArea = (task.areaRef || '').toLowerCase();
        const tProj = (task.projectRef || '').toLowerCase();
        if (!tTitle.includes(q) && !tDesc.includes(q) && !tArea.includes(q) && !tProj.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const tsA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const tsB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return tsB - tsA; // newest first
    });
  }, [tasks, statusFilter, priorityFilter, searchTerm]);

  const priorities = ['all', 'high', 'medium', 'low'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full max-w-full min-w-0">
      {/* Dynamic Feedback Banner */}
      {feedbackMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 text-xs text-blue-300 font-bold"
        >
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span>{feedbackMsg}</span>
        </motion.div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-300 font-mono">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
              <CheckSquare size={16} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">Central de Tarefas</h1>
          </div>
          <p className="text-xs md:text-sm text-white/40 max-w-lg">
            Acompanhamento operacional, rastreabilidade e intenções de tarefas vivas do ecossistema.
          </p>
        </div>

        {/* Global Task Counters */}
        <div className="flex items-center gap-2 bg-white/2 p-2 rounded-2xl border border-white/5 self-start md:self-auto overflow-x-auto max-w-full shrink-0">
          <div className="px-3 py-1 text-center min-w-[70px]">
            <span className="block text-[8px] font-black uppercase tracking-widest text-white/20">Abertas</span>
            <span className="text-xs font-black text-amber-400 font-mono">
              {tasks.filter(t => !t.archived && t.status !== 'completed').length}
            </span>
          </div>
          <div className="px-3 py-1 text-center border-l border-white/5 min-w-[70px]">
            <span className="block text-[8px] font-black uppercase tracking-widest text-white/20">Concluídas</span>
            <span className="text-xs font-black text-emerald-400 font-mono">
              {tasks.filter(t => !t.archived && t.status === 'completed').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters Bar with multi-chip native horizontal flex-scrolling (zero viewport bloat) */}
      <div className="space-y-4 mb-8 w-full max-w-full min-w-0">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white/2 p-3 rounded-3xl border border-white/5 w-full">
          
          {/* Status chips bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 lg:pb-0 w-full lg:w-auto shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mr-1 hidden sm:inline shrink-0">Status:</span>
            {[
              { id: 'open', label: 'Abertas' },
              { id: 'completed', label: 'Concluídas' },
              { id: 'archived', label: 'Arquivadas' },
              { id: 'all', label: 'Todas' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 ${
                  statusFilter === tab.id 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 font-bold' 
                    : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Priority chips bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 lg:pb-0 w-full lg:w-auto shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 pt-2 lg:pt-0 lg:pl-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mr-1 shrink-0">Prioridade:</span>
            {priorities.map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 ${
                  priorityFilter === p 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {p === 'all' ? 'Todas' : p}
              </button>
            ))}
          </div>

          {/* Input Search Box */}
          <div className="relative w-full lg:w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input 
              type="text"
              placeholder="Buscar título, área ou projeto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Task List Layout */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white/2 border border-white/5 rounded-3xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-white/2 border border-white/5 rounded-3xl p-8">
          <CheckSquare size={32} className="mx-auto text-white/10 mb-3" />
          <p className="text-sm font-bold text-white/40">Nenhuma tarefa correspondente aos filtros</p>
          <p className="text-xs text-white/20 mt-1">
            {statusFilter === 'open' ? 'Escondendo tarefas arquivadas e concluídas por padrão.' : 'Tente alterar os termos de busca ou filtros.'}
          </p>
          {statusFilter !== 'all' && (
            <button 
              onClick={() => setStatusFilter('all')} 
              className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all font-bold"
            >
              Mostrar Todo o Histórico
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full min-w-0">
          {filteredTasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isArchived = !!task.archived;
            
            // Priority pill colors
            const pColor = task.priority === 'high' || task.priority === 'critical' 
              ? 'text-red-400 bg-red-500/10 border-red-500/20' 
              : task.priority === 'low' 
              ? 'text-white/30 bg-white/5 border-white/5' 
              : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

            return (
              <motion.div 
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`group relative bg-white/2 border ${isCompleted ? 'border-emerald-500/20 bg-emerald-500/5' : isArchived ? 'border-white/5 opacity-60' : 'border-white/5 hover:border-white/10'} rounded-3xl p-5 flex flex-col justify-between transition-all w-full min-w-0`}
              >
                <div>
                  {/* Card top banner */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${pColor} shrink-0`}>
                      {task.priority || 'medium'}
                    </span>
                    
                    {/* Status visual indication pill */}
                    <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${
                      isCompleted ? 'text-emerald-400' : isArchived ? 'text-white/30' : 'text-amber-400'
                    }`}>
                      {isCompleted ? 'Concluída' : isArchived ? 'Arquivada' : 'Aberta'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 
                    onClick={() => setSelectedTask(task)}
                    className={`text-sm font-black text-white group-hover:text-blue-400 transition-colors cursor-pointer line-clamp-2 break-words leading-snug mb-2 ${isCompleted ? 'line-through text-white/60' : ''}`}
                  >
                    {task.title || task.name || 'Sem Título'}
                  </h3>

                  {/* Description snippet */}
                  {(task.description || task.notes) && (
                    <p className="text-xs text-white/40 line-clamp-2 break-words leading-relaxed mb-4 font-sans">
                      {task.description || task.notes}
                    </p>
                  )}
                </div>

                {/* Card footer layer */}
                <div className="pt-3 border-t border-white/5 space-y-2.5 mt-auto">
                  {/* Context Links */}
                  {(task.areaRef || task.projectRef) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
                      {task.areaRef && (
                        <span className="px-2 py-0.5 bg-blue-500/5 text-blue-400 border border-blue-500/10 rounded font-mono truncate max-w-[120px]">
                          Área: {task.areaRef}
                        </span>
                      )}
                      {task.projectRef && (
                        <span className="px-2 py-0.5 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded font-mono truncate max-w-[120px]">
                          Proj: {task.projectRef}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Owners & Triggers */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-[9px] font-mono text-white/30 truncate max-w-[140px]">
                      {task.ownerRefs && task.ownerRefs.length > 0 ? task.ownerRefs[0] : 'Sem owner'}
                    </div>

                    {/* Compact actions button row */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!isCompleted && !isArchived && (
                        <button 
                          onClick={() => handleComplete(task.id)}
                          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all"
                          title="Concluir Tarefa"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                      
                      {(isCompleted || isArchived) && (
                        <button 
                          onClick={() => handleReopen(task.id)}
                          className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 transition-all"
                          title="Reabrir Tarefa"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}

                      {!isArchived && (
                        <button 
                          onClick={() => handleArchive(task.id)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg border border-white/5 transition-all"
                          title="Arquivar Tarefa"
                        >
                          <Archive size={12} />
                        </button>
                      )}

                      <button 
                        onClick={() => setSelectedTask(task)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg border border-white/5 transition-all ml-1"
                        title="Ver Detalhes"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Embedded Drawer */}
      <TaskDetailDrawer 
        task={selectedTask} 
        onClose={() => setSelectedTask(null)}
        onComplete={handleComplete}
        onArchive={handleArchive}
        onReopen={handleReopen}
      />
    </div>
  );
}
