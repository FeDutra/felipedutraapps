'use client';

import React from 'react';
import type { CorrespondenceMetrics as MetricsType, StatusFilterOption } from '../../types/correspondence.types';

interface Props {
  metrics: MetricsType;
  selectedFilter: StatusFilterOption;
  onSelectFilter: (filter: StatusFilterOption) => void;
}

export function CorrespondenceMetrics({ metrics, selectedFilter, onSelectFilter }: Props) {
  const items: Array<{
    id: StatusFilterOption;
    label: string;
    value: number;
    colorClass: string;
    glowClass: string;
  }> = [
    {
      id: 'all',
      label: 'Total · Registros',
      value: metrics.total,
      colorClass: 'text-white',
      glowClass: 'group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]'
    },
    {
      id: 'active',
      label: 'Presenças · Ativas',
      value: metrics.active,
      colorClass: 'text-emerald-400',
      glowClass: 'group-hover:drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]'
    },
    {
      id: 'pending',
      label: 'Aguardando · Eco',
      value: metrics.pending,
      colorClass: 'text-amber-300',
      glowClass: 'group-hover:drop-shadow-[0_0_12px_rgba(252,211,77,0.4)]'
    },
    {
      id: 'error',
      label: 'Anomalias · Falhas',
      value: metrics.error,
      colorClass: 'text-rose-400',
      glowClass: 'group-hover:drop-shadow-[0_0_12px_rgba(251,113,133,0.4)]'
    },
    {
      id: 'unsubscribed',
      label: 'Dissipados · Saída',
      value: metrics.unsubscribed,
      colorClass: 'text-white/40',
      glowClass: 'group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-10 py-6">
      {items.map((item) => {
        const isSelected = selectedFilter === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectFilter(isSelected && item.id !== 'all' ? 'all' : item.id)}
            className="group flex flex-col items-start text-left bg-transparent border-none p-0 cursor-pointer transition-all duration-300"
          >
            <span
              className={`text-2xl sm:text-3xl font-light font-mono tracking-tight transition-all duration-300 ${item.colorClass} ${item.glowClass} ${
                isSelected ? 'drop-shadow-[0_0_14px_rgba(255,255,255,0.5)] font-normal' : 'opacity-85'
              }`}
            >
              {item.value}
            </span>
            <span
              className={`mt-1.5 text-[9px] font-mono tracking-[0.22em] uppercase transition-colors duration-300 ${
                isSelected ? 'text-white font-medium' : 'text-[#fbf9f5]/35 group-hover:text-[#fbf9f5]/70'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
