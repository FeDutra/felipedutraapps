'use client';

import React from 'react';
import { eventsService } from '../services/eventsService';
import { ingestionService } from '../services/ingestionService';
import { PulsoEvent, IngestionEvent, OutboxStatus } from '../types/pulso.types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Terminal, Zap, Shield, AlertTriangle,
  CheckCircle2, X, Bot, Cpu, Bell, ClipboardList,
  ChevronRight, Package, Layout
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
  const base = 'w-10 h-10 rounded-xl flex items-center justify-center border';
  if (oc === 'alert') return <div className={`${base} bg-red-500/10 border-red-500/20 text-red-400`}><AlertTriangle size={18} /></div>;
  if (oc === 'task')  return <div className={`${base} bg-blue-500/10 border-blue-500/20 text-blue-400`}><ClipboardList size={18} /></div>;
  if (oc === 'agent_update') return <div className={`${base} bg-violet-500/10 border-violet-500/20 text-violet-400`}><Bot size={18} /></div>;
  if ((event.eventType || '').includes('created')) return <div className={`${base} bg-blue-500/10 border-blue-500/20 text-blue-400`}><Activity size={18} /></div>;
  if ((event.eventType || '').includes('updated')) return <div className={`${base} bg-amber-500/10 border-amber-500/20 text-amber-400`}><Activity size={18} /></div>;
  if (isOpenClaw(event)) return <div className={`${base} bg-cyan-500/10 border-cyan-500/20 text-cyan-400`}><Package size={18} /></div>;
  return <div className={`${base} bg-white/5 border-white/10 text-white/40`}><Activity size={18} /></div>;
}

/** Chip for outbox status */
const STATUS_CHIP: Record<string, string> = {
  pending:    'border-amber-500/20 text-amber-400 bg-amber-500/5',
  processed:  'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
  failed:     'border-red-500/20 text-red-400 bg-red-500/5',
  ignored:    'border-white/10 text-white/20 bg-white/5',
  processing: 'border-blue-500/20 text-blue-400 bg-blue-500/5',
};

/** Chip for oc event_type */
const OC_TYPE_CHIP: Record<string, string> = {
  agent_update:  'border-violet-500/20 text-violet-400 bg-violet-500/5',
  task:          'border-blue-500/20 text-blue-400 bg-blue-500/5',
  alert:         'border-red-500/20 text-red-400 bg-red-500/5',
  decision:      'border-amber-500/20 text-amber-400 bg-amber-500/5',
  health_signal: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
};

