import React from 'react';
import { Viewport } from 'next';
import BrowserMesaPage from '@/apps/pulso/pages/BrowserMesaPage';

export const metadata = {
  title: 'PULSO | Navegador',
  description: 'Navegador integrado da PULSO',
};

export const viewport: Viewport = {
  themeColor: '#0f0f0f',
};

export default function Page() {
  return (
    <React.Suspense fallback={<div className="h-[100dvh] bg-[#0f0f0f]" aria-label="Abrindo navegador" />}>
      <BrowserMesaPage />
    </React.Suspense>
  );
}
