export type LedgerEventStatus = 'pending' | 'running' | 'success' | 'failed';
export type LedgerEventSurface = 'openclaw' | 'pulso' | 'local';

export interface PulsoLedgerEvent {
  id: string;
  source: string; // 'lotus_openclaw' | 'pulso_app' | 'pulso_internal_ai' | 'local_machine_agent' | 'user'
  intent: string;
  action: string;
  target?: string;
  payload?: any;
  status: LedgerEventStatus;
  result?: any;
  externalRefs?: Record<string, string>;
  surface: LedgerEventSurface;
  createdAt: string;
  executedAt?: string;
}
