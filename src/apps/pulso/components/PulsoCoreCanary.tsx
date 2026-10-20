'use client';

import React, { useEffect, useState } from 'react';
// Node 24's strip-types test harness resolves the source file directly and
// requires the explicit extension; Next/Turbopack also accepts this import.
// @ts-expect-error explicit .ts extension is intentional for the shared test/runtime module
import { createPulsoCoreClient, resolveTauriInvoke, waitForTauriInvoke, type PulsoCoreBootstrapSnapshot, type PulsoCoreClient, type PulsoCoreResult, type WaitForTauriInvokeOptions } from '../services/pulsoCoreClient.ts';

export type PulsoCoreCanaryStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface PulsoCoreCanarySnapshot {
  readonly status: PulsoCoreCanaryStatus;
  readonly message: string;
  readonly activeAreaId: string | null;
  readonly activeSessionId: string | null;
  readonly runtimeStatus: string | null;
  readonly errorCode: string | null;
}

export interface PulsoCoreCanaryProbeOptions extends WaitForTauriInvokeOptions {
  scope?: unknown;
  client?: Pick<PulsoCoreClient, 'bootstrap'>;
  onStateChange?: (snapshot: PulsoCoreCanarySnapshot) => void;
}

export interface PulsoCoreCanaryProps {
  scope?: unknown;
  timeoutMs?: number;
  intervalMs?: number;
  client?: Pick<PulsoCoreClient, 'bootstrap'>;
}

export interface PulsoCoreRenderedReceiptPayload {
  readonly status: 'connected';
  readonly activeAreaId: string | null;
  readonly activeSessionId: string | null;
  readonly runtimeStatus: string;
}

export const DEFAULT_CANARY_WAIT_TIMEOUT_MS = 1500;
export const DEFAULT_CANARY_WAIT_INTERVAL_MS = 50;

export const INITIAL_CANARY_SNAPSHOT: PulsoCoreCanarySnapshot = Object.freeze({
  status: 'idle',
  message: 'PULSO Core em espera: ambiente fora do Tauri.',
  activeAreaId: null,
  activeSessionId: null,
  runtimeStatus: null,
  errorCode: null,
});

export function createConnectingCanarySnapshot(): PulsoCoreCanarySnapshot {
  return Object.freeze({
    status: 'connecting',
    message: 'PULSO Core conectando ao núcleo local...',
    activeAreaId: null,
    activeSessionId: null,
    runtimeStatus: null,
    errorCode: null,
  });
}

export function createErrorCanarySnapshot(
  errorCode: string,
  reason: string
): PulsoCoreCanarySnapshot {
  return Object.freeze({
    status: 'error',
    message: `PULSO Core indisponível (${errorCode}: ${reason}).`,
    activeAreaId: null,
    activeSessionId: null,
    runtimeStatus: null,
    errorCode,
  });
}

export function isTauriEnvironment(
  scope: unknown = typeof globalThis !== 'undefined' ? globalThis : null
): boolean {
  if (!scope || typeof scope !== 'object') {
    return false;
  }
  if (resolveTauriInvoke(scope) !== null) {
    return true;
  }
  const candidate = scope as Record<string, unknown>;
  return Boolean(
    (candidate.__TAURI__ && typeof candidate.__TAURI__ === 'object') ||
      (candidate.__TAURI_INTERNALS__ && typeof candidate.__TAURI_INTERNALS__ === 'object') ||
      typeof candidate.__TAURI_IPC__ === 'function'
  );
}

export function isBootstrapPayloadComplete(
  payload: unknown
): payload is PulsoCoreBootstrapSnapshot {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  const live = candidate.live;
  const health = candidate.health;

  if (!live || typeof live !== 'object' || Array.isArray(live)) {
    return false;
  }
  if (!health || typeof health !== 'object' || Array.isArray(health)) {
    return false;
  }

  const liveRecord = live as Record<string, unknown>;
  const healthRecord = health as Record<string, unknown>;

  return (
    Array.isArray(liveRecord.areas) &&
    Array.isArray(liveRecord.sessions) &&
    typeof healthRecord.status === 'string' &&
    healthRecord.status.trim().length > 0
  );
}

export function evaluateCanaryBootstrapResult(
  response: PulsoCoreResult<PulsoCoreBootstrapSnapshot> | unknown
): PulsoCoreCanarySnapshot {
  if (!response || typeof response !== 'object') {
    return createErrorCanarySnapshot(
      'INVALID_BOOTSTRAP_RESPONSE',
      'Resposta vazia ou inválida do núcleo'
    );
  }

  const candidate = response as PulsoCoreResult<PulsoCoreBootstrapSnapshot>;
  if (candidate.ok !== true) {
    const code = candidate.error?.code || 'BOOTSTRAP_FAILED';
    const message = candidate.error?.message || 'Falha ao inicializar o PULSO Core';
    return createErrorCanarySnapshot(code, message);
  }

  if (!isBootstrapPayloadComplete(candidate.result)) {
    return createErrorCanarySnapshot(
      'INCOMPLETE_BOOTSTRAP_PAYLOAD',
      'Bootstrap do PULSO Core exige blocos live e health presentes'
    );
  }

  const runtimeStatus = candidate.result.health.status;
  const activeAreaId = candidate.result.live.activeAreaId ?? null;
  const activeSessionId = candidate.result.live.activeSessionId ?? null;

  return Object.freeze({
    status: 'connected',
    message: `PULSO Core conectado (runtime: ${runtimeStatus}; área: ${activeAreaId ?? 'nenhuma'}).`,
    activeAreaId,
    activeSessionId,
    runtimeStatus,
    errorCode: null,
  });
}

