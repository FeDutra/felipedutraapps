'use client';
import React from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase/client';
import { firestorePaths } from '../services/firestorePaths';
import { X } from 'lucide-react';
import type { PulsoContextNode } from '../types/pulso.types';
import type { MesaArtifact } from './MesaPanel';
import { PulsoMessageContent } from './chat/PulsoMessageContent';
import { MessageActions, type Message as RenderMessage } from './chat/MessageRenderer';
import { MessageAttachments, type RenderableAttachment } from './chat/MessageAttachments';

interface PaneMessage extends RenderMessage {
  sender: 'user' | 'lotus';
  isProgressUpdate?: boolean;
  attachments?: RenderableAttachment[];
}

interface SecondaryChatPaneProps {
  contextNode: PulsoContextNode;
  areaIcon: React.ReactNode;
  onClose: () => void;
  isFocused: boolean;
  onFocus: (focusComposer?: boolean) => void;
  onOpenMesa: (artifact: MesaArtifact) => void;
  playingMsgId: string | null;
  playingState: 'stopped' | 'preparing' | 'playing' | 'error/fallback';
  onHearMessage: (message: RenderMessage) => void;
  onCopyMessage: (message: RenderMessage) => void;
}

const TECHNICAL_HISTORY_OMISSION = /^\s*\[chat\.history omitted: message too large\]\s*$/i;

function toRenderableConversationText(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return TECHNICAL_HISTORY_OMISSION.test(text)
    ? 'Esta resposta ficou grande demais para ser carregada integralmente neste histórico.'
    : text;
}

// Mesma identidade visual do chat principal — sem moldura, sem cabeçalho de
// widget, sem input próprio. É a mesma sessão, só ao lado. O input
// permanece único, fixo embaixo ao centro; o foco decide pra qual painel ele
// escreve.
const normalizeAttachments = (value: unknown): RenderableAttachment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((attachment): attachment is Record<string, unknown> => Boolean(
      attachment && typeof attachment === 'object' && typeof (attachment as Record<string, unknown>).url === 'string'
    ))
    .map((attachment, index) => {
      const name = String(attachment.name || attachment.fileName || `arquivo-${index + 1}`);
      return {
        id: String(attachment.id || `attachment-${index}-${name}`),
        name,
        type: typeof attachment.type === 'string' ? attachment.type : undefined,
        mimeType: String(attachment.mimeType || attachment.mime || 'application/octet-stream'),
        url: String(attachment.url),
        sizeBytes: Number(attachment.sizeBytes || attachment.size || 0) || undefined,
      };
    });
};

