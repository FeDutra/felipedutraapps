import React from 'react';
import { DeviceGlyph } from './DeviceGlyphs';
import {
  isDeviceAvailable,
  PULSO_DEVICE_IDENTITIES,
  type PulsoDeviceKey,
  type PulsoDeviceProjection,
  type PulsoExecutionTarget,
} from '../../lib/deviceExecutionTarget';

interface DevicePresenceRailProps {
  devices: PulsoDeviceProjection[];
  selectedTarget: PulsoExecutionTarget;
  onSelect: (target: PulsoDeviceKey) => void;
}

const deviceOrder: PulsoDeviceKey[] = ['imac', 'macbook'];

export function DevicePresenceRail({ devices, selectedTarget, onSelect }: DevicePresenceRailProps) {
  const byKey = React.useMemo(() => new Map(devices.map(device => [device.key, device])), [devices]);

  return (
    <aside
      className="fixed right-[max(.7rem,env(safe-area-inset-right))] top-[max(5.5rem,calc(env(safe-area-inset-top)+5.5rem))] z-[44] flex flex-col items-center gap-3 pointer-events-auto"
      aria-label="Máquinas disponíveis"
    >
      {deviceOrder.map(deviceKey => {
        const available = isDeviceAvailable(byKey.get(deviceKey));
        const selected = selectedTarget === deviceKey;
        const accessibleName = PULSO_DEVICE_IDENTITIES[deviceKey].accessibleName;
        return (
          <button
            key={deviceKey}
            type="button"
            onClick={() => onSelect(deviceKey)}
            aria-label={`${accessibleName}: ${available ? 'online' : 'offline'}${selected ? ', selecionado' : ''}`}
            aria-pressed={selected}
            className={`relative grid h-8 w-8 place-items-center rounded-full border bg-transparent p-0 outline-none transition-all duration-300 ${
              selected
                ? 'border-[#aa78ff]/55 text-[#fbf9f5] shadow-[0_0_14px_rgba(170,120,255,.28)]'
                : available
                  ? 'border-transparent text-[#fbf9f5]/90 drop-shadow-[0_0_7px_rgba(255,255,255,.3)] hover:text-white'
                  : 'border-transparent text-[#fbf9f5]/18 hover:text-[#fbf9f5]/32'
            }`}
          >
            <DeviceGlyph device={deviceKey} size={17} />
          </button>
        );
      })}
    </aside>
  );
}
