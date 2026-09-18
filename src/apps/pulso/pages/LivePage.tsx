'use client';
import ArcaDrawer from '../components/ArcaDrawer';
import { AreaConfigPanel } from '../components/AreaConfigPanel';
import { MesaPanel } from '../components/MesaPanel';
import { listen } from '@tauri-apps/api/event';

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

interface SortableAreaItemWrapperProps {
  area: { id: string; name: string };
  isAreaActive: boolean;
  hasUnreadInArea: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onClickArea: () => void;
  areaContexts: any[];
  editingContextId: string | null;
  editingContextLabel: string;
  setEditingContextLabel: (val: string) => void;
  handleRenameChat: (id: string) => void;
  setEditingContextId: (id: string | null) => void;
  activeContextNode: any;
  unreadContexts: any;
  handleArchiveChat: (id: string, e: any) => void;
  isAddingChatForThisArea: boolean;
  newChatName: string;
  setNewChatName: (val: string) => void;
  setAddingChatAreaId: (id: string | null) => void;
  setHoveredAreaId: (id: string | null) => void;
  allContextNodes: any[];
  setSessions: any;
  setActiveContextNode: (node: any) => void;
  getAreaIcon: (area: any) => React.ReactNode;
  onDeleteArea: (areaId: string, areaName: string, e: React.MouseEvent) => void;
  onOpenAreaConfig: (areaId: string) => void;
}

