import { create } from 'zustand';
import { PulsoLedgerEvent } from '../ledger/types';

export interface StateCacheState {
  recentEvents: PulsoLedgerEvent[];
  activeSummaryCards: any | null;
  activeTaskEvent: PulsoLedgerEvent | null;
  addEvent: (event: PulsoLedgerEvent) => void;
  setSummaryCards: (payload: any) => void;
  clearSummaryCards: () => void;
  setActiveTaskEvent: (event: PulsoLedgerEvent | null) => void;
}

export const useStateCacheStore = create<StateCacheState>((set) => ({
  recentEvents: [],
  activeSummaryCards: null,
  activeTaskEvent: null,
  addEvent: (event: PulsoLedgerEvent) => set((state: StateCacheState) => ({ 
    // Mantém os 50 mais recentes
    recentEvents: [event, ...state.recentEvents].slice(0, 50) 
  })),
  setSummaryCards: (payload: any) => set({ activeSummaryCards: payload }),
  clearSummaryCards: () => set({ activeSummaryCards: null }),
  setActiveTaskEvent: (event: PulsoLedgerEvent | null) => set({ activeTaskEvent: event }),
}));
