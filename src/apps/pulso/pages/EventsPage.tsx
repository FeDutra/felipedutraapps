'use client';

import React from 'react';
import { eventsService } from '../services/eventsService';
import { authService } from '../../../shared/services/authService';
import { ingestionService } from '../services/ingestionService';
import { PulsoEvent, IngestionEvent, OutboxStatus } from '../types/pulso.types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Terminal, Zap, Shield, AlertTriangle,
  CheckCircle2, X, Bot, Cpu, Bell, ClipboardList,
  ChevronRight, Package, Layout, Calendar
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts a human-readable title from any PulsoEvent, prioritising OpenClaw payload fields */
function resolveTitle(event: any): string {
  const p = event.payloadSnapshot || {};
  return (
    event.ocTitle ||
    p.title ||
    p.summary ||
    p.message ||
    p.topic ||
    event.ocEventType ||
    event.payloadSummary ||
    (event.eventType || 'evento').replace(/_/g, ' ')
  );
}

/** Returns the OpenClaw event_type (agent_update / task / alert / …) if available */
function resolveOcType(event: any): string | null {
  return event.ocEventType || null;
}

/** True if event came from OpenClaw ingest */
function isOpenClaw(event: any): boolean {
  return event.origin === 'openclaw' || event.actorRef === 'openclaw';
}

/** Icon per event/oc-type */
function EventIcon({ event }: { event: any }) {
  const oc = resolveOcType(event);
  const base = 'w-10 h-10 rounded-xl flex items-center justify-center border border-white/15 bg-white/5 text-[#fbf9f5] shrink-0';
  if (oc === 'alert') return <div className={base}><AlertTriangle size={16} strokeWidth={1.5} /></div>;
  if (oc === 'task')  return <div className={base}><ClipboardList size={16} strokeWidth={1.5} /></div>;
  if (oc === 'agent_update') return <div className={base}><Bot size={16} strokeWidth={1.5} /></div>;
  if (isOpenClaw(event)) return <div className={base}><Package size={16} strokeWidth={1.5} /></div>;
  return <div className={base}><Activity size={16} strokeWidth={1.5} /></div>;
}

/** Chip for outbox status */
const STATUS_CHIP: Record<string, string> = {
  pending:    'border-white/15 text-[#fbf9f5]/60 bg-white/5',
  processed:  'border-white/35 text-white bg-white/15',
  failed:     'border-white/15 text-[#fbf9f5]/55 bg-white/5',
  ignored:    'border-white/10 text-[#fbf9f5]/40 bg-white/3',
  processing: 'border-white/15 text-[#fbf9f5]/60 bg-white/5',
};

/** Chip for oc event_type */
const OC_TYPE_CHIP: Record<string, string> = {
  agent_update:  'border-white/15 text-[#fbf9f5]/70 bg-white/5',
  task:          'border-white/15 text-[#fbf9f5]/70 bg-white/5',
  alert:         'border-white/30 text-white bg-white/10 font-bold',
  decision:      'border-white/15 text-[#fbf9f5]/70 bg-white/5',
  health_signal: 'border-white/15 text-[#fbf9f5]/70 bg-white/5',
};

