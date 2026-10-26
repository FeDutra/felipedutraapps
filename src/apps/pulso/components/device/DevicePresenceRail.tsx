import React from 'react';
import { DeviceGlyph } from './DeviceGlyphs';
import {
  isDeviceAvailable,
  PULSO_DEVICE_IDENTITIES,
  type PulsoDeviceKey,
  type PulsoDeviceProjection,
} from '../../lib/deviceExecutionTarget';

interface DevicePresenceRailProps {
  devices: PulsoDeviceProjection[];
  syncState?: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncAt?: string | null;
  onSync?: () => void;
}

const deviceOrder: PulsoDeviceKey[] = ['imac', 'macbook'];

function SyncGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19.2 8.4A8 8 0 0 0 5.1 6.2L3 8.3M4.8 15.6a8 8 0 0 0 14.1 2.2l2.1-2.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M3 4.8v3.5h3.5M21 19.2v-3.5h-3.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DevicePresenceRail({ devices, syncState = 'idle', lastSyncAt = null, onSync }: DevicePresenceRailProps) {
  const byKey = React.useMemo(() => new Map(devices.map(device => [device.key, device])), [devices]);

  return (
    <aside
      className="pointer-events-none fixed right-[max(1.5rem,env(safe-area-inset-right))] top-[max(5.5rem,calc(env(safe-area-inset-top)+5.5rem))] z-[44] flex flex-col items-center gap-4 select-none"
      aria-label="Máquinas disponíveis"
    >
      {deviceOrder.map(deviceKey => {
        const available = isDeviceAvailable(byKey.get(deviceKey));
        const accessibleName = PULSO_DEVICE_IDENTITIES[deviceKey].accessibleName;
        return (
          <span
            key={deviceKey}
            role="img"
            aria-label={`${accessibleName}: ${available ? 'online' : 'offline'}`}
            className={`grid h-5 w-5 place-items-center transition-[color,filter,opacity] duration-500 ${
              available
                ? 'text-[#fbf9f5]/88 drop-shadow-[0_0_4px_rgba(255,255,255,.28)]'
                : 'text-[#fbf9f5]/14'
            }`}
          >
            <DeviceGlyph device={deviceKey} size={14} />
          </span>
        );
      })}
      <button
        type="button"
        onClick={onSync}
        disabled={!onSync || syncState === 'syncing'}
        aria-label={syncState === 'syncing' ? 'Sincronizando aparelhos' : 'Sincronizar aparelhos agora'}
        title={lastSyncAt ? `Última sincronização: ${new Date(lastSyncAt).toLocaleString('pt-BR')}` : 'Sincronizar aparelhos'}
        className={`pointer-events-auto grid h-5 w-5 place-items-center border-0 bg-transparent p-0 outline-none transition-[color,filter,opacity,transform] duration-500 ${
          syncState === 'error'
            ? 'text-[#b8283e]/72'
            : syncState === 'syncing'
              ? 'animate-spin text-[#fbf9f5]/82'
              : syncState === 'synced'
                ? 'text-[#fbf9f5]/72 drop-shadow-[0_0_4px_rgba(255,255,255,.22)] hover:text-white'
                : 'text-[#fbf9f5]/22 hover:text-[#fbf9f5]/62'
        } disabled:cursor-default`}
      >
        <SyncGlyph />
      </button>
    </aside>
  );
}
