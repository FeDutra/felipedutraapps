'use client';

import React from 'react';
import { inboxService, requestsService } from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { AlertCircle } from 'lucide-react';
import { inboxHelpers } from '../utils/inboxHelpers';
import { InboxItem, PulsoRequest } from '../types/pulso.types';
import { InboxHeader } from '../components/inbox/InboxHeader';
import { InboxFilters } from '../components/inbox/InboxFilters';
import { InboxItemCard } from '../components/inbox/InboxItemCard';
import { RequestItemCard } from '../components/inbox/RequestItemCard';
import { RequestDetailDrawer } from '../components/inbox/RequestDetailDrawer';
import { InboxDetailDrawer } from '../components/inbox/InboxDetailDrawer';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @file InboxPage.tsx
 * @description Universal Inbox and Requests Bridge monitoring page.
 * Highly resilient to legacy test items and dynamic payloads.
 */

export default function InboxPage() {
  const [items, setItems] = React.useState<InboxItem[]>([]);
  const [requests, setRequests] = React.useState<PulsoRequest[]>([]);
  const [rawDocs, setRawDocs] = React.useState<any[]>([]);
  const [showRawAudit, setShowRawAudit] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedItem, setSelectedItem] = React.useState<InboxItem | null>(null);
  const [selectedRequest, setSelectedRequest] = React.useState<PulsoRequest | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filters, setFilters] = React.useState({
    status: 'new',
    type: 'all',
    priority: 'all',
    area: 'all',
    requestStatus: 'active' // sub-filter default initialized
  });
  const [feedback, setFeedback] = React.useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    try {
      await authService.ensurePulsoAuthReady();
      const [inboxData, requestsData, rawData] = await Promise.all([
        inboxService.getAll(),
        requestsService.getRequests(100, true), // Fetch history inclusive of archived tests
        requestsService.getRawRequests(20)
      ]);
      setItems([...inboxData]);
      setRequests([...requestsData]);
      setRawDocs([...rawData]);
    } catch (err: any) {
      console.error('Inbox load error:', err);
      showFeedback(err.message || 'Erro ao carregar itens do Inbox', 'error');
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = React.useMemo(() => {
    if (filters.status === 'requests') return [];
    let result = inboxHelpers.filterItems(items, filters);
    result = inboxHelpers.searchItems(result, searchQuery);
    return result;
  }, [items, filters, searchQuery]);

  const filteredRequests = React.useMemo(() => {
    if (filters.status !== 'requests') return [];
    
    return requests.filter(r => {
      if (!r) return false;
      
      // 1. Sub-filter matching logic
      const reqSt = filters.requestStatus || 'active';
      if (reqSt === 'active') {
        if (r.archived) return false;
        const activeStatuses = ['requested', 'running', 'needs_approval', 'needs_clarification'];
        if (!activeStatuses.includes(r.status)) return false;
      } else if (reqSt === 'archived') {
        if (!r.archived) return false;
      } else {
        // Direct status filter (running, needs_approval, needs_clarification, completed, etc)
        if (r.status !== reqSt) return false;
        if (r.archived) return false;
      }

      // 2. Type matching logic
      if (filters.type && filters.type !== 'all') {
        const entityTypeStr = r.result?.entityType || r.result?.matResult?.entityType || '';
        const reqTypeStr = r.requestType || '';
        const matchesType = entityTypeStr.toLowerCase() === filters.type.toLowerCase() ||
                            reqTypeStr.toLowerCase().includes(filters.type.toLowerCase());
        if (!matchesType) return false;
      }

      // 3. Priority matching logic
      if (filters.priority && filters.priority !== 'all') {
        if ((r.priority || 'medium') !== filters.priority) return false;
      }

      // 4. Safe Textual search mapping
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const titleStr = r.title || '';
      const summaryStr = r.summary || '';
      const dedupeStr = r.dedupeKey || '';
      const refStr = r.result?.entityRef || r.result?.matResult?.entityRef || '';
      const typeStr = r.requestType || '';

      return titleStr.toLowerCase().includes(q) || 
             summaryStr.toLowerCase().includes(q) ||
             dedupeStr.toLowerCase().includes(q) ||
             refStr.toLowerCase().includes(q) ||
             typeStr.toLowerCase().includes(q);
    });
  }, [requests, filters, searchQuery]);

  const stats = React.useMemo(() => inboxHelpers.getStats(items), [items]);

  const handleUpdate = async (id: string, data: Partial<InboxItem>) => {
    try {
      const updated = await inboxService.update(id, data);
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      if (selectedItem?.id === id) setSelectedItem(updated);
      showFeedback('Item atualizado');
    } catch (err) {
      showFeedback('Erro ao atualizar item', 'error');
    }
  };

  const handleConvert = async (id: string, targetType: string) => {
    try {
      const { item } = await inboxService.convertTo(id, targetType);
      setItems(prev => prev.map(i => i.id === id ? item : i));
      setSelectedItem(null);
      showFeedback(`Item convertido em ${targetType}`);
    } catch (err) {
      console.error('Falha na conversão:', err);
      showFeedback('Erro na conversão', 'error');
    }
  };

  const handleArchiveRequest = async (id: string) => {
    try {
      await requestsService.archiveRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, archived: true } : r));
      // Auto-update drawer if open
      setSelectedRequest(prev => prev?.id === id ? { ...prev, archived: true } : prev);
      showFeedback('Solicitação arquivada da fila principal com sucesso');
    } catch (err) {
      showFeedback('Erro ao arquivar solicitação', 'error');
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      const updated = await requestsService.approveRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      setSelectedRequest(updated);
      showFeedback('Intenção chancelada! Liberado para materialização com sucesso.');
    } catch (err) {
      showFeedback('Erro ao aprovar solicitação', 'error');
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      const updated = await requestsService.rejectRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      setSelectedRequest(updated);
      showFeedback('Solicitação bloqueada e rejeitada.', 'error');
    } catch (err) {
      showFeedback('Erro ao rejeitar solicitação', 'error');
    }
  };

  const handleClarifyRequest = async (id: string, answers: any) => {
    try {
      const updated = await requestsService.answerClarification(id, answers);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      setSelectedRequest(updated);
      showFeedback('Esclarecimentos acoplados ao envelope da Lótus com sucesso!');
    } catch (err) {
      showFeedback('Erro ao transmitir esclarecimento', 'error');
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedItem(null);
  };

  const handleSaveNew = async (data: Partial<InboxItem>) => {
    try {
      const newItem = await inboxService.create(data);
      setItems(prev => [newItem, ...prev]);
      setIsCreating(false);
      showFeedback('Registro salvo no Inbox');
    } catch (err) {
      showFeedback('Erro ao salvar registro', 'error');
    }
  };

  if (loading && items.length === 0 && requests.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sincronizando Barramento</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <InboxHeader stats={stats} onCreateNew={handleCreateNew} />
      
      <InboxFilters 
        filters={filters} 
        setFilters={setFilters} 
        onSearch={setSearchQuery} 
      />

      {filters.status === 'requests' && (
        <div className="mb-6 bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 transition-all">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Auditoria Bruta Direta (Debug Interno)</span>
              <span className="text-[9px] text-white/40">({rawDocs.length} docs lidos da raiz sem filtros)</span>
            </div>
            <button
              onClick={() => setShowRawAudit(!showRawAudit)}
              className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-300 hover:bg-purple-500/20 transition-all uppercase tracking-wider cursor-pointer"
            >
              {showRawAudit ? 'Esconder Leitura Bruta' : 'Exibir Leitura Bruta'}
            </button>
          </div>

          {showRawAudit && (
            <div className="mt-4 pt-4 border-t border-purple-500/10 grid grid-cols-1 gap-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
              {rawDocs.map((doc, idx) => (
                <div key={doc.id || idx} className="p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-purple-300">
                    <span className="font-bold">{doc.id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-[8px] uppercase">{doc.status || 'sem status'}</span>
                  </div>
                  <div className="text-white/60 truncate">
                    Nome/Título: {doc.title || doc.name || doc.decision || doc.requestType || 'N/A'}
                  </div>
                  <div className="text-white/30 text-[9px] truncate">
                    Sumário: {doc.summary || doc.notes || 'N/A'}
                  </div>
                </div>
              ))}
              {rawDocs.length === 0 && (
                <div className="text-center py-4 text-white/40 text-xs">Nenhum documento retornado na leitura bruta. Verifique as permissões de rede.</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filters.status === 'requests' ? (
            filteredRequests.map((req) => (
              <RequestItemCard 
                key={req.id} 
                request={req} 
                onClick={(r) => setSelectedRequest(r)} 
              />
            ))
          ) : (
            filteredItems.map((item) => (
              <InboxItemCard 
                key={item.id} 
                item={item} 
                onClick={(it) => {
                  setSelectedItem(it);
                  setIsCreating(false);
                }} 
              />
            ))
          )}
        </AnimatePresence>

        {((filters.status === 'requests' && filteredRequests.length === 0) || 
          (filters.status !== 'requests' && filteredItems.length === 0)) && (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl bg-white/1">
            <AlertCircle size={28} className="text-white/10 mb-2" />
            <p className="text-white/20 text-xs font-bold">Nenhum envelope de dados corresponde aos critérios.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 ${
              feedback.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${feedback.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <InboxDetailDrawer 
        item={selectedItem} 
        isCreating={isCreating}
        onClose={() => {
          setSelectedItem(null);
          setIsCreating(false);
        }} 
        onUpdate={handleUpdate}
        onConvert={handleConvert}
        onCreate={handleSaveNew}
      />

      <RequestDetailDrawer 
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onArchive={handleArchiveRequest}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
        onClarify={handleClarifyRequest}
      />
    </div>
  );
}
