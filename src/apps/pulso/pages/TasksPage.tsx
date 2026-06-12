'use client';

import React from 'react';
import { 
  tasksService, 
  projectsService, 
  areasService, 
  peopleService, 
  agentsService 
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { requestsService } from '../services/requestsService';
import { Task, Project, Area, Person, Agent } from '../types/pulso.types';
import { motion } from 'framer-motion';
import { 
  CheckSquare, Clock, Plus, Search, Filter, Layers, 
  Tag, Archive, CheckCircle2, RotateCcw, AlertCircle, 
  ChevronRight, Calendar, User, AlertTriangle, Shield
} from 'lucide-react';
import { TaskDetailDrawer } from '../components/ecosystem/TaskDetailDrawer';

export default function TasksPage() {
  const [loading, setLoading] = React.useState(true);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = React.useState<'open' | 'completed' | 'archived' | 'all'>('open');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [areaFilter, setAreaFilter] = React.useState<string>('all');
  const [projectFilter, setProjectFilter] = React.useState<string>('all');
  const [customFilter, setCustomFilter] = React.useState<'all' | 'depende_fe' | 'sem_responsavel' | 'sem_projeto' | 'vencidas'>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  
  const [error, setError] = React.useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      // Load all datasets in parallel
      const [allTasks, allProjects, allAreas, allPeople, allAgents] = await Promise.all([
        tasksService.getAll(true),
        projectsService.getAll(),
        areasService.getAll(),
        peopleService.getAll(),
        agentsService.getAll()
      ]);
      setTasks(allTasks);
      setProjects(allProjects);
      setAreas(allAreas);
      setPeople(allPeople);
      setAgents(allAgents);
    } catch (err: any) {
      console.error('Error loading tasks data:', err);
      setError('Falha ao carregar dados operacionais das tarefas.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Helpers
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

  const isOverdue = React.useCallback((task: Task): boolean => {
    if (task.status === 'completed' || task.archived) return false;
    const targetDate = safeDate(task.dueDate || task.dueAt);
    if (!targetDate) return false;
    return targetDate.getTime() < Date.now();
  }, []);

  const isOwnedByFe = React.useCallback((task: Task): boolean => {
    if (!task.ownerRefs || task.ownerRefs.length === 0) return false;
    return task.ownerRefs.some(owner => {
      const o = owner.toLowerCase();
      return o.includes('felipe') || o.includes('fê') || o === 'fe';
    });
  }, []);

  const getOwnerLabel = (ownerRefs?: string[]): string => {
    if (!ownerRefs || ownerRefs.length === 0) return 'Sem responsável';
    const first = ownerRefs[0];
    const person = people.find(p => p.id === first || p.slug === first);
    if (person) return person.name;
    const agent = agents.find(a => a.id === first || a.slug === first);
    if (agent) return agent.name;
    return first;
  };

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

  // Indicators calculations
  const openCount = React.useMemo(() => tasks.filter(t => !t.archived && t.status !== 'completed').length, [tasks]);
  const dependsFeCount = React.useMemo(() => tasks.filter(t => !t.archived && t.status !== 'completed' && isOwnedByFe(t)).length, [tasks, isOwnedByFe]);
  const overdueCount = React.useMemo(() => tasks.filter(t => isOverdue(t)).length, [tasks, isOverdue]);
  const noOwnerCount = React.useMemo(() => tasks.filter(t => !t.archived && t.status !== 'completed' && (!t.ownerRefs || t.ownerRefs.length === 0)).length, [tasks]);
  const noProjectCount = React.useMemo(() => tasks.filter(t => !t.archived && t.status !== 'completed' && !t.projectRef).length, [tasks]);

  // Filtering logic
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      const isArchivedVal = !!task.archived;
      const isCompletedVal = task.status === 'completed';

      // Status Filter
      if (statusFilter === 'open') {
        if (isArchivedVal || isCompletedVal) return false;
      } else if (statusFilter === 'completed') {
        if (isArchivedVal || !isCompletedVal) return false;
      } else if (statusFilter === 'archived') {
        if (!isArchivedVal) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // Area Filter
      if (areaFilter !== 'all' && task.areaRef !== areaFilter) {
        return false;
      }

      // Project Filter
      if (projectFilter !== 'all' && task.projectRef !== projectFilter) {
        return false;
      }

      // Custom Filter
      if (customFilter === 'depende_fe') {
        if (!isOwnedByFe(task)) return false;
      } else if (customFilter === 'sem_responsavel') {
        if (task.ownerRefs && task.ownerRefs.length > 0) return false;
      } else if (customFilter === 'sem_projeto') {
        if (task.projectRef) return false;
      } else if (customFilter === 'vencidas') {
        if (!isOverdue(task)) return false;
      }

      // Search term filtering
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const tTitle = (task.title || task.name || '').toLowerCase();
        const tDesc = (task.description || task.notes || '').toLowerCase();
        const tArea = (task.areaRef || '').toLowerCase();
        const tProj = (task.projectRef || '').toLowerCase();
        
        // Resolve project and area names for search
        const resolvedProjName = projects.find(p => p.id === task.projectRef)?.name?.toLowerCase() || '';
        const resolvedAreaName = areas.find(a => a.id === task.areaRef)?.name?.toLowerCase() || '';

        if (!tTitle.includes(q) && !tDesc.includes(q) && !tArea.includes(q) && !tProj.includes(q) && !resolvedProjName.includes(q) && !resolvedAreaName.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const tsA = safeDate(a.createdAt)?.getTime() || 0;
      const tsB = safeDate(b.createdAt)?.getTime() || 0;
      return tsB - tsA; // newest first
    });
  }, [tasks, statusFilter, priorityFilter, areaFilter, projectFilter, customFilter, searchTerm, projects, areas, isOwnedByFe, isOverdue]);

  const priorities = ['all', 'high', 'medium', 'low'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full max-w-full min-w-0">
      {/* Dynamic Feedback Banner */}
      {feedbackMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-white/10 border border-white/20 rounded-2xl flex items-center gap-3 text-xs text-white font-bold"
        >
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{feedbackMsg}</span>
        </motion.div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-300 font-mono">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white">
              <CheckSquare size={16} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">Central de Tarefas</h1>
          </div>
          <p className="text-xs md:text-sm text-white/40 max-w-lg leading-relaxed font-semibold">
            O que precisa andar, em qual projeto, e quem precisa agir? Dashboard operacional integrado.
          </p>
        </div>
      </div>

      {/* Stunning Interactive Dashboard Indicator Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { id: 'all', count: openCount, label: 'Abertas', desc: 'Tarefas ativas', color: 'text-white/80 border-white/10 bg-white/5', activeColor: 'ring-1 ring-white/30' },
          { id: 'depende_fe', count: dependsFeCount, label: 'Depende do Fê', desc: 'Atribuídas a Felipe', color: 'text-white/80 border-white/10 bg-white/5', activeColor: 'ring-1 ring-white/30' },
          { id: 'vencidas', count: overdueCount, label: 'Vencidas', desc: 'Passaram do prazo', color: 'text-white/80 border-white/10 bg-white/5', activeColor: 'ring-1 ring-white/30' },
          { id: 'sem_responsavel', count: noOwnerCount, label: 'Sem Responsável', desc: 'Nenhum ownerRef', color: 'text-white/80 border-white/10 bg-white/5', activeColor: 'ring-1 ring-white/30' },
          { id: 'sem_projeto', count: noProjectCount, label: 'Sem Projeto', desc: 'Órfãs de projeto', color: 'text-white/80 border-white/10 bg-white/5', activeColor: 'ring-1 ring-white/30' }
        ].map(card => {
          const isActive = (card.id === 'all' && customFilter === 'all') || (card.id !== 'all' && customFilter === card.id);
          return (
            <div 
              key={card.id}
              onClick={() => {
                setStatusFilter('open');
                setCustomFilter(card.id as any);
              }}
              className={`p-4 bg-white/2 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 hover:border-white/10 transition-all group flex flex-col justify-between ${card.color} ${isActive ? card.activeColor : ''}`}
            >
              <div>
                <span className="block text-[8px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors">{card.label}</span>
                <span className="block text-[10px] text-white/40 mt-0.5 leading-snug group-hover:text-white/60 transition-colors font-medium">{card.desc}</span>
              </div>
              <span className="text-xl font-black font-mono mt-4 self-end group-hover:scale-110 transition-transform">{card.count}</span>
            </div>
          );
        })}
      </div>

      {/* Advanced Filters Panel */}
      <div className="space-y-4 mb-8 w-full max-w-full min-w-0">
        <div className="flex flex-col gap-4 bg-white/2 p-4 rounded-3xl border border-white/5 w-full">
          
          {/* First row: Status, Priority and Search */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 w-full">
            
            {/* Status chips bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 shrink-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mr-1 hidden sm:inline shrink-0">Status:</span>
              {[
                { id: 'open', label: 'Abertas' },
                { id: 'completed', label: 'Concluídas' },
                { id: 'archived', label: 'Arquivadas' },
                { id: 'all', label: 'Todas' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id as any);
                    if (tab.id !== 'open') setCustomFilter('all');
                  }}
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
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 pt-2 lg:pt-0 lg:pl-3">
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
            <div className="relative flex-1 max-w-lg min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input 
                type="text"
                placeholder="Buscar por título, descrição, área ou projeto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-all truncate"
              />
            </div>
          </div>

          {/* Second row: Dropdowns for Area and Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5 w-full">
            
            {/* Area Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white/2 border border-white/5 rounded-xl px-3 py-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25 shrink-0">Filtrar Área:</span>
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="bg-transparent text-xs text-white/80 focus:outline-none w-full cursor-pointer font-semibold"
              >
                <option value="all" className="bg-[#b8544a] text-white">Todas as Áreas</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id} className="bg-[#b8544a] text-white">{a.name}</option>
                ))}
              </select>
            </div>

            {/* Project Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white/2 border border-white/5 rounded-xl px-3 py-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25 shrink-0">Filtrar Projeto:</span>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-transparent text-xs text-white/80 focus:outline-none w-full cursor-pointer font-semibold"
              >
                <option value="all" className="bg-[#b8544a] text-white">Todos os Projetos</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#b8544a] text-white">{p.name}</option>
                ))}
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* Clear Filters Reset Option */}
      {(priorityFilter !== 'all' || areaFilter !== 'all' || projectFilter !== 'all' || customFilter !== 'all' || searchTerm !== '') && (
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-[10px] font-semibold text-white/40">Filtros Ativos Encontraram {filteredTasks.length} Resultados</span>
          <button
            onClick={() => {
              setPriorityFilter('all');
              setAreaFilter('all');
              setProjectFilter('all');
              setCustomFilter('all');
              setSearchTerm('');
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <RotateCcw size={10} /> Limpar Filtros
          </button>
        </div>
      )}

      {/* Task List Grid Layout */}
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
          {(statusFilter !== 'all' || customFilter !== 'all') && (
            <button 
              onClick={() => {
                setStatusFilter('all');
                setCustomFilter('all');
              }} 
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
            const overdue = isOverdue(task);
            const dependsFe = isOwnedByFe(task);
            const hasNoOwner = !task.ownerRefs || task.ownerRefs.length === 0;
            const hasNoProj = !task.projectRef;
            
            const pColor = task.priority === 'high' || task.priority === 'critical' 
              ? 'text-white border-white/30 bg-white/10' 
              : task.priority === 'low' 
              ? 'text-white/30 bg-white/5 border-white/5' 
              : 'text-white/70 bg-white/5 border-white/10';

            const resolvedProj = projects.find(p => p.id === task.projectRef);
            const resolvedArea = areas.find(a => a.id === task.areaRef);

            return (
              <motion.div 
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`group relative bg-white/2 border ${
                  isCompleted 
                    ? 'border-white/20 bg-white/5 opacity-70' 
                    : isArchived 
                    ? 'border-white/5 opacity-60' 
                    : overdue
                    ? 'border-white/20 bg-white/5'
                    : 'border-white/5 hover:border-white/10'
                } rounded-3xl p-6 flex flex-col justify-between transition-all w-full min-w-0`}
              >
                <div>
                  {/* Card top banner */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${pColor} shrink-0`}>
                      {task.priority || 'medium'}
                    </span>
                    
                    <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${
                      isCompleted ? 'text-white/60' : isArchived ? 'text-white/30' : overdue ? 'text-white underline decoration-white/40' : 'text-white/80'
                    }`}>
                      {isCompleted ? 'Concluída' : isArchived ? 'Arquivada' : overdue ? 'Vencida' : 'Aberta'}
                    </span>
                  </div>

                  <h3 
                    onClick={() => setSelectedTask(task)}
                    className={`text-sm font-black text-white group-hover:underline transition-all cursor-pointer line-clamp-2 break-words leading-snug mb-2 ${isCompleted ? 'line-through text-white/60' : ''}`}
                  >
                    {task.title || task.name || 'Sem Título'}
                  </h3>

                  {/* Description snippet */}
                  {(task.description || task.notes) && (
                    <p className="text-xs text-white/40 line-clamp-2 break-words leading-relaxed mb-4 font-sans font-semibold">
                      {task.description || task.notes}
                    </p>
                  )}
                </div>

                {/* Card footer layer */}
                <div className="pt-4 border-t border-white/5 space-y-3 mt-auto">
                  
                  <div className="flex flex-wrap gap-1">
                    {overdue && (
                      <span className="px-2 py-0.5 bg-white/10 text-white border border-white/20 rounded-md text-[8px] font-black uppercase tracking-widest">
                        ⚠️ Vencida
                      </span>
                    )}
                    {dependsFe && (
                      <span className="px-2 py-0.5 bg-white/10 text-white border border-white/20 rounded-md text-[8px] font-black uppercase tracking-widest">
                        👤 Depende do Fê
                      </span>
                    )}
                    {hasNoOwner && (
                      <span className="px-2 py-0.5 bg-white/5 text-white/60 border border-white/10 rounded-md text-[8px] font-black uppercase tracking-widest">
                        🔍 Sem Responsável
                      </span>
                    )}
                    {hasNoProj && (
                      <span className="px-2 py-0.5 bg-white/5 text-white/60 border border-white/10 rounded-md text-[8px] font-black uppercase tracking-widest">
                        📦 Sem Projeto
                      </span>
                    )}
                  </div>

                  {/* Context Links */}
                  {(task.areaRef || task.projectRef) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
                      {task.areaRef && (
                        <span className="px-2 py-0.5 bg-white/5 text-white/80 border border-white/10 rounded font-bold truncate max-w-[130px]">
                          Área: {resolvedArea?.name || task.areaRef}
                        </span>
                      )}
                      {task.projectRef && (
                        <span className="px-2 py-0.5 bg-white/5 text-white/80 border border-white/10 rounded font-bold truncate max-w-[130px]">
                          Proj: {resolvedProj?.name || task.projectRef}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Owners, dueDate & Triggers */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/2">
                    <div className="text-[9px] font-bold text-white/30 truncate max-w-[140px] flex items-center gap-1">
                      <User size={10} className="text-white/20" />
                      <span>{getOwnerLabel(task.ownerRefs)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {(task.dueDate || task.dueAt) && (
                        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${overdue ? 'text-white bg-white/10 border border-white/20' : 'text-white/30'}`}>
                          {safeDate(task.dueDate || task.dueAt)?.toLocaleDateString() || 'N/A'}
                        </span>
                      )}

                      {/* Compact actions button row */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!isCompleted && !isArchived && (
                          <button 
                            onClick={() => handleComplete(task.id)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all"
                            title="Concluir Tarefa"
                          >
                            <CheckCircle2 size={12} />
                          </button>
                        )}
                        
                        {(isCompleted || isArchived) && (
                          <button 
                            onClick={() => handleReopen(task.id)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all"
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
        projects={projects}
        areas={areas}
        people={people}
        agents={agents}
      />
    </div>
  );
}
