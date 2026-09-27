'use client';

import React from 'react';
import { Search, Mail, Sparkles, CheckCircle2, Clock, AlertTriangle, UserX, RefreshCw } from 'lucide-react';
import type {
  CorrespondenceSubscriberClient,
  CorrespondenceStatus,
  StatusFilterOption
} from '../../types/correspondence.types';
import { correspondenceService } from '../../services/correspondenceService';

interface Props {
  subscribers: CorrespondenceSubscriberClient[];
  filter: StatusFilterOption;
  onFilterChange: (f: StatusFilterOption) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

const FILTER_TABS: Array<{ id: StatusFilterOption; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'error', label: 'Anomalias' },
  { id: 'unsubscribed', label: 'Descadastrados' }
];

function StatusIndicator({ status, errorCode }: { status: CorrespondenceStatus; errorCode?: string | null }) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          Ativo
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-300 font-mono text-[10px] tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse opacity-80 drop-shadow-[0_0_6px_rgba(252,211,77,0.7)]" />
          Pendente
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 text-rose-400 font-mono text-[10px] tracking-widest uppercase" title={errorCode || 'Erro de entrega'}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
          Falha {errorCode ? `· ${errorCode}` : ''}
        </span>
      );
    case 'unsubscribed':
      return (
        <span className="inline-flex items-center gap-1.5 text-white/30 font-mono text-[10px] tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          Descadastrado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-white/40 font-mono text-[10px] tracking-widest uppercase">
          {status}
        </span>
      );
  }
}

function DeliveryIndicator({
  status,
  deliveredAt
}: {
  status?: string | null;
  deliveredAt?: any;
}) {
  const formattedDate = deliveredAt ? correspondenceService.formatDate(deliveredAt) : null;

  if (!status) {
    return <span className="text-[#fbf9f5]/20 font-mono text-[10px] tracking-wider">—</span>;
  }

  let label = status;
  let colorClass = 'text-white/60';

  if (status === 'welcome_sent') {
    label = 'Boas-vindas enviada';
    colorClass = 'text-emerald-400/80';
  } else if (status === 'confirmation_sent') {
    label = 'Confirmação enviada';
    colorClass = 'text-amber-300/80';
  } else if (status === 'queued' || status === 'welcome_queued') {
    label = 'Na fila';
    colorClass = 'text-blue-300/80';
  } else if (status === 'failed') {
    label = 'Falha no envio';
    colorClass = 'text-rose-400/80';
  }

  return (
    <div className="flex flex-col">
      <span className={`font-mono text-[10px] tracking-wider ${colorClass}`}>{label}</span>
      {formattedDate && (
        <span className="font-mono text-[9px] text-[#fbf9f5]/30 tracking-widest mt-0.5">
          {formattedDate}
        </span>
      )}
    </div>
  );
}

