import React from 'react';
import { Viewport } from 'next';
import LivePage from '@/apps/pulso/pages/LivePage';

export const metadata = {
  title: 'PULSO | Lótus Live',
  description: 'Superfície conversacional de comando e estado vivo - Fê ↔ Lótus',
};

export const viewport: Viewport = {
  themeColor: '#b8283e',
};

export default function Page() {
  return (
    <React.Suspense fallback={
      <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#080808] px-5 pb-4 pt-4 text-[#fbf9f5]" style={{ backgroundColor: '#080808', color: '#fbf9f5' }} aria-label="Sintonizando Lótus">
        <p className="text-[8px] font-medium uppercase tracking-[0.22em] text-white/25">PULSO · presença contextual</p>
        <h1 className="mt-1 text-[18px] font-light tracking-[0.08em] text-white/90">LÓTUS</h1>
        <div className="mt-4 h-px bg-white/[0.06]" />
        <div className="flex flex-1 flex-col justify-center pb-20"><p className="text-[9px] uppercase tracking-[0.2em] text-[#b8283e]/70">lótus · sintonizando</p><p className="mt-3 max-w-[28ch] text-[12px] font-light leading-5 text-white/38">Estou recuperando a continuidade sem interromper sua navegação.</p></div>
      </div>
    }>
      <LivePage />
    </React.Suspense>
  );
}
