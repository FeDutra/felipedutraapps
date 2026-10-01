'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import type { MesaArtifact } from '../MesaPanel';
import { MessageRenderer } from './MessageRenderer';

const PULSO_DOC_PATTERN = /<p(?:ulso|olso)-doc\s+id="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/p(?:ulso|olso)-doc>/i;

export function parsePulsoDocument(text: string, contextId?: string): {
  displayText: string;
  artifact: MesaArtifact | null;
} {
  const match = text.match(PULSO_DOC_PATTERN);
  if (!match) return { displayText: text, artifact: null };

  return {
    displayText: text.replace(PULSO_DOC_PATTERN, '').trim(),
    artifact: {
      id: match[1],
      title: match[2],
      content: match[3].trim(),
      contextId,
    },
  };
}

interface PulsoMessageContentProps {
  text: string;
  sender: 'user' | 'lotus' | 'system';
  contextId?: string;
  onOpenMesa: (artifact: MesaArtifact) => void;
}

export function PulsoMessageContent({ text, sender, contextId, onOpenMesa }: PulsoMessageContentProps) {
  const { displayText, artifact } = React.useMemo(
    () => parsePulsoDocument(text, contextId),
    [contextId, text],
  );

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 select-text" data-message-content>
      {displayText && <MessageRenderer text={displayText} sender={sender} />}
      {artifact && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMesa(artifact);
          }}
          className="flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left outline-none transition-all hover:bg-white/10 cursor-pointer select-none group"
        >
          <div className="rounded-lg bg-black/40 p-2 transition-colors group-hover:bg-black/60">
            <FileText size={16} className="text-white/70" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Abrir Mesa</span>
            <span className="text-sm font-medium text-white">{artifact.title}</span>
          </div>
        </button>
      )}
    </div>
  );
}