function SortableAreaItemWrapper({
  area,
  isAreaActive,
  hasUnreadInArea,
  isHovered,
  onMouseEnter,
  onClickArea,
  areaContexts,
  editingContextId,
  editingContextLabel,
  setEditingContextLabel,
  handleRenameChat,
  setEditingContextId,
  activeContextNode,
  unreadContexts,
  handleArchiveChat,
  isAddingChatForThisArea,
  newChatName,
  setNewChatName,
  setAddingChatAreaId,
  setHoveredAreaId,
  allContextNodes,
  setSessions,
  setActiveContextNode,
  getAreaIcon,
  onDeleteArea,
  onOpenAreaConfig
}: SortableAreaItemWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: area.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as any,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      onMouseEnter={onMouseEnter}
      className="flex flex-col items-start transition-all duration-300 w-full"
    >
      {/* Area Trigger Container */}
      <div 
        onClick={onClickArea}
        className="flex items-center justify-between group/item w-full"
      >
        <div 
          {...attributes}
          {...listeners}
          className="flex items-center gap-2.5 cursor-grab active:cursor-grabbing py-1 flex-1 touch-none"
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
            {getAreaIcon({ id: area.id, name: area.name })}
          </span>

          {/* Area Text Label */}
          <span 
            className={`text-[9px] tracking-widest uppercase font-sans font-light transition-all duration-200 opacity-0 max-w-0 overflow-hidden whitespace-nowrap group-hover/sidebar:opacity-40 group-hover/sidebar:max-w-[150px] group-hover/item:opacity-90 ${
              isAreaActive ? 'text-white font-medium' : 'text-[#fbf9f5]'
            }`}
          >
            {area.name}
          </span>
        </div>

        {/* Configure Area Button (Visible on hover) */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenAreaConfig(area.id); }}
          className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-[#fbf9f5]/25 hover:text-white bg-transparent border-none cursor-pointer outline-none shrink-0"
          title={`Configurar área ${area.name}`}
        >
          <Settings size={10} strokeWidth={2} />
        </button>

        {/* Delete Area Button (Visible on hover, except for default core system areas) */}
        {!['area_eu', 'area_trabalho', 'area_casa', 'area_familia', 'area_criacao', 'area_estudo', 'area_habitos', 'area_saude', 'area_dinheiro', 'area_pessoas', 'area_viagens', 'area_lazer', 'area_sistema', 'area_futuro', 'area_livre', 'area_despertar'].includes(area.id) && (
          <button
            onClick={(e) => onDeleteArea(area.id, area.name, e)}
            className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-[#fbf9f5]/25 hover:text-[#b8283e] bg-transparent border-none cursor-pointer outline-none shrink-0"
            title="Excluir Área"
          >
            <X size={10} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Sub-contexts (Sanfona style) */}
      <div 
        className={`flex flex-col gap-1.5 pl-8 overflow-y-auto no-scrollbar transition-all duration-300 ease-in-out w-full ${
          isHovered ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        {areaContexts.map((ctx) => {
          const isContextActive = activeContextNode.contextId === ctx.contextId;
          const isUnread = !!unreadContexts[ctx.contextId];
          const isCustom = !ctx.isDefault;
          
          return (
            <div
              key={ctx.contextId}
              onClick={() => {
                setActiveContextNode(ctx);
              }}
              className="group/ctx flex items-center justify-between gap-2 w-full py-0.5 cursor-pointer"
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
                    const cleanAreaPrefix = area.id.replace('area_', '');
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
                    
                    (async () => {
                      const createdSession = await sessionsService.createSession({
                        id: contextId,
                        label: rawLabel,
                        areaId: area.id,
                      }).catch(err => {
                        console.error("Failed to create session:", err);
                        return null;
                      });

                      if (createdSession) {
                        const newNode = sessionToContextNode(createdSession);
                        if (pulsoService.getDataMode() !== 'firestore') {
                          const list = await sessionsService.getAll();
                          setSessions(list.map(s => sessionToContextNode(s)));
                        }
                        setActiveContextNode(newNode);
                      }
                    })();
                    
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
                setAddingChatAreaId(area.id);
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
}

import React from 'react';
import { createPortal } from 'react-dom';
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
import { actionLedgerClient } from '../../../lib/pulso/ledger/ActionLedgerClient';
import { SummaryCards } from '../../../components/pulso/SummaryCards';
import { intentRouter } from '../../../lib/pulso/llm/IntentRouter';
import { localActions } from '../../../lib/pulso/actions/localActions';
import { VoiceSessionController, VoiceSessionState } from '../../../lib/pulso/audio/VoiceSessionController';


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
  Settings,
  Circle,
  Hash,
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
  ChevronRight,
  Globe,
  Layers,
  Cpu,
  Palette,
  Video,
  Terminal
} from 'lucide-react';
import { formatDate, truncateText } from '../utils/formatters';
import { interpretLiveIntent } from '../utils/liveIntentInterpreter';
import { onSnapshot, collection, query, where, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { db, storage } from '../../../shared/lib/firebase/client';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { firestorePaths } from '../services/firestorePaths';
import { PulsoContextNode, Session } from '../types/pulso.types';
import { sessionsService } from '../services/sessionsService';
import dynamic from 'next/dynamic';
import { useMeetingRecorder } from '../hooks/useMeetingRecorder';
const AtelieWorkspace = dynamic(() => import('../components/AtelieWorkspace'), {
  ssr: false,
  loading: () => <div className="p-8 text-white/50 text-xs font-mono">Carregando ateliê...</div>
});

const EstudioWorkspace = dynamic(() => import('../components/EstudioWorkspace'), {
  ssr: false,
  loading: () => <div className="p-8 text-white/50 text-xs font-mono">Carregando estúdio...</div>
});



interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'audio' | 'generic';
  mimeType: string;
  url: string;
  sizeBytes?: number;
  createdAt: Date;
  contextId: string;
  
  // Camada de Texto Interoperável
  textExtracted?: string;
  summary?: string;
  keyExcerpts?: string[];
  sectionIndex?: Array<{ title: string; pageRange: string; summaryExcerpt: string }>;

  // Controles de Ciclo de Vida e Envio
  status?: 'uploading' | 'processing_extraction' | 'ready' | 'failed';
  availableToLotus?: boolean;
  includedInline?: boolean;
  fullTextDeferred?: boolean;
  extractionMode?: 'none' | 'text' | 'ocr' | 'transcription' | 'multimodal';
}

/**
 * Converts a persisted Session entity into the PulsoContextNode shape used throughout the UI.
 * This keeps backward compat while the UI layer gradually adopts Session directly.
 */
const sessionToContextNode = (session: Session): PulsoContextNode => ({
  areaId: session.areaId || '',
  subareaId: session.subareaId || '',
  contextId: session.id,
  chatId: 'default',
  openclawSessionKey: session.openclawSessionKey,
  label: session.label,
  archived: session.archived ?? false,
  isDefault: session.isDefault ?? false,
  lastMessageAt: session.lastMessageAt,
  updatedAt: session.updatedAt,
});

/**
 * Default sessions seeded on first use.
 * Previously lived as INITIAL_CONTEXT_NODES hardcoded in the component.
 * Now written to Firestore on startup if pulso_sessions is empty.
 */
const DEFAULT_SESSIONS: Omit<Session, 'createdAt' | 'updatedAt'>[] = [
  // Sistema
  { id: 'sistema_pulso',            areaId: 'area_sistema',  subareaId: 'pulso',               label: 'pulso',               openclawSessionKey: 'agent:main:pulso:sistema_pulso',            isDefault: true, runtimeStatus: 'pending' },
  { id: 'sistema_infraestrutura',   areaId: 'area_sistema',  subareaId: 'infraestrutura',       label: 'infraestrutura',      openclawSessionKey: 'agent:main:pulso:sistema_infraestrutura',   isDefault: true, runtimeStatus: 'pending' },
  { id: 'sistema_openclaw_agentes', areaId: 'area_sistema',  subareaId: 'openclaw_agentes',     label: 'openclaw e agentes',  openclawSessionKey: 'agent:main:pulso:sistema_openclaw_agentes', isDefault: true, runtimeStatus: 'pending' },
  { id: 'sistema_teste_groq',       areaId: 'area_sistema',  subareaId: 'teste_groq',           label: 'teste groq vps',      openclawSessionKey: 'agent:groq_test:pulso:sistema_teste_groq',  isDefault: true, runtimeStatus: 'pending' },
  // Trabalho
  { id: 'trabalho_modu',            areaId: 'area_trabalho', subareaId: 'modu',                 label: 'modú',                openclawSessionKey: 'agent:main:pulso:trabalho_modu',            isDefault: true, runtimeStatus: 'pending' },
  { id: 'trabalho_despertar',       areaId: 'area_trabalho', subareaId: 'despertar',            label: 'despertar',           openclawSessionKey: 'agent:main:pulso:trabalho_despertar',       isDefault: true, runtimeStatus: 'pending' },
  // Casa
  { id: 'casa_construcao',          areaId: 'area_casa',     subareaId: 'construcao',           label: 'construção',          openclawSessionKey: 'agent:main:pulso:casa_construcao',          isDefault: true, runtimeStatus: 'pending' },
  { id: 'casa_horta',               areaId: 'area_casa',     subareaId: 'horta',                label: 'horta',               openclawSessionKey: 'agent:main:pulso:casa_horta',               isDefault: true, runtimeStatus: 'pending' },
  // Família
  { id: 'familia_escola_guayi',     areaId: 'area_familia',  subareaId: 'escola_guayi',         label: 'escola guayi',        openclawSessionKey: 'agent:main:pulso:familia_escola_guayi',     isDefault: true, runtimeStatus: 'pending' },
  // Criação
  { id: 'criacao_producao_autoral', areaId: 'area_criacao',  subareaId: 'producao_autoral',     label: 'produção autoral',    openclawSessionKey: 'agent:main:pulso:criacao_producao_autoral', isDefault: true, runtimeStatus: 'pending' },
  // Livre
  { id: 'livre_geral',              areaId: 'area_livre',    subareaId: 'geral',                label: 'geral',               openclawSessionKey: 'agent:main:pulso:livre_geral',              isDefault: true, runtimeStatus: 'pending' },
  { id: 'global_estrada',           areaId: 'area_livre',    subareaId: 'global_estrada',       label: 'global estrada',      openclawSessionKey: 'agent:main:pulso:global_estrada',           isDefault: true, runtimeStatus: 'pending' },
];

/** Placeholder used before sessions load from Firestore */
const LOADING_PLACEHOLDER_NODE: PulsoContextNode = {
  areaId: 'area_sistema',
  subareaId: 'pulso',
  contextId: 'sistema_pulso',
  chatId: 'default',
  openclawSessionKey: 'agent:main:pulso:sistema_pulso',
  label: 'pulso',
};


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
  area_futuro: "futuro",
  area_livre: "livre"
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
  "area_futuro",
  "area_livre"
];

// Safe array helper
const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Safari can deny localStorage access in private/standalone contexts. Storage
// is a convenience for restoring UI preferences; it must never prevent the
// conversation shell from rendering.
const safeStorageGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`[PULSO_STORAGE_READ_UNAVAILABLE] ${key}`, error);
    return null;
  }
};

const safeStorageSet = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[PULSO_STORAGE_WRITE_UNAVAILABLE] ${key}`, error);
  }
};

const settleWithin = async <T,>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
  fallback: T
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[PULSO_INIT_TIMEOUT] ${label} exceeded ${timeoutMs}ms; continuing with fallback.`);
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    console.error(`[PULSO_INIT_FAILED] ${label}:`, error);
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

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

interface PendingAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'audio' | 'generic';
  mimeType: string;
  localUrl: string;
  sizeBytes: number;
  status: 'uploading' | 'done' | 'error';
  storageUrl?: string;
  progress: number;
  file: File;
}

interface StrongState {
  activeCommitment?: {
    id: string;
    description: string;
    status: 'pending' | 'delayed' | 'completed';
    openedAt: string;
    expectedCompletionAt?: string;
    deliveryArtifactRef?: string;
  } | null;
  lastStrongArtifact?: {
    id: string;
    type: string;
    name: string;
    summary: string;
    url: string;
    timestamp: string;
  } | null;
  workingContext?: string | null;
}

interface LightState {
  presence: 'idle' | 'busy' | 'away';
  lastUpdate?: string | null;
  progressPercent?: number | null;
  lastPulseAt?: string | null;
}

interface PulsoContextState {
  contextId: string;
  updatedAt: any;
  strongState: StrongState;
  lightState: LightState;
}

interface Message {
  id: string;
  sender: 'user' | 'lotus' | 'system';
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
  replyTo?: { id: string; sender: string; text: string } | null;
  isProgressUpdate?: boolean;
  phase?: string | null;
  originRequestId?: string | null;
}

export type VoiceMode = 'off' | 'recording_once' | 'presence' | 'recording_meeting';

export type UnifiedVoiceState =
  | 'idle'
  | 'recording_once'
  | 'transcribing'
  | 'submitting'
  | 'waiting_lotus'
  | 'speaking'
  | 'presence_listening'
  | 'presence_returning_to_listen'
  | 'error'
  | 'starting'
  | 'user_speaking'
  | 'thinking'
  | 'interrupted';


export default function LivePage() {
  const router = useRouter();
  const [state, setState] = React.useState<any>(null);
  // The shell is intentionally visible from the first render. Data hydration
  // may continue in the background, but it cannot hold the UI on a spinner.
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inputMessage, setInputMessage] = React.useState('');
  const [inputHeight, setInputHeight] = React.useState(36);
  const [windowWidth, setWindowWidth] = React.useState<number>(1024);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const chatHeight = React.useMemo(() => {
    if (windowWidth < 768) return `calc(100dvh - ${180 + inputHeight}px)`;
    const baseHeight = windowWidth >= 1536 ? '45vh' : '60vh';
    return `calc(${baseHeight} - ${inputHeight - 36}px)`;
  }, [windowWidth, inputHeight]);

  const chatMarginBottom = React.useMemo(() => {
    return `${inputHeight - 36 + 16}px`;
  }, [inputHeight]);

  const pulsoJarvisLayerEnabled = true;

  React.useEffect(() => {
    if (pulsoJarvisLayerEnabled) {
      actionLedgerClient.startListening();
      return () => actionLedgerClient.stopListening();
    }
  }, []);

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
  /** Reply-to (quoted message) state */
  const [replyTo, setReplyTo] = React.useState<{ id: string; sender: string; text: string } | null>(null);
  /** Pending attachments staged for send (not yet sent) */
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);
  /** v2: sessions loaded from Firestore pulso_sessions (replaces customContextNodes + INITIAL_CONTEXT_NODES) */
  const [sessions, setSessions] = React.useState<PulsoContextNode[]>([LOADING_PLACEHOLDER_NODE]);
  const [sessionsLoaded, setSessionsLoaded] = React.useState(false);
  const [isAtelieActive, setIsAtelieActive] = React.useState(false);
  const [isEstudioActive, setIsEstudioActive] = React.useState(false);
  const [isMesaOpen, setIsMesaOpen] = React.useState(false);
  const [activeMesaArtifact, setActiveMesaArtifact] = React.useState<{id: string, title: string, content: string, contextId?: string} | null>(null);
  const [isMesaCollapsed, setIsMesaCollapsed] = React.useState(false);
  const [contextStatesMap, setContextStatesMap] = React.useState<Record<string, PulsoContextState>>({});

  React.useEffect(() => {
    if (activeMesaArtifact) {
      setIsMesaCollapsed(false);
    }
  }, [activeMesaArtifact]);

  const [isArcaOpen, setIsArcaOpen] = React.useState(false);
  const [isEngineeringActive, setIsEngineeringActive] = React.useState(false);
  const [engineeringLogs, setEngineeringLogs] = React.useState<string[]>([]);
  const [engineeringInput, setEngineeringInput] = React.useState('');
  const [showAtelieChatHistory, setShowAtelieChatHistory] = React.useState(false);
  
  const sessionsRef = React.useRef(sessions);
  React.useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  /**
   * v2: Load sessions from Firestore pulso_sessions.
   * On first run (empty collection), seeds the DEFAULT_SESSIONS list.
   * Falls back to DEFAULT_SESSIONS locally if not in Firestore mode.
   */
  React.useEffect(() => {
    let unlisten: any;
    const setupListener = async () => {
      // The engineering event bridge exists only inside the Tauri desktop shell.
      // Calling it on the web throws through window.__TAURI_INTERNALS__.
      if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;
      try {
        unlisten = await listen('cmd_output', (event) => {
          setEngineeringLogs((prev) => [...prev, event.payload as string]);
        });
      } catch (error) {
        console.warn('[PULSO_TAURI_LISTENER_UNAVAILABLE]', error);
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  React.useEffect(() => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';

    if (!isFirestore) {
      // Non-Firestore mode: use DEFAULT_SESSIONS directly
      setSessions(DEFAULT_SESSIONS.map(s => sessionToContextNode({ ...s, createdAt: new Date(), updatedAt: new Date() })));
      setSessionsLoaded(true);
      return;
    }

    if (loading || !db) return;

    let unsubscribe: (() => void) | null = null;

    const seedAndSubscribe = async () => {
      try {
        // Check if pulso_sessions already has documents
        const snap = await settleWithin(
          getDocs(collection(db!, firestorePaths.sessions())),
          6000,
          'sessions_seed_check',
          null
        );
        if (!snap) {
          setSessions(DEFAULT_SESSIONS.map(s => sessionToContextNode({ ...s, createdAt: new Date(), updatedAt: new Date() })));
          setSessionsLoaded(true);
        } else if (snap.empty) {
          console.log('[PULSO_SESSIONS] Seeding default sessions...');
          // Seed all default sessions in parallel
          await Promise.all(
            DEFAULT_SESSIONS.map(s =>
              sessionsService.createSession(s).catch(err =>
                console.error('[PULSO_SESSIONS] Seed failed for', s.id, err)
              )
            )
          );
          console.log('[PULSO_SESSIONS] Default sessions seeded.');
        }
      } catch (err) {
        console.error('[PULSO_SESSIONS] Seed check failed:', err);
      }

      // Real-time subscription to pulso_sessions
      try {
        unsubscribe = onSnapshot(
          collection(db!, firestorePaths.sessions()),
          (snapshot) => {
            const loaded: PulsoContextNode[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Session;
              if (!data.archived) {
                loaded.push(sessionToContextNode({ ...data, id: docSnap.id }));
              }
            });
            // Sort: default sessions first (by their DEFAULT_SESSIONS order), then custom ones by createdAt
            const defaultOrder = DEFAULT_SESSIONS.map(s => s.id);
            loaded.sort((a, b) => {
              const ai = defaultOrder.indexOf(a.contextId);
              const bi = defaultOrder.indexOf(b.contextId);
              if (ai !== -1 && bi !== -1) return ai - bi;
              if (ai !== -1) return -1;
              if (bi !== -1) return 1;
              return 0;
            });
            setSessions(loaded.length > 0 ? loaded : [LOADING_PLACEHOLDER_NODE]);
            setSessionsLoaded(true);
          },
          (err) => {
            console.error('[PULSO_SESSIONS] onSnapshot error:', err);
            // Fallback to defaults
            setSessions(DEFAULT_SESSIONS.map(s => sessionToContextNode({ ...s, createdAt: new Date(), updatedAt: new Date() })));
            setSessionsLoaded(true);
          }
        );
      } catch (e) {
        console.error('[PULSO_SESSIONS] Failed to subscribe:', e);
        setSessions(DEFAULT_SESSIONS.map(s => sessionToContextNode({ ...s, createdAt: new Date(), updatedAt: new Date() })));
        setSessionsLoaded(true);
      }
    };

    seedAndSubscribe();

    return () => { if (unsubscribe) unsubscribe(); };
  }, [db, loading]);


  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateThemeColor = () => {
      const currentTheme = safeStorageGet('pulso-theme') || 'orange';
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute('content', currentTheme === 'black' ? '#0f0f0f' : '#b8283e');
    };
    window.addEventListener('pulso-theme-change', updateThemeColor);
    return () => window.removeEventListener('pulso-theme-change', updateThemeColor);
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);
  /**
   * v2: All visible sessions — directly from Firestore pulso_sessions (no merging needed).
   * Previously: [...INITIAL_CONTEXT_NODES, ...customContextNodes]
   */
  const allContextNodes = sessions;


  const pageLoadTimeRef = React.useRef(new Date());
  const [lastReadTimes, setLastReadTimes] = React.useState<Record<string, string>>({});
  const [latestIncomingTimes, setLatestIncomingTimes] = React.useState<Record<string, string>>({});
  
  const markContextAsRead = React.useCallback((contextId: string) => {
    const nowStr = new Date().toISOString();
    setLastReadTimes(prev => {
      if (prev[contextId] === nowStr) return prev;
      return { ...prev, [contextId]: nowStr };
    });
    safeStorageSet(`pulso_last_read_${contextId}`, nowStr);
    
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (isFirestore && db) {
      setDoc(doc(db, `workspaces/felipe_dutra/pulso_meta/read_status`), {
        [contextId]: nowStr
      }, { merge: true }).catch(err => console.error("Failed to save read status to Firestore:", err));
    }
  }, []);

  // Keep server and first client render identical. The saved session is
  // restored after Firestore sessions arrive, avoiding hydration mismatch.
  const [activeContextNode, setActiveContextNode] = React.useState<PulsoContextNode>(LOADING_PLACEHOLDER_NODE);
  const activeContextNodeRef = React.useRef(activeContextNode);

  const unreadContexts = React.useMemo(() => {
    const unreads: Record<string, boolean> = {};
    allContextNodes.forEach(node => {
      if (node.contextId) {
        const lastRead = lastReadTimes[node.contextId] || pageLoadTimeRef.current.toISOString();
        // Only real Lótus responses create unread state. Session updatedAt also
        // changes when the user sends, renames or otherwise touches a chat.
        const lastMsgAt = latestIncomingTimes[node.contextId];
        if (lastMsgAt) {
          const lastMsgDate = safeConvertToDate(lastMsgAt);
          const lastMsgTime = lastMsgDate ? lastMsgDate.getTime() : 0;
          const lastReadDate = safeConvertToDate(lastRead);
          const lastReadTime = lastReadDate ? lastReadDate.getTime() : 0;
          if (node.contextId !== activeContextNode.contextId && lastMsgTime > lastReadTime) {
            unreads[node.contextId] = true;
          }
        }
      }
    });
    return unreads;
  }, [allContextNodes, lastReadTimes, latestIncomingTimes, activeContextNode.contextId]);

  // ── Session Restore (runs once when sessions finish loading) ──────────────
  // IMPORTANT: This ref tracks whether we already restored once, so the persist
  // effect below does NOT overwrite the saved key before the restore can run.
  const sessionRestoredRef = React.useRef(false);

  React.useEffect(() => {
    if (!sessionsLoaded || sessions.length === 0) return;
    if (sessionRestoredRef.current) return; // only run once
    sessionRestoredRef.current = true;

    const savedId = safeStorageGet('pulso_active_session_id');
    if (savedId) {
      const found = sessions.find(s => s.contextId === savedId);
      if (found) {
        setActiveContextNode(found);
        return;
      }
    }
    // Fallback: most recently active session
    const sortedByLatest = [...sessions].sort((a, b) => {
      const dateA = safeConvertToDate(a.lastMessageAt) || safeConvertToDate(a.updatedAt);
      const dateB = safeConvertToDate(b.lastMessageAt) || safeConvertToDate(b.updatedAt);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA;
    });
    setActiveContextNode(sortedByLatest[0] || sessions[0]);
  }, [sessionsLoaded, sessions]);

  // Persist active session to localStorage whenever it changes.
  // Skip the placeholder node so we never overwrite a valid saved key with the loading state.
  React.useEffect(() => {
    activeContextNodeRef.current = activeContextNode;
    markContextAsRead(activeContextNode.contextId);
    if (
      typeof window !== 'undefined' &&
      activeContextNode.contextId &&
      activeContextNode.contextId !== 'loading' &&
      activeContextNode.contextId !== LOADING_PLACEHOLDER_NODE.contextId
    ) {
      safeStorageSet('pulso_active_session_id', activeContextNode.contextId);
    }
  }, [activeContextNode, markContextAsRead]);
  // Load and listen to read status from localStorage/Firestore
  React.useEffect(() => {
    // 1. Load from localStorage
    const localTimes: Record<string, string> = {};
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('pulso_last_read_')) {
          const contextId = key.replace('pulso_last_read_', '');
          localTimes[contextId] = safeStorageGet(key) || '';
        }
      }
    } catch (error) {
      console.warn('[PULSO_STORAGE_ENUMERATION_UNAVAILABLE]', error);
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
                  safeStorageSet(`pulso_last_read_${contextId}`, timeStr);
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

  const [expandedProgressGroups, setExpandedProgressGroups] = React.useState<Record<string, boolean>>({});

  const setContextTyping = (contextId: string, typing: boolean) => {
    setContextTypingStates(prev => ({ ...prev, [contextId]: typing }));
  };

  const [editingContextId, setEditingContextId] = React.useState<string | null>(null);
  const [editingContextLabel, setEditingContextLabel] = React.useState('');
  const [addingChatAreaId, setAddingChatAreaId] = React.useState<string | null>(null);
  const [newChatName, setNewChatName] = React.useState('');
  const [hoveredAreaId, setHoveredAreaId] = React.useState<string | null>(null);

  const [isAddingArea, setIsAddingArea] = React.useState(false);
  const [newAreaName, setNewAreaName] = React.useState('');

  const dynamicAreas = React.useMemo(() => {
    const list: Array<{ id: string; name: string; order: number }> = [];

    // Add all static base areas in order
    AREA_ORDER.forEach((id, idx) => {
      list.push({ id, name: AREA_NAMES[id] || id.replace('area_', ''), order: idx });
    });

    // Add any area from the DB that is not already in the list
    const dbAreas = safeArray(state?.allAreas).filter((a: any) => a && a.archived !== true && a.status === 'active');
    dbAreas.forEach((dbArea) => {
      const existingIdx = list.findIndex(item => item.id === dbArea.id);
      if (existingIdx === -1) {
        list.push({
          id: dbArea.id,
          name: dbArea.name || dbArea.id.replace('area_', ''),
          order: dbArea.order ?? list.length
        });
      } else {
        if (dbArea.order !== undefined) {
          list[existingIdx].order = dbArea.order;
        }
        if (dbArea.name) {
          list[existingIdx].name = dbArea.name;
        }
      }
    });

    // Sort by order
    list.sort((a, b) => a.order - b.order);
    return list;
  }, [state?.allAreas]);
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

  const getAreaIcon = (area: any): React.ReactNode => {
    if (!area) return '○';
    const identifier = (area.slug || area.id || area.name || '').toLowerCase();
    
    if (identifier.includes('despertar')) {
      return (
        <svg viewBox="0 0 24 24" className="w-[1.1em] h-[1.1em] inline-block fill-current align-middle" style={{ display: 'inline-block' }}>
          {/* Top Left */}
          <path d="M11.5 11.5 C11.5 8, 9.5 6, 6 6 C 6 9.5, 8 11.5, 11.5 11.5 Z" />
          {/* Top Right */}
          <path d="M12.5 11.5 C12.5 8, 14.5 6, 18 6 C 18 9.5, 16 11.5, 12.5 11.5 Z" />
          {/* Bottom Left */}
          <path d="M11.5 12.5 C11.5 16, 9.5 18, 6 18 C 6 14.5, 8 12.5, 11.5 12.5 Z" />
          {/* Bottom Right */}
          <path d="M12.5 12.5 C12.5 16, 14.5 18, 18 18 C 18 14.5, 16 12.5, 12.5 12.5 Z" />
        </svg>
      );
    }
    if (identifier.includes('modu')) {
      return (
        <svg viewBox="0 0 24 24" className="w-[1.1em] h-[1.1em] inline-block fill-current align-middle" style={{ display: 'inline-block' }}>
          {/* Top horizontal block */}
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          {/* Bottom three blocks */}
          <rect x="3" y="12" width="4.5" height="8" rx="1" />
          <rect x="9.75" y="12" width="4.5" height="8" rx="1" />
          <rect x="16.5" y="12" width="4.5" height="8" rx="1" />
        </svg>
      );
    }
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
    if (identifier.includes('livre')) return '✧';
    
    return '⚬';
  };
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = React.useState(false);
  const [areaConfigPanelAreaId, setAreaConfigPanelAreaId] = React.useState<string | null>(null);
  const attachmentMenuRef = React.useRef<HTMLDivElement>(null);

  // Attachment and header menus render into a portal (their own full-screen
  // backdrop handles click-outside-to-close), so they're intentionally not
  // covered by this ref-based outside-click check.
  
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
      return safeStorageGet('pulso_tts_kokoro_endpoint') || 'http://127.0.0.1:8880/v1/audio/speech';
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

  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>('off');

  const wakeLockRef = React.useRef<any>(null);

  React.useEffect(() => {
    async function requestLock() {
      if (typeof window !== 'undefined' && 'wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[WakeLock] Screen Wake Lock acquired.');
        } catch (err) {
          console.warn('[WakeLock] Failed to acquire wake lock:', err);
        }
      }
    }

    function releaseLock() {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
          console.log('[WakeLock] Screen Wake Lock released.');
        }).catch((err: any) => {
          console.error('[WakeLock] Failed to release wake lock:', err);
        });
      }
    }

    if (voiceMode === 'recording_meeting') {
      requestLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [voiceMode]);
  
  // Meeting Recorder Hook
  const activeMeetingIdRef = React.useRef<string | null>(null);
  const activeMeetingContextRef = React.useRef<PulsoContextNode | null>(null);
  const { startRecording: startMeetingRec, stopRecording: stopMeetingRec } = useMeetingRecorder(
    activeMeetingContextRef.current?.contextId || activeContextNode?.contextId || 'general'
  );

  const [voiceState, setVoiceState] = React.useState<UnifiedVoiceState>('idle');
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = React.useState(0);

  const voiceModeRef = React.useRef<VoiceMode>('off');
  const voiceStateRef = React.useRef<UnifiedVoiceState>('idle');
  const maxRecordingTimeoutRef = React.useRef<any>(null);
  const spokenRequestsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (voiceMode !== 'recording_once') {
      setRecordingElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setRecordingElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setRecordingElapsedSeconds(Math.min(420, Math.floor((Date.now() - startedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(timer);
  }, [voiceMode]);
  
  // Latency and session session state tracking
  const presenceSessionStartTimeRef = React.useRef<number>(0);
  const latencyStopRecRef = React.useRef<number | null>(null);
  const latencyTranscriptionRef = React.useRef<number | null>(null);
  const latencyRequestCreatedRef = React.useRef<number | null>(null);
  const latencyResponseReceivedRef = React.useRef<number | null>(null);
  const latencyAutoTtsStartRef = React.useRef<number | null>(null);
  const latencyMapRef = React.useRef<Record<string, {
    t1_client_submit?: number;
    t2_firestore_queued?: number;
    t3_processing_by_openclaw?: number;
    t4_openclaw_finished?: number;
    t5_firestore_completed?: number;
    t6_client_rendered?: number;
    reported?: boolean;
  }>>({});

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
  
  const globalIncomingSeenRef = React.useRef<Set<string>>(new Set());
  const globalIncomingReadyRef = React.useRef(false);

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
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const silenceTimeoutRef = React.useRef<any>(null);
  const finalTranscriptRef = React.useRef<string>('');
  const hasRetriedSpeechRecognitionRef = React.useRef<boolean>(false);
  const isSpeechRecognitionRetryingRef = React.useRef<boolean>(false);

  // Gemini Audio Recording Refs
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = React.useRef<MediaStream | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const silenceStartRef = React.useRef<number>(0);
  const animationFrameRef = React.useRef<number>(0);
  const startSpeechRecognitionRef = React.useRef<any>(null);
  const baseTextBeforeRecordingRef = React.useRef<string>('');
  const sendAfterTranscribeRef = React.useRef<boolean>(false);
  const voiceSessionControllerRef = React.useRef<VoiceSessionController | null>(null);

  React.useEffect(() => {
    voiceModeRef.current = voiceMode;
    console.log('[PULSO_VOICE_MODE_CHANGED]', { mode: voiceMode });
  }, [voiceMode]);

  React.useEffect(() => {
    voiceStateRef.current = voiceState;
    console.log('[PULSO_VOICE_STATE_CHANGED]', { state: voiceState });
  }, [voiceState]);

  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const scrollToBottom = React.useCallback((smooth = true) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
      chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
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
  // Unified robust scroll-to-bottom controller.
  // Fires when the active session changes (switching chats) or new messages arrive.
  // Uses requestAnimationFrame so we scroll AFTER the browser has painted the new content.
  React.useEffect(() => {
    if (currentMessages.length === 0) return;

    // Immediate jump (no animation) to ensure the correct position before paint
    scrollToBottom(false);

    // Then cascade with smooth passes to catch async content (images, lazy markdown, typing bubble)
    let raf: number;
    const scheduleRaf = () => {
      raf = requestAnimationFrame(() => scrollToBottom(false));
    };
    scheduleRaf();

    const t1 = setTimeout(() => scrollToBottom(true), 80);
    const t2 = setTimeout(() => scrollToBottom(true), 300);
    const t3 = setTimeout(() => scrollToBottom(true), 700);
    const t4 = setTimeout(() => scrollToBottom(true), 1500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [currentMessages.length, isTyping, activeContextNode.contextId, scrollToBottom]);

  React.useEffect(() => {
    scrollToBottom(false);
  }, [inputHeight, scrollToBottom]);
  // Load database state once
  React.useEffect(() => {
    let cancelled = false;
    const revealFallback = window.setTimeout(() => {
      if (!cancelled) {
        console.warn('[PULSO_INIT_REVEAL_FALLBACK] Revealing conversation shell before data hydration finished.');
        setLoading(false);
      }
    }, 3500);

    async function load() {
      try {
        await settleWithin(
          authService.ensurePulsoAuthReady(),
          3500,
          'auth_ready',
          undefined
        );

        if (cancelled) return;
        clearTimeout(revealFallback);
        setLoading(false);
        
        // First paint only waits for the conversation and its minimum navigation context.
        // Operational datasets are hydrated in the background below.
        const [dashboardState, allAreas, allRequests] = await Promise.all([
          settleWithin(pulsoService.getDashboardState(), 8000, 'dashboard_state', {} as any),
          settleWithin(areasService.getAll(), 8000, 'areas', [] as any[]),
          settleWithin(requestsService.getRequests(200, true), 8000, 'requests', [] as any[])
        ]);

        if (cancelled) return;
        
        setState({
          ...dashboardState,
          allRoutines: [],
          allAgents: [],
          allLogs: [],
          allAreas: safeArray(allAreas),
          allRequests: safeArray(allRequests),
          allSources: [],
          allTasks: []
        });

        const chatHistory: Message[] = [];
        const commandRequests = safeArray(allRequests)
          .filter((req: any) => req && (req.requestType === 'conversation_command' || req.requestType === 'active_message' || req.requestType === 'local_interaction' || req.requestType === 'progress_update') && req.archived !== true && req.contextId === activeContextNode.contextId)
          .sort((a, b) => {
            const timeA = safeGetTime(a.requestedAt) || a.clientCreatedAtMs || safeGetTime(a.createdAt) || safeGetTime(a.updatedAt) || 0;
            const timeB = safeGetTime(b.requestedAt) || b.clientCreatedAtMs || safeGetTime(b.createdAt) || safeGetTime(b.updatedAt) || 0;
            return timeA - timeB;
          });

        commandRequests.forEach((req: any) => {
          const reqTime = safeConvertToDate(req.requestedAt) || new Date();
          
          if (req.requestType !== "active_message" && req.requestType !== "progress_update") {
            chatHistory.push({
              id: `user-${req.id || Math.random()}`,
              sender: 'user',
              text: req.input || req.rawInput || req.summary || req.title || '',
              timestamp: reqTime,
              contextId: req.contextId || null
            });
          }

          if (req.requestType === "progress_update") {
            chatHistory.push({
              id: `lotus-progress-${req.id || Math.random()}`,
              sender: 'lotus',
              text: req.text || req.message || '',
              timestamp: reqTime,
              contextId: req.contextId || null,
              isProgressUpdate: true,
              phase: req.meta?.phase || null,
              originRequestId: req.meta?.originRequestId || null
            });
          }
          
          const isConvCommand = req.requestType === 'conversation_command' || req.requestType === 'local_interaction' || req.requestType === 'active_message';
          
          if (isConvCommand) {
            const status = req.status;
            const responseText = req.openclawResult?.responseText ?? null;
            const hasRealResponse = responseText && responseText.trim() !== '';
            
            const isAcceptedStatus = ['success', 'proposal_ready', 'needs_approval', 'needs_clarification'].includes(status || '');
            if (isAcceptedStatus && hasRealResponse) {
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
              const errorText = req.openclawResult?.responseText || req.openclawResult?.error || 'Falha operacional (Nuvem indisponível / Sem quota).';
              chatHistory.push({
                id: `lotus-${req.id || Math.random()}`,
                sender: 'lotus',
                text: `[Lótus] ${errorText}`,
                timestamp: safeConvertToDate(req.updatedAt) || reqTime,
                interpretation: req.interpretation,
                openclawResult: req.openclawResult || undefined,
                handoffStatus: req.status,
                requestId: req.id || undefined,
                originalCommand: req.summary || req.title || undefined,
                contextId: req.contextId || null
              });
            }
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
        void Promise.all([
          routinesService.getAll().catch(e => { console.error(e); return []; }),
          agentsService.getAll().catch(e => { console.error(e); return []; }),
          healthService.getLogs(15).catch(e => { console.error(e); return []; }),
          sourcesService.getAll().catch(e => { console.error(e); return []; }),
          tasksService.getAll().catch(e => { console.error(e); return []; })
        ]).then(([allRoutines, allAgents, allLogs, allSources, allTasks]) => {
          setState((previous: any) => ({
            ...previous,
            allRoutines: safeArray(allRoutines),
            allAgents: safeArray(allAgents),
            allLogs: safeArray(allLogs),
            allSources: safeArray(allSources),
            allTasks: safeArray(allTasks)
          }));
        });
      } catch (err: any) {
        console.error('Lótus Live load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(revealFallback);
    };
  }, []);

  // Real-time Firestore requests listener (Golden Path to OpenClaw usage)
  React.useEffect(() => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (!isFirestore) return;
    if (!db) return;
    if (!activeContextNode.contextId || activeContextNode.contextId === 'loading' || activeContextNode.contextId === LOADING_PLACEHOLDER_NODE.contextId) {
      console.log('[PULSO_ONSNAPSHOT] Ignorando snapshot: contexto em loading.');
      return;
    }

    let unsubscribe: any = null;
    try {
      console.log('[PULSO_ONSNAPSHOT] Iniciando escuta real-time do Firestore para contexto:', activeContextNode.contextId);
      const q = query(
        collection(db, firestorePaths.requests()),
        where("requestType", "in", ["conversation_command", "active_message", "local_interaction", "progress_update"]),
        where("contextId", "==", activeContextNode.contextId)
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
          const reqTime = safeConvertToDate(req.requestedAt) || safeConvertToDate(req.createdAt) || safeConvertToDate(req.updatedAt) || new Date(0);          

          // Trace telemetry checkpoints t3, t4, and t5
          const entry = latencyMapRef.current[req.id];
          if (entry) {
            if (req.status === 'processing_by_openclaw' && !entry.t3_processing_by_openclaw) {
              const startVal = req.startedAt || req.updatedAt;
              if (startVal) {
                const date = safeConvertToDate(startVal);
                if (date) entry.t3_processing_by_openclaw = date.getTime();
              }
            }
            if (['success', 'completed', 'proposal_ready', 'failed', 'error', 'timeout'].includes(req.status)) {
              if (!entry.t3_processing_by_openclaw) {
                const startVal = req.startedAt || req.updatedAt || req.requestedAt;
                if (startVal) {
                  const date = safeConvertToDate(startVal);
                  if (date) entry.t3_processing_by_openclaw = date.getTime();
                }
              }
              if (!entry.t4_openclaw_finished) {
                const procAtVal = req.openclawProcessedAt || req.openclawResult?.processedAt;
                if (procAtVal) {
                  const date = safeConvertToDate(procAtVal);
                  if (date) entry.t4_openclaw_finished = date.getTime();
                } else {
                  const fallbackVal = req.updatedAt || req.startedAt;
                  if (fallbackVal) {
                    const date = safeConvertToDate(fallbackVal);
                    if (date) entry.t4_openclaw_finished = date.getTime();
                  }
                }
              }
              if (!entry.t5_firestore_completed) {
                const updatedVal = req.updatedAt;
                if (updatedVal) {
                  const date = safeConvertToDate(updatedVal);
                  if (date) entry.t5_firestore_completed = date.getTime();
                }
              }
            }
          }

          if (req.requestType !== "active_message" && req.requestType !== "progress_update") {
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

          if (req.requestType === "progress_update") {
            chatHistory.push({
              id: `lotus-progress-${req.id}`,
              sender: 'lotus',
              text: req.text || req.message || '',
              timestamp: reqTime,
              contextId: req.contextId || null,
              isProgressUpdate: true,
              phase: req.meta?.phase || null,
              originRequestId: req.meta?.originRequestId || null
            });
          }

          const isConvCommand = req.requestType === 'conversation_command' || req.requestType === 'local_interaction' || req.requestType === 'active_message';

          if (isConvCommand) {
            const status = req.status;
            const responseText = req.openclawResult?.responseText ?? null;
            const hasRealResponse = responseText && responseText.trim() !== '';

            // Check if auto TTS needs to be triggered in presence mode
            const requestOriginMode = req.mode || req.originMode || (voiceReplyRequestsRef.current.has(req.id) ? 'presence' : 'text');
            const reqTimeMs = req.clientCreatedAtMs || (req.requestedAt ? new Date(req.requestedAt).getTime() : 0);
            
            const isErrorState = (status === 'error' || status === 'timeout');
            const ttsText = isErrorState ? 'Falha operacional. Nuvem indisponível ou sem cota.' : responseText;
            const hasSpeakableResponse = (status === 'success' && hasRealResponse) || isErrorState;

            if (hasSpeakableResponse && requestOriginMode === 'presence') {
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
              } else if (voiceStateRef.current === 'speaking') {
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
                
                voiceStateRef.current = 'speaking';
                setVoiceState('speaking');
                setPlayingMsgId(msgId);
                setPlayingState('preparing');
                
                playPresenceSoundCue('speak_start');
                
                // Latency point 5: TTS Started
                latencyAutoTtsStartRef.current = Date.now();
                const diffRespToTts = latencyAutoTtsStartRef.current - (latencyResponseReceivedRef.current || latencyAutoTtsStartRef.current);
                console.log(`[PULSO_LATENCY_RESPONSE_RECEIVED_TO_AUTO_TTS_START_MS] ${diffRespToTts} ms`);
                
                const presenceController = voiceSessionControllerRef.current;
                if (!presenceController) {
                  console.warn('[PULSO_PRESENCE_TTS_SKIPPED_NO_CONTROLLER]', { requestId: req.id });
                } else {
                  presenceController.speakAssistant(
                  ttsText,
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
                        return null;
                      }
                      return prev;
                    });
                  }
                  );
                }
              }
            }

            const isAcceptedStatus = ['success', 'proposal_ready', 'needs_approval', 'needs_clarification'].includes(status || '');
            if (isAcceptedStatus && hasRealResponse) {
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
              const errorText = req.openclawResult?.responseText || req.openclawResult?.error || 'Falha operacional (Nuvem indisponível / Sem quota).';
              chatHistory.push({
                id: `lotus-${req.id}`,
                sender: 'lotus',
                text: `[Lótus] ${errorText}`,
                timestamp: safeConvertToDate(req.updatedAt) || reqTime,
                interpretation: req.interpretation,
                openclawResult: req.openclawResult || undefined,
                handoffStatus: req.status,
                requestId: req.id || undefined,
                originalCommand: req.summary || req.title || undefined,
                contextId: req.contextId || null
              });
            }
          }
        });
        setState((prev: any) => {
          if (!prev) return prev;
          return { ...prev, allRequests: sortedRequests };
        });

        console.log('[PULSO_ONSNAPSHOT] Mensagens carregadas do Firestore:', {
          activeSessionId: safeStorageGet('pulso_active_session_id'),
          contextId: activeContextNode.contextId,
          snapshotMessagesCount: chatHistory.length,
          sourceOfMessages: 'firestore_snapshot',
          reasonForSetMessages: 'realtime_update'
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

        // Schedule t6 calculation (visible in UI) for any pending requests in latencyMapRef
        requestAnimationFrame(() => {
          const now = Date.now();
          Object.keys(latencyMapRef.current).forEach((reqId) => {
            const entry = latencyMapRef.current[reqId];
            if (entry.t1_client_submit && !entry.reported) {
              const responseMsgExists = chatHistory.some(m => m.requestId === reqId && m.sender === 'lotus');
              if (responseMsgExists) {
                entry.t6_client_rendered = now;
                entry.reported = true;

                const t1 = entry.t1_client_submit;
                const t2 = entry.t2_firestore_queued || t1;
                const t3 = entry.t3_processing_by_openclaw || t2;
                const t4 = entry.t4_openclaw_finished || t3;
                const t5 = entry.t5_firestore_completed || t4;
                const t6 = entry.t6_client_rendered;

                const total = t6 - t1;
                const clientToFirestore = t2 - t1;
                const firestoreToClaim = t3 - t2;
                const openclawProcess = t4 - t3;
                const openclawWrite = t5 - t4;
                const syncToRender = t6 - t5;

                console.log(
                  `%c[PULSO_LATENCY_REPORT] ID: ${reqId}\n` +
                  `---------------------------------------------\n` +
                  `⏱️ Tempo Total Ponta a Ponta: ${(total / 1000).toFixed(2)}s (${total} ms)\n` +
                  `  1. Submit -> Firestore Queued (t1 -> t2): ${(clientToFirestore / 1000).toFixed(2)}s (${clientToFirestore} ms)\n` +
                  `  2. Queued -> Worker Claimed (t2 -> t3):   ${(firestoreToClaim / 1000).toFixed(2)}s (${firestoreToClaim} ms)\n` +
                  `  3. Worker LLM Processing (t3 -> t4):     ${(openclawProcess / 1000).toFixed(2)}s (${openclawProcess} ms)\n` +
                  `  4. Worker Write Back Time (t4 -> t5):    ${(openclawWrite / 1000).toFixed(2)}s (${openclawWrite} ms)\n` +
                  `  5. Firestore Sync -> Render (t5 -> t6):   ${(syncToRender / 1000).toFixed(2)}s (${syncToRender} ms)\n` +
                  `---------------------------------------------`,
                  'color: #00ffcc; font-weight: bold;'
                );
              }
            }
          });
        });
      }, (error: any) => {
        console.error("Firestore requests onSnapshot error:", error);
      });
    } catch (err) {
      console.error("Firestore onSnapshot subscription failed:", err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [db, loading, activeContextNode]);

  // ── Sincronização em Tempo Real Global de Estados Conversacionais e Compromissos ──
  React.useEffect(() => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (!isFirestore || !db) return;

    let unsubContextStates: (() => void) | null = null;
    try {
      console.log('[PULSO_CONTEXT_STATE] Iniciando escuta global da coleção pulso_context_states');
      const colRef = collection(db, `workspaces/felipe_dutra/pulso_context_states`);

      unsubContextStates = onSnapshot(colRef, (snapshot: any) => {
        setContextStatesMap(prev => {
          const nextMap = { ...prev };
          snapshot.docChanges().forEach((change: any) => {
            const docId = change.doc.id;
            if (change.type === 'removed') {
              delete nextMap[docId];
            } else {
              nextMap[docId] = change.doc.data() as PulsoContextState;
            }
          });
          return nextMap;
        });
      }, (error: any) => {
        console.error("Error onSnapshot global context states:", error);
      });
    } catch (err) {
      console.error("Subscription failed for global context states:", err);
    }

    return () => {
      if (unsubContextStates) unsubContextStates();
    };
  }, [db]);

  // ── Global incoming-message listener ─────────────────────────────────────
  // Watches real Lótus outputs in every chat. User sends and generic session
  // activity never create unread state or desktop notifications.
  React.useEffect(() => {
    const isFirestore = pulsoService.getDataMode() === 'firestore';
    if (!isFirestore || !db) return;

    let unsubscribe: (() => void) | null = null;

    try {
      const incomingQuery = query(
        collection(db, firestorePaths.requests()),
        where("requestType", "in", ["conversation_command", "active_message", "local_interaction"])
      );

      unsubscribe = onSnapshot(
        incomingQuery,
        (snapshot) => {
          const latestByContext: Record<string, string> = {};

          snapshot.forEach((docSnap: any) => {
            const req = docSnap.data();
            const contextId = req.contextId;
            const responseText = req.openclawResult?.responseText;
            const isAccepted = ['success', 'proposal_ready', 'needs_approval', 'needs_clarification'].includes(req.status || '');
            if (!contextId || req.archived === true || !isAccepted || !responseText?.trim()) return;

            const incomingDate = safeConvertToDate(req.updatedAt)
              || safeConvertToDate(req.openclawProcessedAt)
              || safeConvertToDate(req.requestedAt);
            if (!incomingDate) return;

            const incomingIso = incomingDate.toISOString();
            if (!latestByContext[contextId] || incomingIso > latestByContext[contextId]) {
              latestByContext[contextId] = incomingIso;
            }
          });

          setLatestIncomingTimes(latestByContext);

          // The first snapshot establishes history and must never notify.
          if (!globalIncomingReadyRef.current) {
            snapshot.forEach((docSnap: any) => {
              const req = docSnap.data();
              const responseText = req.openclawResult?.responseText;
              if (responseText?.trim()) globalIncomingSeenRef.current.add(docSnap.id);
            });
            globalIncomingReadyRef.current = true;
            return;
          }

          snapshot.docChanges().forEach((change: any) => {
            if (change.type === 'removed') return;
            const req = change.doc.data();
            const requestId = change.doc.id;
            const contextId = req.contextId;
            const responseText = req.openclawResult?.responseText;
            const isAccepted = ['success', 'proposal_ready', 'needs_approval', 'needs_clarification'].includes(req.status || '');
            if (!contextId || req.archived === true || !isAccepted || !responseText?.trim()) return;
            if (globalIncomingSeenRef.current.has(requestId)) return;

            const incomingDate = safeConvertToDate(req.updatedAt)
              || safeConvertToDate(req.openclawProcessedAt)
              || safeConvertToDate(req.requestedAt);
            if (!incomingDate || incomingDate.getTime() <= pageLoadTimeRef.current.getTime()) return;

            globalIncomingSeenRef.current.add(requestId);
            const isActive = contextId === activeContextNodeRef.current.contextId;
            if (isActive) markContextAsRead(contextId);

            playNotificationSound(isActive);

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const session = sessionsRef.current.find(s => s.contextId === contextId);
              const chatLabel = session?.label || contextId;
              const areaLabel = session?.areaId
                ? (AREA_NAMES[session.areaId] || session.areaId.replace('area_', ''))
                : 'livre';
              try {
                new window.Notification(`Lótus — [${areaLabel}] ${chatLabel}`, {
                  body: responseText,
                  tag: `incoming_${requestId}`,
                });
              } catch (err) {
                console.warn('[PULSO_GLOBAL_INCOMING] Desktop notification failed:', err);
              }
            }

            const isRemoteMessage = !latencyMapRef.current[requestId];
            if (isRemoteMessage && isActive) {
              console.log('[PULSO_PRESENCE_PROACTIVE_TTS]', { requestId, text: responseText });
              playPresenceSoundCue('speak_start');
              voiceStateRef.current = 'speaking';
              setVoiceState('speaking');
              ttsAdapter.speak(responseText, () => {}, () => {
                voiceStateRef.current = 'idle';
                setVoiceState('idle');
              });
            }
          });
        },
        (err) => {
          console.error('[PULSO_GLOBAL_INCOMING] Requests listener error:', err);
        }
      );
    } catch (err) {
      console.error('[PULSO_GLOBAL_INCOMING] Failed to start requests listener:', err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [db, markContextAsRead]);

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
      attachments?: Array<{ id: string; name: string; type: string; mimeType: string; url: string; sizeBytes: number }>;
      requestId?: string;
    }
  ) => {
    const mode = options?.mode || 'text';
    const cleanMsg = input;
    const rawMsg = input;

    console.log('[PULSO_SUBMIT_START]');
    console.log('[PULSO_SUBMIT_INPUT]', { input: cleanMsg, rawInput: rawMsg, mode });

    const currentUser = authService.getCurrentUser();
    const userRef = currentUser?.email || currentUser?.displayName || 'felipe_dutra';
    const reqId = options?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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

    const activeSession = sessions.find(s => s.contextId === (options?.contextId || activeContextNode.contextId));
    const bootstrapStatus = activeSession?.runtimeStatus || 'pending';
    const runtimeKey = options?.openclawSessionKey || activeContextNode.openclawSessionKey || `agent:main:pulso:${options?.contextId || activeContextNode.contextId}`;

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
      openclawSessionKey: runtimeKey,
      
      // Modelo A: Campos físicos de roteamento cognitivo
      runtimeSessionKey: runtimeKey,
      sessionBootstrapStatus: bootstrapStatus,
      deliveryMode: "firestore_sync",
      originType: "user_ui"
    };

    if (routeResult.areaRef) lotusPayload.areaRef = routeResult.areaRef;
    if (routeResult.routing) lotusPayload.routing = routeResult.routing;
    if (routeResult.routing?.secondaryTopics) lotusPayload.secondaryAreaRefs = routeResult.routing.secondaryTopics;
    if (options?.attachments && options.attachments.length > 0) {
      lotusPayload.attachments = options.attachments;
    }

    console.log('[PULSO_FIRESTORE_PATH]', { path: `workspaces/felipe_dutra/pulso_requests` });
    console.log('[PULSO_FIRESTORE_PAYLOAD]', lotusPayload);

    try {
      const newRequest = await lotusOpenClawClient.queueRequest(lotusPayload);
      console.log('[PULSO_FIRESTORE_CREATED]', {
        path: `workspaces/felipe_dutra/pulso_requests`,
        documentId: newRequest.id,
        requestType: newRequest.requestType,
        status: newRequest.status,
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

  /** Stage files into the pending tray and start background upload to Storage */
  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const isFirestore = pulsoService.getDataMode() === 'firestore';
    const sendingContextId = activeContextNode.contextId;

    const newPending: PendingAttachment[] = Array.from(files).map(file => {
      const id = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let type: 'image' | 'pdf' | 'audio' | 'generic' = 'generic';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type === 'application/pdf') type = 'pdf';
      else if (file.type.startsWith('audio/')) type = 'audio';
      return {
        id,
        name: file.name,
        type,
        mimeType: file.type,
        localUrl: URL.createObjectURL(file),
        sizeBytes: file.size,
        status: 'uploading' as const,
        progress: 0,
        file
      };
    });

    // Add to pending tray immediately so user sees the preview
    setPendingAttachments(prev => [...prev, ...newPending]);

    // Start background upload for each file
    if (isFirestore && storage) {
      newPending.forEach(async (att) => {
        try {
          const path = `pulso/chats/${sendingContextId}/attachments/${att.id}_${att.name}`;
          const fileRef = storageRef(storage!, path);
          const uploadTask = uploadBytesResumable(fileRef, att.file);

          uploadTask.on('state_changed',
            snapshot => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setPendingAttachments(prev => prev.map(p =>
                p.id === att.id ? { ...p, progress } : p
              ));
            },
            (err) => {
              console.error('Upload error for', att.name, err);
              setPendingAttachments(prev => prev.map(p =>
                p.id === att.id ? { ...p, status: 'error' } : p
              ));
            },
            async () => {
              const storageUrl = await getDownloadURL(fileRef);
              setPendingAttachments(prev => prev.map(p =>
                p.id === att.id ? { ...p, status: 'done', progress: 100, storageUrl } : p
              ));
            }
          );
        } catch (err) {
          console.error('Failed to start upload for', att.name, err);
          setPendingAttachments(prev => prev.map(p =>
            p.id === att.id ? { ...p, status: 'error' } : p
          ));
        }
      });
    } else {
      // Mock/offline mode: mark all as done immediately with local URL
      setPendingAttachments(prev => prev.map(p =>
        newPending.find(np => np.id === p.id)
          ? { ...p, status: 'done', progress: 100, storageUrl: p.localUrl }
          : p
      ));
    }
  };

  const isSubmittingRef = React.useRef(false);

  const handleSendMessage = async (textToSend?: string, options?: {
    originMode?: 'text' | 'recording_once' | 'presence' | 'recording_meeting';
    displayText?: string;
    targetContextNode?: PulsoContextNode;
  }) => {
    if (isTyping || isSubmittingRef.current) {
      console.warn('Blocked duplicate send: message already processing or submitting.');
      return;
    }
    
    isSubmittingRef.current = true;
    setTimeout(() => { isSubmittingRef.current = false; }, 500);

    const rawMsg = textToSend || inputMessage;
    const hasPending = pendingAttachments.length > 0;
    if (!rawMsg.trim() && !hasPending) return;

    const originMode = options?.originMode || 'text';
    const cleanMsg = originMode === 'recording_once' || originMode === 'presence'
      ? normalizeTranscript(rawMsg)
      : rawMsg.trim();
    const sendingNode = options?.targetContextNode || activeContextNode;

    const sendingContextId = sendingNode.contextId;
    setContextTyping(sendingContextId, true);

    // Capture and clear pending attachments before async work
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]);

    // Build attachment metadata for the request (prefer storageUrl, fall back to localUrl)
    const attachmentsMeta = attachmentsToSend.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      mimeType: a.mimeType,
      url: a.storageUrl || a.localUrl,
      sizeBytes: a.sizeBytes,
      status: 'processing_extraction' as const,
      availableToLotus: false,
      includedInline: false,
      fullTextDeferred: false,
      extractionMode: (a.type === 'image' ? 'ocr' : (a.type === 'audio' ? 'transcription' : 'text')) as any
    }));

    // Build Attachment[] for optimistic local message
    const messageAttachments: Attachment[] = attachmentsToSend.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      mimeType: a.mimeType,
      url: a.storageUrl || a.localUrl,
      sizeBytes: a.sizeBytes,
      createdAt: new Date(),
      contextId: sendingContextId,
      status: 'processing_extraction',
      availableToLotus: false,
      includedInline: false,
      fullTextDeferred: false,
      extractionMode: (a.type === 'image' ? 'ocr' : (a.type === 'audio' ? 'transcription' : 'text')) as any
    }));

    const sendMode = originMode === 'presence' ? 'presence' : (originMode === 'recording_once' ? 'voice' : 'text');
    const messageText = cleanMsg || (attachmentsToSend.length > 0 ? attachmentsToSend.map(a => a.name).join(', ') : '');
    const preGeneratedReqId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // t1: Moment the message enters PULSO
    latencyMapRef.current[preGeneratedReqId] = {
      t1_client_submit: Date.now()
    };

    // Optimistic UI Update: Clear text and append user message instantly
    setInputMessage('');
    currentTextRef.current = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      setInputHeight(36);
    }

    const capturedReplyTo = replyTo;
    setReplyTo(null);

    const userMsg: Message = {
      id: `user-msg-${preGeneratedReqId}`,
      sender: 'user',
      text: options?.displayText || cleanMsg,
      timestamp: new Date(),
      contextId: sendingNode.contextId,
      replyTo: capturedReplyTo || undefined,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined
    };
    setMessages(prev => [...prev, userMsg]);

    if (originMode === 'presence') {
      // Não fala transição, apenas atualiza estado interno para esperar
      voiceStateRef.current = 'transcribing';
      setVoiceState('transcribing');
    }

    if (originMode === 'presence' || originMode === 'recording_once' || originMode === 'recording_meeting') {
      voiceReplyRequestsRef.current.add(preGeneratedReqId);
    }

    // Toda interação da /live segue diretamente para a Lótus/OpenClaw.
    createPulsoConversationRequest(messageText, {
      mode: sendMode,
      areaId: sendingNode.areaId,
      contextId: sendingNode.contextId,
      chatId: sendingNode.chatId,
      attachments: attachmentsMeta.length > 0 ? attachmentsMeta : undefined,
      requestId: preGeneratedReqId,
      context: contextStatesMap[sendingNode.contextId]?.strongState ? {
        reusableContext: contextStatesMap[sendingNode.contextId].strongState
      } : undefined
    }).then(async (newRequest) => {
      // t2: Moment request vira queued_for_openclaw in Firestore
      if (latencyMapRef.current[newRequest.id]) {
        latencyMapRef.current[newRequest.id].t2_firestore_queued = Date.now();
      }
      sessionsService.touchSession(sendingContextId);
      setLastSentRequestsByContext(prev => ({ ...prev, [sendingContextId]: newRequest.id }));

      // Save attachment metadata to Firestore so the snapshot renders file bubbles
      if (attachmentsMeta.length > 0 && db && newRequest.id) {
        const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
        const reqDocRef = fsDoc(db, `workspaces/felipe_dutra/pulso_requests`, newRequest.id);
        const serialized = attachmentsMeta.map(a => ({ ...a, createdAt: new Date().toISOString() }));
        updateDoc(reqDocRef, { attachments: serialized })
          .catch(err => console.warn('Could not save attachment metadata to request:', err));
      }

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
        voiceStateRef.current = 'waiting_lotus';
        setVoiceState('waiting_lotus');
        const diffTransToReq = latencyRequestCreatedRef.current - (latencyTranscriptionRef.current || latencyRequestCreatedRef.current);
        console.log(`[PULSO_LATENCY_TRANSCRIPTION_TO_REQUEST_CREATED_MS] ${diffTransToReq} ms`);
      }
    }).catch((err: any) => {
      const lotusErrorMsg: Message = {
        id: `lotus-error-${Date.now()}`,
        sender: 'lotus',
        text: `falha ao enviar para a Lótus: ${err?.message || 'erro de persistência'}.`,
        timestamp: new Date(),
        contextId: sendingNode.contextId
      };
      setMessages(prev => [...prev, lotusErrorMsg]);
    }).finally(() => {
      setContextTyping(sendingContextId, false);
    });
  };

  const handleRenameChat = async (contextId: string) => {
    const trimmed = editingContextLabel.trim();
    if (trimmed) {
      await sessionsService.renameSession(contextId, trimmed).catch(err =>
        console.error("Failed to rename session:", err)
      );
      if (pulsoService.getDataMode() !== 'firestore') {
        const list = await sessionsService.getAll();
        setSessions(list.map(s => sessionToContextNode(s)));
      }
      
      if (activeContextNode.contextId === contextId) {
        setActiveContextNode(prev => ({ ...prev, label: trimmed }));
      }
    }
    setEditingContextId(null);
  };

  const handleArchiveChat = async (contextId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await sessionsService.archiveSession(contextId).catch(err =>
      console.error("Failed to archive session:", err)
    );
    let updatedSessions = sessions;
    if (pulsoService.getDataMode() !== 'firestore') {
      const list = await sessionsService.getAll();
      updatedSessions = list.map(s => sessionToContextNode(s));
      setSessions(updatedSessions);
    }
    
    if (activeContextNode.contextId === contextId) {
      const remaining = updatedSessions.filter(s => s.contextId !== contextId);
      if (remaining.length > 0) {
        setActiveContextNode(remaining[0]);
      } else {
        setActiveContextNode(LOADING_PLACEHOLDER_NODE);
      }
    }
  };

  const requestMicrophonePermission = React.useCallback(async (): Promise<boolean> => {
    console.log('[PULSO_MIC_PERMISSION_REQUEST]');
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
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
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && window.MediaRecorder) {
      console.log('[PULSO_MEDIA_RECORDER_AVAILABLE]');
      return true;
    } else {
      console.log('[PULSO_MEDIA_RECORDER_UNAVAILABLE]');
      return false;
    }
  }, []);

  const stopVoiceRecognition = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else if (microphoneStreamRef.current) {
      // Sem gravação ativa (ex: erro antes de começar), não há onstop pra
      // limpar a stream — encerra aqui mesmo.
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend().catch(console.error);
      }
    }
  }, []);

  const exitPresenceMode = React.useCallback(() => {
    console.log('[PULSO_PRESENCE_EXIT_CLEAN]');
    if (voiceSessionControllerRef.current) {
      voiceSessionControllerRef.current.stop();
      voiceSessionControllerRef.current = null;
    }
    setPresenceMode(false);
    setVoiceMode('off');
    voiceModeRef.current = 'off';
    setVoiceState('idle');
    voiceStateRef.current = 'idle';
    stopVoiceRecognition();
    ttsAdapter.cancel();
    setPlayingMsgId(null);
    setPlayingState('stopped');
    currentTextRef.current = '';
    setInputMessage('');
  }, [stopVoiceRecognition, ttsAdapter]);

  const inputMessageRef = React.useRef(inputMessage);
  React.useEffect(() => {
    inputMessageRef.current = inputMessage;
  }, [inputMessage]);

  const transcribeAudioBlob = React.useCallback(async (blob: Blob, mode: VoiceMode) => {
    try {
      voiceStateRef.current = 'transcribing';
      setVoiceState('transcribing');
      
      const isTauriEnv = typeof window !== 'undefined' && (
        window.location.protocol === 'tauri:' ||
        !!(window as any).__TAURI__ ||
        !!(window as any).__TAURI_INTERNALS__
      );

      const endpointUrl = isTauriEnv 
        ? 'https://felipedutraapps.web.app/api/pulso/transcribe' 
        : '/api/pulso/transcribe';

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
        },
        body: blob,
      });

      if (!response.ok) {
        throw new Error('Falha na transcrição');
      }

      const data = await response.json();
      const transcribedText = data.text || '';
      
      if (mode === 'recording_once') {
         const currentBase = baseTextBeforeRecordingRef.current;
         const newText = transcribedText.trim() ? (currentBase ? `${currentBase}${transcribedText}` : transcribedText) : currentBase.trim();
         const shouldSendDirect = sendAfterTranscribeRef.current;
         sendAfterTranscribeRef.current = false;

         if (shouldSendDirect && newText.trim()) {
           setInputMessage('');
           currentTextRef.current = '';
           inputMessageRef.current = '';
           setVoiceState('idle');
           voiceStateRef.current = 'idle';
           setVoiceMode('off');
           voiceModeRef.current = 'off';
           handleSendMessage(newText, { originMode: 'recording_once' });
           return;
         }

         setInputMessage(newText);
         currentTextRef.current = newText;
         inputMessageRef.current = newText;
         if (!transcribedText.trim()) {
           // Sinaliza claramente em vez de deixar a caixa de texto igual, sem
           // pista nenhuma de que a gravação não virou texto.
           setVoiceError('não captei nenhum áudio nessa gravação — tenta de novo.');
         }

         setVoiceState('idle');
         voiceStateRef.current = 'idle';
         setVoiceMode('off');
         voiceModeRef.current = 'off';
      } else if (mode === 'presence') {
         setInputMessage(transcribedText);
         currentTextRef.current = transcribedText;
         inputMessageRef.current = transcribedText;
         
         if (transcribedText.trim().length > 0) {
            voiceStateRef.current = 'submitting';
            setVoiceState('submitting');
            playPresenceSoundCue('sent');
            handleSendMessage(transcribedText, { originMode: 'presence' });
            voiceStateRef.current = 'waiting_lotus';
            setVoiceState('waiting_lotus');
         } else {
            // Restart presence if nothing was heard
            if (voiceModeRef.current === 'presence') {
              startSpeechRecognitionRef.current?.('presence');
            }
         }
      }
    } catch (err) {
      console.error('[PULSO_TRANSCRIBE_ERROR]', err);
      setVoiceState('error');
      setVoiceError('Erro ao transcrever o áudio.');
      if (mode === 'recording_once') {
         const originalText = baseTextBeforeRecordingRef.current.trim();
         setInputMessage(originalText);
         currentTextRef.current = originalText;
         inputMessageRef.current = originalText;
         
         setVoiceState('idle');
         voiceStateRef.current = 'idle';
         setVoiceMode('off');
         voiceModeRef.current = 'off';
      }
      if (mode === 'presence' && voiceModeRef.current === 'presence') {
        setTimeout(() => {
          startSpeechRecognitionRef.current?.('presence');
        }, 2000);
      }
    }
  }, [handleSendMessage]);

  const startSpeechRecognition = React.useCallback(async (mode: VoiceMode) => {
    ttsAdapter.cancel();
    stopVoiceRecognition();

    setVoiceMode(mode);
    voiceModeRef.current = mode;
    isSpeechRecognitionRetryingRef.current = false;
    setVoiceError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      microphoneStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        // Só agora, com o gravador de fato parado e o último chunk garantido,
        // é seguro encerrar as tracks do microfone. Pará-las antes (no clique
        // de stop) corta o flush final em alguns navegadores/iOS e produz
        // áudio truncado/vazio na transcrição.
        if (microphoneStreamRef.current) {
          microphoneStreamRef.current.getTracks().forEach(track => track.stop());
          microphoneStreamRef.current = null;
        }
        // Only transcribe if we haven't manually aborted or completely exited
        if (voiceStateRef.current === 'recording_once' || voiceStateRef.current === 'presence_listening' || voiceStateRef.current === 'transcribing') {
           transcribeAudioBlob(audioBlob, mode);
        }
      };

      if (mode === 'presence') {
        if (!audioContextRef.current) {
          const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextCtor();
        }
        const audioCtx = audioContextRef.current;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(console.warn);
        }
        
        const analyser = audioCtx.createAnalyser();
        analyser.minDecibels = -70;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        silenceStartRef.current = 0;

        const checkSilence = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
          analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;

          if (average > 25) {
            silenceStartRef.current = Date.now();
            if (voiceStateRef.current === 'speaking') {
              console.log('[PULSO_PRESENCE_VOICE_INTERRUPTION]');
              ttsAdapter.cancel();
              voiceStateRef.current = 'presence_listening';
              setVoiceState('presence_listening');
              playPresenceSoundCue('start_listening');
            }
          } else {
            // Trigger auto-stop on 2.5s of silence, ONLY if user has spoken first
            if (silenceStartRef.current > 0 && Date.now() - silenceStartRef.current > 2500 && voiceStateRef.current !== 'speaking') {
               console.log('[PULSO_PRESENCE_SILENCE_DETECTED]');
               stopVoiceRecognition();
               voiceStateRef.current = 'transcribing';
               setVoiceState('transcribing');
               return;
            }
          }
          animationFrameRef.current = requestAnimationFrame(checkSilence);
        };
        checkSilence();
      }

      mediaRecorder.start(250); // emit chunks regularly

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition && mode !== 'recording_once') {
         const recognition = new SpeechRecognition();
         recognition.lang = 'pt-BR';
         recognition.continuous = mode === 'presence';
         recognition.interimResults = true;
         recognition.maxAlternatives = 1;
         recognitionRef.current = recognition;

         if (mode === 'recording_once' && inputMessageRef.current.trim().length > 0) {
            finalTranscriptRef.current = inputMessageRef.current.trim() + ' ';
         } else {
            finalTranscriptRef.current = '';
         }
         baseTextBeforeRecordingRef.current = finalTranscriptRef.current;
         currentTextRef.current = finalTranscriptRef.current;

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
            const currentText = (finalTranscriptRef.current + ' ' + interimTranscript).trim().replace(/\\s+/g, ' ');
            currentTextRef.current = currentText;
            setInputMessage(currentText);
         };
         
         recognition.onerror = () => {};

         try {
            recognition.start();
         } catch (e) {}
      } else {
         if (mode === 'recording_once') {
           const baseText = inputMessageRef.current.trim();
           baseTextBeforeRecordingRef.current = baseText ? baseText + ' ' : '';
           setInputMessage(inputMessageRef.current);
         } else if (mode === 'presence') {
           baseTextBeforeRecordingRef.current = '';
           setInputMessage('Ouvindo atentamente...');
         }
      }

      if (mode === 'presence') {
        voiceStateRef.current = 'presence_listening';
        setVoiceState('presence_listening');
        playPresenceSoundCue('start_listening');
        console.log('[PULSO_PRESENCE_LISTENING]');
      } else if (mode === 'recording_once') {
        voiceStateRef.current = 'recording_once';
        setVoiceState('recording_once');
        console.log('[PULSO_RECORDING_ONCE_START]');
      }
      
      maxRecordingTimeoutRef.current = setTimeout(() => {
        console.log('Max recording timeout reached.');
        stopVoiceRecognition();
      }, 7 * 60 * 1000); // 7 minutes max

    } catch (error) {
      console.error('Microphone error:', error);
      setVoiceState('error');
      setVoiceError('Permissão de microfone negada ou indisponível.');
    }
  }, [stopVoiceRecognition, ttsAdapter, transcribeAudioBlob]);

  React.useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition;
  }, [startSpeechRecognition]);

  const toggleMeetingRecording = React.useCallback(async () => {
    if (voiceModeRef.current === 'recording_meeting') {
      setVoiceMode('off');
      voiceModeRef.current = 'off';
      setToastMessage('salvando áudio da reunião...');

      try {
        const { sessionId: sId, chunks } = await stopMeetingRec();
        const meetingContext = activeMeetingContextRef.current || activeContextNode;
        const meetingRef = db ? doc(db, firestorePaths.meeting(sId)) : null;
        const recordingLinks = chunks.map(chunk => chunk.url);
        if (meetingRef) await setDoc(meetingRef, {
          id: sId,
          contextId: meetingContext.contextId || 'general',
          areaId: meetingContext.areaId || null,
          sessionLabel: meetingContext.label || null,
          status: 'transcribing',
          recordingLinks,
          chunks,
          endedAt: new Date(),
          updatedAt: new Date(),
        }, { merge: true });

        console.log('[MEETING] Áudio preservado. Enviando para transcrição...', { sessionId: sId, chunks: chunks.length });
        setToastMessage('transcrevendo reunião...');

          // Hosting closes long-running rewrites before longer meetings finish.
          // The stable Cloud Function URL honors the function's 9-minute timeout.
          const endpointUrl = 'https://us-central1-felipedutraapps.cloudfunctions.net/pulsoProcessMeeting';

          const currentUser = authService.getCurrentUser();
          const authToken = currentUser ? await currentUser.getIdToken() : null;
          if (!authToken) throw new Error('Sessão de autenticação indisponível para processar a reunião.');

          const reqRes = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              contextId: meetingContext.contextId || 'general',
              sessionId: sId || Date.now().toString(),
              chunkUrls: chunks
            })
          });

          if (!reqRes.ok) {
            const payload = await reqRes.json().catch(() => null);
            throw new Error(payload?.error || `Falha ao processar reunião (${reqRes.status}).`);
          }
          const data = await reqRes.json();

          if (data.transcription?.trim()) {
            if (meetingRef) await setDoc(meetingRef, {
              status: 'analysis_queued',
              transcription: data.transcription,
              transcriptionProvider: 'gemini-2.5-flash',
              transcriptionPartial: !!data.partial,
              failedChunks: data.failedChunks || [],
              updatedAt: new Date(),
            }, { merge: true });

            console.log('[MEETING] Transcrição recebida. Encaminhando para análise contextual da Lótus.', data);
            setToastMessage('analisando contexto e próximos passos...');

            await handleSendMessage(`REUNIÃO ENCERRADA — PROCESSAMENTO CONTEXTUAL

Esta reunião foi gravada pelo botão dedicado de reunião da PULSO.

Referência: ${sId}
Área: ${meetingContext.areaId || 'não informada'}
Sessão: ${meetingContext.label || meetingContext.contextId || 'não informada'}
Contexto da sessão: ${meetingContext.contextId || 'general'}
Transcrição parcial: ${data.partial ? 'sim' : 'não'}

Analise a transcrição à luz do contexto desta sessão, dos projetos, das pessoas e das fontes de verdade disponíveis. Produza:
1. resumo executivo claro e fiel;
2. pauta consolidada por assunto;
3. decisões e acordos firmados;
4. plano de ação com responsável, entrega, prazo citado e dependências;
5. participantes identificados, distinguindo confirmação de hipótese;
6. destino recomendado no Notion e vínculos com projetos existentes;
7. pacote de distribuição: quem deve receber, por qual canal e qual mensagem/documento;
8. dúvidas objetivas que impeçam atribuição ou envio.

Registre a reunião no Notion no destino adequado quando houver segurança contextual suficiente. Não envie WhatsApp, e-mail ou mensagem a terceiros sem aprovação explícita do Fe. Ao final, apresente os envios propostos para aprovação.

TRANSCRIÇÃO:
${data.transcription}`, {
              originMode: 'recording_meeting',
              displayText: `Reunião encerrada em “${meetingContext.label || meetingContext.contextId}”. Processando registro, decisões e próximos passos.`,
              targetContextNode: meetingContext,
            });

            setToastMessage('reunião entregue à Lótus');
            setTimeout(() => setToastMessage(null), 3500);
          } else {
            throw new Error('A transcrição retornou vazia.');
          }
      } catch (error: any) {
        console.error('[MEETING] Erro no processamento:', error);
        if (db && activeMeetingIdRef.current) {
          await setDoc(doc(db, firestorePaths.meeting(activeMeetingIdRef.current)), {
            status: 'failed',
            errorMessage: error?.message || String(error),
            updatedAt: new Date(),
          }, { merge: true }).catch(updateError => {
            console.warn('[MEETING] Não foi possível persistir a falha:', updateError);
          });
        }
        setToastMessage(error?.message || 'falha ao processar reunião.');
        setTimeout(() => setToastMessage(null), 5000);
      }
      activeMeetingContextRef.current = null;
      
    } else {
      try {
        const meetingContext = { ...activeContextNode };
        activeMeetingContextRef.current = meetingContext;
        const { sessionId } = await startMeetingRec();
        activeMeetingIdRef.current = sessionId;
        setVoiceMode('recording_meeting');
        voiceModeRef.current = 'recording_meeting';
        setToastMessage('gravação de reunião iniciada');
        setTimeout(() => setToastMessage(null), 3000);
        if (db) {
          await setDoc(doc(db, firestorePaths.meeting(sessionId)), {
            id: sessionId,
            date: new Date(),
            startedAt: new Date(),
            updatedAt: new Date(),
            status: 'recording',
            contextId: meetingContext.contextId || 'general',
            areaId: meetingContext.areaId || null,
            sessionLabel: meetingContext.label || null,
            participantsRefs: [],
            recordingLinks: [],
          }, { merge: true }).catch(error => {
            console.warn('[MEETING] Gravação iniciada, mas o registro inicial não foi persistido:', error);
          });
        }
      } catch (error: any) {
        console.error('[MEETING] Falha ao iniciar:', error);
        activeMeetingContextRef.current = null;
        setToastMessage(error?.message || 'não foi possível iniciar a gravação.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    }
  }, [startMeetingRec, stopMeetingRec, activeContextNode, handleSendMessage, db]);

  const toggleRecordingOnce = React.useCallback(async () => {
    hasRetriedSpeechRecognitionRef.current = false;
    if (voiceModeRef.current === 'recording_once') {
      voiceModeRef.current = 'off'; // Mark as off immediately so onend doesn't restart
      stopVoiceRecognition();
      setVoiceMode('off');
    } else {
      if (!isSpeechRecognitionSupported()) {
        setVoiceState('error');
        setVoiceError('transcrição indisponível no app (WebView sem suporte a STT nativo)');
        return;
      }
      
      setVoiceState('recording_once');
      startSpeechRecognition('recording_once');
    }
  }, [startSpeechRecognition, stopVoiceRecognition, isSpeechRecognitionSupported]);

  // Para, transcreve normalmente e já envia a mensagem assim que o texto sai
  // — sem precisar de um segundo toque no botão de enviar.
  const sendRecordingOnceDirect = React.useCallback(() => {
    if (voiceModeRef.current !== 'recording_once') return;
    sendAfterTranscribeRef.current = true;
    voiceModeRef.current = 'off';
    stopVoiceRecognition();
    setVoiceMode('off');
  }, [stopVoiceRecognition]);

  // Desiste da gravação: para sem transcrever e restaura o texto que já
  // estava na caixa antes de começar a gravar.
  const cancelRecordingOnce = React.useCallback(() => {
    if (voiceModeRef.current !== 'recording_once') return;
    sendAfterTranscribeRef.current = false;
    voiceModeRef.current = 'off';
    voiceStateRef.current = 'idle'; // onstop só transcreve se o estado ainda permitir
    setVoiceMode('off');
    setVoiceState('idle');
    stopVoiceRecognition();
    const originalText = baseTextBeforeRecordingRef.current;
    setInputMessage(originalText);
    currentTextRef.current = originalText;
    inputMessageRef.current = originalText;
  }, [stopVoiceRecognition]);

  const togglePresenceMode = React.useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (presenceMode) {
      exitPresenceMode();
    } else {
      if (!isSpeechRecognitionSupported()) {
        setPresenceMode(true);
        setVoiceState('error');
        setVoiceError('transcrição indisponível no app (WebView sem suporte a STT nativo)');
        return;
      }
      
      setPresenceMode(true);
      setVoiceMode('presence');
      voiceModeRef.current = 'presence';
      presenceSessionStartTimeRef.current = Date.now();
      spokenRequestsRef.current.clear();

      const controller = new VoiceSessionController({
        activeContextNode,
        onStateChange: (newState) => {
          setVoiceState(newState);
          voiceStateRef.current = newState;
        },
        onError: (err) => {
          setVoiceError(err);
        },
        onTextReceived: (userText, assistantText) => {
          // Apenas adiciona ao log do chat se necessário (geralmente handleSendMessage já cria as mensagens)
        },
        handleSendMessage: async (text, options) => {
          return handleSendMessage(text, options);
        }
      });

      voiceSessionControllerRef.current = controller;

      // Primeiro trigger síncrono com a interação física: criamos o AudioContext na raiz do clique
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const syncAudioCtx = new AudioContextCtor();
      audioContextRef.current = syncAudioCtx;
      if (syncAudioCtx.state === 'suspended') {
        syncAudioCtx.resume().catch(console.warn);
      }

      await controller.start(syncAudioCtx);
    }
  }, [presenceMode, exitPresenceMode, isSpeechRecognitionSupported, activeContextNode, handleSendMessage]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (voiceState === 'recording_once') setVoiceState('idle');
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 212);
      textareaRef.current.style.height = `${newHeight}px`;
      setInputHeight(newHeight);
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
    if (isTyping) return true;
    const lastSentIdForActive = lastSentRequestsByContext[activeContextNode.contextId];
    if (!lastSentIdForActive) return false;
    const req = allRequests.find((r: any) => r.id === lastSentIdForActive);
    if (!req) return false;
    return req.status !== 'success' && req.status !== 'error' && req.status !== 'timeout';
  }, [allRequests, lastSentRequestsByContext, activeContextNode.contextId, isTyping]);


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
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = dynamicAreas.findIndex(a => a.id === active.id);
      const newIndex = dynamicAreas.findIndex(a => a.id === over.id);
      const newOrder = arrayMove(dynamicAreas, oldIndex, newIndex);
      
      setState((prev: any) => {
        if (!prev) return prev;
        const updatedAreas = [...(prev.allAreas || [])];
        newOrder.forEach((item, index) => {
          const idx = updatedAreas.findIndex(a => a.id === item.id);
          if (idx !== -1) {
            updatedAreas[idx] = { ...updatedAreas[idx], order: index };
          } else {
            updatedAreas.push({ id: item.id, name: item.name, order: index, status: 'active', type: 'personal' });
          }
        });
        return { ...prev, allAreas: updatedAreas };
      });

      try {
        const promises = newOrder.map((areaToSave, index) => {
          return areasService.saveArea({ id: areaToSave.id, name: areaToSave.name, order: index, status: 'active' } as any);
        });
        await Promise.all(promises);
      } catch (err) {
        console.error("Erro ao salvar ordem das áreas:", err);
      }
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirm1 = window.confirm(`Deseja mesmo excluir a área "${areaName}"?`);
    if (!confirm1) return;
    const confirm2 = window.confirm(`ATENÇÃO: Todos os chats e sessões associados à área "${areaName}" serão arquivados. Confirmar exclusão?`);
    if (!confirm2) return;

    try {
      // Archive/delete in Firestore
      await setDoc(doc(db!, firestorePaths.area(areaId)), { archived: true, status: 'archived', updatedAt: new Date() }, { merge: true });
      
      // Update local state
      setState((prev: any) => {
        if (!prev) return prev;
        const updatedAreas = (prev.allAreas || []).filter((a: any) => a.id !== areaId);
        return { ...prev, allAreas: updatedAreas };
      });

      // Archive sessions associated with this area
      const sessionsToArchive = allContextNodes.filter(n => n.areaId === areaId);
      await Promise.all(sessionsToArchive.map(session => 
        setDoc(doc(db!, firestorePaths.session(session.contextId)), { archived: true, updatedAt: new Date() }, { merge: true })
      ));
    } catch (err) {
      console.error("Erro ao excluir área:", err);
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
      if (voiceStateRef.current === 'presence_listening') return 'lotus-listening-anim';
      if (voiceStateRef.current === 'transcribing' || voiceStateRef.current === 'submitting') return 'lotus-thinking-anim';
      if (voiceStateRef.current === 'waiting_lotus') return 'lotus-waiting-anim';
      if (voiceStateRef.current === 'speaking') return 'lotus-responding-anim';
      if (voiceStateRef.current === 'error') return 'lotus-error-anim';
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

      {pulsoJarvisLayerEnabled && <SummaryCards />}


      {/* Camada Contextual */}
      <ContextSurfaceVariants 
        variant={activeVariant} 
        isOpen={isContextSurfaceOpen} 
        onClose={() => setIsContextSurfaceOpen(false)}
        activeContext={activeContextNode.label}
      />

      {/* Botão sutil de saída do Modo Foco ou Ateliê */}
      <div className={`fixed top-8 right-8 z-30 pulso-transition ${(presenceMode || isAtelieActive || isEstudioActive) ? 'pulso-visible' : 'pulso-hidden-up'}`}>
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            if (presenceMode) exitPresenceMode(); 
            if (isAtelieActive) setIsAtelieActive(false);
            if (isEstudioActive) setIsEstudioActive(false);
          }}
          className="text-[10px] font-light tracking-widest text-[#fbf9f5]/40 hover:text-[#fbf9f5]/80 transition-colors lowercase bg-transparent border-none outline-none cursor-pointer"
        >
          {isAtelieActive ? '[ sair do ateliê ]' : isEstudioActive ? '[ sair do estúdio ]' : '[ sair do foco ]'}
        </button>
      </div>
      
      <header className={`flex justify-between items-center w-full max-w-4xl mx-auto relative z-20 select-none pulso-transition ${presenceMode || isAtelieActive || isEstudioActive ? 'pulso-hidden-up' : 'pulso-visible'}`}>
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
          
          <span className="text-sm font-semibold tracking-[0.2em] text-[#fbf9f5]/80 lowercase">pulso</span>
          
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
            {(voiceState === 'presence_listening' || voiceState === 'recording_once') ? 'ouvindo...' : isTyping ? 'processando...' : 'conectada'}
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
            onClick={(e) => { 
              e.stopPropagation(); 
              const nextState = !isEngineeringActive;
              setIsEngineeringActive(nextState); 
              if (nextState) {
                setIsAtelieActive(false);
                setIsEstudioActive(false);
              }
            }}
            className={`hidden md:flex text-xs font-light tracking-widest transition-all duration-300 items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer ${
              isEngineeringActive ? 'text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse' : 'text-[#fbf9f5]/80 hover:text-white'
            }`}
          >
            <span>[ engenharia ]</span>
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              const nextState = !isAtelieActive;
              setIsAtelieActive(nextState); 
              if (nextState) {
                setIsEngineeringActive(false);
                setIsEstudioActive(false);
              }
            }}
            className={`hidden md:flex text-xs font-light tracking-widest transition-all duration-300 items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer ${
              isAtelieActive ? 'text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse' : 'text-[#fbf9f5]/80 hover:text-white'
            }`}
          >
            <span>{isAtelieActive ? '[ chat ]' : '[ ateliê ]'}</span>
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              const nextState = !isEstudioActive;
              setIsEstudioActive(nextState); 
              if (nextState) {
                setIsEngineeringActive(false);
                setIsAtelieActive(false);
              }
            }}
            className={`hidden md:flex text-xs font-light tracking-widest transition-all duration-300 items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer ${
              isEstudioActive ? 'text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse' : 'text-[#fbf9f5]/80 hover:text-white'
            }`}
          >
            <span>[ estúdio ]</span>
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsArcaOpen(!isArcaOpen); 
            }}
            className={`hidden md:flex text-xs font-light tracking-widest transition-all duration-300 items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer ${
              isArcaOpen ? 'text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse' : 'text-[#fbf9f5]/80 hover:text-white'
            }`}
          >
            <span>[ arca ]</span>
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
            
            {isHeaderMenuOpen && !contextSurfaceVariant && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-[70] bg-[#0c0c0c]/76 backdrop-blur-xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col items-end text-left animate-fade-in"
                onClick={() => setIsHeaderMenuOpen(false)}
              >
                <div className="flex flex-col gap-7 w-full max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[9px] font-light tracking-[0.24em] text-[#fbf9f5]/35 uppercase">menu</span>
                    <button
                      onClick={() => setIsHeaderMenuOpen(false)}
                      className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center"
                    >
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-6">
                    {/* Mobile-only navigation items */}
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); setIsEngineeringActive(!isEngineeringActive); if (!isEngineeringActive) { setIsAtelieActive(false); setIsEstudioActive(false); } }}
                      className="flex md:hidden items-center py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <span>engenharia</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); setIsAtelieActive(!isAtelieActive); if (!isAtelieActive) { setIsEngineeringActive(false); setIsEstudioActive(false); } }}
                      className="flex md:hidden items-center py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <span>{isAtelieActive ? 'chat' : 'ateliê'}</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); setIsEstudioActive(!isEstudioActive); if (!isEstudioActive) { setIsEngineeringActive(false); setIsAtelieActive(false); } }}
                      className="flex md:hidden items-center py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <span>estúdio</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); setIsArcaOpen(!isArcaOpen); }}
                      className="flex md:hidden items-center py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <span>arca</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); setIsSidebarOpen(true); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Activity size={12} strokeWidth={1.5} />
                      <span>sinais operacionais</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); setIsTtsSettingsOpen(true); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Mic size={12} strokeWidth={1.5} />
                      <span>voz da lótus (tts)</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); router.push('/pulso/ecossistema'); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Layers size={12} strokeWidth={1.5} />
                      <span>visão do contexto</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); router.push('/pulso/eventos'); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Database size={12} strokeWidth={1.5} />
                      <span>logs técnicos</span>
                    </button>
                    <button
                      onMouseDown={() => { setIsHeaderMenuOpen(false); router.push('/pulso/conexoes'); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Globe size={12} strokeWidth={1.5} />
                      <span>conexões</span>
                    </button>
                  </div>
                </div>
              </div>,
              document.body
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
        className={`hidden md:flex fixed left-6 top-1/2 -translate-y-1/2 max-h-[85vh] overflow-y-auto no-scrollbar z-40 flex flex-col gap-4 group/sidebar select-none pulso-transition ${
          presenceMode ? 'pulso-hidden-left' : 'pulso-visible'
        }`}
      >
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={dynamicAreas.map(a => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {dynamicAreas.map((area) => {
              const areaId = area.id;
              const areaContexts = allContextNodes.filter(n => n.areaId === areaId);
              const isHovered = hoveredAreaId === areaId;
              const isAreaActive = activeAreaId === areaId;
              const hasUnreadInArea = areaContexts.some(n => !!unreadContexts[n.contextId]);
              const isAddingChatForThisArea = addingChatAreaId === areaId;
              
              return (
                <SortableAreaItemWrapper
                  key={areaId}
                  area={area}
                  isAreaActive={isAreaActive}
                  hasUnreadInArea={hasUnreadInArea}
                  isHovered={isHovered}
                  onMouseEnter={() => {
                    if (!addingChatAreaId) {
                      setHoveredAreaId(areaId);
                    }
                  }}
                  onClickArea={() => {
                    if (areaContexts.length > 0) {
                      setActiveContextNode(areaContexts[0]);
                    }
                  }}
                  areaContexts={areaContexts}
                  editingContextId={editingContextId}
                  editingContextLabel={editingContextLabel}
                  setEditingContextLabel={setEditingContextLabel}
                  handleRenameChat={handleRenameChat}
                  setEditingContextId={setEditingContextId}
                  activeContextNode={activeContextNode}
                  unreadContexts={unreadContexts}
                  handleArchiveChat={handleArchiveChat}
                  isAddingChatForThisArea={isAddingChatForThisArea}
                  newChatName={newChatName}
                  setNewChatName={setNewChatName}
                  setAddingChatAreaId={setAddingChatAreaId}
                  setHoveredAreaId={setHoveredAreaId}
                  allContextNodes={allContextNodes}
                  setSessions={setSessions}
                  setActiveContextNode={setActiveContextNode}
                  getAreaIcon={getAreaIcon}
                  onDeleteArea={handleDeleteArea}
                  onOpenAreaConfig={setAreaConfigPanelAreaId}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Add Area Input/Button */}
        <div className="flex items-center gap-2.5 py-1">
          {isAddingArea ? (
            <input
              autoFocus
              type="text"
              placeholder="nova área..."
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const rawName = newAreaName.trim();
                  if (rawName) {
                    const slug = rawName
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                      .replace(/-+/g, '-');
                    const areaId = `area_${slug}`;
                    try {
                      await areasService.saveArea({
                        id: areaId,
                        name: rawName,
                        slug,
                        status: 'active',
                        order: dynamicAreas.length,
                        type: 'personal',
                      });
                      setState((prev: any) => {
                        if (!prev) return prev;
                        const existing = prev.allAreas || [];
                        if (existing.some((a: any) => a.id === areaId)) return prev;
                        return {
                          ...prev,
                          allAreas: [...existing, { id: areaId, name: rawName, slug, status: 'active', order: dynamicAreas.length, type: 'personal' }]
                        };
                      });
                    } catch (err) {
                      console.error("Erro ao criar área:", err);
                    }
                  }
                  setIsAddingArea(false);
                  setNewAreaName('');
                } else if (e.key === 'Escape') {
                  setIsAddingArea(false);
                  setNewAreaName('');
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsAddingArea(false);
                  setNewAreaName('');
                }, 200);
              }}
              className="bg-transparent border-b border-[#fbf9f5]/20 text-[#fbf9f5] text-[9px] tracking-widest uppercase w-20 py-0.5 outline-none placeholder-[#fbf9f5]/25 font-sans font-light"
            />
          ) : (
            <button
              onClick={() => setIsAddingArea(true)}
              className="text-[9px] font-light tracking-widest text-[#fbf9f5]/25 hover:text-[#fbf9f5]/60 transition-colors uppercase select-none cursor-pointer border-none bg-transparent outline-none p-0 text-left w-full"
            >
              + área
            </button>
          )}
        </div>
      </div>

        <main
          className={`flex-1 min-h-0 overscroll-none no-scrollbar flex flex-col lg:flex-row 2xl:flex-col lg:items-center items-center justify-end lg:justify-center 2xl:justify-end mx-auto relative pointer-events-auto z-10 ${
            isAtelieActive || isEstudioActive
              ? 'overflow-hidden w-full h-full max-w-none mt-0 mb-0'
              : 'overflow-hidden max-w-5xl w-full mt-2 md:mt-6 mb-2 md:mb-4 pb-28'
          }`}
          style={{
            transform: (!isAtelieActive && !isEstudioActive && isMesaOpen && !isMesaCollapsed)
              ? 'translateX(calc(-22vw + 1.5rem))'
              : 'translateX(0)',
            transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >

          {/* Atelie Workspace Container nested within main */}
          <div className={`absolute inset-0 w-full h-full z-0 overflow-hidden pulso-transition ${
            isAtelieActive ? 'opacity-100 filter-none pointer-events-auto' : 'opacity-0 blur-md pointer-events-none'
          }`}>
            <AtelieWorkspace activeContextNode={activeContextNode} isActive={isAtelieActive} />
          </div>

          {/* Estudio Workspace Container nested within main */}
          <div className={`absolute inset-0 w-full h-full z-0 overflow-hidden pulso-transition ${
            isEstudioActive ? 'opacity-100 filter-none pointer-events-auto' : 'opacity-0 blur-md pointer-events-none'
          }`}>
            <EstudioWorkspace activeContextNode={activeContextNode} isActive={isEstudioActive} />
          </div>
          
          <div 
            onClick={togglePresenceMode}
            className={isAtelieActive || isEstudioActive
              ? `fixed bottom-[18px] left-1/2 translate-x-[200px] sm:translate-x-[240px] md:translate-x-[300px] z-50 cursor-pointer pointer-events-auto transition-all duration-[1200ms] ease-in-out scale-[0.22] origin-center opacity-85 hover:opacity-100 filter-none`
              : `relative w-36 h-36 md:w-64 md:h-64 flex items-center justify-center shrink-0 select-none transition-all duration-[1200ms] ease-in-out origin-center ${!presenceMode ? 'cursor-pointer' : ''} ${
                  presenceMode 
                    ? 'z-20 translate-y-[15vh] md:translate-y-[25vh] lg:translate-y-0 lg:translate-x-[15vw] 2xl:translate-x-0 2xl:translate-y-[25vh]' 
                    : 'mt-10 mb-2 md:mt-auto md:mb-12 lg:mt-0 lg:mb-0 lg:mr-10 2xl:mt-auto 2xl:mb-auto 2xl:mr-0 z-10 translate-y-0 md:translate-y-[-5vh] lg:translate-y-0 2xl:translate-y-0'
                }`
            }
          >
            <div className={`absolute flex items-center justify-center transition-transform duration-1000 ease-in-out origin-center ${
              presenceMode && !(isAtelieActive || isEstudioActive) ? 'scale-[0.75] md:scale-100' : 'scale-[0.38] md:scale-50 lg:scale-[0.55] 2xl:scale-[0.54]'
            }`}>
              <div 
                className={`w-[422px] h-[422px] rounded-full border-[19px] border-[#fbf9f5] transition-all duration-1000 ease-in-out flex flex-col items-center justify-center p-8 text-center ${getLotusAnimClass()}`} 
                aria-label={`Modo Presença: ${voiceState}`}
              />
              {voiceMode === 'recording_meeting' && (
                <div className="absolute -bottom-20 flex flex-col items-center pointer-events-none">
                  <div className="w-[10px] h-[10px] bg-[#b8283e] rounded-full animate-pulse shadow-[0_0_12px_rgba(184,40,62,1)]" />
                </div>
              )}
              
            </div>
          </div>

          {(!(isAtelieActive || isEstudioActive) || (isAtelieActive && showAtelieChatHistory)) && (
            <div className={`transition-all duration-500 ${(isMesaOpen && !isMesaCollapsed) ? 'w-full px-4 md:px-8' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-1 md:mt-2 mb-2 md:mb-4 pointer-events-auto flex flex-col gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}>
              
              <div 
                className={`flex flex-col relative transition-all duration-300 ${
                  isAtelieActive 
                    ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                    : 'bg-transparent'
                } ${isMesaOpen ? 'w-full' : 'w-full'}`}
                style={{ height: chatHeight, marginBottom: chatMarginBottom }}
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
              {currentMessages.map((msg, msgIndex) => {
                if (msg.isProgressUpdate) {
                  const progressGroupKey = msg.originRequestId || msg.id;
                  const firstGroupIndex = currentMessages.findIndex(candidate =>
                    candidate.isProgressUpdate &&
                    (candidate.originRequestId || candidate.id) === progressGroupKey
                  );

                  if (msgIndex !== firstGroupIndex) return null;

                  const groupUpdates = currentMessages.filter(candidate =>
                    candidate.isProgressUpdate &&
                    (candidate.originRequestId || candidate.id) === progressGroupKey
                  );
                  const hasFinalResponse = Boolean(
                    msg.originRequestId && currentMessages.some(candidate =>
                      !candidate.isProgressUpdate &&
                      candidate.sender === 'lotus' &&
                      candidate.requestId === msg.originRequestId
                    )
                  );
                  const isExpanded = expandedProgressGroups[progressGroupKey] ?? !hasFinalResponse;

                  return (
                    <div 
                      key={msg.id} 
                      className="flex w-full justify-start animate-fade-in py-1"
                    >
                      <div className="w-full max-w-[85%] border-l border-white/10 pl-3">
                        <button
                          type="button"
                          onClick={() => setExpandedProgressGroups(prev => ({
                            ...prev,
                            [progressGroupKey]: !(prev[progressGroupKey] ?? !hasFinalResponse)
                          }))}
                          className="group flex items-center gap-2 bg-transparent border-none p-0 text-left cursor-pointer outline-none text-[#fbf9f5]/45 hover:text-[#fbf9f5]/70 transition-colors"
                          aria-expanded={isExpanded}
                        >
                          {hasFinalResponse ? (
                            <span className="h-1 w-1 rounded-full bg-[#fbf9f5]/25" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]/65 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.35)]" />
                          )}
                          <span className="text-xs font-light tracking-wide">
                            {hasFinalResponse ? 'Processo concluído' : 'Em andamento'}
                          </span>
                          <span className="text-[#fbf9f5]/25 transition-transform duration-200">
                            {isExpanded ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronRight size={13} strokeWidth={1.5} />}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pb-1">
                            {groupUpdates.map((update, updateIndex) => (
                              <div key={update.id} className="flex items-start gap-2.5 text-xs text-[#fbf9f5]/40 font-light leading-relaxed">
                                <span className={`mt-[0.45rem] h-1 w-1 shrink-0 rounded-full ${
                                  !hasFinalResponse && updateIndex === groupUpdates.length - 1
                                    ? 'bg-[#fbf9f5]/55 animate-pulse'
                                    : 'bg-[#fbf9f5]/20'
                                }`} />
                                <span>{update.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
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

                      {/* Reply quote block */}
                      {msg.replyTo && (
                        <div className={`border-l-2 border-white/20 pl-2.5 py-1 mb-1 rounded-r-lg bg-white/5 ${isLotus ? 'text-left' : 'text-left border-l-0 border-r-2 pr-2.5 pl-0 rounded-r-none rounded-l-lg'}`}>
                          <span className="block text-[8px] tracking-widest uppercase text-white/35 font-medium mb-0.5 select-none">
                            {msg.replyTo.sender === 'lotus' ? 'lótus' : 'fê'}
                          </span>
                          <span className="block text-[10px] text-[#fbf9f5]/50 font-light leading-snug line-clamp-2">
                            {msg.replyTo.text.slice(0, 120)}{msg.replyTo.text.length > 120 ? '…' : ''}
                          </span>
                        </div>
                      )}
                      {/* Text body & blocks renderer */}
                      {(!msg.attachments || msg.attachments.length === 0 || msg.text !== msg.attachments.map(a => a.name).join(', ')) && msg.text && (
                        <div className="text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 block break-words text-left" style={{ overflowWrap: 'anywhere' }}>
                          {(() => {
                            const docRegex = /<pulso-doc\s+id="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/pulso-doc>/i;
                            const docMatch = msg.text.match(docRegex);
                            let displayText = msg.text;
                            let artifactData = null;
                            if (docMatch) {
                              artifactData = { id: docMatch[1], title: docMatch[2], content: docMatch[3].trim(), contextId: msg.contextId || undefined };
                              displayText = msg.text.replace(docRegex, '').trim();
                            }
                            
                            return (
                              <div className="flex flex-col gap-3">
                                {displayText && <MessageRenderer text={displayText} sender={msg.sender} />}
                                {artifactData && (
                                  <button
                                    onClick={() => {
                                      setActiveMesaArtifact(artifactData);
                                      setIsMesaOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all w-fit cursor-pointer outline-none group text-left"
                                  >
                                    <div className="p-2 bg-black/40 rounded-lg group-hover:bg-black/60 transition-colors">
                                      <FileText size={16} className="text-white/70" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Abrir Mesa</span>
                                      <span className="text-sm font-medium text-white">{artifactData.title}</span>
                                    </div>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
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

                      {/* User Message Timestamp + Reply button */}
                      {!isLotus && msg.sender !== 'system' && (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setReplyTo({ id: msg.id, sender: msg.sender, text: msg.text })}
                            className="text-[#fbf9f5]/30 hover:text-white/70 transition-colors bg-transparent border-none cursor-pointer outline-none"
                            title="Responder"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 17 4 12 9 7" />
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                          </button>
                          <span className="text-[9px] text-[#fbf9f5]/40 select-none lowercase">
                            {formatMessageTimestamp(msg.timestamp)}
                          </span>
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
                          onReply={(m) => setReplyTo({ id: m.id, sender: m.sender, text: m.text })}
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
          
        </div>
      )}

        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#b8283e] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 pulso-transition ${
          showAttachmentToast ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4 pointer-events-none'
        }`}>
          <Activity size={16} className="animate-pulse" />
          <span className="text-xs font-semibold tracking-widest uppercase">função em desenvolvimento</span>
        </div>
      </main>
      <ArcaDrawer isOpen={isArcaOpen} onClose={() => setIsArcaOpen(false)} contextId={activeContextNode?.contextId} />


      {isEngineeringActive && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
          <button 
            onClick={() => setIsEngineeringActive(false)}
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors text-xs font-mono tracking-widest cursor-pointer bg-transparent border-none outline-none"
          >
            [ fechar ]
          </button>
          
          <div className="w-full max-w-2xl flex flex-col h-[70vh] border border-white/10 bg-black/50 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="flex-1 overflow-y-auto p-6 font-mono text-[10px] sm:text-[11px] text-[#00ffcc]/80 space-y-2 leading-relaxed">
              {engineeringLogs.length === 0 ? (
                <div className="text-white/30 text-center mt-20 animate-pulse">
                  [ antigravity terminal aguardando instruções ]
                </div>
              ) : (
                engineeringLogs.map((log, i) => (
                  <div key={i} className="break-words">{log}</div>
                ))
              )}
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!engineeringInput.trim()) return;
                const cmd = engineeringInput;
                setEngineeringInput('');
                setEngineeringLogs(prev => [...prev, `> agy ${cmd}`]);
                await localActions.runAntigravityStream(cmd);
              }}
              className="p-4 border-t border-white/10 bg-black/80 flex items-center gap-3"
            >
              <span className="text-[#00ffcc] font-mono text-sm">~</span>
              <input 
                type="text" 
                value={engineeringInput}
                onChange={(e) => setEngineeringInput(e.target.value)}
                placeholder="Ex: run --task 'mude a cor do botão'"
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs placeholder:text-white/30"
                autoFocus
              />
              <button type="submit" className="text-[#00ffcc]/50 hover:text-[#00ffcc] transition-colors text-xs font-mono uppercase cursor-pointer bg-transparent border-none">
                [ enviar ]
              </button>
            </form>
          </div>
        </div>
      )}

      
          {/* Mesa Panel (Split Screen) - Global Right Half */}
          {isMesaOpen && activeMesaArtifact && (
            <div className={`fixed top-20 md:top-24 right-0 md:right-8 bottom-4 z-50 transition-all duration-500 ease-in-out pointer-events-auto flex flex-col ${
              windowWidth < 768 
                ? `left-0 px-4 w-full ${isMesaCollapsed ? 'transform translate-x-full pointer-events-none' : ''}` 
                : `w-[calc(50vw-2rem)] md:w-[calc(50vw-3rem)] ${isMesaCollapsed ? 'transform translate-x-[calc(100%-12px)] md:translate-x-[calc(100%-16px)]' : ''}`
            }`}>
              <div className="w-full h-full overflow-hidden">
                <MesaPanel
                  isOpen={isMesaOpen}
                  onClose={() => setIsMesaOpen(false)}
                  artifact={activeMesaArtifact}
                  onSave={async (id, content) => {
                    setActiveMesaArtifact(prev => prev ? { ...prev, content } : null);
                  }}
                  isCollapsed={isMesaCollapsed}
                  onToggleCollapse={() => setIsMesaCollapsed(!isMesaCollapsed)}
                />
              </div>
            </div>
          )}

          {isMesaOpen && isMesaCollapsed && activeMesaArtifact && (
            <button
              onClick={() => setIsMesaCollapsed(false)}
              className="fixed right-0 top-1/2 -translate-y-1/2 z-[70] px-2 py-3 bg-[#b8283e] hover:bg-[#b8283e]/80 border-l border-y border-white/20 text-[9px] uppercase tracking-widest text-white rounded-l-xl cursor-pointer shadow-2xl transition-all select-none animate-fade-in flex items-center gap-1"
            >
              <span>‹</span>
              <span className="writing-mode-vertical uppercase [writing-mode:vertical-lr] tracking-[0.25em]">mesa</span>
            </button>
          )}

<footer
        className={`fixed bottom-0 left-1/2 w-full max-w-xl flex flex-col items-center z-30 select-none max-h-[450px] gap-3 pb-6 md:pb-8 px-4 md:px-0 ${
        presenceMode ? 'pulso-hidden-center' : 'pulso-visible'
      }`}
        style={{
          transform: (!isAtelieActive && !isEstudioActive && isMesaOpen && !isMesaCollapsed)
            ? 'translate(calc(-50% - 22vw + 1.5rem), 0)'
            : 'translate(-50%, 0)',
          transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        
        {activeContextNode && (
          <div className="w-full flex items-center justify-center gap-3 mb-0.5 animate-fade-in select-none">
            <span className="text-[9px] text-[#fbf9f5]/25 tracking-widest uppercase font-mono font-light">
              [ contexto ativo: {activeContextNode.label} ]
            </span>
            {isAtelieActive && (
              <button
                onClick={() => setShowAtelieChatHistory(!showAtelieChatHistory)}
                className="text-[9px] text-[#fbf9f5]/40 hover:text-white transition-colors font-mono tracking-widest bg-transparent border-none outline-none cursor-pointer"
                title={showAtelieChatHistory ? 'Ocultar Histórico' : 'Exibir Histórico'}
              >
                [ {showAtelieChatHistory ? '↓' : '↑'} ]
              </button>
            )}
          </div>
        )}

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
                          {fileInfo.progress === 0 ? 'enviando...' : `enviando... ${fileInfo.progress}%`}
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

        {/* Pending Attachments Tray — staged files waiting to be sent */}
        {pendingAttachments.length > 0 && (
          <div className="w-full flex flex-wrap gap-2 px-1 py-2 border-b border-white/10">
            {pendingAttachments.map(att => (
              <div key={att.id} className="relative flex flex-col items-center gap-1 group">
                {att.type === 'image' ? (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/15 bg-white/5 relative">
                    <img src={att.localUrl} alt={att.name} className="w-full h-full object-cover" />
                    {att.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-[9px] font-mono text-white">{att.progress}%</span>
                      </div>
                    )}
                    {att.status === 'done' && (
                      <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                    {att.status === 'error' && (
                      <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                        <span className="text-[9px] text-red-300">erro</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg max-w-[120px]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50 shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                    <span className="text-[9px] text-white/60 truncate font-light">{att.name}</span>
                    {att.status === 'uploading' && <span className="text-[8px] text-[#b8283e] shrink-0">{att.progress}%</span>}
                    {att.status === 'done' && <span className="text-[8px] text-emerald-400 shrink-0">✓</span>}
                  </div>
                )}
                <button
                  onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== att.id))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 border border-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <svg width="6" height="6" viewBox="0 0 12 12" fill="none"><line x1="2" y1="2" x2="10" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quote/Reply preview bar — sits above the input row, full width */}
        {replyTo && (
          <div className="w-full flex items-start gap-2 px-1 py-2 border-b border-white/10 bg-transparent">
            <div className="flex-1 border-l-2 border-white/25 pl-2.5">
              <span className="block text-[8px] tracking-widest uppercase text-white/35 font-medium mb-0.5 select-none">
                respondendo {replyTo.sender === 'lotus' ? 'lótus' : 'fê'}
              </span>
              <span className="block text-[10px] text-[#fbf9f5]/50 font-light leading-snug line-clamp-1">
                {replyTo.text.slice(0, 120)}{replyTo.text.length > 120 ? '…' : ''}
              </span>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-white/30 hover:text-white/70 transition-colors bg-transparent border-none cursor-pointer outline-none mt-0.5 shrink-0"
              title="Cancelar resposta"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="w-full flex items-center gap-1.5 sm:gap-3.5 bg-transparent border-b border-white/20 focus-within:border-white transition-colors py-2 px-1 relative">
          {(voiceState === 'recording_once' || voiceState === 'transcribing') && (
            <div 
              className="absolute inset-0 blur-md pointer-events-none"
              style={{
                background: voiceState === 'transcribing'
                  ? 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.03) 65%, transparent 100%)'
                  : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 65%, transparent 100%)',
                animation: voiceState === 'transcribing'
                  ? 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            />
          )}

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
              className="p-1.5 text-[#fbf9f5]/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
              title="Anexar arquivos"
            >
              <Paperclip size={14} strokeWidth={1.5} />
            </button>
            
            {isAttachmentMenuOpen && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-[70] bg-[#0c0c0c]/76 backdrop-blur-xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col justify-end text-left animate-fade-in"
                onClick={() => setIsAttachmentMenuOpen(false)}
              >
                <div className="flex flex-col gap-7 w-full max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[9px] font-light tracking-[0.24em] text-[#fbf9f5]/35 uppercase">anexar</span>
                    <button
                      onClick={() => setIsAttachmentMenuOpen(false)}
                      className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center"
                    >
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-6">
                    <button
                      onClick={() => { fileInputRef.current?.setAttribute('accept', '*'); fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <FileText size={12} strokeWidth={1.5} />
                      <span>arquivos</span>
                    </button>
                    <button
                      onClick={() => { cameraInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Camera size={12} strokeWidth={1.5} />
                      <span>câmera</span>
                    </button>
                    <button
                      onClick={() => { fileInputRef.current?.setAttribute('accept', 'audio/*'); fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                      className="flex items-center gap-2.5 py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.16em] uppercase font-sans transition-colors cursor-pointer text-[#fbf9f5]/35 hover:text-white/85"
                    >
                      <Volume2 size={12} strokeWidth={1.5} />
                      <span>áudio</span>
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>

        {/* Quote preview bar was moved above the input row — removed from here */}

          {/* Mapeamento de status físico do canal cognitivo ativo */}
          {(() => {
            const activeSession = sessions.find(s => s.contextId === activeContextNode.contextId);
            // Fallback 'ready': se a sessão não está no array local ainda, não bloqueia o input
            const runtimeStatus = activeSession?.runtimeStatus || 'ready';
            const errorMessage = activeSession?.errorMessage || '';
            
            let placeholderText = "";
            let isBlocked = false;

            if (runtimeStatus === 'bootstrapping') {
              placeholderText = "Lótus ativando canal cognitivo...";
              isBlocked = true;
            } else if (runtimeStatus === 'migrating') {
              placeholderText = "Importando histórico do canal cognitivo...";
              isBlocked = true;
            } else if (runtimeStatus === 'error') {
              // Em caso de erro, avisa mas não bloqueia — permite reenviar
              placeholderText = `canal com instabilidade — pode tentar enviar`;
              isBlocked = false;
            } else if (runtimeStatus === 'disabled') {
              placeholderText = "Canal cognitivo desativado.";
              isBlocked = true;
            }

            return (
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (isBlocked) {
                    e.preventDefault();
                    return;
                  }
                  if (e.key === 'Enter') {
                    const isMobileDevice = typeof window !== 'undefined' && (
                      window.matchMedia('(max-width: 768px)').matches || 
                      window.matchMedia('(pointer: coarse)').matches
                    );
                    
                    if (isMobileDevice) {
                      return;
                    }
                    
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }
                }}
                onPaste={(e) => {
                  if (isBlocked) {
                    e.preventDefault();
                    return;
                  }
                  const cd = e.clipboardData;
                  if (cd.files && cd.files.length > 0) {
                    e.preventDefault();
                    handleAttachFiles(cd.files);
                    return;
                  }
                  if (cd.items) {
                    const imageItems: File[] = [];
                    for (let i = 0; i < cd.items.length; i++) {
                      const item = cd.items[i];
                      if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) imageItems.push(file);
                      }
                    }
                    if (imageItems.length > 0) {
                      e.preventDefault();
                      const dt = new DataTransfer();
                      imageItems.forEach(f => dt.items.add(f));
                      handleAttachFiles(dt.files);
                    }
                  }
                }}
                placeholder={placeholderText}
                disabled={isBlocked || voiceState === 'transcribing'}
                rows={1}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 bg-transparent border-none text-sm font-light text-white placeholder:text-white/30 outline-none disabled:opacity-40 resize-none min-h-[36px] max-h-[212px] py-1.5 overflow-y-auto no-scrollbar"
              />
            );
          })()}

          {/* Indicador de Compromisso Ativo Minimalista */}
          {contextStatesMap[activeContextNode.contextId]?.strongState?.activeCommitment?.status === 'pending' && (
            <div 
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-[0.2em] text-[#fbf9f5]/30 select-none cursor-help hover:text-[#f59e0b]/60 transition-colors"
              title={`Compromisso ativo: ${contextStatesMap[activeContextNode.contextId].strongState.activeCommitment.description}`}
            >
              <span className="text-[#f59e0b] animate-ping text-[6px]">●</span>
              <span className="hidden md:inline max-w-[120px] truncate uppercase">compromisso</span>
            </div>
          )}

          <button
            onClick={toggleRecordingOnce}
            disabled={false}
            className={`p-1.5 rounded-full transition-all duration-300 cursor-pointer border-none outline-none bg-transparent ${
              voiceMode === 'recording_once' 
                ? 'text-[#b8283e] bg-white scale-105 shadow-md' 
                : 'text-[#fbf9f5]/60 hover:text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={voiceMode === 'recording_once' ? 'gravando... clique para parar' : 'capturar áudio'}
          >
            {voiceMode === 'recording_once' ? <Mic size={14} strokeWidth={1.5} className="animate-pulse" /> : <Mic size={14} strokeWidth={1.5} />}
          </button>

          {voiceMode === 'recording_once' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-[8px] tabular-nums tracking-[0.12em] text-[#fbf9f5]/45 select-none" aria-live="polite">
                {`${Math.floor(recordingElapsedSeconds / 60)}:${String(recordingElapsedSeconds % 60).padStart(2, '0')} / 7:00`}
              </span>
              <button
                onClick={cancelRecordingOnce}
                className="p-1 text-[#fbf9f5]/40 hover:text-[#b8283e] transition-colors bg-transparent border-none cursor-pointer outline-none"
                title="cancelar gravação"
              >
                <X size={13} strokeWidth={1.5} />
              </button>
              <button
                onClick={sendRecordingOnceDirect}
                className="p-1 text-[#fbf9f5]/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
                title="parar e enviar direto"
              >
                <Send size={13} strokeWidth={1.5} />
              </button>
            </div>
          )}

          <button
            onClick={toggleMeetingRecording}
            className={`p-1.5 transition-all duration-300 bg-transparent border-none cursor-pointer outline-none ${voiceMode === 'recording_meeting' ? 'opacity-100 drop-shadow-[0_0_8px_rgba(184,40,62,0.6)] animate-pulse' : 'opacity-30 hover:opacity-100'}`}
            title="Gravar Reunião"
          >
            <Circle size={10} strokeWidth={3} className={voiceMode === 'recording_meeting' ? "text-[#b8283e]" : "text-[#fbf9f5]"} fill={voiceMode === 'recording_meeting' ? "currentColor" : "none"} />
          </button>

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim()}
            className="p-1.5 text-[#fbf9f5]/60 hover:text-white disabled:opacity-20 disabled:hover:text-[#fbf9f5]/60 transition-colors bg-transparent border-none cursor-pointer outline-none"
          >
            <Send size={14} strokeWidth={1.5} />
          </button>
        </div>
      </footer>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0c0c]/76 backdrop-blur-xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col text-left md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="flex flex-col gap-7 w-full max-w-[240px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between select-none">
              <span className="text-[9px] font-light tracking-[0.24em] text-[#fbf9f5]/35 uppercase">conversas</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col gap-6 overflow-y-auto overscroll-contain no-scrollbar max-h-[calc(100dvh-10rem)]">
              {dynamicAreas.map((area) => {
                const areaId = area.id;
                const areaName = area.name || AREA_NAMES[areaId] || areaId.replace('area_', '');
                const areaContexts = allContextNodes.filter(n => n.areaId === areaId);
                const isAreaActive = activeAreaId === areaId;
                const isExpanded = activeMobileAreaId === areaId;
                const hasUnreadInArea = areaContexts.some(n => !!unreadContexts[n.contextId]);
                
                return (
                  <div key={areaId} className="flex flex-col gap-2.5">
                    <div
                      onClick={() => {
                        // accordion reativo restrito: only one area open at a time
                        setActiveMobileAreaId(isExpanded ? null : areaId);
                      }}
                      className="flex items-center justify-between cursor-pointer py-0.5 group/mobile-area select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-sm font-mono ${isAreaActive ? 'text-white' : hasUnreadInArea ? 'pulso-unread animate-pulse' : 'text-[#fbf9f5]/25'}`}>
                          {getAreaIcon({ id: areaId, name: areaName })}
                        </span>
                        <span className={`text-[9px] tracking-[0.16em] uppercase font-sans ${isAreaActive ? 'text-white/85' : 'text-[#fbf9f5]/35'}`}>
                          {areaName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAreaConfigPanelAreaId(areaId);
                            setIsMobileMenuOpen(false);
                          }}
                          className="text-[#fbf9f5]/25 hover:text-white/70 transition-colors bg-transparent border-none outline-none cursor-pointer flex items-center justify-center"
                          title={`Configurar área ${areaName}`}
                        >
                          <Settings size={12} strokeWidth={1.5} />
                        </button>
                        <span className="text-[#fbf9f5]/25 group-hover/mobile-area:text-[#fbf9f5]/50 transition-colors">
                          {isExpanded ? <ChevronDown size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="flex flex-col gap-3 pl-6 pb-1 animate-fade-in">
                        {areaContexts.map((ctx) => {
                          const isContextActive = activeContextNode.contextId === ctx.contextId;
                          const isUnread = !!unreadContexts[ctx.contextId];
                          
                          return (
                            <button
                              key={ctx.contextId} 
                              className={`w-full py-0.5 text-left bg-transparent border-none outline-none text-[9px] tracking-[0.14em] uppercase font-sans transition-colors truncate ${
                                isContextActive ? 'text-white/90' : isUnread ? 'pulso-unread animate-pulse' : 'text-[#fbf9f5]/35'
                              }`}
                              onClick={() => {
                                setActiveContextNode(ctx);
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              {ctx.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {areaConfigPanelAreaId && (
        <AreaConfigPanel
          areaId={areaConfigPanelAreaId}
          areaName={
            dynamicAreas.find(a => a.id === areaConfigPanelAreaId)?.name
            || AREA_NAMES[areaConfigPanelAreaId]
            || areaConfigPanelAreaId.replace('area_', '')
          }
          onClose={() => setAreaConfigPanelAreaId(null)}
        />
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
                  <option value="local_kokoro_sidecar" className="bg-[#121212]">sidecar nativo (pf_dora)</option>
                  <option value="kokoro_http" className="bg-[#121212]">kokoro http (oficial)</option>
                  <option value="local_kokoro" className="bg-[#121212]">kokoro-fastapi (beta)</option>
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
                      value={['pf_dora', 'pf_dora(0.70)+af_bella(0.30)', 'pf_dora(0.70)+af_sarah(0.30)'].includes(ttsPrefs.voiceName) ? ttsPrefs.voiceName : ttsPrefs.voiceName === '' ? 'pf_dora(0.70)+af_bella(0.30)' : 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newVoiceName = val === 'custom' ? '' : val;
                        const newPrefs = { ...ttsPrefs, voiceName: newVoiceName };
                        setTtsPrefs(newPrefs);
                        ttsAdapter.updatePreferences(newPrefs);
                      }}
                      className="pulso-select w-full"
                    >
                      <option value="pf_dora(0.70)+af_bella(0.30)" className="bg-[#121212]">lótus híbrida bella (fem pt-br + us - recomendada)</option>
                      <option value="pf_dora(0.70)+af_sarah(0.30)" className="bg-[#121212]">lótus híbrida sarah (fem pt-br + us - samantha style)</option>
                      <option value="pf_dora" className="bg-[#121212]">pf_dora (fem pt-br - padrão pura)</option>
                      <option value="custom" className="bg-[#121212]">outra voz (escrever abaixo)...</option>
                    </select>
                    <span className="text-[8px] text-[#fbf9f5]/40 leading-relaxed block mt-1">
                      nota: vozes híbridas misturam a fonética pt-br com a expressividade us da Kokoro.
                    </span>
                  </div>

                  {!['pf_dora', 'pf_dora(0.70)+af_bella(0.30)', 'pf_dora(0.70)+af_sarah(0.30)'].includes(ttsPrefs.voiceName) && ttsPrefs.voiceName !== '' && (
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
                    "oi, fê. esta é uma voz de teste da lótus rodando na vps. o setup do next.js e o deploy foram concluídos.",
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
