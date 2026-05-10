'use client';

import React from 'react';
import { eventsService } from '../services/eventsService';
import { ingestionService } from '../services/ingestionService';
import { PulsoEvent, IngestionEvent, EventType, OutboxStatus } from '../types/pulso.types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, ArrowRight, Clock, Filter, 
  Search, Terminal, Database, Shield, 
  AlertCircle, CheckCircle2, Inbox, Zap, 
  ExternalLink, ChevronRight, X 
} from 'lucide-react';
import { getStatusLabel } from '../utils/statusHelpers';

export default function EventsPage() {
  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<PulsoEvent[]>([]);
  const [ingestions, setIngestions] = React.useState<IngestionEvent[]>([]);
  const [filter, setFilter] = React.useState<OutboxStatus | 'all'>('all');
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

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => e.outboxStatus === filter);

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
            Protocolo de auditoria e sincronização (Outbox) para agentes externos e OpenClaw.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/2 border border-white/5 p-1 rounded-xl">
            {(['all', 'pending', 'processed', 'failed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-white/5 text-white' : 'text-white/20 hover:text-white/40'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'processed' ? 'Processados' : 'Falhos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Events List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Terminal size={12} /> Fluxo do Outbox
            </h3>
            <span className="text-[10px] font-bold text-white/10 uppercase">{filteredEvents.length} Eventos</span>
          </div>

          <div className="space-y-3">
            {filteredEvents.map(event => (
              <EventRow 
                key={event.id} 
                event={event} 
                onClick={() => setSelectedEvent(event)}
              />
            ))}
            {filteredEvents.length === 0 && (
              <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl">
                <p className="text-white/20 text-xs italic">Nenhum evento encontrado para este filtro.</p>
              </div>
            )}
          </div>
        </div>

        {/* Ingestion Stream (Right) */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white/2 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Zap size={12} /> Ingestão (OpenClaw)
              </h3>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>

            <div className="space-y-6">
              {ingestions.map(ingest => (
                <div key={ingest.id} className="relative pl-6 pb-6 border-l border-white/5 last:pb-0">
                  <div className={`absolute left-[-5px] top-0 w-2 h-2 rounded-full ${
                    ingest.ingestionStatus === 'failed' ? 'bg-red-500' : 
                    ingest.ingestionStatus === 'converted_to_inbox' ? 'bg-emerald-500' : 
                    'bg-blue-500'
                  }`} />
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">{ingest.originLabel || 'OpenClaw'}</span>
                    <span className="text-[8px] text-white/10">
                      {ingest.createdAt ? new Date(ingest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 font-medium line-clamp-1">{ingest.name || ingest.summary || 'Ingestão externa'}</p>
                  <p className="text-[9px] text-white/30 font-bold uppercase mt-1 tracking-widest">{ingest.ingestionStatus || 'received'}</p>
                </div>
              ))}
              {ingestions.length === 0 && (
                <p className="text-center py-10 text-[10px] text-white/20 italic">Aguardando entrada externa...</p>
              )}
            </div>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Pendentes</p>
                <p className="text-xl font-black text-amber-500">{events.filter(e => e.outboxStatus === 'pending').length}</p>
             </div>
             <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Taxa de Sync</p>
                <p className="text-xl font-black text-white">98%</p>
             </div>
          </div>
        </div>
      </div>

      {/* Event Drawer */}
      <EventDetailDrawer 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}

function EventRow({ event, onClick }: { event: PulsoEvent, onClick: () => void }) {
  const statusColors = {
    pending: 'border-amber-500/20 text-amber-500 bg-amber-500/5',
    processed: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
    failed: 'border-red-500/20 text-red-500 bg-red-500/5',
    ignored: 'border-white/10 text-white/20 bg-white/2',
    processing: 'border-blue-500/20 text-blue-400 bg-blue-500/5'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group bg-white/2 border border-white/5 p-5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer flex items-center justify-between"
    >
      <div className="flex items-center gap-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
          (event.eventType || '').includes('created') ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
          (event.eventType || '').includes('updated') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
          'bg-white/5 border-white/10 text-white/40'
        }`}>
          <Activity size={18} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h4 className="text-[11px] font-black text-white/80 uppercase tracking-widest">
              {(event.eventType || 'unknown_event').replace(/_/g, ' ')}
            </h4>
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${statusColors[event.outboxStatus || 'pending']}`}>
              {event.outboxStatus || 'pending'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">
             <span className="flex items-center gap-1"><Shield size={10} /> {event.actorType || 'system'}</span>
             <span className="flex items-center gap-1"><Inbox size={10} /> {event.entityType || 'unknown'}</span>
             <span>{event.createdAt ? new Date(event.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-white/40 uppercase mb-1">Origem</p>
        <p className="text-xs font-bold text-white/60">{event.origin}</p>
      </div>
    </motion.div>
  );
}

function EventDetailDrawer({ event, onClose, onUpdateStatus }: { 
  event: PulsoEvent | null, 
  onClose: () => void,
  onUpdateStatus: (id: string, status: OutboxStatus) => void
}) {
  if (!event) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex justify-end pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"
        />

        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-slate-950 border-l border-white/10 h-full overflow-y-auto pointer-events-auto shadow-2xl flex flex-col"
        >
          <div className="p-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
                  <Activity size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Log de Evento</p>
                  <h2 className="text-xl font-black text-white">{event.eventType || 'Evento Desconhecido'}</h2>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Status Outbox</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${event.outboxStatus === 'processed' ? 'bg-emerald-500' : event.outboxStatus === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{event.outboxStatus || 'pending'}</span>
                </div>
              </div>
              <div className="bg-white/2 border border-white/5 p-5 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Entidade</p>
                <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{event.entityType || 'unknown'}</span>
              </div>
            </div>

            {/* Payload */}
            <div className="mb-10">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4 px-2">Snapshot do Payload</h3>
               <pre className="p-6 bg-black/40 border border-white/5 rounded-3xl text-[11px] text-blue-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                 {JSON.stringify(event.payloadSnapshot || { summary: event.payloadSummary || 'Nenhum snapshot disponível.' }, null, 2)}
               </pre>
            </div>

            {/* Metadata Table */}
            <div className="space-y-4 mb-12">
               <MetaRow label="ID do Evento" value={event.id} />
               <MetaRow label="Ref Entidade" value={event.entityRef || '--'} />
               <MetaRow label="Ator" value={`${event.actorType || 'system'} (${event.actorRef || 'system'})`} />
               <MetaRow label="Origem" value={event.origin || 'system'} />
               <MetaRow label="Data/Hora" value={event.createdAt ? new Date(event.createdAt).toLocaleString() : '--'} />
               <MetaRow label="Processado Por" value={event.processedByAgents?.join(', ') || 'Nenhum agente'} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-8 border-t border-white/5">
              <button 
                onClick={() => onUpdateStatus(event.id, 'processed')}
                className="flex-1 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} /> Marcar Processado
              </button>
              <button 
                onClick={() => onUpdateStatus(event.id, 'failed')}
                className="flex-1 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                <X size={14} /> Reportar Falha
              </button>
            </div>
            <button 
                onClick={() => onUpdateStatus(event.id, 'ignored')}
                className="w-full mt-3 py-4 bg-white/2 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/30 hover:bg-white/5 transition-all"
              >
                Ignorar Evento
              </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function MetaRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 px-2">
      <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">{label}</span>
      <span className="text-[10px] text-white/60 font-mono truncate max-w-[200px]">{value}</span>
    </div>
  );
}