function Chip({ label, style }: { label: string; style?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border shrink-0 ${style || 'border-white/10 text-[#fbf9f5]/50 bg-white/5'}`}>
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<PulsoEvent[]>([]);
  const [ingestions, setIngestions] = React.useState<IngestionEvent[]>([]);
  const [filter, setFilter] = React.useState<OutboxStatus | 'all' | 'openclaw'>('all');
  const [dateRange, setDateRange] = React.useState<string>('all');
  const [selectedEvent, setSelectedEvent] = React.useState<PulsoEvent | null>(null);
  const [error, setError] = React.useState<{ code: string; message: string } | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      const [allEvents, allIngestions] = await Promise.all([
        eventsService.getRecent(50),
        ingestionService.getAll()
      ]);
      setEvents(allEvents);
      setIngestions(allIngestions);
    } catch (err: any) {
      console.error('Error loading events:', err);
      let message = 'Falha ao carregar eventos. Ver console/log técnico.';
      
      if (err.code === 'permission-denied') {
        message = 'Firestore bloqueou a leitura. Verifique autenticação anônima e regras.';
      } else if (err.code === 'unauthenticated') {
        message = 'Usuário não autenticado. Tente recarregar a página.';
      } else if (err.code === 'failed-precondition') {
        message = 'A query exige índice Firestore (fallback parcial ativo).';
      }

      setError({ code: err.code || 'unknown', message });
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEvents = React.useMemo(() => {
    let baseList = events;
    if (filter !== 'all') {
      if (filter === 'openclaw') {
        baseList = baseList.filter(e => isOpenClaw(e));
      } else {
        baseList = baseList.filter(e => e.outboxStatus === filter);
      }
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      baseList = baseList.filter(e => {
        if (!e.createdAt) return false;
        let d: Date;
        if (typeof (e.createdAt as any).toDate === 'function') {
          d = (e.createdAt as any).toDate();
        } else if ((e.createdAt as any).seconds) {
          d = new Date((e.createdAt as any).seconds * 1000);
        } else {
          d = new Date(e.createdAt);
        }
        if (isNaN(d.getTime())) return false;

        if (dateRange === 'today') {
          return d.toDateString() === now.toDateString();
        } else if (dateRange === '7d') {
          return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (dateRange === '30d') {
          return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (dateRange === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    return baseList;
  }, [events, filter, dateRange]);

  const ocCount = events.filter(e => isOpenClaw(e)).length;

  const handleUpdateStatus = async (id: string, status: OutboxStatus) => {
    await eventsService.updateStatus(id, status);
    loadData();
    if (selectedEvent?.id === id) {
      setSelectedEvent(prev => prev ? { ...prev, outboxStatus: status } : null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">
          Sincronizando Barramento
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full max-w-full text-[#fbf9f5]">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 w-full max-w-full min-w-0">
        <div>
          <h1 className="text-2xl font-black text-[#fbf9f5] mb-2 lowercase tracking-tight">bastidor técnico</h1>
          <p className="text-xs text-[#fbf9f5]/60 max-w-lg font-light lowercase">
            logs, eventos, debug, requests bridge, auditorias técnicas e bastidores do sistema.
          </p>
        </div>

        {/* Filters Container with full horizontal layout responsiveness */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto min-w-0">
          {/* Horizontal scrollable status filters bar */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl overflow-x-auto custom-scrollbar flex-nowrap w-full sm:w-auto">
            {([
              { key: 'all',       label: 'todos' },
              { key: 'openclaw',  label: `openclaw (${ocCount})` },
              { key: 'pending',   label: 'pendentes' },
              { key: 'processed', label: 'processados' },
              { key: 'failed',    label: 'falhos' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap ${
                  filter === key ? 'bg-white/10 text-white border border-white/10' : 'text-[#fbf9f5]/40 hover:text-[#fbf9f5]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mandatory Recency Date filter selector */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-center">
            <Calendar size={12} className="text-[#fbf9f5]/60" strokeWidth={1.5} />
            <span className="text-[8px] font-black uppercase tracking-widest text-[#fbf9f5]/40">Data:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-[10px] font-bold text-[#fbf9f5] focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors outline-none lowercase"
            >
              <option value="all" className="bg-[#b8283e]">sempre</option>
              <option value="today" className="bg-[#b8283e]">hoje</option>
              <option value="7d" className="bg-[#b8283e]">últimos 7 dias</option>
              <option value="30d" className="bg-[#b8283e]">últimos 30 dias</option>
              <option value="month" className="bg-[#b8283e]">este mês</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-8 p-5 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3 flex-wrap">
          <AlertTriangle className="text-red-400 shrink-0" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400/60 mb-0.5">Erro de Sincronia</p>
            <p className="text-xs text-white/70 font-medium break-words">{error.message}</p>
          </div>
          <button 
            onClick={() => loadData()}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-full min-w-0">
        {/* Events list */}
        <div className="lg:col-span-8 space-y-3 w-full max-w-full min-w-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#fbf9f5]/40 flex items-center gap-1.5">
              <Terminal size={10} strokeWidth={1.5} /> fluxo do outbox
            </h3>
            <span className="text-[9px] font-bold text-[#fbf9f5]/30 uppercase">{filteredEvents.length} eventos</span>
          </div>

          <div className="space-y-3 w-full max-w-full min-w-0">
            {filteredEvents.map(event => (
              <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
            ))}
            {filteredEvents.length === 0 && (
              <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl mt-2">
                <p className="text-[#fbf9f5]/40 text-xs italic">Nenhum evento encontrado para estes filtros.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-6 w-full max-w-full min-w-0">
          {/* Ingestion stream */}
          <section className="bg-white/3 border border-white/5 rounded-3xl p-6 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-[#fbf9f5]/40 flex items-center gap-1.5">
                <Zap size={10} strokeWidth={1.5} /> ingestão (openclaw)
              </h3>
              <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
            </div>
            <div className="space-y-5">
              {ingestions.map(ingest => {
                const p: any = (ingest as any).payload || {};
                const title =
                  (ingest as any).ocTitle ||
                  p.title || p.summary || p.message || p.topic ||
                  ingest.name || ingest.summary || 'Ingestão externa';
                const ocType = (ingest as any).event_type || (ingest as any).ocEventType || null;
                return (
                  <div key={ingest.id} className="relative pl-5 pb-5 border-l border-white/5 last:pb-0 min-w-0">
                    <div className={`absolute left-[-4px] top-0 w-2 h-2 rounded-full ${
                      ingest.ingestionStatus === 'failed' ? 'bg-[#3d2f2f]' :
                      ingest.ingestionStatus === 'converted_to_inbox' ? 'bg-white' :
                      'bg-white/50'
                    }`} />
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[8px] font-black text-[#fbf9f5]/60 uppercase tracking-tight shrink-0">openclaw</span>
                        {ocType && (
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border shrink-0 truncate ${OC_TYPE_CHIP[ocType] || 'border-white/10 text-white/30'}`}>
                            {ocType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-[#fbf9f5]/30 shrink-0">
                        {ingest.createdAt ? new Date(ingest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </span>
                    </div>
                    <p className="text-xs text-[#fbf9f5]/80 font-light line-clamp-2 break-words">{title}</p>
                    <p className="text-[8px] text-[#fbf9f5]/40 font-bold uppercase mt-1 tracking-widest">{ingest.ingestionStatus || 'received'}</p>
                  </div>
                );
              })}
              {ingestions.length === 0 && (
                <p className="text-center py-10 text-[10px] text-[#fbf9f5]/30 italic">Aguardando entrada externa...</p>
              )}
            </div>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/3 border border-white/5 p-4 rounded-2xl min-w-0">
              <p className="text-[8px] font-black text-[#fbf9f5]/40 uppercase mb-0.5 truncate">OpenClaw</p>
              <p className="text-lg font-black text-white">{ocCount}</p>
            </div>
            <div className="bg-white/3 border border-white/5 p-4 rounded-2xl min-w-0">
              <p className="text-[8px] font-black text-[#fbf9f5]/40 uppercase mb-0.5 truncate">Pendentes</p>
              <p className="text-lg font-black text-white">{events.filter(e => e.outboxStatus === 'pending').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <EventDetailDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

function EventRow({ event, onClick }: { event: any; onClick: () => void }) {
  const title    = resolveTitle(event);
  const ocType   = resolveOcType(event);
  const oc       = isOpenClaw(event);
  const p        = event.payloadSnapshot || {};
  const severity = p.severity || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group bg-white/3 border border-white/5 p-4 md:p-5 rounded-2xl hover:bg-white/8 hover:border-white/10 transition-all cursor-pointer w-full max-w-full min-w-0"
    >
      <div className="flex items-start gap-3 md:gap-4 min-w-0">
        <EventIcon event={event} />

        <div className="flex-1 min-w-0">
          {/* Chips row */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {oc && <Chip label="OpenClaw" style="border-white/20 text-[#fbf9f5]/70 bg-white/5" />}
            {ocType && <Chip label={ocType.replace(/_/g, ' ')} style={OC_TYPE_CHIP[ocType]} />}
            {severity && (
              <Chip
                label={severity}
                style={
                  severity === 'critical' ? 'border-white/40 text-white bg-white/10 font-bold' :
                  severity === 'high'     ? 'border-white/20 text-[#fbf9f5]/80 bg-white/5' :
                  severity === 'warning'  ? 'border-white/20 text-[#fbf9f5]/70 bg-white/5' :
                  'border-white/15 text-[#fbf9f5]/50 bg-white/3'
                }
              />
            )}
            <Chip
              label={event.outboxStatus || 'received'}
              style={STATUS_CHIP[event.outboxStatus || 'pending']}
            />
            {event.areaRef && <Chip label={event.areaRef.replace('area_', '')} style="border-white/15 text-[#fbf9f5]/60 bg-white/5" />}
            {event.projectRef && <Chip label={event.projectRef.replace('proj_', '')} style="border-white/15 text-[#fbf9f5]/60 bg-white/5" />}
          </div>

          {/* Title */}
          <h4 className="text-xs md:text-[13px] font-bold text-[#fbf9f5]/90 leading-snug break-words mb-1">
            {title}
          </h4>

          {/* Meta row */}
          <div className="flex items-center gap-2 text-[8px] font-bold text-[#fbf9f5]/40 uppercase tracking-widest flex-wrap">
            {event.ocActor?.name && (
              <span className="flex items-center gap-1 shrink-0"><Bot size={8} strokeWidth={1.5} />{event.ocActor.name}</span>
            )}
            {!event.ocActor?.name && event.actorRef && (
              <span className="flex items-center gap-1 shrink-0"><Shield size={8} strokeWidth={1.5} />{event.actorRef}</span>
            )}
            {event.ocSource?.host && <span className="shrink-0">{event.ocSource.host}</span>}
            <span className="shrink-0">{event.createdAt ? new Date(event.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--'}</span>
          </div>
        </div>

        <ChevronRight size={14} className="text-[#fbf9f5]/20 group-hover:text-[#fbf9f5]/45 transition-colors mt-1 shrink-0 ml-1" />
      </div>
    </motion.div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function EventDetailDrawer({ event, onClose, onUpdateStatus }: {
  event: any | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OutboxStatus) => void;
}) {
  if (!event) return null;

  const oc      = isOpenClaw(event);
  const ocType  = resolveOcType(event);
  const title   = resolveTitle(event);
  const p       = event.payloadSnapshot || {};
  const src     = event.ocSource  || {};
  const actor   = event.ocActor   || {};
  const ctx     = event.ocContext || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex justify-end pointer-events-none w-full max-w-full">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#3d2f2f]/40 backdrop-blur-md pointer-events-auto w-full max-w-full"
        />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg sm:max-w-md md:max-w-lg bg-[#fbf9f5] border-l border-[#3c2f2f]/10 h-full overflow-y-auto pointer-events-auto shadow-2xl flex flex-col shrink-0 custom-scrollbar text-[#3d2f2f]"
        >
          <div className="p-6 md:p-8 w-full max-w-full min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 pb-2 border-b border-[#3c2f2f]/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#3c2f2f]/20 bg-[#3c2f2f]/5 text-[#b8283e] shrink-0">
                  <Activity size={16} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {oc    && <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border border-[#3c2f2f]/20 text-[#3d2f2f]/60 bg-[#3c2f2f]/5">OpenClaw</span>}
                    {ocType && <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border border-[#3c2f2f]/20 text-[#3d2f2f]/60 bg-[#3c2f2f]/5">{ocType.replace(/_/g, ' ')}</span>}
                  </div>
                  <h2 className="text-base font-black text-[#3d2f2f] leading-tight break-words lowercase">{title}</h2>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#3c2f2f]/5 rounded-full text-[#3d2f2f]/40 transition-colors shrink-0">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-full min-w-0">
              <div className="bg-[#3c2f2f]/5 border border-[#3c2f2f]/10 p-3 rounded-xl min-w-0">
                <p className="text-[8px] font-black text-[#3d2f2f]/45 uppercase mb-1 truncate">Outbox Status</p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    event.outboxStatus === 'processed' ? 'bg-[#52856d]' :
                    event.outboxStatus === 'failed'    ? 'bg-[#c9554d]' : 'bg-[#d97706]'
                  }`} />
                  <span className="text-[9px] font-bold text-[#3d2f2f]/85 uppercase truncate">{event.outboxStatus || 'pending'}</span>
                </div>
              </div>
              <div className="bg-[#3c2f2f]/5 border border-[#3c2f2f]/10 p-3 rounded-xl min-w-0">
                <p className="text-[8px] font-black text-[#3d2f2f]/45 uppercase mb-1 truncate">Origem</p>
                <span className="text-[9px] font-bold text-[#b8283e] uppercase truncate block">{event.origin || 'system'}</span>
              </div>
            </div>

            {/* Payload */}
            <div className="mb-6 w-full max-w-full min-w-0">
              <h3 className="text-[8px] font-black uppercase tracking-widest text-[#3d2f2f]/45 mb-2 truncate">Payload Snapshot</h3>
              <pre className="p-4 bg-[#3c2f2f]/5 border border-[#3c2f2f]/10 rounded-xl text-[9px] text-[#3d2f2f]/85 font-mono overflow-x-auto whitespace-pre-wrap break-words leading-relaxed max-h-60 custom-scrollbar">
                {JSON.stringify(p && Object.keys(p).length > 0 ? p : { info: event.payloadSummary || 'sem payload' }, null, 2)}
              </pre>
            </div>

            {/* OpenClaw envelope fields */}
            {oc && (
              <div className="mb-6 w-full max-w-full min-w-0">
                <h3 className="text-[8px] font-black uppercase tracking-widest text-[#3d2f2f]/45 mb-2 flex items-center gap-1 truncate">
                  <Cpu size={10} strokeWidth={1.5} className="shrink-0" /> Envelope OpenClaw
                </h3>
                <div className="space-y-0 border border-[#3c2f2f]/10 rounded-xl overflow-hidden max-w-full min-w-0">
                  <MetaRow label="event_id"      value={event.entityRef || event.id} />
                  <MetaRow label="dedupe_key"    value={event.ocDedupeKey || '--'} />
                  <MetaRow label="event_type"    value={ocType || '--'} />
                  <MetaRow label="occurred_at"   value={event.ocOccurredAt || '--'} />
                  <MetaRow label="source.product" value={src.product || '--'} />
                  <MetaRow label="source.agent"  value={src.agent || '--'} />
                  <MetaRow label="source.host"   value={src.host || '--'} />
                  <MetaRow label="source.env"    value={src.environment || '--'} />
                  <MetaRow label="actor.type"    value={actor.type || event.actorType || '--'} />
                  <MetaRow label="actor.id"      value={actor.id   || event.actorRef  || '--'} />
                  <MetaRow label="actor.name"    value={actor.name || '--'} />
                  <MetaRow label="context.channel"     value={ctx.channel     || '--'} />
                  <MetaRow label="context.session_key" value={ctx.session_key || '--'} />
                </div>
              </div>
            )}

            {/* Context & Metadata */}
            <div className="mb-6 w-full max-w-full min-w-0">
              <h3 className="text-[8px] font-black uppercase tracking-widest text-[#3d2f2f]/45 mb-2 flex items-center gap-1 truncate">
                <Layout size={10} strokeWidth={1.5} className="shrink-0" /> Contexto Estrutural
              </h3>
              <div className="space-y-0 border border-[#3c2f2f]/10 rounded-xl overflow-hidden max-w-full min-w-0">
                <MetaRow label="Área (areaRef)"     value={event.areaRef || '--'} />
                <MetaRow label="Projeto (projectRef)" value={event.projectRef || '--'} />
                <MetaRow label="entityType"          value={event.entityType || '--'} />
                <MetaRow label="actorType"           value={event.actorType || '--'} />
                <MetaRow label="actorRef"            value={event.actorRef || '--'} />
                <MetaRow label="origin"              value={event.origin || '--'} />
                <MetaRow label="createdAt"           value={event.createdAt ? new Date(event.createdAt).toLocaleString() : '--'} />
              </div>
            </div>

            {/* System metadata */}
            <div className="mb-6 w-full max-w-full min-w-0">
              <h3 className="text-[8px] font-black uppercase tracking-widest text-[#3d2f2f]/45 mb-2 truncate">Sistema Canônico</h3>
              <div className="space-y-0 border border-[#3c2f2f]/10 rounded-xl overflow-hidden max-w-full min-w-0">
                <MetaRow label="pulso_event_id" value={event.id} />
                <MetaRow label="entityRef"      value={event.entityRef || '--'} />
                <MetaRow label="processedBy"    value={event.processedByAgents?.join(', ') || 'nenhum'} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-[#3c2f2f]/10 w-full max-w-full">
              <button
                onClick={() => onUpdateStatus(event.id, 'processed')}
                className="flex-1 py-3 bg-[#52856d]/10 border border-[#52856d]/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#52856d] hover:bg-[#52856d]/20 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={12} strokeWidth={1.5} /> Processado
              </button>
              <button
                onClick={() => onUpdateStatus(event.id, 'failed')}
                className="flex-1 py-3 bg-[#c9554d]/10 border border-[#c9554d]/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#c9554d] hover:bg-[#c9554d]/20 transition-all flex items-center justify-center gap-1.5"
              >
                <X size={12} strokeWidth={1.5} /> Falha
              </button>
            </div>
            <button
              onClick={() => onUpdateStatus(event.id, 'ignored')}
              className="w-full mt-2 py-3 bg-[#3c2f2f]/5 border border-[#3c2f2f]/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#3d2f2f]/60 hover:bg-[#3c2f2f]/10 transition-all"
            >
              Ignorar Evento
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── MetaRow ──────────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-[#3c2f2f]/10 last:border-0 hover:bg-[#3c2f2f]/5 transition-colors min-w-0 gap-2">
      <span className="text-[8px] text-[#3d2f2f]/45 font-black uppercase tracking-widest shrink-0 truncate max-w-[40%]">{label}</span>
      <span className="text-[9px] text-[#3d2f2f]/85 font-mono truncate max-w-[60%] text-right select-all">{value}</span>
    </div>
  );
}
