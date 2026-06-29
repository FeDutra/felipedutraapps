import React from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/client';
import { useStateCacheStore } from '@/lib/pulso/state/StateCacheStore';
import { invoke } from '@tauri-apps/api/core';

export function PulsoDebugPanel() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const clearSummaryCards = useStateCacheStore(state => state.clearSummaryCards);

  const insertMockTask = async () => {
    try {
      const mockEvent: any = {
        id: 'debug_' + Date.now(),
        source: "lotus_openclaw",
        intent: "Criar tarefa para revisão de arte",
        action: "notion.create_task",
        target: "notion/db_test",
        payload: {
          title: "Revisar arte do cliente",
          assignee: "Fulano"
        },
        status: "success",
        surface: "openclaw",
        createdAt: new Date().toISOString()
      };
      
      // Força a renderização na UI imediatamente
      useStateCacheStore.getState().setActiveTaskEvent(mockEvent);
      setTimeout(() => useStateCacheStore.getState().setActiveTaskEvent(null), 5000);

      const eventsRef = collection(db, 'workspaces/felipe_dutra/pulso_events');
      await addDoc(eventsRef, mockEvent);
      console.log('Evento mock de task inserido com sucesso!');
    } catch (error) {
      console.error('Erro ao inserir mock de task:', error);
    }
  };

  const insertMockCards = async () => {
    try {
      const payload = {
        type: "daily_summary_cards",
        cards: [
          {
            title: "Prioridade 1",
            description: "Finalizar arte do cliente.",
            source: "notion"
          },
          {
            title: "Responder cliente",
            description: "Cliente perguntou sobre prazo no WhatsApp.",
            source: "whatsapp"
          }
        ]
      };

      // Força a renderização na UI imediatamente
      useStateCacheStore.getState().setSummaryCards(payload);

      const eventsRef = collection(db, 'workspaces/felipe_dutra/pulso_events');
      await addDoc(eventsRef, {
        source: "lotus_openclaw",
        intent: "Resumo do dia",
        action: "daily_summary_cards",
        status: "success",
        surface: "openclaw",
        payload: payload,
        createdAt: new Date().toISOString()
      });
      console.log('Evento mock de cards inserido com sucesso!');
    } catch (error) {
      console.error('Erro ao inserir mock de cards:', error);
    }
  };

  const testLocalUrl = async () => {
    try {
      await invoke('local_open_url', { url: 'https://google.com' });
      console.log('Comando local executado com sucesso!');
    } catch (error) {
      console.error('Erro ao executar tauri local_open_url:', error);
      alert('Erro ao rodar comando Tauri (talvez rodando na web?): ' + String(error));
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2">
      <div className="backdrop-blur-md p-2 transition-all flex flex-col gap-1 items-start">
        <h3 className="text-white/50 text-[9px] uppercase tracking-widest font-bold mb-2 ml-1 drop-shadow-md">Debug Menu</h3>
        <button onClick={insertMockTask} className="text-left text-[11px] text-white/80 hover:text-white p-1 transition-colors font-mono drop-shadow-md">notion.create_task</button>
        <button onClick={insertMockCards} className="text-left text-[11px] text-white/80 hover:text-white p-1 transition-colors font-mono drop-shadow-md">daily_summary_cards</button>
        <button onClick={testLocalUrl} className="text-left text-[11px] text-white/80 hover:text-white p-1 transition-colors font-mono drop-shadow-md">local.open_url</button>
        <button onClick={clearSummaryCards} className="text-left text-[11px] text-white/50 hover:text-white/80 p-1 transition-colors mt-2 font-mono drop-shadow-md">Limpar_cards()</button>
      </div>
    </div>
  );
}
