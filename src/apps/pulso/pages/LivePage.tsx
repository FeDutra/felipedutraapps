'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableAreaItem({ area, isActive, onClick, icon, hasUnread }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: area.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as any,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex items-center gap-2.5 cursor-pointer group/item py-1 touch-none`}
    >
      <span
        className={`text-lg text-center transition-all duration-300 font-mono ${
          isActive
            ? 'text-white scale-110 opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
            : hasUnread
            ? 'pulso-unread scale-110 opacity-100 animate-pulse font-bold'
            : 'text-[#fbf9f5]/35 group-hover/item:text-[#fbf9f5]/80 group-hover/item:scale-110'
        }`}
        style={{ width: '24px' }}
      >
        {icon}
      </span>
      <span
        className={`text-[9px] tracking-widest uppercase font-sans font-light transition-all duration-300 opacity-0 max-w-0 overflow-hidden whitespace-nowrap group-hover/sidebar:opacity-40 group-hover/sidebar:max-w-[150px] group-hover/item:opacity-90 ${
          isActive ? 'text-white font-medium' : hasUnread ? 'pulso-unread font-bold animate-pulse' : 'text-[#fbf9f5]'
        }`}
      >
        {area.name}
      </span>
    </div>
  );
}

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
import { lotusOpenClawClient } from '../services/lotusOpenClawClient';
import { useSearchParams } from 'next/navigation';
import { ContextSurfaceVariants } from '../components/system/ContextSurfaceVariants';
import { 
  MessageRenderer, 
  MessageActions, 
  formatMessageTimestamp 
} from '../components/chat/MessageRenderer';
import { routeInputToArea } from '../../../lib/pulso/AreaRouter';
import { normalizeTranscript } from '../../../lib/pulso/normalizeTranscript';
import { candidateAreas } from '../scripts/seedAreas';
import { TTSAdapter, TTSPreferences } from '../../../lib/pulso/TTSAdapter';
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
  Database,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Camera,
  Volume2,
  Square,
  ArrowDown,
  UploadCloud,
  ExternalLink,
  Download,
  Edit2,
  Archive,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { formatDate, truncateText } from '../utils/formatters';
import { interpretLiveIntent } from '../utils/liveIntentInterpreter';
import { onSnapshot, collection, query, where, doc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from '../../../shared/lib/firebase/client';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { firestorePaths } from '../services/firestorePaths';
import { PulsoContextNode } from '../types/pulso.types';

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'audio' | 'generic';
  mimeType: string;
  url: string;
  sizeBytes?: number;
  createdAt: Date;
  contextId: string;
}

// NOTA: Esta lista estática é estritamente temporária/de transição.
// Ela será totalmente descontinuada na próxima fase para dar lugar à criação
// e persistência dinâmica de chats vinculados a cada uma das 14 áreas estruturais.
const INITIAL_CONTEXT_NODES: PulsoContextNode[] = [
  // Sistema
  {
    areaId: "area_sistema",
    subareaId: "pulso",
    contextId: "sistema_pulso",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:sistema_pulso",
    label: "pulso"
  },
  {
    areaId: "area_sistema",
    subareaId: "infraestrutura",
    contextId: "sistema_infraestrutura",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:sistema_infraestrutura",
    label: "infraestrutura"
  },
  {
    areaId: "area_sistema",
    subareaId: "openclaw_agentes",
    contextId: "sistema_openclaw_agentes",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:sistema_openclaw_agentes",
    label: "openclaw e agentes"
  },
  // Trabalho
  {
    areaId: "area_trabalho",
    subareaId: "modu",
    contextId: "trabalho_modu",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:trabalho_modu",
    label: "modú"
  },
  {
    areaId: "area_trabalho",
    subareaId: "despertar",
    contextId: "trabalho_despertar",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:trabalho_despertar",
    label: "despertar"
  },
  // Casa
  {
    areaId: "area_casa",
    subareaId: "construcao",
    contextId: "casa_construcao",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:casa_construcao",
    label: "construção"
  },
  {
    areaId: "area_casa",
    subareaId: "horta",
    contextId: "casa_horta",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:casa_horta",
    label: "horta"
  },
  // Família
  {
    areaId: "area_familia",
    subareaId: "escola_guayi",
    contextId: "familia_escola_guayi",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:familia_escola_guayi",
    label: "escola guayi"
  },
  // Criação
  {
    areaId: "area_criacao",
    subareaId: "producao_autoral",
    contextId: "criacao_producao_autoral",
    chatId: "default",
    openclawSessionKey: "agent:main:pulso:criacao_producao_autoral",
    label: "produção autoral"
  }
];

const AREA_NAMES: Record<string, string> = {
  area_eu: "eu",
  area_trabalho: "trabalho",
  area_casa: "casa",
  area_familia: "família",
  area_criacao: "criação",
  area_estudo: "estudo",
  area_habitos: "hábitos",
  area_saude: "saúde",
  area_dinheiro: "dinheiro",
  area_pessoas: "pessoas",
  area_viagens: "viagens",
  area_lazer: "lazer",
  area_sistema: "sistema",
  area_futuro: "futuro"
};

const AREA_ORDER = [
  "area_eu",
  "area_trabalho",
  "area_casa",
  "area_familia",
  "area_criacao",
  "area_estudo",
  "area_habitos",
  "area_saude",
  "area_dinheiro",
  "area_pessoas",
  "area_viagens",
  "area_lazer",
  "area_sistema",
  "area_futuro"
];

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
    processedAt?: string;
    createdAt?: string;
    links?: Array<{ label: string; url: string }>;
    actions?: Array<{ label: string; type: string; payload?: any; requiresConfirmation?: boolean }>;
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
  contextId?: string | null;
  attachments?: Attachment[];
}

