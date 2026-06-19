'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function PulsoRootPage() {
  const router = useRouter();

  React.useEffect(() => {
    const checkIsTauri = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.location.protocol === 'tauri:' ||
        window.location.protocol === 'file:' ||
        !!(window as any).__TAURI__ ||
        !!(window as any).__TAURI_INTERNALS__
      );
    };

    if (checkIsTauri()) {
      router.replace('/pulso/live');
    } else {
      router.replace('/pulso/cockpit');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
      <div className="w-8 h-8 border border-white/20 border-t-white rounded-full animate-spin mb-4" />
      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Redirecionando...</p>
    </div>
  );
}