export const SecondaryChatPane: React.FC<SecondaryChatPaneProps> = ({
  contextNode,
  areaIcon,
  onClose,
  isFocused,
  onFocus,
  onOpenMesa,
  playingMsgId,
  playingState,
  onHearMessage,
  onCopyMessage,
}) => {
  const [messages, setMessages] = React.useState<PaneMessage[]>([]);
  const [isPending, setIsPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, firestorePaths.requests()),
      where('requestType', 'in', ['conversation_command', 'active_message', 'local_interaction', 'progress_update']),
      where('contextId', '==', contextNode.contextId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: PaneMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.archived === true) return;
        const timestamp = data.requestedAt?.toDate ? data.requestedAt.toDate() : new Date();
        if (data.requestType !== 'active_message' && data.requestType !== 'progress_update' && (data.input || data.rawInput)) {
          items.push({
            id: `user-${docSnap.id}`,
            sender: 'user',
            text: data.input || data.rawInput,
            timestamp,
            attachments: normalizeAttachments(data.attachments),
          });
        }
        if (data.requestType === 'progress_update' && (data.text || data.message)) {
          items.push({
            id: `progress-${docSnap.id}`,
            sender: 'lotus',
            text: data.text || data.message,
            timestamp,
            isProgressUpdate: true,
          });
        }
        const responseText = toRenderableConversationText(data.openclawResult?.responseText);
        const accepted = ['success', 'proposal_ready', 'needs_approval', 'needs_clarification'].includes(data.status || '');
        const responseAttachments = normalizeAttachments(
          data.openclawResult?.attachments || data.responseAttachments || (data.requestType === 'active_message' ? data.attachments : undefined)
        );
        if (accepted && (responseText?.trim() || responseAttachments.length > 0)) {
          const responseTimestamp = data.updatedAt?.toDate ? data.updatedAt.toDate() : timestamp;
          items.push({
            id: `lotus-${docSnap.id}`,
            sender: 'lotus',
            text: responseText,
            timestamp: responseTimestamp,
            openclawResult: data.openclawResult,
            attachments: responseAttachments,
          });
        }
      });
      items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setMessages(items);

      const latestRequest = [...snapshot.docs]
        .map((docSnap) => docSnap.data())
        .filter((data) => data.requestType !== 'progress_update')
        .sort((a, b) => {
          const aTime = a.requestedAt?.toMillis?.() || a.clientCreatedAtMs || 0;
          const bTime = b.requestedAt?.toMillis?.() || b.clientCreatedAtMs || 0;
          return bTime - aTime;
        })[0];
      setIsPending(Boolean(latestRequest && !['success', 'completed', 'proposal_ready', 'needs_approval', 'needs_clarification', 'error', 'timeout', 'failed'].includes(latestRequest.status || '')));
    });
    return () => unsubscribe();
  }, [contextNode.contextId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      className={`pulso-split-pane relative h-full w-full overflow-hidden transition-opacity duration-300 ${isFocused ? 'pulso-split-pane-active opacity-100' : 'opacity-80'}`}
      data-context-id={contextNode.contextId}
      data-focused={isFocused ? 'true' : 'false'}
      onPointerDown={(event) => {
        // O compositor é único. Marca o destino antes de qualquer clique
        // interno para que o próximo caractere nunca fique associado ao painel
        // que estava focado antes.
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        onFocus(!target.closest('[data-message-content], [data-message-action]'));
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-10 z-20 flex items-center justify-between px-6 pointer-events-none animate-fade-in">
        <span className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-mono shrink-0 transition-colors ${isFocused ? 'text-white/85' : 'text-[#fbf9f5]/40'}`}>
            {areaIcon}
          </span>
          <span className={`text-[9px] tracking-[0.2em] uppercase font-sans truncate transition-colors ${isFocused ? 'text-white/85' : 'text-[#fbf9f5]/40'}`}>
            {contextNode.label}
          </span>
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-[#fbf9f5]/30 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center shrink-0 pointer-events-auto"
          title="Fechar painel"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>

      <div ref={scrollRef} className="absolute inset-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto no-scrollbar chat-fade-mask px-4 md:px-6 py-6 pt-12 space-y-8">
        {messages.map((msg) => msg.isProgressUpdate ? (
          <div key={msg.id} className="flex min-w-0 w-full max-w-full justify-start animate-fade-in py-1">
            <div className="min-w-0 w-full max-w-[85%] border-l border-white/10 pl-3 flex items-start gap-2.5 text-xs text-[#fbf9f5]/40 font-light leading-relaxed">
              <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-[#fbf9f5]/30" />
              <span>{msg.text}</span>
            </div>
          </div>
        ) : (
          <div key={msg.id} className={`group/message flex min-w-0 w-full max-w-full ${msg.sender === 'lotus' ? 'justify-start' : 'justify-end'} animate-fade-in`}>
            <div className="min-w-0 max-w-[85%] space-y-1 select-text">
              <span className={`block text-[9px] tracking-widest lowercase select-none ${msg.sender === 'lotus' ? 'text-white font-bold opacity-90' : 'text-[#fbf9f5]/50 font-light'}`}>
                {msg.sender === 'lotus' ? 'lótus' : 'fê'}
              </span>
              <div className="min-w-0 max-w-full text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 block break-words text-left select-text" style={{ overflowWrap: 'anywhere' }}>
                <PulsoMessageContent
                  text={msg.text}
                  sender={msg.sender}
                  contextId={contextNode.contextId}
                  onOpenMesa={onOpenMesa}
                />
              </div>
              <MessageAttachments attachments={msg.attachments} align={msg.sender === 'user' ? 'end' : 'start'} />
              <div data-message-action onClick={(event) => event.stopPropagation()}>
                <MessageActions
                  msg={msg}
                  playingMsgId={playingMsgId}
                  playingState={playingState}
                  onHearClick={onHearMessage}
                  onCopyText={onCopyMessage}
                />
              </div>
            </div>
          </div>
        ))}
        {isPending && (
          <div className="flex justify-start w-full animate-pulse select-none text-left">
            <div className="space-y-1">
              <span className="block text-[9px] tracking-widest text-[#fbf9f5] font-bold lowercase">lótus</span>
              <span className="text-xs font-light text-[#fbf9f5]/40">pensando...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecondaryChatPane;
