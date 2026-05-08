'use client';

import React from 'react';
import Link from 'next/link';
import { Status, Priority, Severity } from '../types/pulso.types';
import { getStatusTheme, getPriorityTheme, getSeverityTheme } from '../utils/pulsoUIHelpers';
import { getStatusLabel, getPriorityLabel } from '../utils/statusHelpers';

export const SemanticDot = ({ theme, size = 'w-1.5 h-1.5' }: { theme: any, size?: string }) => (
  <div className={`${size} rounded-full ${theme.dot} ${theme.glow}`} />
);

export const StatusBadge = ({ status }: { status: Status }) => {
  const theme = getStatusTheme(status);
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${theme.bg} ${theme.border} ${theme.text}`}>
      {getStatusLabel(status)}
    </span>
  );
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const theme = getPriorityTheme(priority);
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${theme.bg} ${theme.border} ${theme.text}`}>
      {getPriorityLabel(priority)}
    </span>
  );
};

export const PulsoHeader = ({ title = 'PULSO', subtitle = 'central viva do ecossistema de Felipe Dutra', systemStatus = 'Sincronizado' }) => (
  <header className="mb-12">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
          {title}
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
        </h1>
        <p className="text-sm text-white/40 font-medium tracking-tight mt-1">{subtitle}</p>
      </div>
      
      <Link href="/pulso/health" className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md hover:bg-white/10 transition-all group">
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">System Status</p>
          <p className="text-xs font-bold text-emerald-400">{systemStatus}</p>
        </div>
        <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-white/5 group-hover:border-emerald-500/50 transition-all">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </Link>
    </div>
  </header>
);