export type VoiceMode = 'off' | 'recording_once' | 'presence';
export type PresenceState = 
  | 'presence_idle' 
  | 'presence_requesting_permission' 
  | 'presence_listening' 
  | 'presence_transcribing' 
  | 'presence_sending' 
  | 'presence_waiting_response' 
  | 'presence_speaking' 
  | 'presence_error';


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
  const [lastSentRequestsByContext, setLastSentRequestsByContext] = React.useState<Record<string, string>>({});
  const [contextTypingStates, setContextTypingStates] = React.useState<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [presenceMode, setPresenceMode] = React.useState(false);
  const [showAttachmentToast, setShowAttachmentToast] = React.useState(false);
  const [customContextNodes, setCustomContextNodes] = React.useState<PulsoContextNode[]>([]);
  
  React.useEffect(() => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (!isFirestore) {
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('pulso_custom_contexts');
          if (saved) {
            setCustomContextNodes(JSON.parse(saved));
          }
        } catch (e) {
          console.error(e);
        }
      }
      return;
    }

    if (loading || !db) return;

    let unsubscribe: any = null;
    try {
      const q = query(collection(db, firestorePaths.customContexts()));
      unsubscribe = onSnapshot(q, (snapshot: any) => {
        const nodes: PulsoContextNode[] = [];
        snapshot.forEach((docSnap: any) => {
          const data = docSnap.data();
          nodes.push({
            areaId: data.areaId,
            contextId: data.contextId,
            chatId: data.chatId || "default",
            openclawSessionKey: data.openclawSessionKey,
            label: data.label,
            archived: data.archived || false
          });
        });
        setCustomContextNodes(nodes);
      }, (error: any) => {
        console.error("Firestore customContexts onSnapshot error:", error);
      });
    } catch (e) {
      console.error("Failed to subscribe to customContexts:", e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [db, loading]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateThemeColor = () => {
      const currentTheme = localStorage.getItem('pulso-theme') || 'orange';
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute('content', currentTheme === 'black' ? '#0f0f0f' : '#b8283e');
    };
    updateThemeColor();
    window.addEventListener('pulso-theme-change', updateThemeColor);
    return () => window.removeEventListener('pulso-theme-change', updateThemeColor);
  }, []);

  const allContextNodes = React.useMemo(() => {
    const visibleCustom = customContextNodes.filter(n => !n.archived);
    return [...INITIAL_CONTEXT_NODES, ...visibleCustom];
  }, [customContextNodes]);

  const pageLoadTimeRef = React.useRef(new Date());
  const [lastReadTimes, setLastReadTimes] = React.useState<Record<string, string>>({});
  
  const unreadContexts = React.useMemo(() => {
    const unreads: Record<string, boolean> = {};
    messages.forEach(msg => {
      if (msg.sender === 'lotus' && msg.contextId && msg.id !== 'welcome') {
        const lastRead = lastReadTimes[msg.contextId] || pageLoadTimeRef.current.toISOString();
        const msgTime = new Date(msg.timestamp).getTime();
        if (msgTime > new Date(lastRead).getTime()) {
          unreads[msg.contextId] = true;
        }
      }
    });
    return unreads;
  }, [messages, lastReadTimes]);

  const markContextAsRead = React.useCallback((contextId: string) => {
    const nowStr = new Date().toISOString();
    setLastReadTimes(prev => {
      if (prev[contextId] === nowStr) return prev;
      return { ...prev, [contextId]: nowStr };
    });
    localStorage.setItem(`pulso_last_read_${contextId}`, nowStr);
    
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (isFirestore && db) {
      setDoc(doc(db, `workspaces/felipe_dutra/pulso_meta/read_status`), {
        [contextId]: nowStr
      }, { merge: true }).catch(err => console.error("Failed to save read status to Firestore:", err));
    }
  }, []);

  const [activeContextNode, setActiveContextNode] = React.useState<PulsoContextNode>(INITIAL_CONTEXT_NODES[0]);
  const activeContextNodeRef = React.useRef(activeContextNode);
  React.useEffect(() => {
    activeContextNodeRef.current = activeContextNode;
    markContextAsRead(activeContextNode.contextId);
  }, [activeContextNode, markContextAsRead]);

  // Load and listen to read status from localStorage/Firestore
  React.useEffect(() => {
    // 1. Load from localStorage
    const localTimes: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pulso_last_read_')) {
        const contextId = key.replace('pulso_last_read_', '');
        localTimes[contextId] = localStorage.getItem(key) || '';
      }
    }
    setLastReadTimes(localTimes);

    // 2. Load and listen from Firestore
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (isFirestore && db) {
      const docRef = doc(db, 'workspaces/felipe_dutra/pulso_meta/read_status');
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() || {};
          setLastReadTimes(prev => {
            const updated = { ...prev };
            let hasChanges = false;
            Object.entries(data).forEach(([contextId, timeStr]) => {
              if (typeof timeStr === 'string') {
                const localTime = prev[contextId] ? new Date(prev[contextId]).getTime() : 0;
                const firestoreTime = new Date(timeStr).getTime();
                if (firestoreTime > localTime) {
                  updated[contextId] = timeStr;
                  localStorage.setItem(`pulso_last_read_${contextId}`, timeStr);
                  hasChanges = true;
                }
              }
            });
            return hasChanges ? updated : prev;
          });
        }
      }, (err) => {
        console.error("Failed to subscribe to read status:", err);
      });
      return unsubscribe;
    }
  }, []);
  const activeAreaId = activeContextNode.areaId;
  const isTyping = contextTypingStates[activeContextNode?.contextId] || false;
  const currentMessages = React.useMemo(() => {
    return messages.filter(msg => {
      if (msg.id === 'welcome') return true;
      return msg.contextId === activeContextNode.contextId;
    });
  }, [messages, activeContextNode.contextId]);

  const setContextTyping = (contextId: string, typing: boolean) => {
    setContextTypingStates(prev => ({ ...prev, [contextId]: typing }));
  };

  const [editingContextId, setEditingContextId] = React.useState<string | null>(null);
  const [editingContextLabel, setEditingContextLabel] = React.useState('');
  const [addingChatAreaId, setAddingChatAreaId] = React.useState<string | null>(null);
  const [newChatName, setNewChatName] = React.useState('');
  const [hoveredAreaId, setHoveredAreaId] = React.useState<string | null>(null);
  const [isContextSheetOpen, setIsContextSheetOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [activeMobileAreaId, setActiveMobileAreaId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeContextNode?.areaId) {
      setActiveMobileAreaId(activeContextNode.areaId);
    }
  }, [activeContextNode?.areaId]);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = React.useState(false);
  const headerMenuRef = React.useRef<HTMLDivElement>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = React.useState<Attachment | null>(null);
  const [previewPdf, setPreviewPdf] = React.useState<Attachment | null>(null);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const [uploadingFiles, setUploadingFiles] = React.useState<Record<string, { name: string; progress: number; status?: string; error?: boolean; contextId: string }>>({});

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
        setPreviewPdf(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const searchParams = useSearchParams();
  const contextSurfaceVariant = searchParams?.get('contextSurface') as 'a' | 'b' | 'c' | null;
  const [isContextSurfaceOpen, setIsContextSurfaceOpen] = React.useState(!!contextSurfaceVariant);
  const activeVariant = contextSurfaceVariant || 'a';

  React.useEffect(() => {
    if (contextSurfaceVariant) {
      setIsContextSurfaceOpen(true);
    }
  }, [contextSurfaceVariant]);

  const getAreaIcon = (area: any) => {
    if (!area) return '○';
    const identifier = (area.slug || area.id || area.name || '').toLowerCase();
    
    if (identifier.includes('casa')) return '⌂';
    if (identifier.includes('familia') || identifier.includes('família')) return '◎';
    if (identifier.includes('trabalho')) return '▦';
    if (identifier.includes('criacao') || identifier.includes('criação')) return '✦';
    if (identifier.includes('estudo')) return '◈';
    if (identifier.includes('habitos') || identifier.includes('hábitos')) return '〰';
    if (identifier.includes('saude') || identifier.includes('saúd')) return '✚';
    if (identifier.includes('dinheiro')) return '◌';
    if (identifier.includes('pessoas')) return '⟡';
    if (identifier.includes('viagens')) return '▻';
    if (identifier.includes('lazer')) return '✹';
    if (identifier.includes('sistema')) return '⌘';
    if (identifier.includes('futuro')) return '▲';
    if (identifier.includes('eu')) return '⊙';
    
    return '⚬';
  };
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = React.useState(false);
  const attachmentMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [copiedPromptId, setCopiedPromptId] = React.useState<string | null>(null);
  const [copiedPackageId, setCopiedPackageId] = React.useState<string | null>(null);
  const voiceReplyRequestsRef = React.useRef<Set<string>>(new Set());
  const currentTextRef = React.useRef<string>('');

  // TTS instantiation
  const [ttsAdapter] = React.useState(() => new TTSAdapter());
  const [ttsPrefs, setTtsPrefs] = React.useState<TTSPreferences>(() => ttsAdapter.getPreferences());
  const [availableVoices, setAvailableVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [isTtsSettingsOpen, setIsTtsSettingsOpen] = React.useState(false);
  const [kokoroEndpoint, setKokoroEndpoint] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pulso_tts_kokoro_endpoint') || 'http://127.0.0.1:8880/v1/audio/speech';
    }
    return 'http://127.0.0.1:8880/v1/audio/speech';
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = ttsAdapter.getPortugueseVoices();
      setAvailableVoices(voices);
      
      // Auto-update prefs if standard voice selected is empty but we have voices loaded
      const currentPrefs = ttsAdapter.getPreferences();
      if (!currentPrefs.voiceURI && voices.length > 0) {
        const defVoice = ttsAdapter.getDefaultPortugueseVoice();
        if (defVoice) {
          const updated = {
            ...currentPrefs,
            voiceURI: defVoice.voiceURI,
            voiceName: defVoice.name,
            voiceLang: defVoice.lang
          };
          setTtsPrefs(updated);
          ttsAdapter.updatePreferences(updated);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [ttsAdapter]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresenceMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [copiedResultId, setCopiedResultId] = React.useState<string | null>(null);
  const [registeringForId, setRegisteringForId] = React.useState<string | null>(null);
  const [openclawDraft, setOpenclawDraft] = React.useState('');
  const [submittingResponse, setSubmittingResponse] = React.useState(false);
  const [approvalNotes, setApprovalNotes] = React.useState<Record<string, string>>({});
  const [submittingApprovalId, setSubmittingApprovalId] = React.useState<string | null>(null);
  const [submittingExecutionId, setSubmittingExecutionId] = React.useState<string | null>(null);
  const [executionErrors, setExecutionErrors] = React.useState<Record<string, string>>({});
  const [playingMsgId, setPlayingMsgId] = React.useState<string | null>(null);
  const [playingState, setPlayingState] = React.useState<'stopped' | 'preparing' | 'playing' | 'error/fallback'>('stopped');

  // Voice State Machine additions
  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>('off');
  const [presenceState, setPresenceState] = React.useState<PresenceState>('presence_idle');

  const voiceModeRef = React.useRef<VoiceMode>('off');
  const presenceStateRef = React.useRef<PresenceState>('presence_idle');
  const maxRecordingTimeoutRef = React.useRef<any>(null);
  const spokenRequestsRef = React.useRef<Set<string>>(new Set());
  
  // Latency and session session state tracking
  const presenceSessionStartTimeRef = React.useRef<number>(0);
  const latencyStopRecRef = React.useRef<number | null>(null);
  const latencyTranscriptionRef = React.useRef<number | null>(null);
  const latencyRequestCreatedRef = React.useRef<number | null>(null);
  const latencyResponseReceivedRef = React.useRef<number | null>(null);
  const latencyAutoTtsStartRef = React.useRef<number | null>(null);

  const [presenceSoundCuesEnabled, setPresenceSoundCuesEnabled] = React.useState(true);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Helper to generate soft synth tones with smooth envelopes and no clicks (warm chords)
  const playSynthTone = React.useCallback((ctx: AudioContext, freqs: number[], type: OscillatorType, startTime: number, duration: number, startVolume: number) => {
    freqs.forEach((freq) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        // Soft attack to avoid digital clicking (15ms fade-in)
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(startVolume / freqs.length, startTime + 0.015);
        
        // Soft release (decay to zero exponentially)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      } catch (err) {
        console.warn('Oscillator setup failed:', err);
      }
    });
  }, []);

  const playPresenceSoundCue = React.useCallback((type: 'start_listening' | 'sent' | 'response_arrived' | 'speak_start' | 'error') => {
    if (!presenceSoundCuesEnabled) {
      console.log('[PULSO_PRESENCE_SOUND_CUE_SKIPPED_DISABLED]', { type });
      return;
    }
    console.log('[PULSO_PRESENCE_SOUND_CUE_PLAY]', { type });
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      if (type === 'start_listening') {
        // Soft ascending fifth chord sweep (A3, E4, A4) - warm synthesizer rise
        playSynthTone(ctx, [220.00, 330.00, 440.00], 'triangle', now, 0.35, 0.12);
      } else if (type === 'sent') {
        // Quick soft high chime (A5, E6) - clean chirp
        playSynthTone(ctx, [880.00, 1318.51], 'sine', now, 0.15, 0.08);
      } else if (type === 'response_arrived') {
        // Warm C-Major 7th bell chord (C5, E5, G5, B5)
        playSynthTone(ctx, [523.25, 659.25, 783.99, 987.77], 'sine', now, 0.5, 0.15);
      } else if (type === 'speak_start') {
        // Soft positive swell (A4, C#5, E5) - warm synthesizer chord
        playSynthTone(ctx, [440.00, 554.37, 659.25], 'sine', now, 0.4, 0.10);
      } else if (type === 'error') {
        // Warm low warning (E3, G3)
        playSynthTone(ctx, [164.81, 196.00], 'triangle', now, 0.45, 0.14);
      }
    } catch (e) {
      console.warn('Failed to play presence sound cue:', e);
    }
  }, [presenceSoundCuesEnabled, playSynthTone]);

  // ── Notification State & Programmatic Sound Cues ───────────────────────
  const [notificationSoundEnabled, setNotificationSoundEnabled] = React.useState(true);
  
  const seenMessagesRef = React.useRef<Set<string>>(new Set());
  const isHistoryLoadedRef = React.useRef<boolean>(false);

  const playNotificationSound = React.useCallback((isSameSession: boolean) => {
    if (!notificationSoundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      if (isSameSession) {
        // Som A (Sessão Ativa): Acorde C-Major 7th seguido de G-Major (bipe duplo harmônico)
        // Primeiro acorde (Dó, Mi, Sol)
        playSynthTone(ctx, [523.25, 659.25, 783.99], 'sine', now, 0.35, 0.18);
        
        // Segundo acorde ligeiramente atrasado (Sol, Si, Ré)
        setTimeout(() => {
          try {
            const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now2 = ctx2.currentTime;
            playSynthTone(ctx2, [783.99, 987.77, 1174.66], 'sine', now2, 0.35, 0.15);
          } catch {}
        }, 80);
      } else {
        // Som B (Sessão Inativa): Alerta de quinta perfeita em acorde suspenso (Fá, Dó depois Lá, Mi)
        // Primeiro tom suspenso
        playSynthTone(ctx, [349.23, 523.25], 'sine', now, 0.4, 0.18);
        
        // Segundo tom de resolução
        setTimeout(() => {
          try {
            const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now2 = ctx2.currentTime;
            playSynthTone(ctx2, [440.00, 659.25], 'sine', now2, 0.4, 0.15);
          } catch {}
        }, 100);
      }
    } catch (e) {
      console.warn('Failed to play notification sound cue:', e);
    }
  }, [notificationSoundEnabled, playSynthTone]);

  // ── Voice Input State ────────────────────────────────────────────────
  type VoiceState = 'idle' | 'listening' | 'transcribing' | 'ready' | 'error_permission' | 'unsupported';
  const [voiceState, setVoiceState] = React.useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const silenceTimeoutRef = React.useRef<any>(null);
  const finalTranscriptRef = React.useRef<string>('');
  const hasRetriedSpeechRecognitionRef = React.useRef<boolean>(false);
  const isSpeechRecognitionRetryingRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    voiceModeRef.current = voiceMode;
    console.log('[PULSO_VOICE_MODE_CHANGED]', { mode: voiceMode });
    
    // Sync voiceState to maintain compatibility with existing UI checks
    if (voiceMode === 'off') {
      setVoiceState('idle');
    } else if (voiceMode === 'recording_once') {
      setVoiceState('listening');
    } else if (voiceMode === 'presence') {
      if (presenceState === 'presence_listening') setVoiceState('listening');
      else if (presenceState === 'presence_transcribing' || presenceState === 'presence_sending' || presenceState === 'presence_waiting_response') setVoiceState('transcribing');
      else setVoiceState('idle');
    }
  }, [voiceMode, presenceState]);

  React.useEffect(() => {
    presenceStateRef.current = presenceState;
    
    // Sync voiceState
    if (voiceMode === 'presence') {
      if (presenceState === 'presence_listening') setVoiceState('listening');
      else if (presenceState === 'presence_transcribing' || presenceState === 'presence_sending' || presenceState === 'presence_waiting_response') setVoiceState('transcribing');
      else setVoiceState('idle');
    }
  }, [presenceState, voiceMode]);

  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const scrollToBottom = React.useCallback((smooth = true) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const threshold = 120;
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > threshold;
    setShowScrollButton(isScrolledUp);
  }, []);



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

  const handleHearClick = React.useCallback((msg: Message) => {
    if (playingMsgId === msg.id) {
      ttsAdapter.cancel();
      setPlayingMsgId(null);
      setPlayingState('stopped');
    } else {
      setPlayingMsgId(msg.id);
      setPlayingState('preparing');
      ttsAdapter.speak(
        msg.text,
        () => {
          setPlayingMsgId(prev => {
            if (prev === msg.id) {
              setPlayingState('playing');
            }
            return prev;
          });
        },
        () => {
          setPlayingMsgId(prev => {
            if (prev === msg.id) {
              setPlayingState('stopped');
              return null;
            }
            return prev;
          });
        },
        () => {
          setPlayingMsgId(prev => {
            if (prev === msg.id) {
              setPlayingState('preparing');
            }
            return prev;
          });
        }
      );
    }
  }, [playingMsgId, ttsAdapter]);

  const handleCopyText = React.useCallback((msg: Message) => {
    const visibleText = ttsAdapter.normalizeTextForSpeech(msg.text);
    navigator.clipboard.writeText(visibleText || msg.text).then(() => {
      setToastMessage('texto copiado!');
      setTimeout(() => setToastMessage(null), 2000);
    }).catch(() => {});
  }, [ttsAdapter]);

  const handleCopyPackage = React.useCallback((msg: Message) => {
    const pkg = buildHandoffPackage(msg);
    navigator.clipboard.writeText(pkg).then(() => {
      setToastMessage('pacote técnico copiado!');
      setTimeout(() => setToastMessage(null), 2000);
    }).catch(() => {});
  }, []);

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
    scrollToBottom(true);
  }, [currentMessages, isTyping, scrollToBottom]);

  // Guarantee scroll to bottom on initial load / refresh and when messages are loaded
  React.useEffect(() => {
    if (currentMessages.length > 0) {
      // Immediate non-smooth scroll to bottom
      scrollToBottom(false);
      
      // Secondary deferred scroll after layout/images render (important for slow connections/devices)
      const t1 = setTimeout(() => scrollToBottom(false), 50);
      const t2 = setTimeout(() => scrollToBottom(false), 200);
      const t3 = setTimeout(() => scrollToBottom(false), 600);
      const t4 = setTimeout(() => scrollToBottom(false), 1000);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [currentMessages.length, activeContextNode.contextId, scrollToBottom]);

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
        const allRequests = await requestsService.getRequests(25, true).catch(e => { console.error(e); return []; });
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
          .filter((req: any) => req && (req.requestType === 'conversation_command' || req.requestType === 'active_message') && req.archived !== true)
          .sort((a, b) => {
            const timeA = safeGetTime(a.requestedAt) || a.clientCreatedAtMs || safeGetTime(a.createdAt) || safeGetTime(a.updatedAt) || 0;
            const timeB = safeGetTime(b.requestedAt) || b.clientCreatedAtMs || safeGetTime(b.createdAt) || safeGetTime(b.updatedAt) || 0;
            return timeA - timeB;
          });

        commandRequests.forEach((req: any) => {
          const reqTime = safeConvertToDate(req.requestedAt) || new Date();
          
          if (req.requestType !== "active_message") {
            chatHistory.push({
              id: `user-${req.id || Math.random()}`,
              sender: 'user',
              text: req.input || req.rawInput || req.summary || req.title || '',
              timestamp: reqTime,
              contextId: req.contextId || null
            });
          }
          
          const isConvCommand = req.requestType === 'conversation_command';
          const isActiveMessage = req.requestType === "active_message";
          
          if (isConvCommand) {
            const status = req.status;
            const responseText = req.openclawResult?.responseText ?? null;
            const hasRealResponse = responseText && responseText.trim() !== '';
            
            if (status === 'success' && hasRealResponse) {
              console.log('[PULSO_RENDER_OPENCLAW_RESPONSE]', { requestId: req.id });
              console.log('[PULSO_WEB_RENDER_OPENCLAW_RESPONSE]', { requestId: req.id });
              console.log('[PULSO_RESPONSE_RENDERED]', { requestId: req.id, responseText });
              chatHistory.push({
                id: `lotus-${req.id || Math.random()}`,
                sender: 'lotus',
                text: responseText || '',
                timestamp: safeConvertToDate(req.updatedAt) || reqTime,
                interpretation: req.interpretation,
                openclawResult: req.openclawResult || undefined,
                handoffStatus: req.status,
                requestId: req.id || undefined,
                originalCommand: req.summary || req.title || undefined,
                executedAt: req.executedAt ? (req.executedAt instanceof Date ? req.executedAt.toISOString() : typeof req.executedAt === 'string' ? req.executedAt : req.executedAt.toDate?.().toISOString() || String(req.executedAt)) : undefined,
                executedBy: req.executedBy || undefined,
                createdEntityRef: req.createdEntityRef || undefined,
                executionError: req.executionError || undefined,
                contextId: req.contextId || null
              });
            } else if (status === 'error' || status === 'timeout') {
              console.log('[PULSO_RENDER_ERROR_STATE]', { requestId: req.id, status });
              chatHistory.push({
                id: `lotus-${req.id || Math.random()}`,
                sender: 'lotus',
                text: 'falha operacional no processamento deste comando.',
                timestamp: safeConvertToDate(req.updatedAt) || reqTime,
                interpretation: req.interpretation,
                openclawResult: req.openclawResult || undefined,
                handoffStatus: req.status,
                requestId: req.id || undefined,
                originalCommand: req.summary || req.title || undefined,
                contextId: req.contextId || null
              });
            } else {
              console.log('[PULSO_RENDER_PENDING_REQUEST]', { requestId: req.id, status });
              console.log('[PULSO_RENDER_SUPPRESSED_FALLBACK_RESPONSE]', { requestId: req.id });
            }
          } else if (isActiveMessage) {
            console.log('[PULSO_RENDER_ACTIVE_MESSAGE]', { requestId: req.id });
            const replyText = req.message || req.text || '';
            console.log('[PULSO_ACTIVE_MESSAGE_RENDERED]', { requestId: req.id, text: replyText });
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
              contextId: req.contextId || null
            });
          }
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
    if (loading || !db) return;

    let unsubscribe: any = null;
    try {
      const q = query(
        collection(db, firestorePaths.requests()),
        where("requestType", "in", ["conversation_command", "active_message"])
      );

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        const fetchedRequests: any[] = [];
        snapshot.forEach((docSnap: any) => {
          const data = docSnap.data();
          if (data.archived === true) return; // filter archived in memory

          Object.keys(data).forEach(key => {
            if (data[key] && typeof data[key].toDate === 'function') {
              data[key] = data[key].toDate();
            }
          });
          fetchedRequests.push({ ...data, id: docSnap.id });
        });

        const sortedRequests = fetchedRequests.sort((a, b) => {
          const timeA = safeGetTime(a.requestedAt) || a.clientCreatedAtMs || safeGetTime(a.createdAt) || safeGetTime(a.updatedAt) || 0;
          const timeB = safeGetTime(b.requestedAt) || b.clientCreatedAtMs || safeGetTime(b.createdAt) || safeGetTime(b.updatedAt) || 0;
          return timeA - timeB;
        });

        const chatHistory: Message[] = [];
        sortedRequests.forEach((req: any) => {
          const reqTime = safeConvertToDate(req.requestedAt) || new Date();
          
          if (req.requestType !== "active_message") {
            const atts = Array.isArray(req.attachments) ? req.attachments.map((a: any) => ({
              ...a,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date()
            })) : undefined;

            chatHistory.push({
              id: `user-${req.id}`,
              sender: 'user',
              text: req.input || req.rawInput || req.summary || req.title || '',
              timestamp: reqTime,
              contextId: req.contextId || null,
              attachments: atts
            });
          }

          const isConvCommand = req.requestType === 'conversation_command';
          const isActiveMessage = req.requestType === "active_message";

          if (isConvCommand) {
            const status = req.status;
            const responseText = req.openclawResult?.responseText ?? null;
            const hasRealResponse = responseText && responseText.trim() !== '';

            // Check if auto TTS needs to be triggered in presence mode
            const requestOriginMode = req.originMode || (voiceReplyRequestsRef.current.has(req.id) ? 'presence' : 'text');
            const reqTimeMs = req.clientCreatedAtMs || (req.requestedAt ? new Date(req.requestedAt).getTime() : 0);
            
            if (status === 'success' && hasRealResponse && requestOriginMode === 'presence') {
              const isPresenceActive = voiceModeRef.current === 'presence';
              const isRecent = reqTimeMs > presenceSessionStartTimeRef.current;
              
              if (!isPresenceActive || !isRecent) {
                if (!spokenRequestsRef.current.has(req.id)) {
                  spokenRequestsRef.current.add(req.id);
                  console.log('[PULSO_PRESENCE_AUTO_TTS_SKIPPED_NOT_ACTIVE]', { 
                    requestId: req.id, 
                    isPresenceActive, 
                    isRecent,
                    reqTimeMs,
                    sessionStart: presenceSessionStartTimeRef.current
                  });
                }
              } else if (spokenRequestsRef.current.has(req.id)) {
                console.log('[PULSO_PRESENCE_AUTO_TTS_DEDUPED]', { requestId: req.id });
              } else if (presenceStateRef.current === 'presence_speaking') {
                console.log('[PULSO_PRESENCE_AUTO_TTS_SKIPPED_ALREADY_SPEAKING]', { requestId: req.id });
              } else {
                spokenRequestsRef.current.add(req.id);
                const msgId = `lotus-${req.id}`;
                
                // Latency point 4: Response Received
                latencyResponseReceivedRef.current = Date.now();
                const diffReqToResp = latencyResponseReceivedRef.current - (latencyRequestCreatedRef.current || latencyResponseReceivedRef.current);
                console.log(`[PULSO_LATENCY_REQUEST_CREATED_TO_RESPONSE_RECEIVED_MS] ${diffReqToResp} ms`);
                
                console.log('[PULSO_PRESENCE_RESPONSE_RECEIVED]', { requestId: req.id });
                console.log('[PULSO_PRESENCE_AUTO_TTS_START]', { requestId: req.id });
                
                // Play response arrived sound cue
                playPresenceSoundCue('response_arrived');
                
                // Block new recording & mute
                stopVoiceRecognition();
                console.log('[PULSO_PRESENCE_MIC_PAUSED_DURING_TTS]');
                
                presenceStateRef.current = 'presence_speaking';
                setPresenceState('presence_speaking');
                setPlayingMsgId(msgId);
                setPlayingState('preparing');
                
                playPresenceSoundCue('speak_start');
                
                // Latency point 5: TTS Started
                latencyAutoTtsStartRef.current = Date.now();
                const diffRespToTts = latencyAutoTtsStartRef.current - (latencyResponseReceivedRef.current || latencyAutoTtsStartRef.current);
                console.log(`[PULSO_LATENCY_RESPONSE_RECEIVED_TO_AUTO_TTS_START_MS] ${diffRespToTts} ms`);
                
                ttsAdapter.speak(
                  responseText,
                  () => {
                    // Latency point 6: First Audio Playing
                    const firstAudioTime = Date.now();
                    const diffTtsToFirst = firstAudioTime - (latencyAutoTtsStartRef.current || firstAudioTime);
                    console.log(`[PULSO_LATENCY_AUTO_TTS_START_TO_FIRST_AUDIO_MS] ${diffTtsToFirst} ms`);
                    
                    const totalTime = firstAudioTime - (latencyStopRecRef.current || firstAudioTime);
                    console.log(`[PULSO_LATENCY_PRESENCE_TOTAL_MS] ${totalTime} ms`);
                    
                    setPlayingMsgId(prev => {
                      if (prev === msgId) {
                        setPlayingState('playing');
                      }
                      return prev;
                    });
                  },
                  () => {
                    setPlayingMsgId(prev => {
                      if (prev === msgId) {
                        setPlayingState('stopped');
                        console.log('[PULSO_PRESENCE_AUTO_TTS_DONE]', { requestId: req.id });
                        
                        // Return to listening if we are still in presence mode
                        if (voiceModeRef.current === 'presence') {
                          console.log('[PULSO_PRESENCE_MIC_RESUMED_AFTER_TTS]');
                          presenceStateRef.current = 'presence_listening';
                          setPresenceState('presence_listening');
                          startSpeechRecognition('presence');
                        }
                        return null;
                      }
                      return prev;
                    });
                  },
                  () => {
                    setPlayingMsgId(prev => {
                      if (prev === msgId) {
                        setPlayingState('preparing');
                      }
                      return prev;
                    });
                  }
                );
              }
            }

            if (status === 'success' && hasRealResponse) {
              console.log('[PULSO_RENDER_OPENCLAW_RESPONSE]', { requestId: req.id });
              console.log('[PULSO_WEB_RESPONSE_RECEIVED]', { requestId: req.id });
              console.log('[PULSO_WEB_RENDER_OPENCLAW_RESPONSE]', { requestId: req.id });
              console.log('[PULSO_RESPONSE_RENDERED]', { requestId: req.id, responseText });
              chatHistory.push({
                id: `lotus-${req.id}`,
                sender: 'lotus',
                text: responseText || '',
                timestamp: safeConvertToDate(req.updatedAt) || reqTime,
                interpretation: req.interpretation,
                openclawResult: req.openclawResult || undefined,
                handoffStatus: req.status,
                requestId: req.id || undefined,
                originalCommand: req.summary || req.title || undefined,
                executedAt: req.executedAt ? (req.executedAt instanceof Date ? req.executedAt.toISOString() : typeof req.executedAt === 'string' ? req.executedAt : req.executedAt.toDate?.().toISOString() || String(req.executedAt)) : undefined,
                executedBy: req.executedBy || undefined,
                createdEntityRef: req.createdEntityRef || undefined,
                executionError: req.executionError || undefined,
                contextId: req.contextId || null
              });
            } else if (status === 'error' || status === 'timeout') {
              console.log('[PULSO_RENDER_ERROR_STATE]', { requestId: req.id, status });
              chatHistory.push({
                id: `lotus-${req.id}`,
                sender: 'lotus',
                text: 'falha operacional no processamento deste comando.',
                timestamp: safeConvertToDate(req.updatedAt) || reqTime,
                interpretation: req.interpretation,
                openclawResult: req.openclawResult || undefined,
                handoffStatus: req.status,
                requestId: req.id || undefined,
                originalCommand: req.summary || req.title || undefined,
                contextId: req.contextId || null
              });
            } else {
              console.log('[PULSO_RENDER_PENDING_REQUEST]', { requestId: req.id, status });
              console.log('[PULSO_RENDER_SUPPRESSED_FALLBACK_RESPONSE]', { requestId: req.id });
            }
          } else if (isActiveMessage) {
            console.log('[PULSO_RENDER_ACTIVE_MESSAGE]', { requestId: req.id });
            const replyText = req.message || req.text || '';
            console.log('[PULSO_ACTIVE_MESSAGE_RENDERED]', { requestId: req.id, text: replyText });
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
              contextId: req.contextId || null
            });
          }
        });

        // Detect new messages from Lótus to trigger sound/visual notifications
        chatHistory.forEach((msg) => {
          if (msg.sender === 'lotus' && msg.id) {
            if (!seenMessagesRef.current.has(msg.id)) {
              seenMessagesRef.current.add(msg.id);
              
              // Only trigger sound/visual indicators if the history has already loaded
              if (isHistoryLoadedRef.current) {
                // Determine if the message context is the active one
                const activeContext = activeContextNodeRef.current;
                const isSame = !msg.contextId || msg.contextId === activeContext.contextId;
                
                if (isSame) {
                  playNotificationSound(true);
                } else {
                  playNotificationSound(false);
                }
              }
            }
          }
        });

        // Mark history as loaded after the initial processing of messages
        if (!isHistoryLoadedRef.current) {
          chatHistory.forEach(msg => {
            if (msg.id) seenMessagesRef.current.add(msg.id);
          });
          isHistoryLoadedRef.current = true;
        }

        setState((prev: any) => {
          if (!prev) return prev;
          return { ...prev, allRequests: sortedRequests };
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
      }, (error: any) => {
        console.error("Firestore requests onSnapshot error:", error);
      });
    } catch (err) {
      console.error("Firestore onSnapshot subscription failed:", err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [db, loading]);

  const createPulsoConversationRequest = React.useCallback(async (
    input: string,
    options?: {
      mode?: "text" | "voice" | "presence";
      conversationId?: string;
      context?: object;
      areaId?: string;
      contextId?: string;
      chatId?: string;
      openclawSessionKey?: string;
    }
  ) => {
    const mode = options?.mode || 'text';
    const cleanMsg = input;
    const rawMsg = input;

    console.log('[PULSO_SUBMIT_START]');
    console.log('[PULSO_SUBMIT_INPUT]', { input: cleanMsg, rawInput: rawMsg, mode });

    const currentUser = authService.getCurrentUser();
    const userRef = currentUser?.email || currentUser?.displayName || 'felipe_dutra';
    const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Routing
    const routeResult = routeInputToArea(rawMsg, state?.allAreas || [], {
      currentRoute: typeof window !== 'undefined' ? window.location.pathname : '/pulso/live',
      activeAreaId: activeAreaId || undefined
    });

    const isTauri = typeof window !== 'undefined' && (
      window.location.protocol === 'tauri:' ||
      window.location.protocol === 'file:' ||
      !!(window as any).__TAURI__ ||
      !!(window as any).__TAURI_INTERNALS__
    );

    const lotusPayload: any = {
      requestId: reqId,
      userId: userRef,
      source: "pulso_live" as const,
      mode: (mode === 'presence' || mode === 'voice' ? 'voice' : 'text') as "voice" | "text",
      originMode: mode,
      input: cleanMsg,
      rawInput: rawMsg,
      cleanInput: (mode === 'presence' || mode === 'voice') ? cleanMsg : undefined,
      rawTranscript: (mode === 'presence' || mode === 'voice') ? rawMsg : undefined,
      cleanTranscript: (mode === 'presence' || mode === 'voice') ? cleanMsg : undefined,
      timestamp: new Date().toISOString(),
      clientCreatedAtMs: Date.now(),
      conversationId: options?.conversationId || `conv_${options?.contextId || activeContextNode.contextId}`,
      messageId: `msg_${Date.now()}`,
      approvalMode: "allow_read_only" as const,
      context: {
        currentRoute: typeof window !== 'undefined' ? window.location.pathname : '/pulso/live',
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Sao_Paulo',
        locale: "pt-BR" as const,
        userName: "Fê",
        interface: "pulso" as const,
        ...options?.context
      },
      contextWindow: [],
      areaId: options?.areaId || activeContextNode.areaId,
      contextId: options?.contextId || activeContextNode.contextId,
      chatId: options?.chatId || activeContextNode.chatId,
      openclawSessionKey: options?.openclawSessionKey || activeContextNode.openclawSessionKey
    };

    if (routeResult.areaRef) lotusPayload.areaRef = routeResult.areaRef;
    if (routeResult.routing) lotusPayload.routing = routeResult.routing;
    if (routeResult.routing?.secondaryTopics) lotusPayload.secondaryAreaRefs = routeResult.routing.secondaryTopics;

    console.log('[PULSO_FIRESTORE_PATH]', { path: `workspaces/felipe_dutra/pulso_requests` });
    console.log('[PULSO_FIRESTORE_PAYLOAD]', lotusPayload);

    try {
      const newRequest = await lotusOpenClawClient.queueRequest(lotusPayload);

      console.log('[PULSO_FIRESTORE_CREATED]', {
        path: `workspaces/felipe_dutra/pulso_requests`,
        documentId: newRequest.id,
        requestType: newRequest.requestType,
        status: newRequest.status,
        input: newRequest.input,
        rawInput: newRequest.rawInput,
        source: newRequest.source,
        conversationId: newRequest.conversationId,
        messageId: newRequest.messageId,
        runtime: isTauri ? 'tauri' : 'web'
      });

      if (typeof window !== 'undefined') {
        (window as any).lastPulsoSubmit = {
          lastSubmitInput: cleanMsg,
          runtime: isTauri ? 'tauri' : 'web',
          firestorePath: `workspaces/felipe_dutra/pulso_requests`,
          documentId: newRequest.id,
          payload: lotusPayload,
          status: newRequest.status
        };
      }

      console.log('[PULSO_DEBUG_LAST_SUBMIT]', JSON.stringify((window as any).lastPulsoSubmit, null, 2));

      return newRequest;
    } catch (err: any) {
      console.log('[PULSO_FIRESTORE_CREATE_FAILED]', { error: err?.message || String(err) });
      
      if (typeof window !== 'undefined') {
        (window as any).lastPulsoSubmit = {
          lastSubmitInput: cleanMsg,
          runtime: isTauri ? 'tauri' : 'web',
          firestorePath: `workspaces/felipe_dutra/pulso_requests`,
          error: err?.message || String(err)
        };
      }

      console.log('[PULSO_DEBUG_LAST_SUBMIT]', JSON.stringify((window as any).lastPulsoSubmit, null, 2));
      throw err;
    }
  }, [state, activeContextNode]);

  const uploadFile = async (file: File): Promise<Attachment> => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    const id = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const name = file.name;
    const sizeBytes = file.size;
    const mimeType = file.type;
    const createdAt = new Date();
    const contextId = activeContextNode.contextId;

    // Detect type
    let type: 'image' | 'pdf' | 'audio' | 'generic' = 'generic';
    if (mimeType.startsWith('image/')) type = 'image';
    else if (mimeType === 'application/pdf') type = 'pdf';
    else if (mimeType.startsWith('audio/')) type = 'audio';

    // Local fallback Object URL
    const localUrl = URL.createObjectURL(file);

    if (isFirestore && storage) {
      try {
        setUploadingFiles(prev => ({ ...prev, [id]: { name, progress: 0, status: 'enviando', contextId } }));
        
        // Define Storage Path
        const path = `pulso/chats/${contextId}/attachments/${id}_${name}`;
        const fileRef = storageRef(storage, path);
        
        // Resumable upload task
        const uploadTask = uploadBytesResumable(fileRef, file);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadingFiles(prev => ({
                ...prev,
                [id]: { name, progress, status: 'enviando', contextId }
              }));
            },
            (error) => {
              setUploadingFiles(prev => ({
                ...prev,
                [id]: { name, progress: 0, status: 'erro', error: true, contextId }
              }));
              reject(error);
            },
            () => {
              resolve();
            }
          );
        });
        
        // Get URL
        const downloadUrl = await getDownloadURL(fileRef);
        
        setUploadingFiles(prev => ({
          ...prev,
          [id]: { name, progress: 100, status: 'concluido', contextId }
        }));
        
        // UX delay for success state
        await new Promise(r => setTimeout(r, 600));
        
        setUploadingFiles(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        return {
          id,
          name,
          type,
          mimeType,
          url: downloadUrl,
          sizeBytes,
          createdAt,
          contextId
        };
      } catch (err) {
        console.error('Firebase Storage upload failed, falling back to local URL:', err);
        setUploadingFiles(prev => ({
          ...prev,
          [id]: { name, progress: 0, status: 'erro', error: true, contextId }
        }));
        
        // UX delay for error state
        await new Promise(r => setTimeout(r, 2000));
        
        setUploadingFiles(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return {
          id,
          name,
          type,
          mimeType,
          url: localUrl,
          sizeBytes,
          createdAt,
          contextId
        };
      }
    } else {
      // In mock mode or offline, use Object URL.
      // We also show a quick "concluido" feedback for mock mode!
      setUploadingFiles(prev => ({ ...prev, [id]: { name, progress: 100, status: 'concluido', contextId } }));
      await new Promise(r => setTimeout(r, 600));
      setUploadingFiles(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return {
        id,
        name,
        type,
        mimeType,
        url: localUrl,
        sizeBytes,
        createdAt,
        contextId
      };
    }
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Create new user message with attachments in parallel
    const uploadPromises = Array.from(files).map(file => uploadFile(file));
    const attachedItems = await Promise.all(uploadPromises);

    if (attachedItems.length === 0) return;

    // Send a message indicating files uploaded (without [anexo] prefix)
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    const sendingContextId = activeContextNode.contextId;
    setContextTyping(sendingContextId, true);

    try {
      const fileNames = attachedItems.map(a => a.name).join(', ');
      const cleanMsg = fileNames;
      const newRequest = await createPulsoConversationRequest(cleanMsg, {
        mode: 'text',
        areaId: activeContextNode.areaId,
        contextId: activeContextNode.contextId,
        chatId: activeContextNode.chatId,
        openclawSessionKey: activeContextNode.openclawSessionKey
      });

      // Save request in Firestore with attachments metadata
      if (isFirestore && db && newRequest.id) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const reqDocRef = doc(db, `workspaces/felipe_dutra/pulso_requests`, newRequest.id);
        const serializedAttachments = attachedItems.map(a => ({
          ...a,
          createdAt: a.createdAt.toISOString()
        }));
        await updateDoc(reqDocRef, {
          attachments: serializedAttachments
        }).catch(err => console.error('Failed to update request doc with attachments metadata:', err));
      }

      setLastSentRequestsByContext(prev => ({ ...prev, [sendingContextId]: newRequest.id }));

      const userMsg: Message = {
        id: `user-msg-${newRequest.id || Date.now()}`,
        sender: 'user',
        text: cleanMsg,
        timestamp: new Date(),
        contextId: activeContextNode.contextId,
        attachments: attachedItems
      };
      setMessages(prev => [...prev, userMsg]);

      if (state) {
        setState((prev: any) => {
          if (!prev) return prev;
          const updatedRequests = [{ ...newRequest, attachments: attachedItems }, ...(prev.allRequests || [])];
          return { ...prev, allRequests: updatedRequests };
        });
      }
    } catch (err) {
      console.error('Failed to process message with attachments:', err);
    } finally {
      setContextTyping(sendingContextId, false);
    }
  };

  const handleSendMessage = async (textToSend?: string, options?: { originMode?: 'text' | 'recording_once' | 'presence' }) => {
    if (isTyping) {
      console.warn('Blocked duplicate send: message already processing.');
      return;
    }

    const rawMsg = textToSend || inputMessage;
    if (!rawMsg.trim()) return;

    const originMode = options?.originMode || 'text';
    const cleanMsg = originMode === 'text' ? rawMsg : normalizeTranscript(rawMsg);

    const sendingContextId = activeContextNode.contextId;
    setContextTyping(sendingContextId, true);

    try {
      const sendMode = originMode === 'presence' ? 'presence' : (originMode === 'recording_once' ? 'voice' : 'text');
      const newRequest = await createPulsoConversationRequest(cleanMsg, {
        mode: sendMode,
        areaId: activeContextNode.areaId,
        contextId: activeContextNode.contextId,
        chatId: activeContextNode.chatId,
        openclawSessionKey: activeContextNode.openclawSessionKey
      });
      setLastSentRequestsByContext(prev => ({ ...prev, [sendingContextId]: newRequest.id }));

      // ONLY on success, clear the input
      setInputMessage('');
      currentTextRef.current = '';
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      const userMsg: Message = {
        id: `user-msg-${newRequest.id || Date.now()}`,
        sender: 'user',
        text: cleanMsg,
        timestamp: new Date(),
        contextId: activeContextNode.contextId
      };
      setMessages(prev => [...prev, userMsg]);

      if (state) {
        setState((prev: any) => {
          if (!prev) return prev;
          const updatedRequests = [newRequest, ...(prev.allRequests || [])];
          return { ...prev, allRequests: updatedRequests };
        });
      }

      console.log('[PULSO_WAITING_OPENCLAW]', { requestId: newRequest.id });

      // Latency point 3: Request Created in Firestore
      if (originMode === 'presence') {
        latencyRequestCreatedRef.current = Date.now();
        const diffTransToReq = latencyRequestCreatedRef.current - (latencyTranscriptionRef.current || latencyRequestCreatedRef.current);
        console.log(`[PULSO_LATENCY_TRANSCRIPTION_TO_REQUEST_CREATED_MS] ${diffTransToReq} ms`);
      }

    } catch (err: any) {
      const lotusErrorMsg: Message = {
        id: `lotus-error-${Date.now()}`,
        sender: 'lotus',
        text: `falha ao enviar para a Lótus: ${err?.message || 'erro de persistência'}.`,
        timestamp: new Date(),
        contextId: activeContextNode.contextId
      };
      setMessages(prev => [...prev, lotusErrorMsg]);
    } finally {
      setContextTyping(sendingContextId, false);
    }
  };

  const handleRenameChat = (contextId: string) => {
    const trimmed = editingContextLabel.trim();
    if (trimmed) {
      const updated = customContextNodes.map(node => {
        if (node.contextId === contextId) {
          return { ...node, label: trimmed };
        }
        return node;
      });
      setCustomContextNodes(updated);
      localStorage.setItem('pulso_custom_contexts', JSON.stringify(updated));
      
      const isFirestore = pulsoService.getDataMode() === 'firestore';
      if (isFirestore && db) {
        const path = firestorePaths.customContext(contextId);
        const contextDocRef = doc(db, path);
        updateDoc(contextDocRef, { label: trimmed }).catch((err: any) =>
          console.error("Failed to update context label in Firestore:", err)
        );
      }
      
      if (activeContextNode.contextId === contextId) {
        setActiveContextNode(prev => ({ ...prev, label: trimmed }));
      }
    }
    setEditingContextId(null);
  };

  const handleArchiveChat = (contextId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customContextNodes.map(node => {
      if (node.contextId === contextId) {
        return { ...node, archived: true };
      }
      return node;
    });
    setCustomContextNodes(updated);
    localStorage.setItem('pulso_custom_contexts', JSON.stringify(updated));
    
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (isFirestore && db) {
      const path = firestorePaths.customContext(contextId);
      const contextDocRef = doc(db, path);
      updateDoc(contextDocRef, { archived: true }).catch((err: any) =>
        console.error("Failed to archive context in Firestore:", err)
      );
    }
    
    if (activeContextNode.contextId === contextId) {
      setActiveContextNode(INITIAL_CONTEXT_NODES[0]);
    }
  };

  const requestMicrophonePermission = React.useCallback(async (): Promise<boolean> => {
    console.log('[PULSO_MIC_PERMISSION_REQUEST]');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('[PULSO_MIC_PERMISSION_DENIED]', { reason: 'mediaDevices API not supported' });
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[PULSO_MIC_PERMISSION_GRANTED]');
      return true;
    } catch (err) {
      console.log('[PULSO_MIC_PERMISSION_DENIED]', err);
      return false;
    }
  }, []);

  const isSpeechRecognitionSupported = React.useCallback((): boolean => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      console.log('[PULSO_STT_API_AVAILABLE]');
      return true;
    } else {
      console.log('[PULSO_STT_API_UNAVAILABLE]');
      return false;
    }
  }, []);

  const stopVoiceRecognition = React.useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }
    
    if (voiceModeRef.current === 'presence') {
      console.log('[PULSO_PRESENCE_STOP]');
    } else if (voiceModeRef.current === 'recording_once') {
      console.log('[PULSO_RECORDING_ONCE_STOP]');
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Recognition stop error:', e);
      }
      recognitionRef.current = null;
    }
  }, []);

  const exitPresenceMode = React.useCallback(() => {
    console.log('[PULSO_PRESENCE_EXIT_CLEAN]');
    setPresenceMode(false);
    setVoiceMode('off');
    voiceModeRef.current = 'off';
    setPresenceState('presence_idle');
    presenceStateRef.current = 'presence_idle';
    stopVoiceRecognition();
    ttsAdapter.cancel();
    setPlayingMsgId(null);
    setPlayingState('stopped');
    currentTextRef.current = '';
    setInputMessage('');
  }, [stopVoiceRecognition, ttsAdapter]);

  const startSpeechRecognition = React.useCallback((mode: VoiceMode) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceState('unsupported');
      return;
    }

    // Cancel any active speech from Lótus before listening
    ttsAdapter.cancel();

    // Clear any existing recognition or timeouts
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }

    setVoiceMode(mode);
    voiceModeRef.current = mode;
    isSpeechRecognitionRetryingRef.current = false;
    if (mode === 'presence') {
      presenceStateRef.current = 'presence_listening';
      setPresenceState('presence_listening');
      playPresenceSoundCue('start_listening');
      console.log('[PULSO_PRESENCE_START]');
      console.log('[PULSO_PRESENCE_LISTENING]');
    } else if (mode === 'recording_once') {
      console.log('[PULSO_RECORDING_ONCE_START]');
    }

    finalTranscriptRef.current = '';
    currentTextRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    // continuous=true is needed for background presence mode, but for single capture, 
    // using continuous=false is significantly more stable in Chrome and avoids 'network' errors.
    recognition.continuous = mode === 'presence' ? true : !hasRetriedSpeechRecognitionRef.current;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setVoiceError(null);
      if (mode === 'presence') {
        console.log('[PULSO_PRESENCE_LISTENING]');
      } else if (mode === 'recording_once') {
        console.log('[PULSO_RECORDING_AUDIO_CAPTURE_STARTED]');
      }
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += ' ' + chunk;
        } else {
          interimTranscript += ' ' + chunk;
        }
      }

      const currentText = (finalTranscriptRef.current + ' ' + interimTranscript)
        .trim()
        .replace(/\s+/g, ' ');

      currentTextRef.current = currentText;
      setInputMessage(currentText);

      // Presence mode auto-send on silence
      if (mode === 'presence') {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        silenceTimeoutRef.current = setTimeout(() => {
          const textToSend = currentTextRef.current.trim();
          if (textToSend) {
            latencyStopRecRef.current = Date.now();
            stopVoiceRecognition();
            
            presenceStateRef.current = 'presence_transcribing';
            setPresenceState('presence_transcribing');
            console.log('[PULSO_PRESENCE_TRANSCRIPTION_READY]', { text: textToSend });
            
            latencyTranscriptionRef.current = Date.now();
            const diffStopToTrans = latencyTranscriptionRef.current - (latencyStopRecRef.current || latencyTranscriptionRef.current);
            console.log(`[PULSO_LATENCY_RECORDING_STOP_TO_TRANSCRIPTION_MS] ${diffStopToTrans} ms`);
            
            presenceStateRef.current = 'presence_sending';
            setPresenceState('presence_sending');
            playPresenceSoundCue('sent');
            console.log('[PULSO_PRESENCE_REQUEST_SENT]');
            
            handleSendMessage(textToSend, { originMode: 'presence' });
            
            presenceStateRef.current = 'presence_waiting_response';
            setPresenceState('presence_waiting_response');
          }
        }, 2500);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      
      // Ignore errors that fire after mic is paused for TTS
      if (presenceStateRef.current === 'presence_speaking') {
        console.log('[PULSO_PRESENCE_ERROR_IGNORED_DURING_TTS]', { error: event.error });
        return;
      }
      
      if (event.error === 'network' && !hasRetriedSpeechRecognitionRef.current) {
        hasRetriedSpeechRecognitionRef.current = true;
        isSpeechRecognitionRetryingRef.current = true;
        stopVoiceRecognition();
        console.log('[PULSO_VOICE_RETRYING] Retrying speech recognition with simplified config due to network error...');
        setTimeout(() => {
          if (voiceModeRef.current !== 'off') {
            startSpeechRecognition(mode);
          }
        }, 150);
        return;
      }

      stopVoiceRecognition();
      
      if (mode === 'presence') {
        console.log('[PULSO_PRESENCE_ERROR]', { error: event.error });
        if (event.error === 'no-speech') {
          if (voiceModeRef.current === 'presence' && presenceStateRef.current !== 'presence_speaking') {
            presenceStateRef.current = 'presence_listening';
            setPresenceState('presence_listening');
            startSpeechRecognition('presence');
          }
          return;
        }
        
        playPresenceSoundCue('error');
        presenceStateRef.current = 'presence_error';
        setPresenceState('presence_error');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Permissão de microfone negada ou indisponível.');
        } else {
          setVoiceError(`Erro de voz: ${event.error}.`);
        }
        
        setTimeout(() => {
          if (voiceModeRef.current === 'presence' && presenceStateRef.current !== 'presence_speaking') {
            presenceStateRef.current = 'presence_idle';
            setPresenceState('presence_idle');
          }
        }, 3000);
      } else {
        console.log('[PULSO_RECORDING_TRANSCRIPTION_FAILED]', { error: event.error });
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Permissão de microfone negada ou indisponível.');
        } else {
          setVoiceError(`Erro de voz: ${event.error}.`);
        }
      }
    };

    recognition.onend = () => {
      if (isSpeechRecognitionRetryingRef.current) {
        console.log('[PULSO_VOICE_ONEND] Ignored onend during retry.');
        return;
      }
      if (presenceStateRef.current === 'presence_speaking') {
        // Prevent auto-restarts while Lótus is speaking
        return;
      }
      if (voiceModeRef.current === 'presence' && presenceStateRef.current === 'presence_listening') {
        try {
          recognitionRef.current?.start();
        } catch (err) {
          console.warn('Speech recognition restart failed:', err);
        }
      } else if (voiceModeRef.current === 'recording_once') {
        setVoiceMode('off');
        const finalVal = currentTextRef.current.trim();
        if (finalVal) {
          console.log('[PULSO_RECORDING_TRANSCRIPTION_READY]', { text: finalVal });
        } else {
          console.log('[PULSO_RECORDING_TRANSCRIPTION_FAILED]', { reason: 'No speech detected' });
        }
      }
    };

    // Max recording timeout of 20 seconds
    maxRecordingTimeoutRef.current = setTimeout(() => {
      console.log('Max recording timeout reached.');
      if (voiceModeRef.current === 'presence') {
        const textToSend = currentTextRef.current.trim();
        latencyStopRecRef.current = Date.now();
        stopVoiceRecognition();
        
        if (textToSend) {
          presenceStateRef.current = 'presence_transcribing';
          setPresenceState('presence_transcribing');
          console.log('[PULSO_PRESENCE_TRANSCRIPTION_READY]', { text: textToSend });
          
          latencyTranscriptionRef.current = Date.now();
          const diffStopToTrans = latencyTranscriptionRef.current - (latencyStopRecRef.current || latencyTranscriptionRef.current);
          console.log(`[PULSO_LATENCY_RECORDING_STOP_TO_TRANSCRIPTION_MS] ${diffStopToTrans} ms`);
          
          presenceStateRef.current = 'presence_sending';
          setPresenceState('presence_sending');
          playPresenceSoundCue('sent');
          console.log('[PULSO_PRESENCE_REQUEST_SENT]');
          handleSendMessage(textToSend, { originMode: 'presence' });
          presenceStateRef.current = 'presence_waiting_response';
          setPresenceState('presence_waiting_response');
        } else {
          exitPresenceMode();
        }
      } else if (voiceModeRef.current === 'recording_once') {
        stopVoiceRecognition();
      }
    }, 20000);

    try {
      recognition.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setVoiceMode('off');
      setPresenceState('presence_idle');
    }
  }, [handleSendMessage, stopVoiceRecognition, ttsAdapter, exitPresenceMode]);

  const toggleRecordingOnce = React.useCallback(async () => {
    hasRetriedSpeechRecognitionRef.current = false;
    if (voiceModeRef.current === 'recording_once') {
      stopVoiceRecognition();
      setVoiceMode('off');
    } else {
      if (!isSpeechRecognitionSupported()) {
        setVoiceState('unsupported');
        setVoiceError('transcrição indisponível no app (WebView sem suporte a STT nativo)');
        return;
      }
      
      setVoiceState('listening');
      const granted = await requestMicrophonePermission();
      if (!granted) {
        setVoiceState('idle');
        setVoiceError('Permissão de microfone negada ou indisponível.');
        return;
      }

      startSpeechRecognition('recording_once');
    }
  }, [startSpeechRecognition, stopVoiceRecognition, requestMicrophonePermission, isSpeechRecognitionSupported]);

  const togglePresenceMode = React.useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (presenceMode) {
      exitPresenceMode();
    } else {
      console.log('[PULSO_PRESENCE_ENTER]');
      presenceSessionStartTimeRef.current = Date.now();
      
      if (!isSpeechRecognitionSupported()) {
        setPresenceMode(true);
        setPresenceState('presence_error');
        setVoiceError('transcrição indisponível no app (WebView sem suporte a STT nativo)');
        return;
      }
      
      setPresenceMode(true);
      setPresenceState('presence_requesting_permission');
      
      const granted = await requestMicrophonePermission();
      if (!granted) {
        setPresenceState('presence_error');
        setVoiceError('Permissão de microfone negada ou indisponível.');
        return;
      }
      
      console.log('[PULSO_PRESENCE_MIC_READY]');
      console.log('[PULSO_PRESENCE_STT_READY]');
      startSpeechRecognition('presence');
    }
  }, [presenceMode, startSpeechRecognition, exitPresenceMode, requestMicrophonePermission, isSpeechRecognitionSupported]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (voiceState === 'ready') setVoiceState('idle');
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [voiceState]);

  React.useEffect(() => {
    if (voiceError) {
      const t = setTimeout(() => setVoiceError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [voiceError]);

  React.useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const allRequests = safeArray(state?.allRequests).filter((r: any) => r && r.archived !== true);

  // Check if the most recent request is queued or processing (pending)
  const isLatestRequestPending = React.useMemo(() => {
    const lastSentIdForActive = lastSentRequestsByContext[activeContextNode.contextId];
    if (!lastSentIdForActive) return false;
    const req = allRequests.find((r: any) => r.id === lastSentIdForActive);
    if (!req) return false;
    return req.status !== 'success' && req.status !== 'error' && req.status !== 'timeout';
  }, [allRequests, lastSentRequestsByContext, activeContextNode.contextId]);


  if (loading) {
    return (
      <div className="theme-her flex flex-col items-center justify-center h-[100dvh] pb-[env(safe-area-inset-bottom)] text-[#fbf9f5]">
        <div className="w-8 h-8 rounded-full border border-[#fbf9f5]/20 border-t-[#fbf9f5] animate-spin mb-4" />
        <p className="text-[9px] font-light tracking-widest text-[#fbf9f5]/40 uppercase">sintonizando lótus live...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-her flex flex-col items-center justify-center h-[100dvh] pb-[env(safe-area-inset-bottom)] p-6 text-center text-[#fbf9f5]">
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
  let allAreas = safeArray(state?.allAreas).filter((a: any) => a && a.archived !== true && a.status === 'active');
  allAreas.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  if (allAreas.length === 0) {
    allAreas = candidateAreas as any[];
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = allAreas.findIndex(a => a.id === active.id);
      const newIndex = allAreas.findIndex(a => a.id === over.id);
      const newOrder = arrayMove(allAreas, oldIndex, newIndex);
      
      setState((prev: any) => {
        if (!prev) return prev;
        const updatedAreas = prev.allAreas.map((a: any) => {
          const orderIdx = newOrder.findIndex((no) => no.id === a.id);
          return orderIdx !== -1 ? { ...a, order: orderIdx } : a;
        });
        return { ...prev, allAreas: updatedAreas };
      });

      try {
        const promises = newOrder.map((areaToSave, index) => {
          return areasService.saveArea({ id: areaToSave.id, order: index } as any);
        });
        await Promise.all(promises);
      } catch (err) {
        console.error("Erro ao salvar ordem das áreas:", err);
      }
    }
  };
  const allRoutines = safeArray(state?.allRoutines).filter((r: any) => r && r.archived !== true);
  const allAgents = safeArray(state?.allAgents).filter((ag: any) => ag && ag.archived !== true);
  const allLogs = safeArray(state?.allLogs);
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
    if (voiceModeRef.current === 'presence') {
      if (presenceStateRef.current === 'presence_listening') return 'lotus-listening-anim';
      if (presenceStateRef.current === 'presence_transcribing' || presenceStateRef.current === 'presence_sending') return 'lotus-thinking-anim';
      if (presenceStateRef.current === 'presence_waiting_response') return 'lotus-waiting-anim';
      if (presenceStateRef.current === 'presence_speaking') return 'lotus-responding-anim';
      if (presenceStateRef.current === 'presence_error') return 'lotus-error-anim';
      return 'lotus-idle-anim';
    }
    
    if (voiceModeRef.current === 'recording_once') {
      return 'lotus-listening-anim';
    }
    
    if (isLatestRequestPending) return 'lotus-thinking-anim';
    
    return 'lotus-idle-anim';
  };


  return (
    <div 
      onClick={() => presenceMode && exitPresenceMode()}
      className={`theme-her fixed inset-0 pb-[env(safe-area-inset-bottom)] w-full flex flex-col justify-between py-6 px-4 md:px-8 overflow-hidden font-sans text-[#fbf9f5] transition-all duration-500 ${
        presenceMode ? 'cursor-pointer' : ''
      }`}
    >
      {/* Camada Contextual */}
      <ContextSurfaceVariants 
        variant={activeVariant} 
        isOpen={isContextSurfaceOpen} 
        onClose={() => setIsContextSurfaceOpen(false)}
        activeContext={activeContextNode.label}
      />

      {/* Botão sutil de saída do Modo Foco */}
      <div className={`fixed top-8 right-8 z-30 pulso-transition ${presenceMode ? 'pulso-visible' : 'pulso-hidden-up'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); exitPresenceMode(); }}
          className="text-[10px] font-light tracking-widest text-[#fbf9f5]/40 hover:text-[#fbf9f5]/80 transition-colors lowercase bg-transparent border-none outline-none cursor-pointer"
        >
          [ sair do foco ]
        </button>
      </div>
      
      <header className={`flex justify-between items-center w-full max-w-4xl mx-auto relative z-20 select-none pulso-transition ${presenceMode ? 'pulso-hidden-up' : 'pulso-visible'}`}>
        <div className="flex items-center gap-2 md:gap-3">
          {/* Hamburger button on mobile */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }}
            className="md:hidden p-0 mr-1.5 text-[#fbf9f5]/55 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer flex items-center justify-center -translate-y-[2px]"
            title="Menu de Navegação"
          >
            {isMobileMenuOpen ? <X size={16} strokeWidth={1.5} /> : <Menu size={16} strokeWidth={1.5} />}
          </button>
          
          <span className="text-sm font-semibold tracking-[0.2em] text-[#fbf9f5]/80 lowercase">lótus live</span>
          
          {activeContextNode && (
            <>
              <span className="text-[9px] text-[#fbf9f5]/20 font-extralight select-none">/</span>
              <span className="text-[9px] font-extralight tracking-widest text-[#fbf9f5]/25 lowercase truncate max-w-[100px] md:max-w-[200px]" title={activeContextNode.label}>
                {activeContextNode.label}
              </span>
            </>
          )}

          <span className="w-1 h-1 rounded-full bg-[#fbf9f5] opacity-50 select-none shrink-0" />
          
          <span className="text-[9px] font-light tracking-[0.1em] text-[#fbf9f5]/40 lowercase shrink-0">
            {voiceState === 'listening' ? 'ouvindo...' : isTyping ? 'processando...' : 'conectada'}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const current = localStorage.getItem('pulso-theme') || 'orange';
              const next = current === 'black' ? 'orange' : 'black';
              localStorage.setItem('pulso-theme', next);
              window.dispatchEvent(new CustomEvent('pulso-theme-change', { detail: next }));
            }}
            className="text-xs font-light tracking-widest text-[#fbf9f5]/80 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer"
            title="Alternar Cor"
          >
            [ ⏀ ]
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setPresenceMode(true); }}
            className="hidden md:flex text-xs font-light tracking-widest text-[#fbf9f5]/80 hover:text-white transition-colors items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer"
          >
            <span>[ presença ]</span>
          </button>
          
          <div className="relative" ref={headerMenuRef}>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (contextSurfaceVariant) {
                  setIsContextSurfaceOpen(!isContextSurfaceOpen);
                } else {
                  setIsHeaderMenuOpen(!isHeaderMenuOpen); 
                }
              }}
              className="text-xs font-light tracking-widest text-[#fbf9f5]/50 hover:text-white transition-colors flex items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer"
              title="Superfície de Contexto"
            >
              <span>[ {isContextSurfaceOpen ? '✕' : '⋯'} ]</span>
            </button>
            
            {isHeaderMenuOpen && !contextSurfaceVariant && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden z-50 text-left shadow-2xl transition-all duration-300">
                <div className="flex flex-col text-[10px] font-light tracking-widest text-[#fbf9f5] lowercase">
                  <button 
                    onMouseDown={() => { setIsHeaderMenuOpen(false); setIsSidebarOpen(true); }}
                    className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent border-none outline-none cursor-pointer text-[#fbf9f5]"
                  >
                    <Activity size={12} strokeWidth={1.5} />
                    <span>sinais operacionais</span>
                  </button>
                  <button 
                    onMouseDown={() => { setIsHeaderMenuOpen(false); setIsTtsSettingsOpen(true); }}
                    className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent border-none outline-none cursor-pointer text-[#fbf9f5]"
                  >
                    <Mic size={12} strokeWidth={1.5} />
                    <span>voz da lótus (tts)</span>
                  </button>
                  <button 
                    onMouseDown={() => { setIsHeaderMenuOpen(false); router.push('/pulso/ecossistema'); }}
                    className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent border-none outline-none cursor-pointer text-[#fbf9f5]"
                  >
                    <Layers size={12} strokeWidth={1.5} />
                    <span>visão do contexto</span>
                  </button>
                  <button 
                    onMouseDown={() => { setIsHeaderMenuOpen(false); router.push('/pulso/eventos'); }}
                    className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/10 transition-colors text-left bg-transparent border-none outline-none cursor-pointer text-[#fbf9f5]"
                  >
                    <Database size={12} strokeWidth={1.5} />
                    <span>logs técnicos</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 1. Main Icon Sidebar */}
      <div 
        onMouseLeave={() => {
          if (!addingChatAreaId) {
            setHoveredAreaId(null);
          }
        }}
        className={`hidden md:flex fixed left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4 group/sidebar select-none transition-all duration-200 ${presenceMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {AREA_ORDER.map((areaId) => {
          const areaName = AREA_NAMES[areaId] || areaId;
          const areaContexts = allContextNodes.filter(n => n.areaId === areaId);
          const isHovered = hoveredAreaId === areaId;
          const isAreaActive = activeAreaId === areaId;
          const hasUnreadInArea = areaContexts.some(n => !!unreadContexts[n.contextId]);
          const isAddingChatForThisArea = addingChatAreaId === areaId;
          
          return (
            <div 
              key={areaId} 
              onMouseEnter={() => {
                if (!addingChatAreaId) {
                  setHoveredAreaId(areaId);
                }
              }}
              className="flex flex-col items-start transition-all duration-300"
            >
              {/* Area Trigger */}
              <div 
                onClick={() => {
                  if (areaContexts.length > 0) {
                    setActiveContextNode(areaContexts[0]);
                  }
                }}
                className="flex items-center gap-2.5 cursor-pointer py-1 group/item w-full"
              >
                <span 
                  className={`text-lg text-center transition-all duration-200 font-mono ${
                    isAreaActive
                      ? 'text-white scale-110 opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                      : hasUnreadInArea
                      ? 'pulso-unread scale-110 opacity-100 animate-pulse font-bold'
                      : 'text-[#fbf9f5]/35 group-hover/sidebar:text-[#fbf9f5]/65 group-hover/item:text-[#fbf9f5]/90'
                  }`}
                  style={{ width: '24px' }}
                >
                  {getAreaIcon({ id: areaId, name: areaName })}
                </span>

                {/* Area Text Label */}
                <span 
                  className={`text-[9px] tracking-widest uppercase font-sans font-light transition-all duration-200 opacity-0 max-w-0 overflow-hidden whitespace-nowrap group-hover/sidebar:opacity-40 group-hover/sidebar:max-w-[150px] group-hover/item:opacity-90 ${
                    isAreaActive ? 'text-white font-medium' : 'text-[#fbf9f5]'
                  }`}
                >
                  {areaName}
                </span>
              </div>

              {/* Sub-contexts (Sanfona style) */}
              <div 
                className={`flex flex-col gap-1.5 pl-8 overflow-hidden transition-all duration-300 ease-in-out ${
                  isHovered ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0 pointer-events-none'
                }`}
              >
                {areaContexts.map((ctx) => {
                  const isContextActive = activeContextNode.contextId === ctx.contextId;
                  const isUnread = !!unreadContexts[ctx.contextId];
                  const isCustom = customContextNodes.some(n => n.contextId === ctx.contextId);
                  
                  return (
                    <div
                      key={ctx.contextId}
                      onClick={() => {
                        setActiveContextNode(ctx);
                      }}
                      className="group/ctx flex items-center justify-between gap-2 w-full py-0.5"
                    >
                      {editingContextId === ctx.contextId ? (
                        <input
                          type="text"
                          value={editingContextLabel}
                          onChange={(e) => setEditingContextLabel(e.target.value)}
                          onBlur={() => handleRenameChat(ctx.contextId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameChat(ctx.contextId);
                            if (e.key === 'Escape') setEditingContextId(null);
                          }}
                          className="bg-white/15 text-white border border-white/20 rounded px-1 py-0.5 text-[8px] outline-none w-20"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={`text-[8px] tracking-wider uppercase font-sans font-light cursor-pointer transition-all duration-200 select-none truncate flex-1 text-left ${
                            isContextActive
                              ? 'text-white font-medium drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]'
                              : isUnread
                              ? 'pulso-unread font-bold animate-pulse'
                              : 'text-[#fbf9f5]/40 hover:text-[#fbf9f5]/85'
                          }`}
                        >
                          {ctx.label}
                        </span>
                      )}
                      
                      {isCustom && editingContextId !== ctx.contextId && (
                        <div className="opacity-0 group-hover/ctx:opacity-100 transition-opacity flex items-center gap-1 shrink-0 select-none mr-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingContextId(ctx.contextId);
                              setEditingContextLabel(ctx.label);
                            }}
                            className="p-0.5 text-[#fbf9f5]/35 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
                            title="Renomear chat"
                          >
                            <Edit2 size={8} />
                          </button>
                          <button
                            onClick={(e) => handleArchiveChat(ctx.contextId, e)}
                            className="p-0.5 text-[#fbf9f5]/35 hover:text-[#b8283e] transition-colors bg-transparent border-none cursor-pointer outline-none"
                            title="Arquivar chat"
                          >
                            <Archive size={8} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Chat Input/Button */}
                <div className="mt-0.5">
                  {isAddingChatForThisArea ? (
                    <input
                      autoFocus
                      type="text"
                      placeholder="novo chat..."
                      value={newChatName}
                      onChange={(e) => setNewChatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const rawLabel = newChatName.trim();
                          if (rawLabel) {
                            // Robust slugification: removes accents, replaces spaces with hyphens, removes special characters
                            const cleanAreaPrefix = areaId.replace('area_', '');
                            const slug = rawLabel
                              .toLowerCase()
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .replace(/[^a-z0-9\s-]/g, '')
                              .replace(/\s+/g, '-')
                              .replace(/-+/g, '-');
                            
                            let baseContextId = `${cleanAreaPrefix}_${slug}`;
                            let contextId = baseContextId;
                            let counter = 1;
                            
                            // Check for collisions inside allContextNodes (which includes INITIAL_CONTEXT_NODES and customContextNodes)
                            while (allContextNodes.some(node => node.contextId === contextId)) {
                              contextId = `${baseContextId}-${counter}`;
                              counter++;
                            }
                            
                            const openclawSessionKey = `agent:main:pulso:${contextId}`;
                            const newNode: PulsoContextNode = {
                              areaId,
                              contextId,
                              chatId: "default", // local/provisional compatibility flag
                              openclawSessionKey,
                              label: rawLabel
                            };
                            
                            const updated = [...customContextNodes, newNode];
                            setCustomContextNodes(updated);
                            localStorage.setItem('pulso_custom_contexts', JSON.stringify(updated));

                            const isFirestore = pulsoService.getDataMode() === 'firestore';
                            if (isFirestore && db) {
                              const path = firestorePaths.customContext(contextId);
                              const contextDocRef = doc(db, path);
                              setDoc(contextDocRef, {
                                ...newNode,
                                createdAt: new Date().toISOString()
                              }).catch((err: any) => console.error("Failed to save custom context to Firestore:", err));
                            }

                            setActiveContextNode(newNode);
                            setNewChatName('');
                            setAddingChatAreaId(null);
                            setHoveredAreaId(null);
                          }
                        } else if (e.key === 'Escape') {
                          setAddingChatAreaId(null);
                          setNewChatName('');
                          setHoveredAreaId(null);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setAddingChatAreaId(null);
                          setNewChatName('');
                          setHoveredAreaId(null);
                        }, 200);
                      }}
                      className="bg-transparent border-b border-[#fbf9f5]/20 text-[#fbf9f5] text-[8px] tracking-wider uppercase w-20 py-0.5 outline-none placeholder-[#fbf9f5]/25"
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingChatAreaId(areaId);
                      }}
                      className="text-[8px] font-light text-[#fbf9f5]/25 hover:text-[#fbf9f5]/60 transition-colors uppercase select-none cursor-pointer border-none bg-transparent outline-none p-0 text-left w-full"
                    >
                      + novo
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

        <main className={`flex-1 min-h-0 overflow-y-auto overscroll-none no-scrollbar flex flex-col lg:flex-row 2xl:flex-col lg:items-center items-center justify-end lg:justify-center 2xl:justify-end max-w-5xl w-full mx-auto mt-6 mb-4 z-10 relative transition-all duration-1000 ease-in-out`}>
          
          <div 
            onClick={togglePresenceMode}
            className={`relative w-64 h-64 flex items-center justify-center shrink-0 select-none transition-all duration-1000 ease-in-out ${!presenceMode ? 'cursor-pointer' : ''} ${
            presenceMode 
              ? 'z-20 translate-y-[15vh] md:translate-y-[25vh] lg:translate-y-0 lg:translate-x-[15vw] 2xl:translate-x-0 2xl:translate-y-[25vh]' 
              : 'mt-auto mb-4 md:mb-12 lg:mt-0 lg:mb-0 lg:mr-10 2xl:mt-auto 2xl:mb-auto 2xl:mr-0 z-10 translate-y-[-2vh] md:translate-y-[-5vh] lg:translate-y-0 2xl:translate-y-0'
          }`}>
            <div className={`absolute flex items-center justify-center transition-transform duration-1000 ease-in-out origin-center ${
              presenceMode ? 'scale-[0.75] md:scale-100' : 'scale-[0.417] md:scale-50 lg:scale-[0.55] 2xl:scale-[0.54]'
            }`}>
              <div 
                className={`w-[422px] h-[422px] rounded-full border-[19px] border-[#fbf9f5] transition-all duration-1000 ease-in-out flex flex-col items-center justify-center p-8 text-center ${getLotusAnimClass()}`} 
                aria-label={`Modo Presença: ${presenceState}`}
              />
            </div>
          </div>

          <div 
            className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative bg-transparent border-none shadow-none overflow-hidden pulso-transition flex-1 min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 ${
              presenceMode ? 'pulso-hidden-center' : 'pulso-visible'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleAttachFiles(e.dataTransfer.files);
              }
            }}
          >
            {isDraggingFile && (
              <div className="absolute inset-0 z-50 bg-[#b8283e]/10 backdrop-blur-md border-2 border-dashed border-[#b8283e]/50 rounded-2xl flex flex-col items-center justify-center animate-fade-in pointer-events-none">
                <div className="bg-black/80 p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-2 max-w-xs text-center">
                  <UploadCloud size={28} className="text-[#b8283e] animate-bounce" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#fbf9f5]">Solte para anexar</p>
                  <p className="text-[10px] text-[#fbf9f5]/60 lowercase font-light">imagens, áudios, PDFs ou qualquer arquivo ao chat</p>
                </div>
              </div>
            )}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="absolute inset-0 chat-fade-mask overflow-y-auto no-scrollbar px-6 py-6 space-y-8"
            >
              {currentMessages.map((msg) => {
                const isLotus = msg.sender === 'lotus';
                if (isLotus && !msg.text) return null;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex w-full ${isLotus ? 'justify-start' : 'justify-end'} animate-fade-in`}
                  >
                    <div className="max-w-[85%] space-y-1">
                      <span className={`block text-[9px] tracking-widest lowercase select-none ${
                        isLotus ? 'text-white font-bold opacity-90' : 'text-[#fbf9f5]/50 font-light'
                      }`}>
                        {isLotus ? 'lótus' : 'fê'}
                      </span>
                      
                      {/* Text body & blocks renderer */}
                      {(!msg.attachments || msg.attachments.length === 0 || msg.text !== msg.attachments.map(a => a.name).join(', ')) && msg.text && (
                        <div className={`text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 block break-words ${!isLotus ? 'text-right' : 'text-left'}`} style={{ overflowWrap: 'anywhere' }}>
                          <MessageRenderer text={msg.text} sender={msg.sender} />
                        </div>
                      )}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-2 ${!isLotus ? 'justify-end' : 'justify-start'}`}>
                          {msg.attachments.map((att) => {
                            if (att.type === 'image') {
                              return (
                                <div key={att.id} className="flex flex-col gap-1 w-full max-w-[200px]">
                                  <div 
                                    onClick={() => setPreviewImage(att)}
                                    className="relative group cursor-pointer overflow-hidden rounded-lg border border-white/10 max-h-24"
                                  >
                                    <img 
                                      src={att.url} 
                                      alt={att.name} 
                                      className="object-cover h-24 w-full transition-transform group-hover:scale-105"
                                    />
                                  </div>
                                  <span className="text-[9px] text-[#fbf9f5]/40 font-light truncate px-1 text-left" title={att.name}>
                                    {att.name}
                                  </span>
                                </div>
                              );
                            }
                            if (att.type === 'audio') {
                              return (
                                <div key={att.id} className="flex flex-col gap-1 w-full max-w-xs mt-1">
                                  <audio 
                                    controls 
                                    src={att.url} 
                                    className="w-full h-8 opacity-80 hover:opacity-100 transition-opacity" 
                                  />
                                  <span className="text-[9px] text-[#fbf9f5]/40 font-light truncate px-1 text-left" title={att.name}>
                                    {att.name}
                                  </span>
                                </div>
                              );
                            }
                            if (att.type === 'pdf') {
                              return (
                                <div 
                                  key={att.id}
                                  onClick={() => setPreviewPdf(att)}
                                  className="flex flex-col gap-1 w-full max-w-xs mt-1"
                                >
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer select-none transition-all text-left">
                                    <FileText size={14} className="text-[#b8283e] shrink-0" />
                                    <span className="text-[9px] text-[#fbf9f5]/40 uppercase tracking-widest font-medium">
                                      pdf {att.sizeBytes ? `• ${(att.sizeBytes/1024).toFixed(1)}kb` : ''}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-[#fbf9f5]/40 font-light truncate px-1 text-left" title={att.name}>
                                    {att.name}
                                  </span>
                                </div>
                              );
                            }
                            // Generic
                            return (
                              <a 
                                key={att.id}
                                href={att.url}
                                download={att.name}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col gap-1 w-full max-w-xs mt-1"
                              >
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer select-none transition-all text-left">
                                  <Paperclip size={14} className="text-white/40 shrink-0" />
                                  <span className="text-[9px] text-[#fbf9f5]/40 uppercase tracking-widest font-medium">
                                    arquivo {att.sizeBytes ? `• ${(att.sizeBytes/1024).toFixed(1)}kb` : ''}
                                  </span>
                                </div>
                                <span className="text-[9px] text-[#fbf9f5]/40 font-light truncate px-1 text-left" title={att.name}>
                                  {att.name}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* User Message Timestamp */}
                      {!isLotus && msg.sender !== 'system' && (
                        <div className="text-right text-[9px] text-[#fbf9f5]/40 select-none lowercase">
                          {formatMessageTimestamp(msg.timestamp)}
                        </div>
                      )}

                      {/* Lótus Handoff Proposals Forms / Actions if applicable */}
                      {isLotus && msg.openclawResult && (
                        <div className="flex flex-col gap-2 mt-2">
                          {msg.openclawResult.actions && msg.openclawResult.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-start">
                              {msg.openclawResult.actions.map((action: any, idx: number) => {
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      if (action.type === 'trigger_mutation' && action.payload) {
                                        handleExecuteProposal({
                                          ...msg,
                                          openclawResult: {
                                            ...msg.openclawResult,
                                            proposedMutation: action.payload
                                          }
                                        } as any);
                                      } else {
                                        alert(`Ação acionada: ${action.label}`);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-lg text-[10px] text-white/80 hover:text-white transition-all select-none lowercase cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    {action.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {msg.openclawResult.sourcesConsulted && msg.openclawResult.sourcesConsulted.length > 0 && (
                            <div className="text-[9px] text-[#fbf9f5]/40 font-light mt-1 lowercase select-none">
                              fontes consultadas: {msg.openclawResult.sourcesConsulted.join(', ')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lótus Message Action Bar */}
                      {isLotus && (
                        <MessageActions
                          msg={msg}
                          playingMsgId={playingMsgId}
                          playingState={playingState}
                          onHearClick={handleHearClick}
                          onCopyText={handleCopyText}
                          onCopyPackage={handleCopyPackage}
                        />
                      )}

                      {isLotus && msg.openclawResult && (
                        <>
                          {msg.handoffStatus === 'executed' && msg.createdEntityRef && (
                            <p className="text-[10px] font-mono text-white bg-white/10 p-2 rounded-lg select-all border border-white/10 mt-2">
                              tarefa criada: {msg.createdEntityRef}
                            </p>
                          )}

                          {msg.handoffStatus === 'execution_blocked' && (
                            <div className="p-3 bg-[#fbf9f5] border border-[#b8283e]/20 rounded-xl space-y-1.5 text-[#3d2f2f] mt-2">
                              <p className="text-[9px] text-[#b8283e] font-bold lowercase">execução bloqueada</p>
                              <p className="text-[10px] text-[#3d2f2f]/80 font-light leading-relaxed">{msg.executionError || 'responsável não designado.'}</p>
                              
                              {(msg.executionError || '').includes("ownerRefs") && (
                                <button
                                  onClick={() => handleExecuteProposal(msg, true)}
                                  disabled={submittingExecutionId === msg.id}
                                  className="text-[9px] font-bold text-[#b8283e] hover:text-[#9b4138] transition-colors lowercase bg-transparent border-none cursor-pointer outline-none block mt-1"
                                >
                                  {submittingExecutionId === msg.id ? '[ executando... ]' : '[ confirmar como triagem & executar ]'}
                                </button>
                              )}
                            </div>
                          )}

                          {msg.openclawResult.requiresHumanApproval && msg.handoffStatus === 'waiting_user_approval' && (
                            <div className="p-3 bg-[#fbf9f5] border border-[#b8283e]/25 rounded-xl space-y-3 text-[#3d2f2f] mt-2">
                              <span className="block text-[9px] font-bold text-[#b8283e] tracking-widest lowercase">decisão pendente</span>
                              
                              <input
                                type="text"
                                value={approvalNotes[msg.id] || ''}
                                onChange={e => setApprovalNotes(prev => ({ ...prev, [msg.id]: e.target.value }))}
                                placeholder="nota (opcional)..."
                                className="w-full text-xs text-[#3d2f2f] bg-transparent border-b border-[#3d2f2f]/20 focus:border-[#b8283e] py-1 px-0.5 outline-none placeholder-[#3d2f2f]/45 lowercase"
                                disabled={submittingApprovalId === msg.id}
                              />

                              <div className="flex gap-4">
                                <button
                                  onClick={() => handleApproveProposal(msg)}
                                  disabled={submittingApprovalId === msg.id}
                                  className="text-[10px] font-bold text-[#b8283e] hover:text-[#9b4138] transition-colors lowercase bg-transparent border-none cursor-pointer outline-none"
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

                          {msg.handoffStatus === 'approved_by_user' && msg.openclawResult.proposedMutation?.type === 'create_task' && (
                            <button
                              onClick={() => handleExecuteProposal(msg, false)}
                              disabled={submittingExecutionId === msg.id}
                              className="w-full text-center py-2 bg-white/10 hover:bg-white/20 text-[10px] font-bold text-[#fbf9f5] border border-white/25 rounded-full transition-all lowercase cursor-pointer outline-none mt-2"
                            >
                              {submittingExecutionId === msg.id ? '[ executando... ]' : '[ executar criação de tarefa ]'}
                            </button>
                          )}
                        </>
                      )}

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

            {isLatestRequestPending && (
              <div className="flex justify-start w-full animate-pulse select-none text-left">
                <div className="space-y-1">
                  <span className="block text-[9px] tracking-widest text-[#fbf9f5] font-bold lowercase">lótus</span>
                  <span className="text-xs font-light text-[#fbf9f5]/40">pensando...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Floating button to return to bottom */}
          {showScrollButton && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 p-2 bg-[#fbf9f5]/15 hover:bg-[#fbf9f5]/25 border border-[#fbf9f5]/20 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-all duration-300 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 animate-fade-in"
              title="Voltar para a mensagem mais recente"
            >
              <ArrowDown size={14} className="animate-bounce" />
            </button>
          )}
        </div>

        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#b8283e] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 pulso-transition ${
          showAttachmentToast ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4 pointer-events-none'
        }`}>
          <Activity size={16} className="animate-pulse" />
          <span className="text-xs font-semibold tracking-widest uppercase">função em desenvolvimento</span>
        </div>
      </main>

      <footer className={`w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none pulso-transition max-h-40 gap-3 pb-6 md:pb-8 ${
        presenceMode ? 'pulso-hidden-center' : 'pulso-visible'
      }`}>
        
        {activeContextNode && (
          <div className="w-full flex justify-center mb-0.5 animate-fade-in select-none">
            <span className="text-[9px] text-[#fbf9f5]/25 tracking-widest uppercase font-mono font-light">
              [ contexto ativo: {activeContextNode.label} ]
            </span>
          </div>
        )}
        
        <div className="hidden md:flex items-center gap-3 overflow-x-auto no-scrollbar max-w-full pb-1 whitespace-nowrap">
          {[
            { label: 'resumo do dia', text: 'Resumo do meu dia', icon: Activity },
            { label: 'o que depende de mim', text: 'O que depende de mim?', icon: Zap },
            { label: 'tarefas atrasadas', text: 'Quais tarefas estão atrasadas?', icon: Clock },
            { label: 'projetos estagnados', text: 'Quais projetos estão travados?', icon: AlertTriangle }
          ].map((sugg, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sugg.text)}
              disabled={false}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-[#fbf9f5]/85 hover:text-white cursor-pointer select-none text-[9px] font-medium tracking-wide outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <sugg.icon size={10} strokeWidth={1.5} />
              <span>{sugg.label}</span>
            </button>
          ))}
        </div>

        {Object.values(uploadingFiles).some(fileInfo => fileInfo.contextId === activeContextNode.contextId) && (
          <div className="w-full bg-[#111111]/85 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 animate-fade-in text-[10px] text-[#fbf9f5]/80 max-h-36 overflow-y-auto no-scrollbar shadow-lg">
            {Object.entries(uploadingFiles)
              .filter(([_, fileInfo]) => fileInfo.contextId === activeContextNode.contextId)
              .map(([id, fileInfo]) => {
              const isError = fileInfo.status === 'erro' || fileInfo.error;
              const isConcluido = fileInfo.status === 'concluido';
              
              return (
                <div key={id} className="flex flex-col gap-1.5 animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate max-w-[220px] lowercase font-light text-[#fbf9f5]/90">{fileInfo.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {isError ? (
                        <span className="text-[#b8283e] font-semibold lowercase animate-pulse">falhou</span>
                      ) : isConcluido ? (
                        <span className="text-emerald-500 font-semibold lowercase flex items-center gap-0.5 animate-fade-in">
                          <Check size={10} strokeWidth={2.5} />
                          <span>concluído</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[#b8283e] font-semibold">
                          {fileInfo.progress === 0 ? 'preparando...' : `enviando... ${fileInfo.progress}%`}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isError && (
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 rounded-full ${isConcluido ? 'bg-emerald-500' : 'bg-[#b8283e]'}`} 
                        style={{ width: `${fileInfo.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="w-full flex items-end gap-3.5 bg-transparent border-b border-white/20 focus-within:border-white transition-colors py-2 px-1 relative">

          <div className="relative" ref={attachmentMenuRef}>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleAttachFiles(e.target.files)}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={(e) => handleAttachFiles(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
              className="p-1.5 text-[#fbf9f5]/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none mb-0.5"
              title="Anexar arquivos"
            >
              <Paperclip size={14} strokeWidth={1.5} />
            </button>
            
            <div className={`absolute bottom-full left-0 mb-2 w-36 bg-black/85 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden pulso-transition shadow-2xl ${
              isAttachmentMenuOpen ? 'opacity-100 transform translate-y-0 pointer-events-auto scale-100' : 'opacity-0 transform translate-y-2 pointer-events-none scale-95'
            }`}>
              <div className="flex flex-col text-xs font-light tracking-wide text-[#fbf9f5]">
                <button 
                  onClick={() => { fileInputRef.current?.setAttribute('accept', '*'); fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent cursor-pointer"
                >
                  <FileText size={12} className="opacity-70" />
                  <span>arquivos</span>
                </button>
                <button 
                  onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent cursor-pointer"
                >
                  <ImageIcon size={12} className="opacity-70" />
                  <span>fotos</span>
                </button>
                <button 
                  onClick={() => { cameraInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent cursor-pointer"
                >
                  <Camera size={12} className="opacity-70" />
                  <span>câmera</span>
                </button>
                <button 
                  onClick={() => { fileInputRef.current?.setAttribute('accept', 'audio/*'); fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left bg-transparent cursor-pointer"
                >
                  <Volume2 size={12} className="opacity-70" />
                  <span>áudio</span>
                </button>
              </div>
            </div>
          </div>
          
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              voiceState === 'transcribing' ? 'transcrevendo...' : 
               
              'digitar comando (cmd + enter envia)'
            }
            disabled={voiceState === 'transcribing'}
            rows={1}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent border-none text-sm font-light text-white placeholder:text-white/30 outline-none disabled:opacity-50 resize-none min-h-[36px] max-h-[160px] py-1.5 no-scrollbar"
          />

          {voiceState !== 'unsupported' && (
            <button
              onClick={toggleRecordingOnce}
              disabled={false}
              className={`p-1.5 rounded-full transition-all duration-300 cursor-pointer border-none outline-none bg-transparent mb-0.5 ${
                voiceMode === 'recording_once' 
                  ? 'text-[#b8283e] bg-white scale-105 shadow-md' 
                  : 'text-[#fbf9f5]/60 hover:text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={voiceMode === 'recording_once' ? 'gravando... clique para parar' : 'capturar áudio'}
            >
              {voiceMode === 'recording_once' ? <Mic size={14} strokeWidth={1.5} className="animate-pulse" /> : <Mic size={14} strokeWidth={1.5} />}
            </button>
          )}

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim()}
            className="p-1.5 text-[#fbf9f5]/60 hover:text-white disabled:opacity-20 disabled:hover:text-[#fbf9f5]/60 transition-colors bg-transparent border-none cursor-pointer outline-none mb-0.5"
          >
            <Send size={14} strokeWidth={1.5} />
          </button>
        </div>
      </footer>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0c0c]/70 backdrop-blur-xl p-8 flex flex-col text-left md:hidden animate-fade-in overflow-y-auto no-scrollbar"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="flex flex-col gap-6 w-full max-w-[260px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title / Close Button */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 select-none">
              <span className="text-[10px] font-bold tracking-widest text-[#fbf9f5]/55 uppercase">áreas & chats</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            {/* Accordion list */}
            <div className="flex flex-col gap-5">
              {AREA_ORDER.map((areaId) => {
                const areaName = AREA_NAMES[areaId] || areaId;
                const areaContexts = allContextNodes.filter(n => n.areaId === areaId);
                const isAreaActive = activeAreaId === areaId;
                const isExpanded = activeMobileAreaId === areaId;
                const hasUnreadInArea = areaContexts.some(n => !!unreadContexts[n.contextId]);
                
                return (
                  <div key={areaId} className="flex flex-col gap-2">
                    {/* Area Header Trigger */}
                    <div 
                      onClick={() => {
                        // accordion reativo restrito: only one area open at a time
                        setActiveMobileAreaId(isExpanded ? null : areaId);
                      }}
                      className="flex items-center justify-between cursor-pointer py-1 group/mobile-area select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-base font-mono ${isAreaActive ? 'text-white' : hasUnreadInArea ? 'pulso-unread font-bold' : 'text-[#fbf9f5]/35'}`}>
                          {getAreaIcon({ id: areaId, name: areaName })}
                        </span>
                        <span className={`text-[10px] tracking-wider uppercase font-sans ${isAreaActive ? 'text-white font-medium' : 'text-[#fbf9f5]/50'}`}>
                          {areaName}
                        </span>
                      </div>
                      <span className="text-[#fbf9f5]/25 group-hover/mobile-area:text-[#fbf9f5]/50 transition-colors">
                        {isExpanded ? <ChevronDown size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
                      </span>
                    </div>

                    {/* Chats list inside Area (Accordion Content) */}
                    {isExpanded && (
                      <div className="flex flex-col gap-2 pl-6 pb-2 border-l border-white/5 ml-2.5 animate-fade-in">
                        {areaContexts.map((ctx) => {
                          const isContextActive = activeContextNode.contextId === ctx.contextId;
                          const isUnread = !!unreadContexts[ctx.contextId];
                          const isCustom = customContextNodes.some(n => n.contextId === ctx.contextId);
                          
                          return (
                            <div 
                              key={ctx.contextId} 
                              className="flex items-center justify-between gap-2 w-full py-0.5 cursor-pointer"
                              onClick={() => {
                                setActiveContextNode(ctx);
                                setIsMobileMenuOpen(false); // Close menu naturally
                              }}
                            >
                              {editingContextId === ctx.contextId ? (
                                <input
                                  type="text"
                                  value={editingContextLabel}
                                  onChange={(e) => setEditingContextLabel(e.target.value)}
                                  onBlur={() => handleRenameChat(ctx.contextId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameChat(ctx.contextId);
                                    }
                                    if (e.key === 'Escape') setEditingContextId(null);
                                  }}
                                  className="bg-white/10 text-white border border-white/20 rounded px-1.5 py-0.5 text-[9px] outline-none w-full lowercase"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span 
                                  className={`text-[9px] tracking-wider uppercase font-sans cursor-pointer transition-all duration-200 select-none truncate flex-1 text-left ${
                                    isContextActive 
                                      ? 'text-white font-medium' 
                                      : isUnread 
                                      ? 'pulso-unread font-bold animate-pulse' 
                                      : 'text-[#fbf9f5]/40 hover:text-[#fbf9f5]/80'
                                  }`}
                                >
                                  {ctx.label}
                                </span>
                              )}

                              {isCustom && editingContextId !== ctx.contextId && (
                                <div className="flex items-center gap-1.5 shrink-0 select-none ml-2" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingContextId(ctx.contextId);
                                      setEditingContextLabel(ctx.label);
                                    }}
                                    className="p-0.5 text-[#fbf9f5]/30 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
                                    title="Renomear chat"
                                  >
                                    <Edit2 size={8} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      handleArchiveChat(ctx.contextId, e);
                                      setIsMobileMenuOpen(false); // Close menu naturally on archive
                                    }}
                                    className="p-0.5 text-[#fbf9f5]/30 hover:text-[#b8283e] transition-colors bg-transparent border-none cursor-pointer outline-none"
                                    title="Arquivar chat"
                                  >
                                    <Archive size={8} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Create dynamic chat in mobile area */}
                        <div className="pt-1 select-none">
                          {addingChatAreaId === areaId ? (
                            <input 
                              type="text"
                              value={newChatName}
                              onChange={(e) => setNewChatName(e.target.value)}
                              placeholder="nome..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const rawLabel = newChatName.trim();
                                  if (rawLabel) {
                                    const cleanAreaPrefix = areaId.replace('area_', '');
                                    const slug = rawLabel
                                      .toLowerCase()
                                      .normalize('NFD')
                                      .replace(/[\u0300-\u036f]/g, '')
                                      .replace(/[^a-z0-9\s-]/g, '')
                                      .replace(/\s+/g, '-')
                                      .replace(/-+/g, '-');
                                    
                                    let baseContextId = `${cleanAreaPrefix}_${slug}`;
                                    let contextId = baseContextId;
                                    let counter = 1;
                                    
                                    while (allContextNodes.some(node => node.contextId === contextId)) {
                                      contextId = `${baseContextId}-${counter}`;
                                      counter++;
                                    }
                                    
                                    const openclawSessionKey = `agent:main:pulso:${contextId}`;
                                    const newNode: PulsoContextNode = {
                                      areaId,
                                      contextId,
                                      chatId: "default",
                                      openclawSessionKey,
                                      label: rawLabel
                                    };
                                    
                                    const updated = [...customContextNodes, newNode];
                                    setCustomContextNodes(updated);
                                    localStorage.setItem('pulso_custom_contexts', JSON.stringify(updated));
                                    
                                    const isFirestore = pulsoService.getDataMode() === 'firestore';
                                    if (isFirestore && db) {
                                      const path = firestorePaths.customContext(contextId);
                                      const contextDocRef = doc(db, path);
                                      setDoc(contextDocRef, {
                                        ...newNode,
                                        createdAt: new Date().toISOString()
                                      }).catch((err: any) => console.error("Failed to save custom context to Firestore:", err));
                                    }

                                    setActiveContextNode(newNode);
                                    setNewChatName('');
                                    setAddingChatAreaId(null);
                                    setIsMobileMenuOpen(false); // Close menu naturally
                                  }
                                } else if (e.key === 'Escape') {
                                  setAddingChatAreaId(null);
                                  setNewChatName('');
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setAddingChatAreaId(null);
                                  setNewChatName('');
                                }, 200);
                              }}
                              className="bg-transparent border-b border-white/20 text-[#fbf9f5] text-[9px] tracking-wider uppercase w-full py-0.5 outline-none placeholder-white/20 lowercase"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddingChatAreaId(areaId);
                              }}
                              className="text-[8px] tracking-widest text-[#fbf9f5]/25 hover:text-white/60 transition-colors uppercase font-mono bg-transparent border-none cursor-pointer outline-none py-0.5"
                            >
                              [ + novo chat ]
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(isSidebarOpen || isTtsSettingsOpen) && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] cursor-pointer"
          onClick={() => { setIsSidebarOpen(false); setIsTtsSettingsOpen(false); }}
        />
      )}

      {isSidebarOpen && (
        <div 
          className="fixed top-4 right-4 bottom-4 z-50 w-80 md:w-96 bg-black/10 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-6 overflow-y-auto no-scrollbar flex flex-col justify-between text-left text-[#fbf9f5] animate-fade-in"
        >
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-white" strokeWidth={1.5} />
                <span className="text-xs font-bold tracking-widest text-white/90 lowercase">sinais operacionais</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="text-[#fbf9f5]/45 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">briefing do agora</h4>
              <div className="divide-y divide-white/10 text-sm">
                <div className="py-2.5 flex justify-between items-center">
                  <span className="font-light text-[#fbf9f5]/70 lowercase">minhas tarefas</span>
                  <span className="font-bold text-base text-white">{feTasks.length}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="font-light text-[#fbf9f5]/70 lowercase">riscos & travas</span>
                  <span className={`font-bold text-base ${totalRisksCount > 0 ? 'text-white underline decoration-white/40' : 'text-white/60'}`}>{totalRisksCount}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="font-light text-[#fbf9f5]/70 lowercase">projetos ativos</span>
                  <span className="font-bold text-base text-white">{activeProjects.length}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="font-light text-[#fbf9f5]/70 lowercase">metabolismo</span>
                  <span className={`font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                    brokenRoutines.length > 0 ? 'text-white border-white/30 bg-white/10' : 'text-white/60 border-white/10 bg-white/5'
                  }`}>
                    {brokenRoutines.length > 0 ? 'instável' : 'saudável'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">ações recomendadas</h4>
              <div className="divide-y divide-white/10">
                {nextBestActions.map((action, i) => (
                  <div key={i} className="py-3 flex flex-col gap-1.5">
                    <p className="text-xs font-light text-[#fbf9f5]/80 leading-relaxed lowercase">{action.text}</p>
                    <button 
                      onClick={() => { action.onClick(); setIsSidebarOpen(false); }}
                      className="text-[10px] font-bold text-white hover:text-white/80 flex items-center gap-1 transition-colors self-start lowercase bg-transparent border-none cursor-pointer outline-none"
                    >
                      <span>{action.actionText}</span>
                      <ArrowRight size={10} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">projetos ativos</h4>
                <button 
                  onClick={() => { router.push('/pulso/ecossistema'); setIsSidebarOpen(false); }}
                  className="text-[9px] text-[#fbf9f5]/75 hover:text-white hover:underline lowercase bg-transparent border-none cursor-pointer outline-none"
                >
                  ver ecossistema
                </button>
              </div>
              <div className="divide-y divide-white/10 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                {activeProjects.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs text-[#fbf9f5]/90">
                    <span className="font-medium truncate max-w-[150px] lowercase">{p.name}</span>
                    <span className="text-[10px] font-light text-[#fbf9f5]/55 truncate max-w-[120px] lowercase">
                      {p.nextStep ? p.nextStep : 'sem passo'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">fontes observadas</h4>
              <div className="divide-y divide-white/10 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                {allSources.slice(0, 5).map((src: any, i) => (
                  <div key={i} className="flex justify-between items-center text-xs py-2.5 text-[#fbf9f5]/90">
                    <span className="font-light lowercase">{src.name}</span>
                    <span className="text-[9px] font-bold text-[#fbf9f5]/65 uppercase tracking-wider">sintonizado</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Drawer Footer / Backstage trigger */}
          <div className="border-t border-white/15 pt-4 mt-8 flex flex-col gap-2">
            <button 
              onClick={() => { router.push('/pulso/eventos'); setIsSidebarOpen(false); }}
              className="w-full text-center py-2 border border-white/20 rounded-full text-[9px] font-bold text-white/75 hover:text-white hover:border-white/40 transition-colors lowercase bg-transparent cursor-pointer outline-none"
            >
              abrir bastidor técnico (logs)
            </button>
          </div>
        </div>
      )}

      {isTtsSettingsOpen && (
        <div 
          className="fixed top-4 right-4 bottom-4 z-50 w-80 md:w-96 bg-black/10 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-6 overflow-y-auto no-scrollbar flex flex-col justify-between text-left text-[#fbf9f5] animate-fade-in"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <div className="flex items-center gap-2">
                <Mic size={14} className="text-white" strokeWidth={1.5} />
                <span className="text-xs font-bold tracking-widest text-white/90 lowercase">voz da lótus (tts)</span>
              </div>
              <button 
                onClick={() => setIsTtsSettingsOpen(false)}
                className="text-[#fbf9f5]/45 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">provedor de voz</label>
                <select
                  value={ttsPrefs.ttsProvider}
                  onChange={(e) => {
                    const provider = e.target.value as any;
                    const newPrefs = { ...ttsPrefs, ttsProvider: provider };
                    setTtsPrefs(newPrefs);
                    ttsAdapter.updatePreferences(newPrefs);
                  }}
                  className="pulso-select w-full"
                >
                  <option value="browser_native" className="bg-[#121212]">nativo do navegador</option>
                  <option value="kokoro_http" className="bg-[#121212]">kokoro http (oficial)</option>
                  <option value="local_kokoro" className="bg-[#121212]">kokoro-fastapi (beta)</option>
                  <option value="local_piper" disabled className="bg-[#121212]">local piper (indisponível)</option>
                  <option value="cloud_google" disabled className="bg-[#121212]">google cloud tts (indisponível)</option>
                </select>
              </div>

              {ttsPrefs.ttsProvider === 'browser_native' ? (
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">voz selecionada</label>
                  <select
                    value={ttsPrefs.voiceURI}
                    onChange={(e) => {
                      const selected = availableVoices.find(v => v.voiceURI === e.target.value);
                      if (selected) {
                        const newPrefs = { ...ttsPrefs, voiceURI: selected.voiceURI, voiceName: selected.name, voiceLang: selected.lang };
                        setTtsPrefs(newPrefs);
                        ttsAdapter.updatePreferences(newPrefs);
                      }
                    }}
                    className="pulso-select w-full"
                  >
                    {availableVoices.length === 0 ? (
                      <option className="bg-[#121212]">nenhuma voz pt-br encontrada</option>
                    ) : (
                      availableVoices.map((v, i) => (
                        <option key={i} value={v.voiceURI} className="bg-[#121212]">
                          {v.name} ({v.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">voz selecionada (kokoro)</label>
                    <select
                      value={ttsPrefs.voiceName === 'pf_dora' ? 'pf_dora' : 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newVoiceName = val === 'custom' ? '' : val;
                        const newPrefs = { ...ttsPrefs, voiceName: newVoiceName };
                        setTtsPrefs(newPrefs);
                        ttsAdapter.updatePreferences(newPrefs);
                      }}
                      className="pulso-select w-full"
                    >
                      <option value="pf_dora" className="bg-[#121212]">pf_dora (fem pt-br - provisória)</option>
                      <option value="custom" className="bg-[#121212]">outra voz (escrever abaixo)...</option>
                    </select>
                    <span className="text-[8px] text-[#fbf9f5]/40 leading-relaxed block mt-1">
                      nota: apenas pf_dora está instalada como voz feminina PT-BR local.
                    </span>
                  </div>

                  {ttsPrefs.voiceName !== 'pf_dora' && (
                    <div className="flex flex-col gap-0.5 animate-fade-in">
                      <label className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">nome da voz customizada</label>
                      <input
                        type="text"
                        value={ttsPrefs.voiceName}
                        placeholder="Ex: pm_alex, af_sarah"
                        onChange={(e) => {
                          const newPrefs = { ...ttsPrefs, voiceName: e.target.value };
                          setTtsPrefs(newPrefs);
                          ttsAdapter.updatePreferences(newPrefs);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors lowercase"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">endpoint kokoro http</label>
                    <input
                      type="text"
                      value={kokoroEndpoint}
                      placeholder="http://127.0.0.1:8880/v1/audio/speech"
                      onChange={(e) => {
                        const val = e.target.value;
                        setKokoroEndpoint(val);
                        localStorage.setItem('pulso_tts_kokoro_endpoint', val);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">
                  <span>velocidade (rate)</span>
                  <span>{ttsPrefs.rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={ttsPrefs.rate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    const newPrefs = { ...ttsPrefs, rate };
                    setTtsPrefs(newPrefs);
                    ttsAdapter.updatePreferences(newPrefs);
                  }}
                  className="pulso-slider"
                />
              </div>

              {ttsPrefs.ttsProvider === 'browser_native' && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">
                    <span>tom (pitch)</span>
                    <span>{ttsPrefs.pitch.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={ttsPrefs.pitch}
                    onChange={(e) => {
                      const pitch = parseFloat(e.target.value);
                      const newPrefs = { ...ttsPrefs, pitch };
                      setTtsPrefs(newPrefs);
                      ttsAdapter.updatePreferences(newPrefs);
                    }}
                    className="pulso-slider"
                  />
                </div>
              )}

              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">
                  <span>volume</span>
                  <span>{Math.round(ttsPrefs.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={ttsPrefs.volume}
                  onChange={(e) => {
                    const volume = parseFloat(e.target.value);
                    const newPrefs = { ...ttsPrefs, volume };
                    setTtsPrefs(newPrefs);
                    ttsAdapter.updatePreferences(newPrefs);
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                <span className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">sinais sonoros (foco)</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={presenceSoundCuesEnabled}
                    onChange={(e) => setPresenceSoundCuesEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-white/30 relative"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                <span className="text-[9px] font-bold tracking-widest text-[#fbf9f5]/45 uppercase">notificações sonoras</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notificationSoundEnabled}
                    onChange={(e) => setNotificationSoundEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-white/30 relative"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-white/15 pt-4 mt-8 flex flex-col gap-2">
            <button 
              onClick={() => {
                if (playingMsgId === 'test') {
                  ttsAdapter.cancel();
                  setPlayingMsgId(null);
                  setPlayingState('stopped');
                } else {
                  setPlayingMsgId('test');
                  setPlayingState('preparing');
                  ttsAdapter.speak(
                    "oi, fê. esta é uma voz de teste da lótus.",
                    () => {
                      setPlayingMsgId(prev => {
                        if (prev === 'test') {
                          setPlayingState('playing');
                        }
                        return prev;
                      });
                    },
                    () => {
                      setPlayingMsgId(prev => {
                        if (prev === 'test') {
                          setPlayingState('stopped');
                          return null;
                        }
                        return prev;
                      });
                    },
                    () => {
                      setPlayingMsgId(prev => {
                        if (prev === 'test') {
                          setPlayingState('preparing');
                        }
                        return prev;
                      });
                    }
                  );
                }
              }}
              className="w-full text-center py-2 border border-white/20 rounded-full text-[9px] font-bold text-white/75 hover:text-white hover:border-white/40 transition-colors lowercase bg-transparent cursor-pointer outline-none font-sans"
            >
              {playingMsgId === 'test'
                ? (playingState === 'preparing' ? '[ preparando ]' : '[ parar ]')
                : '[ testar voz da lótus ]'}
            </button>
            <button 
              onClick={() => setIsTtsSettingsOpen(false)}
              className="w-full text-center py-2 text-[9px] text-[#fbf9f5]/45 hover:text-white transition-colors lowercase bg-transparent border-none cursor-pointer outline-none"
            >
              fechar
            </button>
          </div>
        </div>
      )}

      {previewImage && (
        <div 
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in cursor-zoom-out p-4 md:p-8"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
          >
            <X size={20} />
          </button>
          <div 
            className="relative max-w-full max-h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={previewImage.url} 
              alt={previewImage.name} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-white/10 shadow-2xl animate-scale-in"
            />
            <div className="mt-4 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-xs font-light text-[#fbf9f5]/90 tracking-wide flex items-center gap-4">
              <span className="truncate max-w-[200px] md:max-w-[400px] font-medium">{previewImage.name}</span>
              <span className="text-[10px] text-[#fbf9f5]/40">{previewImage.sizeBytes ? `${(previewImage.sizeBytes/1024/1024).toFixed(2)} MB` : ''}</span>
              <a 
                href={previewImage.url} 
                download={previewImage.name} 
                target="_blank" 
                rel="noreferrer"
                className="text-[#b8283e] hover:text-[#b8283e]/85 transition-colors cursor-pointer flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest"
              >
                <Download size={12} />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {previewPdf && (
        <div className="fixed inset-0 z-[140] flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setPreviewPdf(null)} />
          
          <div className="relative w-full md:w-[600px] lg:w-[700px] xl:w-[800px] h-full bg-[#0d0d0d] border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-[#b8283e]" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-wide text-white truncate lowercase">{previewPdf.name}</h3>
                  <p className="text-[9px] text-[#fbf9f5]/40 uppercase tracking-widest mt-0.5">
                    pdf • {previewPdf.sizeBytes ? `${(previewPdf.sizeBytes / 1024).toFixed(1)} kb` : ''}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <a 
                  href={previewPdf.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 cursor-pointer"
                  title="Abrir em Nova Aba"
                >
                  <ExternalLink size={14} />
                </a>
                <a 
                  href={previewPdf.url} 
                  download={previewPdf.name} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 cursor-pointer"
                  title="Baixar Arquivo"
                >
                  <Download size={14} />
                </a>
                <button 
                  onClick={() => setPreviewPdf(null)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 cursor-pointer"
                  title="Fechar"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#141414] relative flex flex-col items-center justify-center p-6">
              <iframe 
                src={`${previewPdf.url}#toolbar=0`}
                className="w-full h-full border-none rounded-lg bg-white"
                title={previewPdf.name}
              />
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center max-w-sm sm:max-w-md shadow-2xl">
                <div className="text-left min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white">Visualização de PDF</p>
                  <p className="text-[9px] text-white/60 lowercase">Caso a pré-visualização não carregue, escolha uma opção abaixo:</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a 
                    href={previewPdf.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#b8283e] hover:bg-[#b8283e]/90 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>Abrir Aba</span>
                  </a>
                  <a 
                    href={previewPdf.url} 
                    download={previewPdf.name} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/10 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>Baixar</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-black/60 backdrop-blur-md border border-white/10 text-[#fbf9f5] px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-fade-in text-[10px] tracking-widest lowercase select-none">
          <Check size={12} className="text-[#fbf9f5]" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
