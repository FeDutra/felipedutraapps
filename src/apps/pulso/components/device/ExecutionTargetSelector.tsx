import React from 'react';
import { DeviceGlyph } from './DeviceGlyphs';
import {
  isDeviceAvailable,
  type PulsoDeviceKey,
  type PulsoDeviceProjection,
  type PulsoExecutionTarget,
} from '../../lib/deviceExecutionTarget';

interface ExecutionTargetSelectorProps {
  devices: PulsoDeviceProjection[];
  value: PulsoExecutionTarget;
  onChange: (target: PulsoExecutionTarget) => void;
}

const deviceOrder: PulsoDeviceKey[] = ['imac', 'macbook'];

function AutoGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2.8v2M21.2 12h-2M12 21.2v-2M2.8 12h2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function ExecutionTargetSelector({ devices, value, onChange }: ExecutionTargetSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const byKey = React.useMemo(() => new Map(devices.map(device => [device.key, device])), [devices]);

  React.useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const targetAvailable = value === 'auto' || isDeviceAvailable(byKey.get(value));

  return (
    <div ref={containerRef} className="relative z-[4] shrink-0">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-label="Escolher máquina de execução"
        aria-expanded={open}
        className={`grid h-7 w-7 place-items-center rounded-full border bg-transparent p-0 outline-none transition-all ${
          value === 'auto'
            ? 'border-transparent text-[#fbf9f5]/45 hover:text-white/80'
            : targetAvailable
              ? 'border-[#aa78ff]/45 text-[#fbf9f5] shadow-[0_0_10px_rgba(170,120,255,.18)]'
              : 'border-[#aa78ff]/25 text-[#fbf9f5]/28'
        }`}
      >
        {value === 'auto' ? <AutoGlyph /> : <DeviceGlyph device={value} size={16} />}
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+.7rem)] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/10 bg-[#0c0c0c]/55 px-2 py-1.5 shadow-[0_12px_35px_rgba(0,0,0,.32)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => { onChange('auto'); setOpen(false); }}
            aria-label="Destino automático"
            aria-pressed={value === 'auto'}
            className={`grid h-7 w-7 place-items-center rounded-full border bg-transparent p-0 outline-none ${value === 'auto' ? 'border-[#aa78ff]/55 text-white' : 'border-transparent text-white/35 hover:text-white/70'}`}
          >
            <AutoGlyph size={15} />
          </button>
          {deviceOrder.map(deviceKey => {
            const available = isDeviceAvailable(byKey.get(deviceKey));
            return (
              <button
                key={deviceKey}
                type="button"
                onClick={() => { onChange(deviceKey); setOpen(false); }}
                aria-label={`${deviceKey === 'imac' ? 'iMac' : 'MacBook'}: ${available ? 'online' : 'offline'}`}
                aria-pressed={value === deviceKey}
                className={`grid h-7 w-7 place-items-center rounded-full border bg-transparent p-0 outline-none ${
                  value === deviceKey
                    ? 'border-[#aa78ff]/55 text-white'
                    : available
                      ? 'border-transparent text-white/75 hover:text-white'
                      : 'border-transparent text-white/18 hover:text-white/30'
                }`}
              >
                <DeviceGlyph device={deviceKey} size={15} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
