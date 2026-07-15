import React from 'react';
import { Viewport } from 'next';
import OrbeTestPage from '@/apps/pulso/pages/OrbeTestPage';

export const metadata = {
  title: 'PULSO | Orbe Playground',
  description: 'Playground experimental local para testes físicos e comportamentais da Orbe da Lótus',
};

export const viewport: Viewport = {
  themeColor: '#b8283e',
};

export default function Page() {
  return (
    <React.Suspense fallback={<div className="h-[100dvh] bg-[#b8283e] flex items-center justify-center text-[#fbf9f5]/50 text-xs tracking-widest lowercase">carregando simulador da orbe...</div>}>
      <OrbeTestPage />
    </React.Suspense>
  );
}
