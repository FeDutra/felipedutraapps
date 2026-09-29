'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, MessageCircleMore } from 'lucide-react';
import { authService } from '@/shared/services/authService';
import { SiteConversationList } from '../components/site-conversations/SiteConversationList';
import { SiteConversationThread } from '../components/site-conversations/SiteConversationThread';
import {
  computeSiteConversationMetrics,
  filterSiteConversations
} from '../services/siteConversationHelpers';
import { siteConversationService } from '../services/siteConversationService';
import type {
  SiteConversationFilter,
  SiteConversationSummary,
  SiteConversationThread as SiteConversationThreadData
} from '../types/siteConversation.types';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function SiteConversationsPage() {
  const [conversations, setConversations] = useState<SiteConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<SiteConversationThreadData | null>(null);
  const [filter, setFilter] = useState<SiteConversationFilter>('all');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const metrics = useMemo(() => computeSiteConversationMetrics(conversations), [conversations]);
  const visibleConversations = useMemo(
    () => filterSiteConversations(conversations, filter, search),
    [conversations, filter, search]
  );

  const loadThread = useCallback(async (conversation: SiteConversationSummary) => {
    setLoadingThread(true);
    setThread(null);
    try {
      const nextThread = await siteConversationService.getThread(conversation);
      setThread(nextThread);

      if (conversation.unread) {
        const user = await authService.ensurePulsoAuthReady();
        await siteConversationService.markAsRead(conversation.id, user.email || user.uid);
        setConversations((current) => current.map((item) => (
          item.id === conversation.id ? { ...item, unread: false, internalLastReadAt: new Date() } : item
        )));
      }
    } catch (err: unknown) {
      console.error('[PULSO_SITE_CONVERSATIONS] Failed to load thread:', err);
      setError(errorMessage(err, 'Não foi possível abrir este fio.'));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      const nextConversations = await siteConversationService.getConversations();
      setConversations(nextConversations);

      const currentSelection = nextConversations.find((item) => item.id === selectedId);
      const nextSelection = currentSelection ?? null;
      setSelectedId(nextSelection?.id ?? null);

      if (nextSelection) {
        await loadThread(nextSelection);
      }
    } catch (err: unknown) {
      console.error('[PULSO_SITE_CONVERSATIONS] Failed to load conversations:', err);
      setError(errorMessage(
        err,
        'Não foi possível sintonizar as conversas do site. Verifique autenticação e acesso ao Firestore.'
      ));
    } finally {
      setLoadingList(false);
    }
  }, [loadThread, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversations(), 0);
    return () => window.clearTimeout(timer);
    // A carga inicial deve acontecer uma vez; seleção e abertura são tratadas separadamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (conversation: SiteConversationSummary) => {
    setError(null);
    setSelectedId(conversation.id);
    setMobileThreadOpen(true);
    if (thread?.conversation.id !== conversation.id) {
      void loadThread(conversation);
    }
  };

  return (
    <div className="flex-1 w-full max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-10 pb-32">
      <header className="pt-2 pb-8 sm:pb-10 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <MessageCircleMore size={15} strokeWidth={1.5} className="text-[#fbf9f5]/50" />
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#fbf9f5]/40">
            PULSO // PRESENÇA PÚBLICA
          </span>
        </div>
        <h1 className="mt-3 text-xl sm:text-2xl font-light tracking-tight text-white">
          Conversas do site
        </h1>
        <p className="mt-2 text-xs text-[#fbf9f5]/45 max-w-2xl font-light leading-relaxed">
          Os fios iniciados com a Lótus em felipedutra.com, preservados para leitura e continuidade.
        </p>
      </header>

      {error && (
        <div className="my-6 flex items-start gap-3 py-4 border-y border-rose-300/20 text-rose-100 text-xs">
          <AlertCircle size={15} className="text-rose-300/70 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase">Falha de sintonia</p>
            <p className="mt-1 font-light opacity-70">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadConversations}
            className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60 hover:text-white"
          >
            tentar novamente
          </button>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.5fr)] pt-6 sm:pt-8">
        <div className={mobileThreadOpen ? 'hidden lg:block' : 'block'}>
          <SiteConversationList
            conversations={visibleConversations}
            selectedId={selectedId}
            loading={loadingList}
            metrics={metrics}
            filter={filter}
            search={search}
            onSelect={handleSelect}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            onRefresh={loadConversations}
          />
        </div>

        <div className={mobileThreadOpen ? 'block' : 'hidden lg:block'}>
          <SiteConversationThread
            conversation={selectedConversation}
            thread={thread}
            loading={loadingThread}
            onBack={() => setMobileThreadOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
