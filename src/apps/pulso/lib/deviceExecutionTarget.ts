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

export function executionTargetEnvelope(target: PulsoExecutionTarget): PulsoExecutionTargetEnvelope {
  if (target === 'auto') return { mode: 'auto' };
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

export function writeExecutionTarget(target: PulsoExecutionTarget, storage?: Storage) {
  storage?.setItem('pulso_execution_target_v1', target);
}
