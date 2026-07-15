import React from 'react';
import { Viewport } from 'next';
import OrbLabPage from '@/apps/pulso/pages/OrbLabPage';

export const metadata = {
  title: 'PULSO | Lótus Somatic Lab',
  description: 'Laboratório somático de pesquisa, comportamento e direção artística da Orbe da Lótus',
};

export const viewport: Viewport = {
  themeColor: '#b8283e',
};

export default function Page() {
  return (
    <React.Suspense fallback={<div className="h-[100dvh] bg-[#b8283e] flex items-center justify-center text-[#fbf9f5]/50 text-xs tracking-widest lowercase">carregando laboratório somático...</div>}>
      <OrbLabPage />
    </React.Suspense>
  );
}
