'use client';

import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { formatSiteConversationDate } from '../../services/siteConversationHelpers';
import type { SiteConversationSummary, SiteConversationThread } from '../../types/siteConversation.types';

interface Props {
  conversation: SiteConversationSummary | null;
  thread: SiteConversationThread | null;
  loading: boolean;
  onBack: () => void;
}

function TurnStatus({ status }: { status: SiteConversationThread['turns'][number]['status'] }) {
  if (status === 'success') return null;
  const label = status === 'error' ? 'falhou' : status === 'running' ? 'Lótus elaborando' : 'aguardando Lótus';
  return (
    <p className={`mt-3 font-mono text-[8px] uppercase tracking-[0.18em] ${status === 'error' ? 'text-rose-300/70' : 'text-[#fbf9f5]/28'}`}>
      {label}
    </p>
  );
}

export function SiteConversationThread({ conversation, thread, loading, onBack }: Props) {
  if (!conversation) {
    return (
      <section className="hidden lg:flex min-h-[62vh] items-center justify-center">
        <div className="max-w-xs text-center">
          <div className="mx-auto h-20 w-20 rounded-full border border-white/15" />
          <p className="mt-8 text-sm font-light text-[#fbf9f5]/42">Escolha um fio para ler.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 lg:pl-10">
      <header className="pb-6 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden mb-6 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#fbf9f5]/45 hover:text-white"
        >
          <ArrowLeft size={13} /> fios
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#fbf9f5]/35">
              {conversation.status === 'blocked' ? 'conversa bloqueada' : 'conversa ativa'}
            </p>
            <h2 className="mt-2 truncate text-xl sm:text-2xl font-light tracking-tight text-white">
              {conversation.visitorName || 'Visitante'}
            </h2>
            <a
              href={conversation.visitorEmail ? `mailto:${conversation.visitorEmail}` : undefined}
              className={`mt-2 inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wide text-[#fbf9f5]/38 ${conversation.visitorEmail ? 'hover:text-white' : 'pointer-events-none'}`}
            >
              {conversation.visitorEmail || 'e-mail não informado'}
              {conversation.visitorEmail && <ExternalLink size={9} />}
            </a>
          </div>
          <p className="shrink-0 text-right font-mono text-[8px] leading-relaxed tracking-wide text-[#fbf9f5]/28">
            iniciado em<br />{formatSiteConversationDate(conversation.createdAt)}
          </p>
        </div>
      </header>

      <div className="py-8 sm:py-10">
        {loading && !thread ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#fbf9f5]/30">
            Abrindo o fio…
          </p>
        ) : !thread || thread.turns.length === 0 ? (
          <p className="text-sm font-light text-[#fbf9f5]/40">Este fio ainda não tem mensagens legíveis.</p>
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {thread.turns.map((turn) => (
              <article key={turn.requestId} className="space-y-7">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
                      {conversation.visitorName || 'Visitante'}
                    </p>
                    <time className="font-mono text-[8px] tracking-wide text-[#fbf9f5]/24">
                      {formatSiteConversationDate(turn.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] sm:text-base font-light leading-7 text-[#fbf9f5]/82">
                    {turn.userText}
                  </p>
                </div>

                {turn.responseText && (
                  <div className="pl-5 sm:pl-7 border-l border-white/12">
                    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#fbf9f5]/35">
                      Lótus
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-[15px] sm:text-base font-light leading-7 text-[#fbf9f5]/72">
                      {turn.responseText}
                    </p>
                  </div>
                )}

                <TurnStatus status={turn.status} />
              </article>
            ))}
          </div>
        )}
      </div>

      <footer className="pt-5 border-t border-white/10 font-mono text-[8px] uppercase tracking-[0.18em] text-[#fbf9f5]/25">
        leitura interna · a resposta continua acontecendo no site
      </footer>
    </section>
  );
}