export function createRenderedReceiptPayload(
  snapshot: PulsoCoreCanarySnapshot
): PulsoCoreRenderedReceiptPayload | null {
  if (snapshot.status !== 'connected' || !snapshot.runtimeStatus) {
    return null;
  }
  return Object.freeze({
    status: 'connected',
    activeAreaId: snapshot.activeAreaId,
    activeSessionId: snapshot.activeSessionId,
    runtimeStatus: snapshot.runtimeStatus,
  });
}

export async function acknowledgeRenderedCanary(
  scope: unknown,
  snapshot: PulsoCoreCanarySnapshot
): Promise<boolean> {
  const payload = createRenderedReceiptPayload(snapshot);
  if (!payload) {
    return false;
  }
  const invoke = resolveTauriInvoke(scope);
  if (!invoke) {
    return false;
  }
  await invoke('core_canary_rendered', { payload });
  return true;
}

export function scheduleRenderedCanaryAcknowledgment(
  scope: unknown,
  snapshot: PulsoCoreCanarySnapshot,
  schedule?: (callback: () => void) => unknown
): boolean {
  if (!createRenderedReceiptPayload(snapshot)) {
    return false;
  }
  const candidate = scope as { requestAnimationFrame?: (callback: () => void) => unknown } | null;
  const scheduleAfterPaint =
    schedule ??
    (candidate && typeof candidate.requestAnimationFrame === 'function'
      ? candidate.requestAnimationFrame.bind(candidate)
      : (callback: () => void) => setTimeout(callback, 0));
  scheduleAfterPaint(() => {
    void acknowledgeRenderedCanary(scope, snapshot).catch(() => undefined);
  });
  return true;
}

export async function runPulsoCoreCanaryProbe(
  options: PulsoCoreCanaryProbeOptions = {}
): Promise<PulsoCoreCanarySnapshot> {
  const scope =
    'scope' in options
      ? options.scope
      : typeof globalThis !== 'undefined'
      ? globalThis
      : null;

  const notify = (snapshot: PulsoCoreCanarySnapshot): PulsoCoreCanarySnapshot => {
    options.onStateChange?.(snapshot);
    return snapshot;
  };

  if (!isTauriEnvironment(scope)) {
    return notify(INITIAL_CANARY_SNAPSHOT);
  }

  notify(createConnectingCanarySnapshot());

  const timeoutMs = options.timeoutMs ?? DEFAULT_CANARY_WAIT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_CANARY_WAIT_INTERVAL_MS;

  const invoke = await waitForTauriInvoke(scope, {
    timeoutMs,
    intervalMs,
    now: options.now,
    sleep: options.sleep,
  });

  if (!invoke) {
    return notify(
      createErrorCanarySnapshot(
        'BRIDGE_TIMEOUT',
        'Bridge Tauri v2 não ficou pronta dentro do tempo limite'
      )
    );
  }

  const client =
    options.client ??
    createPulsoCoreClient({
      scope,
      waitTimeoutMs: timeoutMs,
      waitIntervalMs: intervalMs,
    });

  try {
    const response = await client.bootstrap();
    return notify(evaluateCanaryBootstrapResult(response));
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : 'Exceção inesperada durante bootstrap do PULSO Core';
    return notify(createErrorCanarySnapshot('BOOTSTRAP_EXCEPTION', reason));
  }
}

export function PulsoCoreCanary(props: PulsoCoreCanaryProps = {}) {
  const [snapshot, setSnapshot] = useState<PulsoCoreCanarySnapshot>(INITIAL_CANARY_SNAPSHOT);
  const scope = props.scope ?? (typeof window !== 'undefined' ? window : globalThis);

  useEffect(() => {
    let cancelled = false;

    void runPulsoCoreCanaryProbe({
      scope,
      timeoutMs: props.timeoutMs,
      intervalMs: props.intervalMs,
      client: props.client,
      onStateChange: (next) => {
        if (!cancelled) {
          setSnapshot(next);
          scheduleRenderedCanaryAcknowledgment(scope, next);
        }
      },
    });

    return () => {
      cancelled = true;
    };
  }, [scope, props.timeoutMs, props.intervalMs, props.client]);

  return (
    <output
      className="sr-only"
      data-pulso-core-status={snapshot.status}
      aria-live="polite"
      aria-atomic="true"
    >
      {snapshot.message}
    </output>
  );
}

export default PulsoCoreCanary;
