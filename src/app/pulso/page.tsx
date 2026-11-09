'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function PulsoRootPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace('/pulso/live/');
  }, [router]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
      <div className="w-8 h-8 border border-white/20 border-t-white rounded-full animate-spin mb-4" />
      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Redirecionando...</p>
    </div>
  );
}
