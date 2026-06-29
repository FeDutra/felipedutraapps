import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/client';
import { useStateCacheStore } from '../state/StateCacheStore';
import { PulsoLedgerEvent } from './types';

export class ActionLedgerClient {
  private unsubscribe: (() => void) | null = null;
  private initialized = false;

  startListening() {
    if (this.unsubscribe) return;

    console.log('[ActionLedgerClient] Iniciando listener de eventos na coleção workspaces/felipe_dutra/pulso_events...');

    const eventsRef = collection(db, 'workspaces/felipe_dutra/pulso_events');
    const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(10));

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignora a primeira leitura para não carregar eventos muito velhos, a menos que seja intencional.
      // Para esta fase mínima, processaremos tudo para garantir que mock events criados antes de abrir a aba funcionem.
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const event = { id: change.doc.id, ...change.doc.data() } as PulsoLedgerEvent;

          // Validação de segurança estrita
          const validSurfaces = ['openclaw', 'local', 'pulso'];
          const validStatuses = ['pending', 'running', 'success', 'failed'];
          const validActions = ['system.ledger_ping', 'notion.create_task', 'daily_summary_cards', 'local.open_url'];

          if (event.source !== 'lotus_openclaw') {
            console.warn('[ActionLedgerClient] Ignorando evento de source desconhecida:', event.source);
            return;
          }
          if (!validSurfaces.includes(event.surface)) {
            console.warn('[ActionLedgerClient] Ignorando evento de surface inválida:', event.surface);
            return;
          }
          if (!validStatuses.includes(event.status)) {
            console.warn('[ActionLedgerClient] Ignorando evento de status inválido:', event.status);
            return;
          }
          if (!validActions.includes(event.action)) {
            console.warn('[ActionLedgerClient] Ignorando evento com action não permitida:', event.action);
            return;
          }

          console.log('[ActionLedgerClient] Novo evento recebido:', event);
          
          useStateCacheStore.getState().addEvent(event);

          // Roteamento simples
          if (event.action === 'daily_summary_cards' && event.payload) {
             useStateCacheStore.getState().setSummaryCards(event.payload);
          } else if (event.action === 'notion.create_task' || event.action === 'system.ledger_ping') {
             useStateCacheStore.getState().setActiveTaskEvent(event);
             setTimeout(() => {
                const state = useStateCacheStore.getState();
                if (state.activeTaskEvent?.id === event.id) {
                    state.setActiveTaskEvent(null);
                }
             }, 5000);
          }
        }
      });
      
      this.initialized = true;
    }, (error) => {
      console.error('[ActionLedgerClient] Erro ao escutar eventos:', error);
    });
  }

  stopListening() {
    if (this.unsubscribe) {
      console.log('[ActionLedgerClient] Parando listener de eventos.');
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// Exportar uma instância singleton
export const actionLedgerClient = new ActionLedgerClient();
