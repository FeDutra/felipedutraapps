'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  pulsoService, 
  areasService, 
  routinesService, 
  agentsService, 
  healthService,
  tasksService,
  requestsService,
  sourcesService
} from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { 
  Sparkles, 
  Send, 
  Mic, 
  CheckSquare, 
  Layers, 
  Zap, 
  AlertTriangle, 
  Activity, 
  Layers2, 
  ArrowRight,
  Database,
  Volume2,
  Lock,
  RefreshCw,
  Clock
} from 'lucide-react';
import { formatDate, truncateText } from '../utils/formatters';
import { interpretLiveIntent } from '../utils/liveIntentInterpreter';

// Safe array helper
const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Safe date conversion helper
const safeGetTime = (dateInput: any): number => {
  if (!dateInput) return 0;
  if (dateInput instanceof Date) return dateInput.getTime();
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    return dateInput.toDate().getTime();
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return dateInput.seconds * 1000;
  }
  if (typeof dateInput === 'string') {
    const t = Date.parse(dateInput);
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

const safeConvertToDate = (dateInput: any): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    return dateInput.toDate();
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return new Date(dateInput.seconds * 1000);
  }
  if (typeof dateInput === 'string') {
    const t = Date.parse(dateInput);
    return isNaN(t) ? null : new Date(t);
  }
  return null;
};

// Lightweight inline markdown renderer: converts **bold** to <strong>
const renderMarkdown = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white/95">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

interface Message {
  id: string;
  sender: 'user' | 'lotus';
  text: string;
  timestamp: Date;
  interpretation?: {
    intent: string;
    domain: string;
    sourcesNeeded: string[];
    riskLevel: string;
    requiresConfirmation: boolean;
    canExecuteNow: boolean;
    suggestedReply: string;
  };
}

