import React from 'react';
import { Viewport } from 'next';
import LivePage from '@/apps/pulso/pages/LivePage';

export const metadata = {
  title: 'PULSO | Lótus Live',
  description: 'Superfície conversacional de comando e estado vivo - Fê ↔ Lótus',
};

export const viewport: Viewport = {
  themeColor: '#b8544a',
};

export default function Page() {
  return <LivePage />;
}
