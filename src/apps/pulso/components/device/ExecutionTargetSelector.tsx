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
        className={`grid h-6 w-6 place-items-center rounded-full border-0 bg-transparent p-0 outline-none transition-[color,filter,opacity,transform] duration-300 ${
          value === 'auto'
            ? `${open ? 'text-[#fbf9f5]/88 drop-shadow-[0_0_4px_rgba(255,255,255,.22)]' : 'text-[#fbf9f5]/38'} hover:text-[#fbf9f5]/78`
            : targetAvailable
              ? 'text-[#fbf9f5]/92 drop-shadow-[0_0_5px_rgba(255,255,255,.26)] hover:text-white'
              : 'text-[#fbf9f5]/22 hover:text-[#fbf9f5]/34'
        }`}
      >
        {value === 'auto' ? <AutoGlyph size={14} /> : <DeviceGlyph device={value} size={14} />}
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+.58rem)] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[.06] bg-[#0c0c0c]/32 px-1.5 py-1 shadow-[0_10px_28px_rgba(0,0,0,.24)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => { onChange('auto'); setOpen(false); }}
            aria-label="Destino automático"
            aria-pressed={value === 'auto'}
            className={`grid h-6 w-6 place-items-center rounded-full border-0 bg-transparent p-0 outline-none transition-[color,filter,opacity,transform] duration-300 ${value === 'auto' ? 'scale-[1.04] text-white drop-shadow-[0_0_5px_rgba(255,255,255,.32)]' : 'text-white/28 hover:text-white/62'}`}
          >
            <AutoGlyph size={13} />
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
                className={`grid h-6 w-6 place-items-center rounded-full border-0 bg-transparent p-0 outline-none transition-[color,filter,opacity,transform] duration-300 ${
                  value === deviceKey
                    ? 'scale-[1.04] text-white drop-shadow-[0_0_5px_rgba(255,255,255,.32)]'
                    : available
                      ? 'text-white/58 hover:text-white/88'
                      : 'text-white/14 hover:text-white/26'
                }`}
              >
                <DeviceGlyph device={deviceKey} size={13} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