export default function LivePage() {
  const router = useRouter();
  const [state, setState] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [inputMessage, setInputMessage] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: 'welcome',
      sender: 'lotus',
      text: 'Olá Fê! Sou a Lótus. Sintonizei a central viva do PULSO. Como posso te auxiliar a orientar e comandar a nossa operação hoje?',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  React.useEffect(() => {
    async function load() {
      try {
        await authService.ensurePulsoAuthReady();
        
        const dashboardState = await pulsoService.getDashboardState();
        const allRoutines = await routinesService.getAll().catch(e => { console.error(e); return []; });
        const allAgents = await agentsService.getAll().catch(e => { console.error(e); return []; });
        const allLogs = await healthService.getLogs(15).catch(e => { console.error(e); return []; });
        const allAreas = await areasService.getAll().catch(e => { console.error(e); return []; });
        const allRequests = await requestsService.getRequests(15).catch(e => { console.error(e); return []; });
        const allSources = await sourcesService.getAll().catch(e => { console.error(e); return []; });
        const allTasks = await tasksService.getAll().catch(e => { console.error(e); return []; });
        
        setState({
          ...dashboardState,
          allRoutines: safeArray(allRoutines),
          allAgents: safeArray(allAgents),
          allLogs: safeArray(allLogs),
          allAreas: safeArray(allAreas),
          allRequests: safeArray(allRequests),
          allSources: safeArray(allSources),
          allTasks: safeArray(allTasks)
        });

        const chatHistory: Message[] = [];
        const commandRequests = safeArray(allRequests)
          .filter((req: any) => req && req.requestType === 'conversation_command' && !req.archived)
          .sort((a, b) => safeGetTime(a.requestedAt) - safeGetTime(b.requestedAt));

        commandRequests.forEach((req: any) => {
          const reqTime = safeConvertToDate(req.requestedAt) || new Date();
          chatHistory.push({
            id: `user-${req.id || Math.random()}`,
            sender: 'user',
            text: req.summary || req.title || '',
            timestamp: reqTime
          });
          
          const replyText = req.interpretation?.suggestedReply || 
            `Registrei o comando "${req.summary || req.title}" para processamento operacional.`;
          
          chatHistory.push({
            id: `lotus-${req.id || Math.random()}`,
            sender: 'lotus',
            text: replyText,
            timestamp: safeConvertToDate(req.updatedAt) || reqTime,
            interpretation: req.interpretation
          });
        });

        setMessages([
          {
            id: 'welcome',
            sender: 'lotus',
            text: 'Olá Fê! Sou a Lótus. Sintonizei a central viva do PULSO. Como posso te auxiliar a orientar e comandar a nossa operação hoje?',
            timestamp: new Date()
          },
          ...chatHistory
        ]);
      } catch (err: any) {
        console.error('Lótus Live load error:', err);
        setError(err?.message || 'Erro de sintonização na Lótus Live.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Iniciando Lótus Live...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-6">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Falha de Conexão</h2>
        <p className="text-sm text-white/40 max-w-sm mb-8 leading-relaxed">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
        >
          Tentar Reestabelecer
        </button>
      </div>
    );
  }

  // Bind real data
  const activeAlerts = safeArray(state?.activeAlerts).filter((a: any) => a && a.archived !== true && a.status === 'open');
  const activeProjects = safeArray(state?.activeProjects).filter((p: any) => p && p.archived !== true && p.status === 'active');
  const openTasks = safeArray(state?.openTasks).filter((t: any) => t && t.archived !== true && t.status !== 'completed');
  const pendingInbox = safeArray(state?.pendingInbox).filter((i: any) => i && i.archived !== true && i.status === 'new');
  const allAreas = safeArray(state?.allAreas).filter((a: any) => a && a.archived !== true && a.status === 'active');
  const allRoutines = safeArray(state?.allRoutines).filter((r: any) => r && r.archived !== true);
  const allAgents = safeArray(state?.allAgents).filter((ag: any) => ag && ag.archived !== true);
  const allLogs = safeArray(state?.allLogs);
  const allRequests = safeArray(state?.allRequests).filter((r: any) => r && r.archived !== true);
  const allSources = safeArray(state?.allSources).filter((s: any) => s && s.archived !== true);

  // Filter tasks assigned to Felipe
  const feTasks = openTasks.filter((t: any) => {
    const refs = t.ownerRefs;
    if (!refs || !Array.isArray(refs) || refs.length === 0) return true; // fallback to user
    return refs.some((ref: string) => ref.toLowerCase() === 'felipe' || ref.toLowerCase() === 'fe');
  });

  // Overdue tasks
  const nowTime = Date.now();
  const overdueTasks = openTasks.filter((t: any) => {
    const due = t.dueDate || t.dueAt;
    if (!due) return false;
    const dueTime = safeGetTime(due);
    return dueTime > 0 && dueTime < nowTime;
  });

  // Broken routines
  const brokenRoutines = allRoutines.filter((r: any) => r && (r.status === 'broken' || r.status === 'failed'));

  // Projects missing next steps
  const steplessProjects = activeProjects.filter((p: any) => !p.nextStep || p.nextStep.trim() === '');

  // Total attention signals count
  const totalRisksCount = activeAlerts.length + brokenRoutines.length + overdueTasks.length + steplessProjects.length;

  // 1. Build unified attention signals
  const attentionSignals: Array<{ id: string; type: string; title: string; subtitle: string; severity: 'critical' | 'warning' }> = [];
  activeAlerts.forEach((a: any) => {
    attentionSignals.push({
      id: a.id || `alert-${Math.random()}`,
      type: 'alert',
      title: a.name || 'Alerta Técnico',
      subtitle: a.description || 'Instabilidade no sistema.',
      severity: a.severity === 'critical' ? 'critical' : 'warning'
    });
  });
  overdueTasks.forEach((t: any) => {
    attentionSignals.push({
      id: t.id || `overdue-${Math.random()}`,
      type: 'overdue_task',
      title: `Tarefa Atrasada: ${t.title || t.name}`,
      subtitle: `Prazo limite excedido em ${t.dueDate || t.dueAt ? formatDate(t.dueDate || t.dueAt) : 'data indefinida'}.`,
      severity: 'critical'
    });
  });
  steplessProjects.forEach((p: any) => {
    attentionSignals.push({
      id: p.id || `stepless-${Math.random()}`,
      type: 'stepless_project',
      title: `Projeto sem Próximo Passo: ${p.name}`,
      subtitle: 'Este projeto precisa de uma próxima ação definida para não travar.',
      severity: 'warning'
    });
  });

  // 2. What Lótus Did Feed (humanized)
  const feedItems: Array<{ id: string; event: string; system: string; time: Date | null }> = [];
  
  // Requests triaged or completed
  allRequests.slice(0, 10).forEach((req: any) => {
    let desc = '';
    const type = req.requestType || '';
    const title = req.title || req.summary || '';
    
    if (type === 'conversation_command') {
      desc = `Comando conversacional recebido: "${title}"`;
    } else {
      switch (req.status) {
        case 'requested':
          desc = `Registrou solicitação para: ${title || type}`;
          break;
        case 'needs_approval':
          desc = `Solicitou sua aprovação para: ${title || type}`;
          break;
        case 'completed':
          desc = `Concluiu e materializou: ${title || type}`;
          break;
        case 'failed':
          desc = `Falhou ao processar: ${title || type}`;
          break;
        default:
          desc = `Registrou movimentação em solicitação: ${title || type}`;
      }
    }
    feedItems.push({
      id: req.id || `feed-req-${Math.random()}`,
      event: desc,
      system: 'LÓTUS / BRIDGE',
      time: safeConvertToDate(req.requestedAt || req.updatedAt)
    });
  });

  // Inbox captures
  pendingInbox.slice(0, 5).forEach((item: any) => {
    feedItems.push({
      id: item.id || `feed-inbox-${Math.random()}`,
      event: `Capturou e estacionou no Inbox: "${item.name || truncateText(item.body || '', 30)}"`,
      system: 'LÓTUS / INBOX',
      time: safeConvertToDate(item.createdAt || item.updatedAt)
    });
  });

  // Filter logs for human readability
  allLogs
    .filter((log: any) => {
      if (!log || !log.event) return false;
      const text = log.event.toLowerCase();
      return !text.includes('user login') && !text.includes('seed applied') && !text.includes('auth gate');
    })
    .slice(0, 5)
    .forEach((log: any) => {
      feedItems.push({
        id: log.id || `feed-log-${Math.random()}`,
        event: log.event,
        system: log.system || 'PULSO',
        time: safeConvertToDate(log.createdAt)
      });
    });

  const sortedFeed = feedItems
    .filter(item => item.time !== null)
    .sort((a, b) => (b.time?.getTime() || 0) - (a.time?.getTime() || 0))
    .slice(0, 6);

  // 3. Monitored Sources Status Check
  const sourcesToCheck = [
    { key: 'whatsapp', name: 'WhatsApp', type: 'chat' },
    { key: 'notion', name: 'Notion', type: 'database' },
    { key: 'obsidian', name: 'Obsidian', type: 'files' },
    { key: 'calendar', name: 'Google Calendar', type: 'calendar' },
    { key: 'gmail', name: 'Gmail', type: 'email' },
    { key: 'sheets', name: 'Google Sheets', type: 'spreadsheet' },
    { key: 'pulso', name: 'PULSO Interno', type: 'system' }
  ];

  const monitoredSources = sourcesToCheck.map(src => {
    // Check if there is an active source matching the name or slug
    const isConnected = allSources.some((s: any) => 
      s.status === 'active' && 
      (s.name.toLowerCase().includes(src.key) || 
       s.slug?.toLowerCase().includes(src.key) || 
       s.type?.toLowerCase().includes(src.key))
    );
    return {
      ...src,
      connected: isConnected || src.key === 'pulso' // PULSO is always connected
    };
  });

  // 4. Next Best Action calculation
  const nextBestActions: Array<{ text: string; actionText: string; onClick: () => void; priority: 'high' | 'medium' }> = [];
  
  // Add approvals first
  const pendingApprovals = allRequests.filter((r: any) => r.status === 'needs_approval');
  pendingApprovals.forEach((req: any) => {
    nextBestActions.push({
      text: `Revisar aprovação pendente: ${req.title || req.requestType}`,
      actionText: 'Ir para Inbox',
      onClick: () => router.push('/pulso/inbox'),
      priority: 'high'
    });
  });

  // Overdue tasks
  overdueTasks.slice(0, 2).forEach((t: any) => {
    nextBestActions.push({
      text: `Resolver tarefa atrasada: ${t.title || t.name}`,
      actionText: 'Ver Tarefas',
      onClick: () => router.push('/pulso/tarefas'),
      priority: 'high'
    });
  });

  // Projects missing step
  steplessProjects.slice(0, 2).forEach((p: any) => {
    nextBestActions.push({
      text: `Definir próximo passo para: ${p.name}`,
      actionText: 'Ver Ecossistema',
      onClick: () => router.push('/pulso/ecossistema'),
      priority: 'medium'
    });
  });

  // default fallbacks
  if (nextBestActions.length === 0) {
    nextBestActions.push({
      text: 'Todos os fluxos críticos resolvidos. Sugestão: revisar o Registro da Lótus para novas capturas.',
      actionText: 'Revisar Inbox',
      onClick: () => router.push('/pulso/inbox'),
      priority: 'medium'
    });
  }

  // Handle conversational input submission
  const handleSendMessage = async (textToSend?: string) => {
    const rawMsg = textToSend || inputMessage;
    if (!rawMsg.trim()) return;

    // Clear input
    setInputMessage('');

    // Append Fê's message
    const userMsg: Message = {
      id: `user-msg-${Date.now()}`,
      sender: 'user',
      text: rawMsg,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const currentUser = authService.getCurrentUser();
      const userRef = currentUser?.email || currentUser?.displayName || 'felipe_dutra';

      // Build context from current real state safely
      const context = {
        tasks: state?.allTasks || [],
        projects: state?.allProjects || state?.activeProjects || [],
        areas: state?.allAreas || [],
        agents: state?.allAgents || [],
        routines: state?.allRoutines || [],
        requests: state?.allRequests || [],
        logs: state?.allLogs || [],
        sources: state?.allSources || []
      };

      // Interpret the command using deterministic matching and real data context
      const interpretation = interpretLiveIntent(rawMsg, context);

      // Build the Request object matching Step 3 with interpretation block
      const reqPayload = {
        requestType: 'conversation_command' as any,
        title: rawMsg.length > 80 ? rawMsg.substring(0, 80) + '...' : rawMsg,
        summary: rawMsg,
        status: 'requested' as any,
        priority: 'medium' as any,
        requestedBy: userRef,
        requestedAt: new Date(),
        updatedAt: new Date(),
        origin: 'lotus_live' as any,
        source: 'pulso_live' as any,
        interpretation
      };

      const newRequest = await requestsService.createRequest(reqPayload);

      // Instantly inject the new request to the active state so the feed shows it immediately
      if (state) {
        setState((prev: any) => {
          if (!prev) return prev;
          const updatedRequests = [newRequest, ...(prev.allRequests || [])];
          return {
            ...prev,
            allRequests: updatedRequests
          };
        });
      }

      // Simulate Lótus response with interpreted suggested reply
      setTimeout(() => {
        const lotusMsg: Message = {
          id: `lotus-msg-${Date.now()}`,
          sender: 'lotus',
          text: interpretation.suggestedReply,
          timestamp: new Date(),
          interpretation
        };
        setMessages(prev => [...prev, lotusMsg]);
        setIsTyping(false);
      }, 800);

    } catch (err: any) {
      console.error('Error saving conversation request:', err);
      const lotusErrorMsg: Message = {
        id: `lotus-error-${Date.now()}`,
        sender: 'lotus',
        text: `Falha ao registrar o comando no barramento: ${err?.message || 'Erro de persistência'}.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, lotusErrorMsg]);
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 w-full max-w-full min-w-0">
      
      {/* Premium Header */}
      <header className="mb-8 border-b border-white/5 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-[8px] font-black uppercase tracking-widest text-purple-400 shrink-0">
                Experimental
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white flex items-center gap-2.5">
                Lótus Live
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.7)]" />
              </h1>
            </div>
            <p className="text-xs md:text-sm text-white/40 font-medium tracking-tight mt-1">
              Superfície conversacional de comando e estado vivo • Fê ↔ Lótus
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/2 border border-white/5 rounded-2xl px-4 py-2.5 backdrop-blur-md shrink-0 self-start md:self-auto">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/25">Interface Principal</p>
              <p className="text-xs font-bold text-purple-400">Conversação Ativa</p>
            </div>
            <div className="w-8 h-8 rounded-full border border-purple-500/20 flex items-center justify-center bg-purple-500/5">
              <Sparkles size={14} className="text-purple-400 animate-spin-slow" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Chat vs Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0 items-start">
        
        {/* LEFT COLUMN: A. Conversational Interface (Col-span 7) */}
        <section className="lg:col-span-7 flex flex-col bg-white/2 border border-white/5 rounded-3xl overflow-hidden min-h-[580px] lg:h-[620px] backdrop-blur-md shadow-2xl">
          {/* Chat Header */}
          <div className="px-6 py-4 bg-white/2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/80 leading-none">Console Conversacional</h3>
                <p className="text-[9px] text-white/30 font-medium mt-1">Conectado diretamente ao barramento de dados</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Pronto</span>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar max-h-[350px] lg:max-h-[420px]">
            {messages.map((msg) => {
              const isLotus = msg.sender === 'lotus';
              return (
                <div key={msg.id} className={`flex ${isLotus ? 'justify-start' : 'justify-end'} w-full`}>
                  <div className={`flex items-start gap-3 max-w-[85%] ${isLotus ? '' : 'flex-row-reverse'}`}>
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-[10px] font-black uppercase tracking-wider ${
                      isLotus 
                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.1)]' 
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {isLotus ? 'L' : 'F'}
                    </div>
                    {/* Bubble */}
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap border ${
                      isLotus 
                        ? 'bg-white/2 border-white/5 text-white/80' 
                        : 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/15 text-white/95 shadow-md shadow-blue-950/20'
                    }`}>
                      <div className="leading-relaxed">{renderMarkdown(msg.text)}</div>
                      
                      {isLotus && msg.interpretation && (
                        <div className="mt-3 pt-2.5 border-t border-white/5 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Análise:</span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black tracking-widest uppercase">
                              {msg.interpretation.intent}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${
                              msg.interpretation.riskLevel === 'high' 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                : msg.interpretation.riskLevel === 'medium'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            }`}>
                              Risco {msg.interpretation.riskLevel}
                            </span>
                            {msg.interpretation.requiresConfirmation && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black tracking-widest uppercase animate-pulse">
                                Requer Confirmação
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[9px] text-white/40">
                            <div>
                              <span className="font-semibold text-white/30">Domínio:</span> <span className="text-white/60">{msg.interpretation.domain}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-white/30">Confirmação:</span> <span className="text-white/60">{msg.interpretation.requiresConfirmation ? 'Sim' : 'Não'}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="font-semibold text-white/30">Ação Executada:</span> <span className="text-white/60">Nenhuma, apenas leitura/proposta</span>
                            </div>
                            {msg.interpretation.sourcesNeeded && msg.interpretation.sourcesNeeded.length > 0 && (
                              <div className="col-span-2">
                                <span className="font-semibold text-white/30">Fontes Consultadas:</span> <span className="text-white/60">{msg.interpretation.sourcesNeeded.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <span className="block text-[8px] text-white/20 text-right mt-2 font-medium">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Lótus Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start w-full">
                <div className="flex items-start gap-3 max-w-[85%]">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-[10px] font-black text-purple-400">
                    L
                  </div>
                  <div className="px-4 py-3 bg-white/2 border border-white/5 rounded-2xl flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Pills */}
          <div className="px-6 py-2 bg-white/1 border-t border-white/5 flex items-center gap-2 overflow-x-auto flex-nowrap shrink-0 custom-scrollbar-horizontal select-none">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap mr-1 shrink-0">Perguntas Rápidas:</span>
            {[
              { label: 'Como está meu dia?', text: 'Como está meu dia?' },
              { label: 'O que depende de mim?', text: 'O que depende de mim?' },
              { label: 'O que está travado?', text: 'O que está travado?' },
              { label: 'O que a Lótus fez?', text: 'O que a Lótus fez?' },
              { label: 'Projetos vivos', text: 'Quais projetos estão vivos?' },
              { label: 'Agentes & crons', text: 'Quais agentes estão trabalhando?' },
              { label: 'Fontes sintonizadas', text: 'Quais fontes foram consultadas?' }
            ].map((sugg, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sugg.text)}
                className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-white/50 hover:text-white hover:bg-white/10 hover:border-purple-500/25 transition-all shrink-0 whitespace-nowrap"
              >
                {sugg.label}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-white/3 border-t border-white/5 flex items-center gap-2.5 shrink-0">
            <div className="flex-1 bg-black/20 border border-white/5 rounded-2xl flex items-center px-4 py-2 focus-within:border-purple-500/35 focus-within:ring-2 focus-within:ring-purple-500/5 transition-all">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Fê, pergunte ou peça algo para a Lótus…"
                className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-white/20 outline-none py-1.5"
              />
              <button 
                className="p-1.5 rounded-lg text-white/25 hover:text-purple-400 hover:bg-white/5 transition-all"
                title="Comando de voz (futuro)"
              >
                <Mic size={14} />
              </button>
            </div>
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim()}
              className="p-3 bg-purple-600 hover:bg-purple-500 disabled:bg-white/5 disabled:text-white/20 text-white rounded-2xl transition-all shrink-0 flex items-center justify-center shadow-lg shadow-purple-950/30"
            >
              <Send size={14} />
            </button>
          </div>
        </section>

        {/* RIGHT COLUMN: B & G (Col-span 5) */}
        <div className="lg:col-span-5 space-y-6 min-w-0">
          
          {/* B. BRIEFING DO AGORA */}
          <section className="bg-white/2 border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-5 flex items-center gap-2">
              <Activity size={14} className="text-purple-400" />
              Briefing do Agora
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/4 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Depende de Você</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-amber-400">{feTasks.length}</span>
                  <span className="text-[10px] font-bold text-white/30">tarefas</span>
                </div>
                <p className="text-[9px] text-white/45 mt-1 leading-tight">Atribuídas sob sua responsabilidade direta.</p>
              </div>

              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/4 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Riscos & Travas</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-red-400">{totalRisksCount}</span>
                  <span className="text-[10px] font-bold text-white/30">alertas</span>
                </div>
                <p className="text-[9px] text-white/45 mt-1 leading-tight">Atrasos, projetos estagnados ou crons em falha.</p>
              </div>

              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/4 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Projetos Vivos</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-blue-400">{activeProjects.length}</span>
                  <span className="text-[10px] font-bold text-white/30">frentes</span>
                </div>
                <p className="text-[9px] text-white/45 mt-1 leading-tight">Projetos ativamente em andamento.</p>
              </div>

              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:bg-white/4 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Metabolismo</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-sm font-black uppercase tracking-widest ${brokenRoutines.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {brokenRoutines.length > 0 ? 'Instável' : 'Saudável'}
                  </span>
                </div>
                <p className="text-[9px] text-white/45 mt-1 leading-tight">Agentes e rotinas recorrentes de processamento.</p>
              </div>
            </div>
          </section>

          {/* G. PRÓXIMA MELHOR AÇÃO */}
          <section className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/15 rounded-3xl p-6 backdrop-blur-md shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
            
            <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" />
              Próxima Melhor Ação Recomendada
            </h3>
            
            <div className="space-y-4">
              {nextBestActions.map((action, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3.5 bg-black/20 border border-white/5 rounded-2xl">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/95 leading-relaxed">{action.text}</p>
                    <span className={`inline-block text-[8px] font-black uppercase tracking-widest rounded px-1.5 py-0.5 mt-2 ${
                      action.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      Prioridade {action.priority === 'high' ? 'Crítica' : 'Média'}
                    </span>
                  </div>
                  <button 
                    onClick={action.onClick}
                    className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0"
                  >
                    {action.actionText}
                    <ArrowRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Grid: Lower Panels (C, D, E, F) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-full min-w-0 mt-8">
        
        {/* C. O QUE A LÓTUS FEZ (Activity Feed) */}
        <section className="bg-white/2 border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-5 flex items-center gap-2">
              <Clock size={14} className="text-purple-400" />
              O Que a Lótus Fez (Feed)
            </h3>
            <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {sortedFeed.map((f) => {
                const timeText = f.time ? formatDate(f.time) : '';
                return (
                  <div key={f.id} className="flex flex-col gap-0.5 pb-2.5 border-b border-white/2 last:border-b-0">
                    <p className="text-[11px] text-white/85 leading-snug">{f.event}</p>
                    <div className="flex items-center justify-between text-[8px] text-white/25 mt-0.5">
                      <span className="font-black tracking-widest uppercase">{f.system}</span>
                      <span>{timeText}</span>
                    </div>
                  </div>
                );
              })}
              {sortedFeed.length === 0 && (
                <p className="text-[11px] text-white/30 italic text-center py-6">Nenhum evento registrado nos logs.</p>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => router.push('/pulso/eventos')}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2 mt-4"
          >
            Ver Logs Técnicos
            <ArrowRight size={10} />
          </button>
        </section>

        {/* D. PROJETOS VIVOS */}
        <section className="bg-white/2 border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-5 flex items-center gap-2">
              <Layers2 size={14} className="text-purple-400" />
              Projetos Vivos ({activeProjects.length})
            </h3>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {activeProjects.slice(0, 5).map((p: any) => {
                const isOverdue = p.deadline && safeGetTime(p.deadline) < nowTime;
                return (
                  <div key={p.id} className="flex flex-col gap-1 p-3 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/4 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                      {isOverdue && (
                        <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[7px] font-black tracking-widest uppercase shrink-0">
                          Atrasado
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 leading-relaxed truncate">
                      <span className="font-bold text-purple-400/80">Próximo Passo: </span>
                      {p.nextStep ? p.nextStep : <span className="text-red-400/80 italic font-semibold">Definir passo ⚠️</span>}
                    </p>
                  </div>
                );
              })}
              {activeProjects.length === 0 && (
                <p className="text-[11px] text-white/30 italic text-center py-6">Nenhum projeto ativo.</p>
              )}
            </div>
          </div>

          <button 
            onClick={() => router.push('/pulso/ecossistema')}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2 mt-4"
          >
            Ver Mapa Estratégico
            <ArrowRight size={10} />
          </button>
        </section>

        {/* E. AGENTES EM OPERAÇÃO */}
        <section className="bg-white/2 border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-5 flex items-center gap-2">
              <Zap size={14} className="text-purple-400" />
              Agentes Operantes
            </h3>
            <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {allAgents.slice(0, 4).map((ag: any) => {
                const isActive = ag.status === 'active';
                return (
                  <div key={ag.id} className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/4 transition-colors">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{ag.name}</h4>
                      <p className="text-[8px] text-white/30 uppercase tracking-widest font-black mt-0.5 truncate">{ag.role || 'Agente'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 ${
                      isActive 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-white/5 border-white/10 text-white/30'
                    }`}>
                      {isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                );
              })}
              {allAgents.length === 0 && (
                <p className="text-[11px] text-white/30 italic text-center py-6">Nenhum agente registrado.</p>
              )}
            </div>
          </div>

          <button 
            onClick={() => router.push('/pulso/metabolismo')}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2 mt-4"
          >
            Gerenciar Agentes
            <ArrowRight size={10} />
          </button>
        </section>

        {/* F. FONTES OBSERVADAS */}
        <section className="bg-white/2 border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-5 flex items-center gap-2">
              <Database size={14} className="text-purple-400" />
              Fontes Observadas
            </h3>
            
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {monitoredSources.map((src, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/4 transition-colors">
                  <span className="text-xs font-bold text-white/80">{src.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${src.connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-white/20'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      src.connected ? 'text-emerald-400' : 'text-white/25'
                    }`}>
                      {src.connected ? 'Conectado' : 'Aguardando'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => router.push('/pulso/ecossistema')}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2 mt-4"
          >
            Visualizar Fontes
            <ArrowRight size={10} />
          </button>
        </section>

      </div>
    </div>
  );
}
