'use client';
import React from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase/client';
import { firestorePaths } from '../services/firestorePaths';
import { X, Send } from 'lucide-react';
import type { PulsoContextNode } from '../types/pulso.types';

interface PaneMessage {
  id: string;
  sender: 'user' | 'lotus';
  text: string;
  timestamp: Date;
}

interface SecondaryChatPaneProps {
  contextNode: PulsoContextNode;
  onClose: () => void;
  onSend: (text: string, targetContextNode: PulsoContextNode) => void;
  isTyping: boolean;
  onFocus: () => void;
}

export const SecondaryChatPane: React.FC<SecondaryChatPaneProps> = ({ contextNode, onClose, onSend, isTyping, onFocus }) => {
  const [messages, setMessages] = React.useState<PaneMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, firestorePaths.requests()),
      where('requestType', 'in', ['conversation_command', 'local_interaction']),
      where('contextId', '==', contextNode.contextId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: PaneMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data: any = docSnap.data();
        if (data.archived === true) return;
        const timestamp = data.requestedAt?.toDate ? data.requestedAt.toDate() : new Date();
        if (data.input || data.rawInput) {
          items.push({ id: `user-${docSnap.id}`, sender: 'user', text: data.input || data.rawInput, timestamp });
        }
        const responseText = data.openclawResult?.responseText;
        if (responseText?.trim()) {
          items.push({ id: `lotus-${docSnap.id}`, sender: 'lotus', text: responseText, timestamp });
        }
      });
      items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setMessages(items);
    });
    return () => unsubscribe();
  }, [contextNode.contextId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text, contextNode);
    setDraft('');
  };

  return (
    <div
      className="flex flex-col h-full w-full bg-black/25 border-l border-white/10"
      onFocus={onFocus}
      onClick={onFocus}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-[9px] tracking-[0.2em] uppercase font-sans text-[#fbf9f5]/70 truncate">{contextNode.label}</span>
        <button
          onClick={onClose}
          className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center shrink-0"
          title="Fechar painel"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === 'lotus' ? 'justify-start' : 'justify-end'}`}>
            <div className="max-w-[85%] space-y-1">
              <span className={`block text-[8px] tracking-widest lowercase select-none ${msg.sender === 'lotus' ? 'text-white font-bold opacity-90' : 'text-[#fbf9f5]/50 font-light'}`}>
                {msg.sender === 'lotus' ? 'lótus' : 'fê'}
              </span>
              <div className="text-xs leading-relaxed font-light text-[#fbf9f5]/90 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <span className="text-[9px] tracking-widest uppercase text-[#fbf9f5]/35 animate-pulse">pensando...</span>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/10 shrink-0">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="escrever aqui..."
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-xs text-[#fbf9f5]/90 placeholder:text-[#fbf9f5]/25 max-h-28"
        />
        <button
          onClick={handleSubmit}
          disabled={!draft.trim()}
          className="p-1.5 text-[#fbf9f5]/60 hover:text-white disabled:opacity-20 transition-colors bg-transparent border-none cursor-pointer outline-none shrink-0"
        >
          <Send size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default SecondaryChatPane;