export function CorrespondenceList({
  subscribers,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  loading,
  onRefresh
}: Props) {
  const filtered = React.useMemo(() => {
    return correspondenceService.filterSubscribers(subscribers, filter, searchQuery);
  }, [subscribers, filter, searchQuery]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Search and Filters Strip - Zero Boxes, pure floating interaction */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-4 border-b border-white/5">
        {/* Filter text triggers (no generic pills) */}
        <div className="flex items-center gap-5 sm:gap-6 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          {FILTER_TABS.map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterChange(tab.id)}
                className={`bg-transparent border-none p-0 cursor-pointer font-mono text-[10px] tracking-[0.22em] uppercase transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? 'text-white font-medium drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                    : 'text-[#fbf9f5]/35 hover:text-[#fbf9f5]/75'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search input + Refresh */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 flex items-center">
            <Search
              size={13}
              strokeWidth={1.5}
              className="absolute left-0 text-[#fbf9f5]/30 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome, email ou origem..."
              className="w-full bg-transparent pl-6 pr-2 py-1.5 text-xs text-white placeholder:text-[#fbf9f5]/25 font-mono tracking-wider focus:outline-none border-b border-transparent focus:border-white/20 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 bg-transparent border-none text-[#fbf9f5]/40 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
            title="Atualizar lista"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-8 h-8 rounded-full border border-white/10 border-t-white/60 animate-spin" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#fbf9f5]/40">
            Sintonizando correspondências...
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-center">
          <Mail size={22} strokeWidth={1} className="text-[#fbf9f5]/20 mb-2" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#fbf9f5]/60">
            Nenhum registro encontrado
          </p>
          <p className="text-[11px] text-[#fbf9f5]/30 max-w-sm font-light">
            {searchQuery
              ? 'Nenhum assinante coincide com os termos buscados.'
              : 'Nenhum assinante presente sob este filtro no momento.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col w-full">
          {/* Desktop Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 pb-3 text-[9px] font-mono uppercase tracking-[0.22em] text-[#fbf9f5]/30 border-b border-white/5">
            <div className="col-span-3">Assinante</div>
            <div className="col-span-3">E-mail</div>
            <div className="col-span-1">Origem</div>
            <div className="col-span-1">Estado</div>
            <div className="col-span-2">Entrada</div>
            <div className="col-span-2">Última Entrega</div>
          </div>

          {/* List Rows */}
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {filtered.map((sub) => {
              const createdAtFormatted = correspondenceService.formatDate(sub.createdAt);
              const confirmedAtFormatted = correspondenceService.formatDate(sub.confirmedAt);

              return (
                <div
                  key={sub.id}
                  className="py-4 hover:bg-white/[0.02] transition-colors duration-200"
                >
                  {/* Desktop Layout */}
                  <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                    {/* Name */}
                    <div className="col-span-3 min-w-0">
                      <span className="text-xs font-light text-white truncate block">
                        {sub.name || <span className="text-[#fbf9f5]/25 italic">Sem nome</span>}
                      </span>
                    </div>

                    {/* Email */}
                    <div className="col-span-3 min-w-0">
                      <span className="font-mono text-[11px] text-[#fbf9f5]/75 truncate block">
                        {sub.email}
                      </span>
                    </div>

                    {/* Source */}
                    <div className="col-span-1 min-w-0">
                      <span className="font-mono text-[10px] text-[#fbf9f5]/40 truncate block uppercase tracking-wider">
                        {sub.source}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <StatusIndicator status={sub.status} errorCode={sub.errorCode} />
                    </div>

                    {/* Dates: Entry & Confirmation */}
                    <div className="col-span-2 flex flex-col">
                      <span className="font-mono text-[10px] text-[#fbf9f5]/65 tracking-wider">
                        {createdAtFormatted}
                      </span>
                      {sub.confirmedAt && (
                        <span className="font-mono text-[8px] text-emerald-400/60 tracking-widest mt-0.5">
                          Conf: {confirmedAtFormatted}
                        </span>
                      )}
                    </div>

                    {/* Delivery Status */}
                    <div className="col-span-2">
                      <DeliveryIndicator
                        status={sub.lastDeliveryStatus}
                        deliveredAt={sub.lastDeliveryAt}
                      />
                    </div>
                  </div>

                  {/* Mobile & Tablet Cardless Layout */}
                  <div className="flex lg:hidden flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-light text-white truncate">
                          {sub.name || <span className="text-[#fbf9f5]/30 italic">Sem nome</span>}
                        </p>
                        <p className="font-mono text-[11px] text-[#fbf9f5]/70 truncate mt-0.5">
                          {sub.email}
                        </p>
                      </div>
                      <StatusIndicator status={sub.status} errorCode={sub.errorCode} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] text-[#fbf9f5]/40 tracking-wider pt-1">
                      <span>Origem: <span className="text-[#fbf9f5]/70">{sub.source}</span></span>
                      <span>Entrada: <span className="text-[#fbf9f5]/70">{createdAtFormatted}</span></span>
                      {sub.lastDeliveryStatus && (
                        <span>Entrega: <span className="text-[#fbf9f5]/70">{sub.lastDeliveryStatus}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
