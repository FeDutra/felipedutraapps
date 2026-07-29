'use client';

import React from 'react';
import { PulsoContextNode } from '../../types/pulso.types';

interface VideoStudioProps {
  activeContextNode: PulsoContextNode | null;
}

export default function VideoStudio({ activeContextNode }: VideoStudioProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in gap-4 select-none">
      <span className="text-[#fbf9f5]/15 text-[11px] tracking-[0.2em] uppercase">
        estúdio de vídeo
      </span>
      <span className="text-[#fbf9f5]/10 text-[9px] tracking-[0.15em] lowercase max-w-xs leading-relaxed">
        criação, edição e renderização de narrativas visuais da lótus em desenvolvimento.
      </span>
      <span className="w-1.5 h-1.5 rounded-full bg-[#fbf9f5]/20 animate-ping mt-2" />
    </div>
  );
}
