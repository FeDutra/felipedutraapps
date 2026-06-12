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
  Send, 
  Mic, 
  MicOff, 
  Check, 
  Lock, 
  AlertTriangle, 
  Clock, 
  Zap, 
  ArrowRight, 
  RefreshCw, 
  Copy, 
  X, 
  Menu,
  Activity,
  Layers,
  Database
} from 'lucide-react';
import { formatDate, truncateText } from '../utils/formatters';
import { interpretLiveIntent } from '../utils/liveIntentInterpreter';

// Safe array helper
const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Safe date conversion helpers
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
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
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
    handoff?: {
      target: string;
      mode: string;
      canExecuteNow: boolean;
      requiresHumanConfirmation: boolean;
      intent: string;
      domain: string;
      riskLevel: string;
      actionType: string;
      entitiesMentioned: string[];
      suggestedNextStep: string;
      executionPrompt: string;
    };
  };
  openclawResult?: {
    processedBy: string;
    responseText: string;
    summary?: string;
    confidence?: string;
    riskLevel?: string;
    requiresHumanApproval?: boolean;
    statusTransition?: string;
    sourcesConsulted?: string[];
    proposedActions?: Array<{ label: string; description?: string; riskLevel?: string }>;
    proposedMutation?: { type: string; previewLabel: string; payload: any };
    errors?: string[];
    auditLog?: { model?: string; skillUsed?: string; confidence?: string; notes?: string };
  };
  handoffStatus?: string;
  requestId?: string;
  originalCommand?: string;
  userApproval?: {
    approved: boolean;
    approvedAt?: string;
    rejectedAt?: string;
    note?: string;
    reason?: string;
  };
  executedAt?: string;
  executedBy?: string;
  createdEntityRef?: string;
  executionError?: string;
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
      text: 'olá fê. sou a lótus. sintonizei a central viva do pulso. como posso te auxiliar a orientar e comandar a nossa operação hoje?',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  
  const [copiedPromptId, setCopiedPromptId] = React.useState<string | null>(null);
  const [copiedPackageId, setCopiedPackageId] = React.useState<string | null>(null);
  const [copiedResultId, setCopiedResultId] = React.useState<string | null>(null);
  const [registeringForId, setRegisteringForId] = React.useState<string | null>(null);
  const [openclawDraft, setOpenclawDraft] = React.useState('');
  const [submittingResponse, setSubmittingResponse] = React.useState(false);
  const [approvalNotes, setApprovalNotes] = React.useState<Record<string, string>>({});
  const [submittingApprovalId, setSubmittingApprovalId] = React.useState<string | null>(null);
  const [submittingExecutionId, setSubmittingExecutionId] = React.useState<string | null>(null);
  const [executionErrors, setExecutionErrors] = React.useState<Record<string, string>>({});
  
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // ── Voice Input State ────────────────────────────────────────────────
  type VoiceState = 'idle' | 'listening' | 'transcribing' | 'ready' | 'error_permission' | 'unsupported';
  const [voiceState, setVoiceState] = React.useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);

  const startVoiceInput = React.useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceState('unsupported');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    if (voiceState === 'listening') {
      setVoiceState('idle');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setVoiceState('listening');
      setVoiceError(null);
    };

    recognition.onspeechend = () => {
      setVoiceState('transcribing');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || '';
      if (transcript) {
        setInputMessage(transcript);
        setVoiceState('ready');
      } else {
        setVoiceState('idle');
      }
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      recognitionRef.current = null;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceState('error_permission');
        setVoiceError('Permissão de microfone negada.');
      } else if (event.error === 'no-speech') {
        setVoiceState('idle');
      } else {
        setVoiceState('idle');
        setVoiceError(`Erro de voz: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setVoiceState(prev => prev === 'listening' || prev === 'transcribing' ? 'idle' : prev);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setVoiceState('idle');
    }
  }, [voiceState, setInputMessage]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (voiceState === 'ready') setVoiceState('idle');
  }, [voiceState]);

  React.useEffect(() => {
    if (voiceError) {
      const t = setTimeout(() => setVoiceError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [voiceError]);

  const handleCopyPrompt = (msgId: string, prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedPromptId(msgId);
      setTimeout(() => setCopiedPromptId(null), 2000);
    }).catch(() => {});
  };

  const buildHandoffPackage = (msg: Message): string => {
    return JSON.stringify({
      meta: {
        version: 'v1.5',
        generatedAt: new Date().toISOString(),
        mode: 'proposal_only',
        securityConstraints: {
          canExecuteNow: false,
          noDirectMutations: true,
          noExternalMessages: true,
          responseTarget: `pulso_requests/${msg.requestId}.openclawResult`,
          onlyAllowedActions: ['read', 'create_proposal', 'update_proposal']
        }
      },
      request: {
        id: msg.requestId || null,
        command: msg.originalCommand || msg.text,
        origin: 'lotus_live',
        source: 'pulso_live'
      },
      handoff: msg.interpretation?.handoff ? {
        target: msg.interpretation.handoff.target,
        intent: msg.interpretation.handoff.intent,
        domain: msg.interpretation.handoff.domain,
        riskLevel: msg.interpretation.handoff.riskLevel,
        actionType: msg.interpretation.handoff.actionType,
        requiresHumanConfirmation: msg.interpretation.handoff.requiresHumanConfirmation,
        entitiesMentioned: msg.interpretation.handoff.entitiesMentioned,
        suggestedNextStep: msg.interpretation.handoff.suggestedNextStep,
        executionPrompt: msg.interpretation.handoff.executionPrompt
      } : null,
      responseSchema: {
        processedBy: 'openclaw',
        responseText: '<string: resposta em linguagem natural>',
        statusTransition: 'proposal_ready | waiting_user_approval | completed | failed',
        sourcesConsulted: ['<array de strings>'],
        proposedMutation: null,
        auditLog: {
          model: '<opcional: gemini-2.0-flash ou similar>',
          skillUsed: '<opcional: nome da skill usada>',
          confidence: 'high | medium | low'
        }
      }
    }, null, 2);
  };

  const handleCopyPackage = (msgId: string, msg: Message) => {
    const pkg = buildHandoffPackage(msg);
    navigator.clipboard.writeText(pkg).then(() => {
      setCopiedPackageId(msgId);
      setTimeout(() => setCopiedPackageId(null), 2500);
    }).catch(() => {});
  };

  const handleRegisterOpenClawResponse = async (msg: Message) => {
    if (!openclawDraft.trim() || !msg.requestId) return;
    setSubmittingResponse(true);
    try {
      const needsApproval = msg.interpretation?.handoff?.requiresHumanConfirmation ?? false;
      let newStatus = needsApproval ? 'waiting_user_approval' : 'proposal_ready';
      let result = {
        processedBy: 'openclaw',
        processedAt: new Date(),
        responseText: openclawDraft.trim(),
        requiresHumanApproval: needsApproval,
        statusTransition: newStatus,
        auditLog: {
          confidence: 'medium' as const,
          notes: 'Registrado manualmente via Lótus Live — retorno assistido v1.8'
        }
      } as any;

      if (openclawDraft.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(openclawDraft.trim());
          const requiresApproval = parsed.requiresHumanApproval !== undefined ? Boolean(parsed.requiresHumanApproval) : needsApproval;
          newStatus = requiresApproval ? 'waiting_user_approval' : 'proposal_ready';
          
          result = {
            ...result,
            ...parsed,
            processedAt: new Date(),
            requiresHumanApproval: requiresApproval,
            statusTransition: newStatus
          };
        } catch (jsonErr) {
          console.error("Failed to parse openclawDraft JSON:", jsonErr);
        }
      }

      await requestsService.updateRequest(msg.requestId, {
        openclawResult: result as any,
        status: newStatus as any,
        updatedAt: new Date()
      });

      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, openclawResult: result, handoffStatus: newStatus, text: result.responseText }
          : m
      ));
      setRegisteringForId(null);
      setOpenclawDraft('');
    } catch (err: any) {
      console.error('[v1.7] Error registering OpenClaw response:', err);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleApproveProposal = async (msg: Message) => {
    if (!msg.requestId || submittingApprovalId) return;
    setSubmittingApprovalId(msg.id);
    const now = new Date().toISOString();
    const note = approvalNotes[msg.id]?.trim() || undefined;
    try {
      await requestsService.approveOpenClawProposal(msg.requestId, note);
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, handoffStatus: 'approved_by_user', userApproval: { approved: true, approvedAt: now, note } }
          : m
      ));
      setApprovalNotes(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
    } catch (err: any) {
      console.error('[v1.7] Error approving proposal:', err);
    } finally {
      setSubmittingApprovalId(null);
    }
  };

  const handleRejectProposal = async (msg: Message) => {
    if (!msg.requestId || submittingApprovalId) return;
    setSubmittingApprovalId(msg.id);
    const now = new Date().toISOString();
    const reason = approvalNotes[msg.id]?.trim() || undefined;
    try {
      await requestsService.rejectOpenClawProposal(msg.requestId, reason);
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, handoffStatus: 'rejected_by_user', userApproval: { approved: false, rejectedAt: now, reason } }
          : m
      ));
      setApprovalNotes(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
    } catch (err: any) {
      console.error('[v1.7] Error rejecting proposal:', err);
    } finally {
      setSubmittingApprovalId(null);
    }
  };

  const handleExecuteProposal = async (msg: Message, forceAsTriage = false) => {
    if (!msg.requestId || submittingExecutionId) return;
    setSubmittingExecutionId(msg.id);
    setExecutionErrors(prev => {
      const n = { ...prev };
      delete n[msg.id];
      return n;
    });

    try {
      const createdTask = await requestsService.executeApprovedProposal(msg.requestId, forceAsTriage);
      const now = new Date();
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? {
              ...m,
              handoffStatus: 'executed',
              executedAt: now.toISOString(),
              executedBy: 'felipe@dutra',
              createdEntityRef: `pulso_tasks/${createdTask.id}`,
              executionError: undefined
            }
          : m
      ));
    } catch (err: any) {
      console.error('[v1.8] Error executing proposal:', err);
      const errMsg = err.message || 'Erro desconhecido durante a execução.';
      setExecutionErrors(prev => ({ ...prev, [msg.id]: errMsg }));
      
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? {
              ...m,
              handoffStatus: 'execution_blocked',
              executionError: errMsg
            }
          : m
      ));
    } finally {
      setSubmittingExecutionId(null);
    }
  };

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load database state once
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
          
          const hasOpenClawResponse = !!req.openclawResult?.responseText;
          const replyText = hasOpenClawResponse
            ? req.openclawResult.responseText
            : (req.interpretation?.suggestedReply || 
               `Registrei o comando "${req.summary || req.title}" para processamento operacional.`);
          
          chatHistory.push({
            id: `lotus-${req.id || Math.random()}`,
            sender: 'lotus',
            text: replyText,
            timestamp: safeConvertToDate(req.updatedAt) || reqTime,
            interpretation: req.interpretation,
            openclawResult: req.openclawResult || undefined,
            handoffStatus: req.status,
            requestId: req.id || undefined,
            originalCommand: req.summary || req.title || undefined,
            executedAt: req.executedAt ? (req.executedAt instanceof Date ? req.executedAt.toISOString() : typeof req.executedAt === 'string' ? req.executedAt : req.executedAt.toDate?.().toISOString() || String(req.executedAt)) : undefined,
            executedBy: req.executedBy || undefined,
            createdEntityRef: req.createdEntityRef || undefined,
            executionError: req.executionError || undefined
          });
        });

        setMessages([
          {
            id: 'welcome',
            sender: 'lotus',
            text: 'olá fê. sou a lótus. sintonizei a central viva do pulso. como posso te auxiliar a orientar e comandar a nossa operação hoje?',
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

  // Real-time Firestore requests listener (Golden Path to OpenClaw usage)
  React.useEffect(() => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (!isFirestore) return;

    let unsubscribe: any = null;
    try {
      const { onSnapshot, collection, query, where } = require("firebase/firestore");
      const { db } = require("@/shared/lib/firebase/client");
      const { firestorePaths } = require("../services/firestorePaths");

      if (db) {
        const q = query(
          collection(db, firestorePaths.requests()),
          where("archived", "==", false),
          where("requestType", "==", "conversation_command")
        );

        unsubscribe = onSnapshot(q, (snapshot: any) => {
          const fetchedRequests: any[] = [];
          snapshot.forEach((docSnap: any) => {
            const data = docSnap.data();
            Object.keys(data).forEach(key => {
              if (data[key] && typeof data[key].toDate === 'function') {
                data[key] = data[key].toDate();
              }
            });
            fetchedRequests.push({ ...data, id: docSnap.id });
          });

          const sortedRequests = fetchedRequests.sort((a, b) => safeGetTime(a.requestedAt) - safeGetTime(b.requestedAt));

          const chatHistory: Message[] = [];
          sortedRequests.forEach((req: any) => {
            const reqTime = safeConvertToDate(req.requestedAt) || new Date();
            chatHistory.push({
              id: `user-${req.id}`,
              sender: 'user',
              text: req.summary || req.title || '',
              timestamp: reqTime
            });

            const hasOpenClawResponse = !!req.openclawResult?.responseText;
            const replyText = hasOpenClawResponse
              ? req.openclawResult.responseText
              : (req.interpretation?.suggestedReply || 
                 `Registrei o comando "${req.summary || req.title}" para processamento operacional.`);

            chatHistory.push({
              id: `lotus-${req.id}`,
              sender: 'lotus',
              text: replyText,
              timestamp: safeConvertToDate(req.updatedAt) || reqTime,
              interpretation: req.interpretation,
              openclawResult: req.openclawResult || undefined,
              handoffStatus: req.status,
              requestId: req.id || undefined,
              originalCommand: req.summary || req.title || undefined,
              executedAt: req.executedAt ? (req.executedAt instanceof Date ? req.executedAt.toISOString() : typeof req.executedAt === 'string' ? req.executedAt : req.executedAt.toDate?.().toISOString() || String(req.executedAt)) : undefined,
              executedBy: req.executedBy || undefined,
              createdEntityRef: req.createdEntityRef || undefined,
              executionError: req.executionError || undefined
            });
          });

          setMessages([
            {
              id: 'welcome',
              sender: 'lotus',
              text: 'olá fê. sou a lótus. sintonizei a central viva do pulso. como posso te auxiliar a orientar e comandar a nossa operação hoje?',
              timestamp: new Date()
            },
            ...chatHistory
          ]);
        });
      }
    } catch (err) {
      console.error("Firestore onSnapshot subscription failed:", err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawMsg = textToSend || inputMessage;
    if (!rawMsg.trim()) return;

    setInputMessage('');

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

      const interpretation = interpretLiveIntent(rawMsg, context);

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
        archived: false,
        interpretation,
        handoff: interpretation.handoff
      };

      const newRequest = await requestsService.createRequest(reqPayload);

      if (state) {
        setState((prev: any) => {
          if (!prev) return prev;
          const updatedRequests = [newRequest, ...(prev.allRequests || [])];
          return { ...prev, allRequests: updatedRequests };
        });
      }

      setTimeout(() => {
        const lotusMsg: Message = {
          id: `lotus-msg-${Date.now()}`,
          sender: 'lotus',
          text: interpretation.suggestedReply,
          timestamp: new Date(),
          interpretation,
          requestId: newRequest?.id || undefined,
          originalCommand: rawMsg
        };
        setMessages(prev => [...prev, lotusMsg]);
        setIsTyping(false);
      }, 800);

    } catch (err: any) {
      console.error('Error saving conversation request:', err);
      const lotusErrorMsg: Message = {
        id: `lotus-error-${Date.now()}`,
        sender: 'lotus',
        text: `falha ao registrar o comando no barramento: ${err?.message || 'erro de persistência'}.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, lotusErrorMsg]);
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen theme-her flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border border-[#fbf9f5]/20 border-t-[#fbf9f5] animate-spin mb-4" />
        <p className="text-[9px] font-light tracking-widest text-[#fbf9f5]/40 uppercase">sintonizando lótus live...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen theme-her flex flex-col items-center justify-center p-6 text-center text-[#fbf9f5]">
        <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle size={20} className="text-[#fbf9f5]" />
        </div>
        <h2 className="text-sm font-bold text-[#fbf9f5] mb-2 lowercase tracking-tight">falha de conexão</h2>
        <p className="text-xs text-[#fbf9f5]/65 max-w-sm mb-6 leading-relaxed">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/25 rounded-full text-[10px] font-bold text-[#fbf9f5] transition-all lowercase"
        >
          tentar reestabelecer
        </button>
      </div>
    );
  }

  // Real data parsing for sidebar
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

  const feTasks = openTasks.filter((t: any) => {
    const refs = t.ownerRefs;
    if (!refs || !Array.isArray(refs) || refs.length === 0) return true;
    return refs.some((ref: string) => ref.toLowerCase() === 'felipe' || ref.toLowerCase() === 'fe');
  });

  const nowTime = Date.now();
  const overdueTasks = openTasks.filter((t: any) => {
    const due = t.dueDate || t.dueAt;
    if (!due) return false;
    const dueTime = safeGetTime(due);
    return dueTime > 0 && dueTime < nowTime;
  });

  const brokenRoutines = allRoutines.filter((r: any) => r && (r.status === 'broken' || r.status === 'failed'));
  const steplessProjects = activeProjects.filter((p: any) => !p.nextStep || p.nextStep.trim() === '');
  const totalRisksCount = activeAlerts.length + brokenRoutines.length + overdueTasks.length + steplessProjects.length;

  const attentionSignals: any[] = [];
  activeAlerts.forEach((a: any) => {
    attentionSignals.push({
      id: a.id || `alert-${Math.random()}`,
      title: a.name || 'Alerta Técnico',
      subtitle: a.description || 'Instabilidade no sistema.',
      severity: a.severity === 'critical' ? 'critical' : 'warning'
    });
  });
  overdueTasks.forEach((t: any) => {
    attentionSignals.push({
      id: t.id || `overdue-${Math.random()}`,
      title: `${t.title || t.name}`,
      subtitle: `Prazo limite excedido em ${t.dueDate || t.dueAt ? formatDate(t.dueDate || t.dueAt) : 'data indefinida'}.`,
      severity: 'critical'
    });
  });
  steplessProjects.forEach((p: any) => {
    attentionSignals.push({
      id: p.id || `stepless-${Math.random()}`,
      title: `${p.name}`,
      subtitle: 'Sem próxima ação definida no ecossistema.',
      severity: 'warning'
    });
  });

  const feedItems: any[] = [];
  allRequests.slice(0, 10).forEach((req: any) => {
    let desc = '';
    const type = req.requestType || '';
    const title = req.title || req.summary || '';
    
    if (type === 'conversation_command') {
      desc = `Comando conversacional recebido: "${title}"`;
    } else {
      switch (req.status) {
        case 'requested': desc = `Registrou solicitação para: ${title || type}`; break;
        case 'needs_approval': desc = `Solicitou sua aprovação para: ${title || type}`; break;
        case 'completed': desc = `Concluiu e materializou: ${title || type}`; break;
        case 'failed': desc = `Falhou ao processar: ${title || type}`; break;
        default: desc = `Registrou movimentação em solicitação: ${title || type}`;
      }
    }
    feedItems.push({
      id: req.id || `feed-req-${Math.random()}`,
      event: desc,
      system: 'LÓTUS / BRIDGE',
      time: safeConvertToDate(req.requestedAt || req.updatedAt)
    });
  });

  pendingInbox.slice(0, 5).forEach((item: any) => {
    feedItems.push({
      id: item.id || `feed-inbox-${Math.random()}`,
      event: `Capturou e estacionou no Inbox: "${item.name || truncateText(item.body || '', 30)}"`,
      system: 'LÓTUS / INBOX',
      time: safeConvertToDate(item.createdAt || item.updatedAt)
    });
  });

  const sortedFeed = feedItems
    .filter(item => item.time !== null)
    .sort((a, b) => (b.time?.getTime() || 0) - (a.time?.getTime() || 0))
    .slice(0, 5);

  const nextBestActions: any[] = [];
  const pendingApprovals = allRequests.filter((r: any) => r.status === 'needs_approval');
  pendingApprovals.forEach((req: any) => {
    nextBestActions.push({
      text: `Revisar aprovação pendente: ${req.title || req.requestType}`,
      actionText: 'revisar inbox',
      onClick: () => router.push('/pulso/inbox'),
      priority: 'high'
    });
  });

  overdueTasks.slice(0, 2).forEach((t: any) => {
    nextBestActions.push({
      text: `Resolver tarefa atrasada: ${t.title || t.name}`,
      actionText: 'ver tarefas',
      onClick: () => router.push('/pulso/tarefas'),
      priority: 'high'
    });
  });

  if (nextBestActions.length === 0) {
    nextBestActions.push({
      text: 'Todos os fluxos críticos resolvidos. Sugestão: revisar o Registro da Lótus para novas capturas.',
      actionText: 'ir para inbox',
      onClick: () => router.push('/pulso/inbox'),
      priority: 'medium'
    });
  }

  // Animation resolver
  const getLotusAnimClass = () => {
    if (voiceState === 'listening') return 'lotus-listening-anim';
    if (voiceState === 'transcribing' || voiceState === 'ready') return 'lotus-responding-anim';
    
    // Check if any message is currently queued or processing by OpenClaw
    const isAnyRequestPending = messages.some(
      m => m.sender === 'lotus' && 
      (m.handoffStatus === 'requested' || m.handoffStatus === 'queued_for_openclaw' || m.handoffStatus === 'processing_by_openclaw')
    );
    if (isTyping || isAnyRequestPending) return 'lotus-thinking-anim';
    
    return 'lotus-idle-anim';
  };

  return (
    <div className="theme-her min-h-screen w-full flex flex-col justify-between py-8 px-4 md:px-8 relative overflow-hidden transition-colors duration-500 font-sans text-[#fbf9f5]">
      
      {/* 1. HEADER MINIMALISTA */}
      <header className="flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-[0.2em] text-[#fbf9f5]/80 lowercase">lótus live</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#fbf9f5] opacity-75" />
          <span className="text-[9px] font-light tracking-[0.1em] text-[#fbf9f5]/40 lowercase">
            {voiceState === 'listening' ? 'ouvindo...' : isTyping ? 'processando...' : 'conectada'}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-xs font-light tracking-widest text-[#fbf9f5]/80 hover:text-white transition-colors flex items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer"
          >
            <Menu size={12} className="stroke-[1.5]" />
            <span>[ sinais ]</span>
          </button>
        </div>
      </header>

      {/* 2. CENTRO ABSOLUTO (Círculo Lótus + Conversa) */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto my-12 z-10 relative">
        
        {/* Símbolo vivo da Lótus (Branco Gelo / Off-White) */}
        <div className="mb-14 relative flex items-center justify-center select-none">
          <svg className="w-32 h-32 transition-transform duration-700 ease-out" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="none"
              stroke="#fbf9f5"
              strokeWidth="7"
              strokeLinecap="round"
              className={getLotusAnimClass()}
            />
          </svg>
        </div>

        {/* Linha Editorial da Conversa (Textos em Off-White) */}
        <div className="w-full space-y-8 max-h-[380px] overflow-y-auto pr-1 no-scrollbar py-4 border-b border-white/10">
          {messages.map((msg) => {
            const isLotus = msg.sender === 'lotus';
            return (
              <div 
                key={msg.id} 
                className={`flex w-full ${isLotus ? 'justify-start' : 'justify-end'} animate-fade-in`}
              >
                <div className="max-w-[85%] space-y-1">
                  {/* Sender label */}
                  <span className={`block text-[9px] tracking-widest lowercase select-none ${
                    isLotus ? 'text-white font-bold opacity-90' : 'text-[#fbf9f5]/50 font-light'
                  }`}>
                    {isLotus ? 'lótus' : 'fê'}
                  </span>
                  
                  {/* Text body */}
                  <div className={`text-sm leading-relaxed font-light text-[#fbf9f5] ${!isLotus ? 'text-right' : 'text-left'}`}>
                    {renderMarkdown(msg.text)}
                  </div>

                  {/* Operational result / Governance UI (v1.7 & v1.8) */}
                  {isLotus && msg.openclawResult && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-3 text-left">
                      
                      {/* Status row */}
                      <div className="flex items-center gap-2 text-[9px] text-[#fbf9f5]/60 font-light lowercase">
                        {msg.handoffStatus === 'waiting_user_approval' ? (
                          <><Clock size={10} className="stroke-[1.5]" /><span>aguarda aprovação humana</span></>
                        ) : msg.handoffStatus === 'executed' ? (
                          <><Check size={10} className="text-white/90 stroke-[2]" /><span>executada com sucesso</span></>
                        ) : msg.openclawResult.errors && msg.openclawResult.errors.length > 0 ? (
                          <><AlertTriangle size={10} className="stroke-[1.5] text-white" /><span>falha no processamento</span></>
                        ) : (
                          <><Zap size={10} className="stroke-[1.5]" /><span>resposta obtida</span></>
                        )}
                        
                        {/* Copy package */}
                        <button
                          onClick={() => handleCopyPackage(msg.id, msg)}
                          className="ml-auto text-[8px] text-[#fbf9f5]/40 hover:text-white transition-colors lowercase bg-transparent border-none cursor-pointer outline-none"
                          title="Copiar pacote JSON para OpenClaw"
                        >
                          {copiedPackageId === msg.id ? '[ copiado ]' : '[ copiar pacote ]'}
                        </button>
                      </div>

                      {/* Execution feedback */}
                      {msg.handoffStatus === 'executed' && msg.createdEntityRef && (
                        <p className="text-[10px] font-mono text-white bg-white/10 p-2 rounded-lg select-all border border-white/10">
                          tarefa criada: {msg.createdEntityRef}
                        </p>
                      )}

                      {/* Blocked governance warning — NEGATIVO (fundo off-white, texto terracota) */}
                      {msg.handoffStatus === 'execution_blocked' && (
                        <div className="p-3 bg-[#fbf9f5] border border-[#e59f8c]/20 rounded-xl space-y-1.5 text-[#3d2f2f]">
                          <p className="text-[9px] text-[#cf735c] font-bold lowercase">execução bloqueada</p>
                          <p className="text-[10px] text-[#3d2f2f]/80 font-light leading-relaxed">{msg.executionError || 'responsável não designado.'}</p>
                          
                          {/* Force triage button */}
                          {(msg.executionError || '').includes("ownerRefs") && (
                            <button
                              onClick={() => handleExecuteProposal(msg, true)}
                              disabled={submittingExecutionId === msg.id}
                              className="text-[9px] font-bold text-[#cf735c] hover:text-[#b3563f] transition-colors lowercase bg-transparent border-none cursor-pointer outline-none block mt-1"
                            >
                              {submittingExecutionId === msg.id ? '[ executando... ]' : '[ confirmar como triagem & executar ]'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Approval panels — NEGATIVO (fundo off-white, texto terracota) */}
                      {msg.openclawResult.requiresHumanApproval && msg.handoffStatus === 'waiting_user_approval' && (
                        <div className="p-3 bg-[#fbf9f5] border border-[#e59f8c]/25 rounded-xl space-y-3 text-[#3d2f2f]">
                          <span className="block text-[9px] font-bold text-[#cf735c] tracking-widest lowercase">decisão pendente</span>
                          
                          <input
                            type="text"
                            value={approvalNotes[msg.id] || ''}
                            onChange={e => setApprovalNotes(prev => ({ ...prev, [msg.id]: e.target.value }))}
                            placeholder="nota (opcional)..."
                            className="w-full text-xs text-[#3d2f2f] bg-transparent border-b border-[#3d2f2f]/20 focus:border-[#cf735c] py-1 px-0.5 outline-none placeholder-[#3d2f2f]/45 lowercase"
                            disabled={submittingApprovalId === msg.id}
                          />

                          <div className="flex gap-4">
                            <button
                              onClick={() => handleApproveProposal(msg)}
                              disabled={submittingApprovalId === msg.id}
                              className="text-[10px] font-bold text-[#cf735c] hover:text-[#b3563f] transition-colors lowercase bg-transparent border-none cursor-pointer outline-none"
                            >
                              {submittingApprovalId === msg.id ? '[ registrando... ]' : '[ aprovar proposta ]'}
                            </button>
                            <button
                              onClick={() => handleRejectProposal(msg)}
                              disabled={submittingApprovalId === msg.id}
                              className="text-[10px] font-light text-[#3d2f2f]/60 hover:text-[#3d2f2f] transition-colors lowercase bg-transparent border-none cursor-pointer outline-none"
                            >
                              [ rejeitar ]
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Approved & Executable (v1.8 create_task allowlist) */}
                      {msg.handoffStatus === 'approved_by_user' && msg.openclawResult.proposedMutation?.type === 'create_task' && (
                        <button
                          onClick={() => handleExecuteProposal(msg, false)}
                          disabled={submittingExecutionId === msg.id}
                          className="w-full text-center py-2 bg-white/10 hover:bg-white/20 text-[10px] font-bold text-[#fbf9f5] border border-white/25 rounded-full transition-all lowercase cursor-pointer outline-none"
                        >
                          {submittingExecutionId === msg.id ? '[ executando... ]' : '[ executar criação de tarefa ]'}
                        </button>
                      )}
                      
                    </div>
                  )}

                  {/* Pending local queue responses manual input panel — TRANSLÚCIDO */}
                  {isLotus && msg.interpretation?.handoff && !msg.openclawResult && (msg.handoffStatus === 'requested' || msg.handoffStatus === 'queued_for_openclaw') && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 text-left">
                      {registeringForId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={openclawDraft}
                            onChange={e => setOpenclawDraft(e.target.value)}
                            placeholder="cole a resposta do openclaw (responseText)..."
                            className="w-full text-xs text-[#fbf9f5] bg-white/10 border border-white/20 focus:border-white rounded-xl px-3 py-2 outline-none resize-none font-mono placeholder-white/30 lowercase"
                            rows={3}
                            disabled={submittingResponse}
                          />
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => { setRegisteringForId(null); setOpenclawDraft(''); }}
                              className="text-[9px] text-[#fbf9f5]/50 hover:text-white lowercase bg-transparent border-none cursor-pointer outline-none"
                            >
                              cancelar
                            </button>
                            <button
                              onClick={() => handleRegisterOpenClawResponse(msg)}
                              disabled={!openclawDraft.trim() || submittingResponse}
                              className="text-[9px] font-bold text-white disabled:opacity-35 lowercase bg-transparent border-none cursor-pointer outline-none"
                            >
                              [ registrar ]
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRegisteringForId(msg.id)}
                          className="text-[9px] font-light text-[#fbf9f5]/60 hover:text-white transition-colors lowercase bg-transparent border-none cursor-pointer outline-none"
                        >
                          [ registrar retorno da lótus manualmente ]
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing state mock */}
          {isTyping && (
            <div className="flex justify-start w-full animate-pulse select-none text-left">
              <div className="space-y-1">
                <span className="block text-[9px] tracking-widest text-[#fbf9f5] font-bold lowercase">lótus</span>
                <span className="text-xs font-light text-[#fbf9f5]/40">pensando...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* 3. ENTRADA DE COMUNICAÇÃO (Voz + Texto em Off-White) */}
      <footer className="w-full max-w-xl mx-auto flex flex-col items-center gap-4 z-10 select-none">
        
        {/* Quick Suggestion links */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar max-w-full text-[10px] text-[#fbf9f5]/60 font-light tracking-wide pb-1 whitespace-nowrap">
          {[
            { label: 'resumo do dia', text: 'Resumo do meu dia' },
            { label: 'o que depende de mim', text: 'O que depende de mim?' },
            { label: 'tarefas atrasadas', text: 'Quais tarefas estão atrasadas?' },
            { label: 'projetos estagnados', text: 'Quais projetos estão travados?' }
          ].map((sugg, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sugg.text)}
              className="hover:text-white text-[#fbf9f5]/70 transition-colors border-b border-white/15 pb-0.5 bg-transparent border-none cursor-pointer outline-none"
            >
              {sugg.label}
            </button>
          ))}
        </div>

        {/* Core Input Container */}
        <div className="w-full flex items-center gap-3.5 bg-transparent border-b border-white/20 focus-within:border-white transition-colors py-2 px-1">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="falar ou digitar comando..."
            className="flex-1 bg-transparent border-none text-sm font-light text-white placeholder:text-white/30 outline-none lowercase"
          />

          {/* Voice recorder button */}
          {voiceState !== 'unsupported' && (
            <button
              onClick={startVoiceInput}
              className={`p-1.5 rounded-full transition-all duration-300 cursor-pointer border-none outline-none bg-transparent ${
                voiceState === 'listening' 
                  ? 'text-[#cf735c] bg-white scale-105 shadow-md' 
                  : 'text-[#fbf9f5]/60 hover:text-white'
              }`}
              title={voiceState === 'listening' ? 'ouvindo... clique para parar' : 'capturar áudio'}
            >
              {voiceState === 'listening' ? <Mic size={14} className="animate-pulse" /> : <Mic size={14} />}
            </button>
          )}

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim()}
            className="p-1.5 text-[#fbf9f5]/60 hover:text-white disabled:opacity-20 disabled:hover:text-[#fbf9f5]/60 transition-colors bg-transparent border-none cursor-pointer outline-none"
          >
            <Send size={14} />
          </button>
        </div>
      </footer>

      {/* 4. CAMADA LATERAL ULTRALEVE — NEGATIVO (Fundo Off-White, Texto Terracota) */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-[#fbf9f5]/98 backdrop-blur-lg border-l border-[#e59f8c]/25 shadow-2xl transition-all duration-500 ease-out transform ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } p-6 overflow-y-auto no-scrollbar flex flex-col justify-between text-left text-[#3d2f2f]`}
      >
        <div className="space-y-8">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-[#3c2f2f]/10 pb-4">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#cf735c] stroke-[2]" />
              <span className="text-xs font-bold tracking-widest text-[#3d2f2f]/85 lowercase">sinais operacionais</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-[#3c2f2f]/45 hover:text-[#cf735c] transition-colors bg-transparent border-none cursor-pointer outline-none"
            >
              <X size={16} />
            </button>
          </div>

          {/* Sinais de Atenção */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold tracking-widest text-[#3c2f2f]/45 uppercase">briefing do agora</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#faf6f0] border border-[#e59f8c]/20 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[8px] font-light text-[#3d2f2f]/60 lowercase">minhas tarefas</span>
                <span className="text-xl font-bold mt-1 text-[#3d2f2f]">{feTasks.length}</span>
              </div>
              <div className="bg-[#faf6f0] border border-[#e59f8c]/20 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[8px] font-light text-[#3d2f2f]/60 lowercase">riscos & travas</span>
                <span className="text-xl font-bold mt-1 text-[#c9554d]">{totalRisksCount}</span>
              </div>
              <div className="bg-[#faf6f0] border border-[#e59f8c]/20 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[8px] font-light text-[#3d2f2f]/60 lowercase">projetos ativos</span>
                <span className="text-xl font-bold mt-1 text-[#3d2f2f]">{activeProjects.length}</span>
              </div>
              <div className="bg-[#faf6f0] border border-[#e59f8c]/20 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[8px] font-light text-[#3d2f2f]/60 lowercase">metabolismo</span>
                <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide ${brokenRoutines.length > 0 ? 'text-[#c9554d]' : 'text-[#52856d]'}`}>
                  {brokenRoutines.length > 0 ? 'instável' : 'saudável'}
                </span>
              </div>
            </div>
          </div>

          {/* Próximas Melhores Ações */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold tracking-widest text-[#3c2f2f]/45 uppercase">ações recomendadas</h4>
            <div className="space-y-2.5">
              {nextBestActions.map((action, i) => (
                <div key={i} className="p-3 bg-[#faf6f0] border border-[#e59f8c]/15 rounded-xl flex flex-col justify-between gap-2">
                  <p className="text-[11px] font-light text-[#3d2f2f] leading-normal">{action.text}</p>
                  <button 
                    onClick={() => { action.onClick(); setIsSidebarOpen(false); }}
                    className="text-[9px] font-bold text-[#cf735c] hover:text-[#b3563f] flex items-center gap-1 transition-colors self-start lowercase bg-transparent border-none cursor-pointer outline-none"
                  >
                    <span>{action.actionText}</span>
                    <ArrowRight size={8} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Projetos Vivos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold tracking-widest text-[#3c2f2f]/45 uppercase">projetos ativos</h4>
              <button 
                onClick={() => { router.push('/pulso/ecossistema'); setIsSidebarOpen(false); }}
                className="text-[9px] text-[#cf735c] hover:underline lowercase bg-transparent border-none cursor-pointer outline-none"
              >
                ver ecossistema
              </button>
            </div>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
              {activeProjects.slice(0, 4).map((p: any) => (
                <div key={p.id} className="p-2.5 bg-[#faf6f0] border border-[#e59f8c]/15 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-medium text-[#3d2f2f] truncate max-w-[150px]">{p.name}</span>
                  <span className="text-[9px] font-light text-[#3d2f2f]/60 truncate max-w-[120px]">
                    {p.nextStep ? p.nextStep : 'sem passo'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fontes monitoradas */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold tracking-widest text-[#3c2f2f]/45 uppercase">fontes observadas</h4>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
              {allSources.slice(0, 5).map((src: any, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-1 px-2 hover:bg-[#faf6f0] rounded-lg">
                  <span className="text-[#3d2f2f] font-light">{src.name}</span>
                  <span className="text-[8px] font-bold text-[#52856d] uppercase tracking-wider">sintonizado</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Drawer Footer / Backstage trigger */}
        <div className="border-t border-[#3c2f2f]/10 pt-4 mt-8 flex flex-col gap-2">
          <button 
            onClick={() => { router.push('/pulso/eventos'); setIsSidebarOpen(false); }}
            className="w-full text-center py-2 border border-[#3c2f2f]/20 rounded-full text-[9px] font-bold text-[#3c2f2f]/60 hover:text-[#cf735c] hover:border-[#cf735c]/40 transition-colors lowercase bg-transparent cursor-pointer outline-none"
          >
            abrir bastidor técnico (logs)
          </button>
        </div>

      </div>

    </div>
  );
}
