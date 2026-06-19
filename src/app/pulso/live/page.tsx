import React from 'react';
import { Viewport } from 'next';
import LivePage from '@/apps/pulso/pages/LivePage';

export const metadata = {
  title: 'PULSO | Lótus Live',
  description: 'Superfície conversacional de comando e estado vivo - Fê ↔ Lótus',
};

export const viewport: Viewport = {
  themeColor: '#d81842',
};

export default function Page() {
  return (
    <React.Suspense fallback={<div className="h-[100dvh] bg-[#111] flex items-center justify-center text-[#fbf9f5]/50 text-xs tracking-widest lowercase">sintonizando lótus live...</div>}>
      <LivePage />
    </React.Suspense>
  );
}
