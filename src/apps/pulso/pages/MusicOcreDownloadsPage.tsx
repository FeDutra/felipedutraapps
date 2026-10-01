'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { authService } from '@/shared/services/authService';
import { MusicOcreDownloadList } from '../components/downloads/MusicOcreDownloadList';
import { musicOcreDownloadService } from '../services/musicOcreDownloadService';
import type { MusicOcreDownloadClient } from '../types/musicOcreDownload.types';

export default function MusicOcreDownloadsPage() {
  const [items, setItems] = useState<MusicOcreDownloadClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.ensurePulsoAuthReady();
      setItems(await musicOcreDownloadService.getDownloads());
    } catch (failure: unknown) {
      console.error('[PULSO_MUSIC_OCRE_DOWNLOADS]', failure);
      setError(failure instanceof Error ? failure.message : 'não foi possível ler os downloads agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // A leitura remota é o efeito desta tela; o estado é atualizado por load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const metrics = useMemo(() => musicOcreDownloadService.metrics(items), [items]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-10 pb-32">
      <header className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2.5">
          <Download size={15} strokeWidth={1.4} className="text-[#fbf9f5]/50" />
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#fbf9f5]/40">
            PULSO // MÚSICA OCRE
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-light tracking-tight text-white">Downloads</h1>
        <p className="text-xs text-[#fbf9f5]/45 max-w-2xl font-light leading-relaxed">
          Pessoas que retiraram o EP Pulsão pelo site.
        </p>
      </header>

      <section className="flex flex-wrap gap-x-12 gap-y-6" aria-label="Resumo dos downloads">
        <Metric label="pessoas" value={metrics.people} />
        <Metric label="downloads" value={metrics.downloads} />
        <Metric label="últimos 7 dias" value={metrics.lastSevenDays} />
      </section>

      {error && (
        <div className="flex items-start gap-3 text-rose-200 text-xs font-mono">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <MusicOcreDownloadList
        items={items}
        loading={loading}
        search={search}
        onSearch={setSearch}
        onRefresh={load}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <strong className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">{value}</strong>
      <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/30">{label}</span>
    </div>
  );
}
