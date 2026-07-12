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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-10">
        {[
          { id: 'all', count: openCount, label: 'Abertas', desc: 'Tarefas ativas', color: 'text-white/80', activeColor: 'border-white/40' },
          { id: 'depende_fe', count: dependsFeCount, label: 'Depende do Fê', desc: 'Atribuídas a Felipe', color: 'text-white/80', activeColor: 'border-white/40' },
          { id: 'vencidas', count: overdueCount, label: 'Vencidas', desc: 'Passaram do prazo', color: 'text-white/80', activeColor: 'border-white/40' },
          { id: 'sem_responsavel', count: noOwnerCount, label: 'Sem Responsável', desc: 'Nenhum ownerRef', color: 'text-white/80', activeColor: 'border-white/40' },
          { id: 'sem_projeto', count: noProjectCount, label: 'Sem Projeto', desc: 'Órfãs de projeto', color: 'text-white/80', activeColor: 'border-white/40' }
        ].map(card => {
          const isActive = (card.id === 'all' && customFilter === 'all') || (card.id !== 'all' && customFilter === card.id);
          return (
            <div 
              key={card.id}
              onClick={() => {
                setStatusFilter('open');
                setCustomFilter(card.id as any);
              }}
              className={`py-4 px-2 border-b cursor-pointer transition-all flex flex-col justify-between ${card.color} ${isActive ? 'border-white/40' : 'border-white/5 hover:border-white/20'}`}
            >
              <div>
                <span className="block text-[8px] font-mono tracking-[0.2em] text-white/20 uppercase">{card.label}</span>
                <span className="block text-[10px] text-white/40 mt-1 leading-snug font-light">{card.desc}</span>
              </div>
              <span className="text-xl font-light font-mono mt-4 self-end">{card.count}</span>
            </div>
          );
        })}
      </div>

      {/* Advanced Filters Panel */}
      <div className="space-y-4 mb-8 w-full max-w-full min-w-0">
        <div className="flex flex-col gap-4 py-4 w-full border-b border-white/10">
          
          {/* First row: Status, Priority and Search */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 w-full">
            
            {/* Status chips bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 shrink-0">
              <span className="text-[9px] font-mono tracking-[0.2em] text-white/20 mr-2 uppercase shrink-0">Status:</span>
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
                  className={`px-3 py-1.5 text-[9px] font-mono tracking-[0.1em] uppercase whitespace-nowrap transition-all shrink-0 bg-transparent border-none cursor-pointer ${
                    statusFilter === tab.id 
                      ? 'text-white' 
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Priority chips bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 pt-2 lg:pt-0 lg:pl-4">
              <span className="text-[9px] font-mono tracking-[0.2em] text-white/20 mr-2 uppercase shrink-0">Prioridade:</span>
              {priorities.map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2.5 py-1 text-[9px] font-mono tracking-[0.1em] uppercase whitespace-nowrap transition-all shrink-0 bg-transparent border-none cursor-pointer ${
                    priorityFilter === p 
                      ? 'text-white' 
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {p === 'all' ? 'Todas' : p}
                </button>
              ))}
            </div>

            {/* Input Search Box */}
            <div className="relative flex-1 max-w-lg min-w-0">
              <Search size={12} strokeWidth={1} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
              <input 
                type="text"
                placeholder="Buscar por título, descrição, área ou projeto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-none pl-8 pr-4 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-all truncate font-light"
              />
            </div>
          </div>

          {/* Second row: Dropdowns for Area and Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-white/5 w-full">
            
            {/* Area Filter Dropdown */}
            <div className="flex items-center gap-3 py-1.5 pl-1.5">
              <span className="text-[9px] font-mono tracking-[0.2em] text-white/25 shrink-0 uppercase">Filtrar Área:</span>
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="bg-transparent border-none text-xs text-white/60 hover:text-white focus:outline-none w-full cursor-pointer font-light"
              >
                <option value="all" className="bg-[#b8283e] text-white">Todas as Áreas</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id} className="bg-[#b8283e] text-white">{a.name}</option>
                ))}
              </select>
            </div>

            {/* Project Filter Dropdown */}
            <div className="flex items-center gap-3 py-1.5 pl-1.5">
              <span className="text-[9px] font-mono tracking-[0.2em] text-white/25 shrink-0 uppercase">Filtrar Projeto:</span>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-transparent border-none text-xs text-white/60 hover:text-white focus:outline-none w-full cursor-pointer font-light"
              >
                <option value="all" className="bg-[#b8283e] text-white">Todos os Projetos</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#b8283e] text-white">{p.name}</option>
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
        <div className="flex flex-col gap-1 w-full max-w-full min-w-0">
          {filteredTasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isArchived = !!task.archived;
            const overdue = isOverdue(task);
            const dependsFe = isOwnedByFe(task);
            const hasNoOwner = !task.ownerRefs || task.ownerRefs.length === 0;
            const hasNoProj = !task.projectRef;
            
            const resolvedProj = projects.find(p => p.id === task.projectRef);
            const resolvedArea = areas.find(a => a.id === task.areaRef);

            return (
              <motion.div 
                key={task.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ x: 2 }}
                className={`group relative py-4 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all w-full min-w-0 ${
                  isCompleted ? 'opacity-50' : isArchived ? 'opacity-40' : ''
                }`}
              >
                {/* Left side: Info, Title, Tags */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">
                      {task.priority || 'medium'}
                    </span>
                    <span className="text-white/20 text-[8px] font-mono">•</span>
                    <span className={`text-[8px] font-mono tracking-widest uppercase ${
                      isCompleted ? 'text-white/30' : isArchived ? 'text-white/20' : overdue ? 'text-red-400/80 font-bold' : 'text-white/50'
                    }`}>
                      {isCompleted ? 'Concluída' : isArchived ? 'Arquivada' : overdue ? 'Vencida' : 'Aberta'}
                    </span>
                    {(resolvedArea || resolvedProj) && (
                      <>
                        <span className="text-white/20 text-[8px] font-mono">•</span>
                        <span className="text-[8px] font-mono tracking-wider text-white/30 truncate max-w-[200px] lowercase">
                          {resolvedArea?.name || resolvedProj?.name || ''}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 
                    onClick={() => setSelectedTask(task)}
                    className={`text-sm font-light text-white group-hover:text-blue-400 transition-colors cursor-pointer break-words leading-snug ${isCompleted ? 'line-through text-white/40' : ''}`}
                  >
                    {task.title || task.name || 'Sem Título'}
                  </h3>

                  {(task.description || task.notes) && (
                    <p className="text-[11px] text-white/40 break-words leading-relaxed mt-1 font-light max-w-2xl">
                      {task.description || task.notes}
                    </p>
                  )}
                </div>

                {/* Right side: Metadata (date, owner, actions) */}
                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                  <div className="flex items-center gap-4 text-right">
                    <div className="text-[9px] font-mono tracking-wider text-white/30 flex items-center gap-1.5 justify-end">
                      <User size={10} strokeWidth={1} className="text-white/20" />
                      <span>{getOwnerLabel(task.ownerRefs)}</span>
                    </div>

                    {(task.dueDate || task.dueAt) && (
                      <span className={`text-[9px] font-mono tracking-wider ${overdue ? 'text-red-400/80' : 'text-white/30'}`}>
                        {safeDate(task.dueDate || task.dueAt)?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) || 'N/A'}
                      </span>
                    )}
                  </div>

                  {/* Compact actions button row */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!isCompleted && !isArchived && (
                      <button 
                        onClick={() => handleComplete(task.id)}
                        className="p-1 text-white/50 hover:text-white bg-transparent border-none outline-none cursor-pointer transition-colors"
                        title="Concluir Tarefa"
                      >
                        <CheckCircle2 size={12} strokeWidth={1.5} />
                      </button>
                    )}
                    
                    {(isCompleted || isArchived) && (
                      <button 
                        onClick={() => handleReopen(task.id)}
                        className="p-1 text-white/50 hover:text-white bg-transparent border-none outline-none cursor-pointer transition-colors"
                        title="Reabrir Tarefa"
                      >
                        <RotateCcw size={12} strokeWidth={1.5} />
                      </button>
                    )}

                    {!isArchived && (
                      <button 
                        onClick={() => handleArchive(task.id)}
                        className="p-1 text-white/30 hover:text-white/70 bg-transparent border-none outline-none cursor-pointer transition-colors"
                        title="Arquivar Tarefa"
                      >
                        <Archive size={12} strokeWidth={1.5} />
                      </button>
                    )}

                    <button 
                      onClick={() => setSelectedTask(task)}
                      className="p-1 text-white/50 hover:text-white bg-transparent border-none outline-none cursor-pointer transition-colors"
                      title="Ver Detalhes"
                    >
                      <ChevronRight size={12} strokeWidth={1.5} />
                    </button>
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
