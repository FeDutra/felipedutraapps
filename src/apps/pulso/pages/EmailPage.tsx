'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { authService } from '@/shared/services/authService';
import { correspondenceService } from '../services/correspondenceService';
import { CorrespondenceMetrics } from '../components/email/CorrespondenceMetrics';
import { CorrespondenceList } from '../components/email/CorrespondenceList';
import type {
  CorrespondenceSubscriberClient,
  CorrespondenceMetrics as MetricsType,
  StatusFilterOption
} from '../types/correspondence.types';

export default function EmailPage() {
  const [subscribers, setSubscribers] = useState<CorrespondenceSubscriberClient[]>([]);
  const [metrics, setMetrics] = useState<MetricsType>({
    total: 0,
    active: 0,
    pending: 0,
    error: 0,
    unsubscribed: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      const list = await correspondenceService.getSubscribers();
      setSubscribers(list);
      setMetrics(correspondenceService.computeMetrics(list));
    } catch (err: any) {
      console.error('[PULSO_EMAIL] Failed to load correspondence data:', err);
      setError(
        err?.message ||
        'Não foi possível sintonizar a coleção de correspondência. Verifique autenticação e regras de acesso.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-8 pb-32">
      {/* Header section - Pure floating typography and light */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2.5">
          <Mail size={15} strokeWidth={1.5} className="text-[#fbf9f5]/50" />
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#fbf9f5]/40">
            PULSO // CORRESPONDÊNCIA
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-light tracking-tight text-white">
          Correspondência
        </h1>
        <p className="text-xs text-[#fbf9f5]/45 max-w-2xl font-light leading-relaxed">
          Inscrições, confirmações e falhas de envio.
        </p>
      </div>

      {/* Error Notice if fetch fails */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-500/10 text-rose-200 text-xs font-mono">
          <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium tracking-wide">FALHA DE SINTONIZAÇÃO</p>
            <p className="opacity-80 mt-1 text-[11px] font-sans font-light">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] tracking-widest uppercase transition-colors"
          >
            Reconectar
          </button>
        </div>
      )}

      {/* Luminous Metrics Cluster (Zero Cards/Borders) */}
      <CorrespondenceMetrics
        metrics={metrics}
        selectedFilter={filter}
        onSelectFilter={setFilter}
      />

      {/* Interactive Subscribers List & Controls */}
      <CorrespondenceList
        subscribers={subscribers}
        filter={filter}
        onFilterChange={setFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        loading={loading}
        onRefresh={loadData}
      />
    </div>
  );
}
