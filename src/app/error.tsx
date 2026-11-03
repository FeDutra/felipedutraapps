'use client';

import React from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function PulsoDesktopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    const payload = JSON.stringify({
      stage: 'react_error_boundary',
      message: error.message,
      digest: error.digest || null,
      stack: error.stack?.slice(0, 8_000) || null,
      userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    });
    void invoke('desktop_boot_probe', { payload }).catch(() => undefined);
  }, [error]);

  return (
    <main className="theme-her flex h-[100dvh] items-center justify-center overflow-hidden px-8 text-[#fbf9f5]">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-2xl">
        <p className="mb-3 text-[9px] uppercase tracking-[0.28em] text-white/35">PULSO Next Preview</p>
        <h1 className="mb-3 text-xl font-light tracking-tight">O Core não conseguiu abrir esta superfície.</h1>
        <p className="mb-7 text-sm font-light leading-relaxed text-white/55">
          A falha foi registrada localmente para diagnóstico. Nenhuma área ou sessão foi substituída por conteúdo padrão.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          tentar novamente
        </button>
      </section>
    </main>
  );
}
