import { invoke } from '@tauri-apps/api/core';
import { localActions } from './localActions';
import { classifyPresenceWork, PresenceWorkKind } from '../presence/PresenceWorkRouter';

export interface LocalPresenceFastPathResult {
  handled: boolean;
  action?: 'open_app' | 'play_music' | 'close_mesa' | 'local_read' | 'quick_read' | 'social_exchange';
  target?: string;
  responseText?: string;
  durationMs?: number;
  routeKind?: PresenceWorkKind;
  capability?: string;
}

interface LocalRuntimeHealth {
  capability: 'runtime_health';
  ok: boolean;
  durationMs: number;
  architecture: string;
  hermesProfileReady: boolean;
  hermesGatewayActive: boolean;
  ollamaActive: boolean;
  kokoroActive: boolean;
  localSttActive: boolean;
  whatsappBridgeActive: boolean;
}

function normalize(input: string) {
  return input
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requestsLocalRuntimeHealth(input: string) {
  const normalized = normalize(input);
  return /^(?:lotus\s+)?(?:(?:me\s+)?(?:mostra|diz|ve|verifica|checa)\s+)?(?:o\s+)?(?:status|estado|saude)(?:\s+(?:da|do))?\s+(?:ponte\s+local|modo\s+presenca|presenca\s+local|executor\s+local|hermes)(?:\s+por\s+favor)?$/.test(normalized)
    || /^(?:lotus\s+)?(?:a\s+)?ponte\s+local\s+(?:esta|ta)\s+funcionando$/.test(normalized);
}

function isTauriDesktop() {
  if (typeof window === 'undefined') return false;
  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return window.location.protocol === 'tauri:'
    || window.location.protocol === 'file:'
    || Boolean(tauriWindow.__TAURI__)
    || Boolean(tauriWindow.__TAURI_INTERNALS__);
}

export async function executeLocalPresenceFastPath(input: string): Promise<LocalPresenceFastPathResult> {
  if (!isTauriDesktop()) return { handled: false };

  if (requestsLocalRuntimeHealth(input)) {
    const startedAt = performance.now();
    try {
      const health = await invoke<LocalRuntimeHealth>('local_presence_read', {
        capability: 'runtime_health',
      });
      const unavailable: string[] = [];
      if (!health.hermesProfileReady) unavailable.push('perfil Hermes');
      if (!health.ollamaActive) unavailable.push('modelo local');
      if (!health.kokoroActive) unavailable.push('áudio local');
      if (!health.localSttActive) unavailable.push('transcrição local');

      const responseText = unavailable.length === 0
        ? 'A ponte local está ativa. O perfil isolado, o modelo e o áudio local estão disponíveis.'
        : `A ponte local respondeu, mas ${unavailable.join(', ')} ${unavailable.length === 1 ? 'não está disponível' : 'não estão disponíveis'}.`;

      return {
        handled: true,
        action: 'local_read',
        target: 'runtime_health',
        responseText,
        durationMs: Math.round(performance.now() - startedAt),
        routeKind: 'local_reflex',
        capability: 'runtime_health',
      };
    } catch (error) {
      console.error('[PresenceLocalBroker] Falha na leitura de saúde:', error);
      return {
        handled: true,
        action: 'local_read',
        target: 'runtime_health',
        responseText: 'A ponte local não respondeu. Vou deixar essa consulta no fluxo principal.',
        durationMs: Math.round(performance.now() - startedAt),
        routeKind: 'local_reflex',
        capability: 'runtime_health',
      };
    }
  }

  const decision = classifyPresenceWork(input);
  if (decision.kind !== 'local_reflex' || !decision.target) {
    return { handled: false };
  }

  const startedAt = performance.now();
  if (decision.localAction === 'play_music') {
    const result = await localActions.playMusic(decision.target);
    return {
      handled: true,
      action: 'play_music',
      target: decision.target,
      responseText: result,
      durationMs: Math.round(performance.now() - startedAt),
      routeKind: 'local_reflex',
      capability: 'play_music',
    };
  }
  if (decision.localAction !== 'open_app') return { handled: false };
  const result = await localActions.openApp(decision.target);
  const durationMs = Math.round(performance.now() - startedAt);
  const failed = result.toLocaleLowerCase('pt-BR').includes('problema');

  return {
    handled: true,
    action: 'open_app',
    target: decision.target,
    responseText: failed ? result : `Abri o ${decision.spokenTarget || decision.target}.`,
    durationMs,
    routeKind: 'local_reflex',
    capability: 'open_app',
  };
}
