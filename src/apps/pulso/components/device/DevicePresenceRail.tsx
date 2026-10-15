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
}

const deviceOrder: PulsoDeviceKey[] = ['imac', 'macbook'];

export function DevicePresenceRail({ devices }: DevicePresenceRailProps) {
  const byKey = React.useMemo(() => new Map(devices.map(device => [device.key, device])), [devices]);

  return (
    <aside
      className="pointer-events-none fixed right-[max(.58rem,env(safe-area-inset-right))] top-[max(5.5rem,calc(env(safe-area-inset-top)+5.5rem))] z-[44] flex flex-col items-center gap-2.5 select-none"
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
    </aside>
  );
}
