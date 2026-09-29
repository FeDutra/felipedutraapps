'use client';

import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { formatSiteConversationDate } from '../../services/siteConversationHelpers';
import type {
  SiteConversationFilter,
  SiteConversationMetrics,
  SiteConversationSummary
} from '../../types/siteConversation.types';

interface Props {
  conversations: SiteConversationSummary[];
  selectedId: string | null;
  loading: boolean;
  metrics: SiteConversationMetrics;
  filter: SiteConversationFilter;
  search: string;
  onSelect: (conversation: SiteConversationSummary) => void;
  onFilterChange: (filter: SiteConversationFilter) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
}

const FILTERS: Array<{ id: SiteConversationFilter; label: string; metric: keyof SiteConversationMetrics }> = [
  { id: 'all', label: 'Todos', metric: 'total' },
  { id: 'unread', label: 'Novos', metric: 'unread' },
  { id: 'active', label: 'Ativos', metric: 'active' },
  { id: 'error', label: 'Falhas', metric: 'errors' }
];

function ConversationRow({
  conversation,
  selected,
  onSelect
}: {
  conversation: SiteConversationSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left py-5 border-b border-white/10 transition-colors outline-none focus-visible:bg-white/[0.06] ${
        selected ? 'text-white' : 'text-[#fbf9f5]/72 hover:text-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-label={conversation.unread ? 'Conversa nova' : 'Conversa lida'}
          className={`mt-2 block h-1.5 w-1.5 rounded-full shrink-0 ${
            conversation.unread ? 'bg-white' : 'bg-white/15'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className={`truncate text-sm ${conversation.unread ? 'font-medium' : 'font-light'}`}>
              {conversation.visitorName || 'Visitante'}
            </p>
            <span className="font-mono text-[8px] tracking-wide text-[#fbf9f5]/35 whitespace-nowrap">
              {formatSiteConversationDate(conversation.lastMessageAt)}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[9px] tracking-wide text-[#fbf9f5]/35">
            {conversation.visitorEmail || 'e-mail não informado'}
          </p>
          <p className="mt-3 line-clamp-2 text-xs font-light leading-relaxed text-[#fbf9f5]/55">
            {conversation.preview || 'Conversa iniciada no site.'}
          </p>
          <div className="mt-3 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.18em] text-[#fbf9f5]/28">
            <span>{conversation.totalMessages} {conversation.totalMessages === 1 ? 'envio' : 'envios'}</span>
            <span aria-hidden="true">·</span>
            <span className={conversation.latestRequestStatus === 'error' ? 'text-rose-300/70' : ''}>
              {conversation.latestRequestStatus === 'error' ? 'falha' : conversation.status === 'blocked' ? 'bloqueada' : 'ativa'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function SiteConversationList({
  conversations,
  selectedId,
  loading,
  metrics,
  filter,
  search,
  onSelect,
  onFilterChange,
  onSearchChange,
  onRefresh
}: Props) {
  return (
    <section className="min-w-0 lg:pr-8 lg:border-r lg:border-white/10">
      <div className="grid grid-cols-4 gap-4 pb-6 border-b border-white/10">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={`text-left transition-opacity ${filter === item.id ? 'opacity-100' : 'opacity-45 hover:opacity-75'}`}
          >
            <span className="block text-xl sm:text-2xl font-light tabular-nums">
              {metrics[item.metric]}
            </span>
            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.2em]">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 py-4 border-b border-white/10">
        <Search size={13} strokeWidth={1.5} className="text-[#fbf9f5]/35 shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="nome, e-mail ou assunto"
          className="min-w-0 flex-1 bg-transparent border-0 outline-none text-xs font-light text-white placeholder:text-[#fbf9f5]/28"
        />
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Atualizar conversas"
          className="p-1 text-[#fbf9f5]/35 hover:text-white transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div aria-busy={loading}>
        {loading && conversations.length === 0 ? (
          <div className="py-16 font-mono text-[9px] uppercase tracking-[0.2em] text-[#fbf9f5]/30">
            Sintonizando os fios…
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16">
            <p className="text-sm font-light text-[#fbf9f5]/55">Nenhum fio encontrado.</p>
            <p className="mt-2 max-w-sm text-xs font-light leading-relaxed text-[#fbf9f5]/30">
              As conversas iniciadas em felipedutra.com aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              selected={selectedId === conversation.id}
              onSelect={() => onSelect(conversation)}
            />
          ))
        )}
      </div>
    </section>
  );
}
