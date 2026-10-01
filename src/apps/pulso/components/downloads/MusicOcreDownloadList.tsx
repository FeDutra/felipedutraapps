'use client';

import React, { useMemo } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { musicOcreDownloadService } from '../../services/musicOcreDownloadService';
import type { MusicOcreDownloadClient } from '../../types/musicOcreDownload.types';

interface Props {
  items: MusicOcreDownloadClient[];
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => void;
}

export function MusicOcreDownloadList({ items, loading, search, onSearch, onRefresh }: Props) {
  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.name} ${item.email}`.toLowerCase().includes(normalized)
    );
  }, [items, search]);

  return (
    <section className="flex flex-col gap-6" aria-label="Downloads do EP Pulsão">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <label className="flex items-center gap-3 text-[#fbf9f5]/45 focus-within:text-white transition-colors">
          <Search size={13} strokeWidth={1.4} />
          <span className="sr-only">Buscar por nome ou e-mail</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="nome ou e-mail"
            className="w-full sm:w-72 bg-transparent border-0 border-b border-white/10 focus:border-white/35 outline-none py-2 text-xs font-light text-white placeholder:text-white/25"
          />
        </label>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 self-start text-[9px] font-mono uppercase tracking-[0.22em] text-white/35 hover:text-white transition-colors"
        >
          <RefreshCw size={11} strokeWidth={1.3} className={loading ? 'animate-spin' : ''} />
          atualizar
        </button>
      </div>

      <div className="flex flex-col">
        <div className="hidden md:grid grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)_110px_170px] gap-6 pb-3 text-[8px] font-mono uppercase tracking-[0.22em] text-white/25">
          <span>pessoa</span>
          <span>e-mail</span>
          <span>retiradas</span>
          <span>última</span>
        </div>

        {loading ? (
          <p className="py-12 text-xs font-light text-white/35">sintonizando downloads…</p>
        ) : visibleItems.length === 0 ? (
          <p className="py-12 text-xs font-light text-white/35">
            {search ? 'nenhum registro encontrado.' : 'nenhum download registrado ainda.'}
          </p>
        ) : (
          visibleItems.map((item) => (
            <article
              key={item.id}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)_110px_170px] gap-1 md:gap-6 py-4 border-t border-white/[0.055] text-xs"
            >
              <span className="font-light text-white/90 truncate">{item.name || '—'}</span>
              <a
                href={`mailto:${item.email}`}
                className="font-mono text-[10px] text-white/50 hover:text-white transition-colors truncate"
              >
                {item.email}
              </a>
              <span className="font-mono text-[10px] text-white/40">
                {item.downloadCount}×
              </span>
              <time className="font-mono text-[9px] text-white/35">
                {musicOcreDownloadService.formatDate(item.lastDownloadedAt)}
              </time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
