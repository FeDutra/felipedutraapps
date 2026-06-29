import React from 'react';
import { useStateCacheStore, StateCacheState } from '@/lib/pulso/state/StateCacheStore';

export function SummaryCards() {
  const activeSummaryCards = useStateCacheStore((state: StateCacheState) => state.activeSummaryCards);
  const activeTaskEvent = useStateCacheStore((state: StateCacheState) => state.activeTaskEvent);

  if (!activeSummaryCards && !activeTaskEvent) {
    return null;
  }

  const renderCards = () => {
    if (!activeSummaryCards || activeSummaryCards.type !== 'daily_summary_cards') return null;
    const cards = activeSummaryCards.cards || [];
    return (
      <div className="flex flex-col gap-4">
        {cards.map((card: any, idx: number) => (
          <div key={idx} className="py-2 transition-all">
            <h4 className="text-white text-sm font-medium tracking-wide mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{card.title}</h4>
            <p className="text-white/80 text-xs mb-2 font-light leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{card.description}</p>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-white/60 uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{card.source}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTask = () => {
    if (!activeTaskEvent) return null;
    return (
      <div className="py-2 transition-all animate-pulse-slow">
        <h3 className="text-white/50 text-[9px] uppercase tracking-widest mb-1 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Evento Recebido</h3>
        <h4 className="text-white text-xs font-mono font-bold mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{activeTaskEvent.action}</h4>
        <p className="text-white/90 text-sm font-light mb-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{activeTaskEvent.payload?.title || 'Sem título'}</p>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[9px] text-white/50 font-mono tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">source: {activeTaskEvent.source}</span>
          <span className="text-[9px] text-white/80 font-mono tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">status: {activeTaskEvent.status}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed top-24 right-8 w-80 flex flex-col gap-4 z-50 pointer-events-none">
      {renderCards()}
      {renderTask()}
    </div>
  );
}
