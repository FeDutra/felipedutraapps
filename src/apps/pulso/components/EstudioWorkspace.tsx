'use client';

import React from 'react';
import { PulsoContextNode } from '../types/pulso.types';
import VideoStudio from './video/VideoStudio';

type SubStudio = 'video' | 'design' | 'image' | 'music' | 'app' | 'web';

interface EstudioWorkspaceProps {
  activeContextNode: PulsoContextNode | null;
  isActive: boolean;
}

export default function EstudioWorkspace({ activeContextNode, isActive }: EstudioWorkspaceProps) {
  const [activeSubStudio, setActiveSubStudio] = React.useState<SubStudio>('video');

  if (!isActive) return null;

  const studios: { id: SubStudio; label: string }[] = [
    { id: 'video', label: 'vídeo' },
    { id: 'design', label: 'design' },
    { id: 'image', label: 'imagem' },
    { id: 'music', label: 'música' },
    { id: 'app', label: 'app' },
    { id: 'web', label: 'web' },
  ];

  return (
    <div className="w-full h-full bg-[#030303] text-[#fbf9f5] font-mono flex flex-col items-center p-6 md:p-12 relative overflow-hidden select-none animate-fade-in">
      {/* Luz Difusa de Fundo */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#fbf9f5]/[0.015] blur-[120px] pointer-events-none z-0" />
      
      {/* Sub-navegação do Estúdio */}
      <div className="flex items-center justify-center gap-6 md:gap-10 mb-8 z-10 select-none">
        {studios.map((studio) => {
          const isCurrent = activeSubStudio === studio.id;
          return (
            <button
              key={studio.id}
              onClick={() => setActiveSubStudio(studio.id)}
              className={`text-[10px] md:text-xs font-light tracking-[0.25em] lowercase bg-transparent border-none outline-none cursor-pointer transition-all duration-500 py-1 ${
                isCurrent 
                  ? 'text-[#fbf9f5] font-bold drop-shadow-[0_0_8px_rgba(251,249,245,0.45)] animate-pulse' 
                  : 'text-[#fbf9f5]/20 hover:text-[#fbf9f5]/60'
              }`}
            >
              [ {studio.label} ]
            </button>
          );
        })}
      </div>

      {/* Área Principal de Exibição */}
      <div className="flex-1 w-full max-w-5xl flex flex-col z-10 min-h-0">
        {activeSubStudio === 'video' ? (
          <VideoStudio activeContextNode={activeContextNode} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in gap-4">
            <span className="text-[#fbf9f5]/15 text-[11px] tracking-[0.2em] uppercase select-none">
              estúdio de {activeSubStudio}
            </span>
            <span className="text-[#fbf9f5]/10 text-[9px] tracking-[0.15em] lowercase max-w-xs leading-relaxed select-none">
              {activeSubStudio === 'design' && 'pesquisa de tipografia, identidades e open design em desenvolvimento.'}
              {activeSubStudio === 'image' && 'gerador de texturas, shaders e composições generativas em desenvolvimento.'}
              {activeSubStudio === 'music' && 'síntese sonora e alinhamento de bpm em desenvolvimento.'}
              {activeSubStudio === 'app' && 'reaproveitamento de assets e design systems integrados em desenvolvimento.'}
              {activeSubStudio === 'web' && 'compilação e deploy de interfaces etéreas em desenvolvimento.'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbf9f5]/20 animate-ping mt-2" />
          </div>
        )}
      </div>
    </div>
  );
}
