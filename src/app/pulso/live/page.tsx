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
      <div className="theme-her h-[100dvh] flex items-center justify-center overflow-hidden" aria-label="Abrindo Pulso">
        <div className="pulso-auth-lotus" aria-hidden="true">
          <div className="pulso-auth-lotus-halo" />
          <div className="pulso-auth-lotus-ring" />
        </div>
      </div>
    }>
      <LivePage />
    </React.Suspense>
  );
}
