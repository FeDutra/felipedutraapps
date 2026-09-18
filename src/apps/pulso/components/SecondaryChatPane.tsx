'use client';
import React from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase/client';
import { firestorePaths } from '../services/firestorePaths';
import { X } from 'lucide-react';
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
  isFocused: boolean;
  onFocus: () => void;
}

// Mesma identidade visual do chat principal — sem moldura, sem cabeçalho de
// widget, sem input próprio. É a mesma sessão, só ao lado. O input
// permanece único, fixo embaixo ao centro; o foco decide pra qual painel ele
// escreve.
export const SecondaryChatPane: React.FC<SecondaryChatPaneProps> = ({ contextNode, onClose, isFocused, onFocus }) => {
  const [messages, setMessages] = React.useState<PaneMessage[]>([]);
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

  return (
    <div
      className={`flex flex-col h-full w-full transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-80'}`}
      onClick={onFocus}
    >
      <div className="flex items-center justify-between px-2 pb-2 shrink-0">
        <span className={`text-[9px] tracking-[0.2em] uppercase font-sans truncate transition-colors ${isFocused ? 'text-white/85' : 'text-[#fbf9f5]/40'}`}>
          {contextNode.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-[#fbf9f5]/30 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center shrink-0"
          title="Fechar painel"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar chat-fade-mask px-2 space-y-8">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === 'lotus' ? 'justify-start' : 'justify-end'} animate-fade-in`}>
            <div className="max-w-[85%] space-y-1">
              <span className={`block text-[9px] tracking-widest lowercase select-none ${msg.sender === 'lotus' ? 'text-white font-bold opacity-90' : 'text-[#fbf9f5]/50 font-light'}`}>
                {msg.sender === 'lotus' ? 'lótus' : 'fê'}
              </span>
              <div className="text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecondaryChatPane;