function Chip({ label, style }: { label: string; style?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${style || 'border-white/10 text-white/30 bg-white/5'}`}>
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
  const [selectedEvent, setSelectedEvent] = React.useState<PulsoEvent | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [allEvents, allIngestions] = await Promise.all([
        eventsService.getRecent(50),
        ingestionService.getAll()
      ]);
      setEvents(allEvents);
      setIngestions(allIngestions);
    } catch (err) {
      console.error('Error loading events:', err);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const filteredEvents = React.useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'openclaw') return events.filter(e => isOpenClaw(e));
    return events.filter(e => e.outboxStatus === filter);
  }, [events, filter]);

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
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Sincronizando Barramento</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Barramento de Eventos</h1>
          <p className="text-sm text-white/40 max-w-lg">
            Auditoria, sincronização e ingestão OpenClaw → PULSO.
          </p>
        </div>
        {/* Filters */}
        <div className="flex bg-white/2 border border-white/5 p-1 rounded-xl flex-wrap gap-1">
          {([
            { key: 'all',       label: 'Todos' },
            { key: 'openclaw',  label: `OpenClaw (${ocCount})` },
            { key: 'pending',   label: 'Pendentes' },
            { key: 'processed', label: 'Processados' },
            { key: 'failed',    label: 'Falhos' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === key ? 'bg-white/5 text-white' : 'text-white/20 hover:text-white/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Events list */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Terminal size={12} /> Fluxo do Outbox
            </h3>
            <span className="text-[10px] font-bold text-white/10 uppercase">{filteredEvents.length} Eventos</span>
          </div>

          <div className="space-y-3">
            {filteredEvents.map(event => (
              <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
            ))}
            {filteredEvents.length === 0 && (
              <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl">
                <p className="text-white/20 text-xs italic">Nenhum evento encontrado para este filtro.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-8">
          {/* Ingestion stream */}
          <section className="bg-white/2 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Zap size={12} /> Ingestão (OpenClaw)
              </h3>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <div className="space-y-6">
              {ingestions.map(ingest => {
                const p: any = (ingest as any).payload || {};
                const title =
                  (ingest as any).ocTitle ||
                  p.title || p.summary || p.message || p.topic ||
                  ingest.name || ingest.summary || 'Ingestão externa';
                const ocType = (ingest as any).event_type || (ingest as any).ocEventType || null;
                return (
                  <div key={ingest.id} className="relative pl-6 pb-6 border-l border-white/5 last:pb-0">
                    <div className={`absolute left-[-5px] top-0 w-2 h-2 rounded-full ${
                      ingest.ingestionStatus === 'failed' ? 'bg-red-500' :
                      ingest.ingestionStatus === 'converted_to_inbox' ? 'bg-emerald-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-cyan-400/60 uppercase tracking-tighter">OpenClaw</span>
                        {ocType && (
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${OC_TYPE_CHIP[ocType] || 'border-white/10 text-white/30'}`}>
                            {ocType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-white/10">
                        {ingest.createdAt ? new Date(ingest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 font-medium line-clamp-2">{title}</p>
                    <p className="text-[9px] text-white/30 font-bold uppercase mt-1 tracking-widest">{ingest.ingestionStatus || 'received'}</p>
                  </div>
                );
              })}
              {ingestions.length === 0 && (
                <p className="text-center py-10 text-[10px] text-white/20 italic">Aguardando entrada externa...</p>
              )}
            </div>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
              <p className="text-[9px] font-black text-white/20 uppercase mb-1">OpenClaw</p>
              <p className="text-xl font-black text-cyan-400">{ocCount}</p>
            </div>
            <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
              <p className="text-[9px] font-black text-white/20 uppercase mb-1">Pendentes</p>
              <p className="text-xl font-black text-amber-500">{events.filter(e => e.outboxStatus === 'pending').length}</p>
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
      className="group bg-white/2 border border-white/5 p-5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <EventIcon event={event} />

        <div className="flex-1 min-w-0">
          {/* Chips row */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {oc && <Chip label="OpenClaw" style="border-cyan-500/30 text-cyan-400 bg-cyan-500/5" />}
            {ocType && <Chip label={ocType.replace(/_/g, ' ')} style={OC_TYPE_CHIP[ocType]} />}
            {severity && (
              <Chip
                label={severity}
                style={
                  severity === 'critical' ? 'border-red-500/40 text-red-400 bg-red-500/5' :
                  severity === 'high'     ? 'border-orange-500/30 text-orange-400 bg-orange-500/5' :
                  severity === 'warning'  ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                  'border-white/10 text-white/30 bg-white/5'
                }
              />
            )}
            <Chip
              label={event.outboxStatus || 'received'}
              style={STATUS_CHIP[event.outboxStatus || 'pending']}
            />
            {event.areaRef && <Chip label={event.areaRef.replace('area_', '')} style="border-blue-500/20 text-blue-400 bg-blue-500/5" />}
            {event.projectRef && <Chip label={event.projectRef.replace('proj_', '')} style="border-violet-500/20 text-violet-400 bg-violet-500/5" />}
          </div>

          {/* Title */}
          <h4 className="text-[13px] font-bold text-white/85 leading-snug line-clamp-1 mb-1">
            {title}
          </h4>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[9px] font-bold text-white/25 uppercase tracking-widest">
            {event.ocActor?.name && (
              <span className="flex items-center gap-1"><Bot size={9} />{event.ocActor.name}</span>
            )}
            {!event.ocActor?.name && event.actorRef && (
              <span className="flex items-center gap-1"><Shield size={9} />{event.actorRef}</span>
            )}
            {event.ocSource?.host && <span>{event.ocSource.host}</span>}
            <span>{event.createdAt ? new Date(event.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--'}</span>
          </div>
        </div>

        <ChevronRight size={14} className="text-white/10 group-hover:text-white/30 transition-colors mt-1 shrink-0" />
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
      <div className="fixed inset-0 z-[60] flex justify-end pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"
        />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-slate-950 border-l border-white/10 h-full overflow-y-auto pointer-events-auto shadow-2xl"
        >
          <div className="p-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <EventIcon event={event} />
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {oc    && <Chip label="OpenClaw"   style="border-cyan-500/30 text-cyan-400 bg-cyan-500/5" />}
                    {ocType && <Chip label={ocType.replace(/_/g, ' ')} style={OC_TYPE_CHIP[ocType]} />}
                  </div>
                  <h2 className="text-lg font-black text-white leading-tight">{title}</h2>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-white/20 uppercase mb-1.5">Outbox</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    event.outboxStatus === 'processed' ? 'bg-emerald-500' :
                    event.outboxStatus === 'failed'    ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <span className="text-[10px] font-bold text-white/70 uppercase">{event.outboxStatus || 'pending'}</span>
                </div>
              </div>
              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-white/20 uppercase mb-1.5">Origem</p>
                <span className="text-[10px] font-bold text-cyan-400 uppercase">{event.origin || 'system'}</span>
              </div>
            </div>

            {/* Payload */}
            <div className="mb-8">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-3">Payload</h3>
              <pre className="p-5 bg-black/40 border border-white/5 rounded-2xl text-[10px] text-blue-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(p && Object.keys(p).length > 0 ? p : { info: event.payloadSummary || 'sem payload' }, null, 2)}
              </pre>
            </div>

            {/* OpenClaw envelope fields */}
            {oc && (
              <div className="mb-8">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
                  <Cpu size={10} /> Envelope OpenClaw
                </h3>
                <div className="space-y-0 border border-white/5 rounded-2xl overflow-hidden">
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
            <div className="mb-10">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
                <Layout size={10} /> Contexto Estrutural
              </h3>
              <div className="space-y-0 border border-white/5 rounded-2xl overflow-hidden">
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
            <div className="mb-10">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-3">Sistema</h3>
              <div className="space-y-0 border border-white/5 rounded-2xl overflow-hidden">
                <MetaRow label="pulso_event_id" value={event.id} />
                <MetaRow label="entityRef"      value={event.entityRef || '--'} />
                <MetaRow label="processedBy"    value={event.processedByAgents?.join(', ') || 'nenhum'} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-6 border-t border-white/5">
              <button
                onClick={() => onUpdateStatus(event.id, 'processed')}
                className="flex-1 py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={13} /> Processado
              </button>
              <button
                onClick={() => onUpdateStatus(event.id, 'failed')}
                className="flex-1 py-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                <X size={13} /> Reportar Falha
              </button>
            </div>
            <button
              onClick={() => onUpdateStatus(event.id, 'ignored')}
              className="w-full mt-3 py-3.5 bg-white/2 border border-white/8 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white/25 hover:bg-white/5 transition-all"
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
    <div className="flex items-center justify-between py-2.5 px-4 border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
      <span className="text-[9px] text-white/20 font-black uppercase tracking-widest shrink-0 mr-4">{label}</span>
      <span className="text-[10px] text-white/55 font-mono truncate max-w-[220px] text-right">{value}</span>
    </div>
  );
}
