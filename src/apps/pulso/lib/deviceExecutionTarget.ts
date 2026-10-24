export type PulsoDeviceKey = 'imac' | 'macbook';
export type PulsoExecutionTarget = 'auto' | PulsoDeviceKey;

export interface PulsoDeviceProjection {
  key: PulsoDeviceKey;
  nodeId: string;
  connected: boolean;
  operable: boolean;
  lastSeenAtMs: number | null;
}

export interface PulsoExecutionTargetEnvelope {
  mode: 'auto' | 'device';
  deviceKey?: PulsoDeviceKey;
  nodeId?: string;
  originAssertion?: PulsoDeviceOriginAssertion;
}

export interface PulsoDeviceOriginAssertion {
  version: 1;
  installationId: string;
  issuedAtMs: number;
  signature: string;
}

export interface PulsoDeviceOriginStatus {
  configured: boolean;
  installationId?: string | null;
  deviceKey?: PulsoDeviceKey | null;
}

export const PULSO_DEVICE_IDENTITIES: Record<PulsoDeviceKey, { nodeId: string; accessibleName: string }> = {
  imac: {
    nodeId: '2ebf570d0a71ff10bf5c6b5491929be05c8c8786168108993a5efe3c986074db',
    accessibleName: 'iMac',
  },
  macbook: {
    nodeId: 'cd9a9e9a737df7280bb62480369e143c61ee9316c80408199754f813c222bba3',
    accessibleName: 'MacBook',
  },
};

export const DEVICE_PRESENCE_MAX_AGE_MS = 45_000;

export function isDeviceAvailable(
  device: PulsoDeviceProjection | undefined,
  now = Date.now(),
): boolean {
  if (!device?.connected || !device.operable || !device.lastSeenAtMs) return false;
  return now - device.lastSeenAtMs <= DEVICE_PRESENCE_MAX_AGE_MS;
}

export async function readLocalDeviceOrigin(): Promise<PulsoDeviceOriginStatus> {
  if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) {
    return { configured: false };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const status = await invoke<PulsoDeviceOriginStatus>('local_device_origin_status');
    if (!status.configured || (status.deviceKey !== 'imac' && status.deviceKey !== 'macbook')) {
      return { configured: false };
    }
    return status;
  } catch {
    return { configured: false };
  }
}

export async function executionTargetEnvelope(
  target: PulsoExecutionTarget,
  requestId: string,
): Promise<PulsoExecutionTargetEnvelope> {
  if (target === 'auto') {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return { mode: 'auto' };
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const originAssertion = await invoke<PulsoDeviceOriginAssertion>('local_device_origin_assert', { requestId });
      return { mode: 'auto', originAssertion };
    } catch {
      return { mode: 'auto' };
    }
  }
  return {
    mode: 'device',
    deviceKey: target,
    nodeId: PULSO_DEVICE_IDENTITIES[target].nodeId,
  };
}

export function readExecutionTarget(storage?: Storage): PulsoExecutionTarget {
  if (!storage) return 'auto';
  const value = storage.getItem('pulso_execution_target_v1');
  return value === 'imac' || value === 'macbook' ? value : 'auto';
}

// A escolha manual é uma preferência durável, não uma autorização exclusiva.
// O runtime pode usar o outro Mac confiável quando ele estiver disponível e a
// máquina preferida não estiver operável.
export function writeExecutionTarget(target: PulsoExecutionTarget, storage?: Storage) {
  storage?.setItem('pulso_execution_target_v1', target);
}
