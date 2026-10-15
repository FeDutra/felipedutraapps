import React from 'react';
import type { PulsoDeviceKey } from '../../lib/deviceExecutionTarget';

interface DeviceGlyphProps {
  device: PulsoDeviceKey;
  size?: number;
  className?: string;
}

export function DeviceGlyph({ device, size = 18, className }: DeviceGlyphProps) {
  if (device === 'imac') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3.25" y="3.75" width="17.5" height="12.5" rx="1.7" stroke="currentColor" strokeWidth="1.35" />
        <path d="M8.5 20.25h7M10.3 16.4l-.65 3.65M13.7 16.4l.65 3.65" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        <circle cx="12" cy="14.05" r=".55" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="4" width="14" height="10.75" rx="1.45" stroke="currentColor" strokeWidth="1.35" />
      <path d="M2.9 18.25h18.2l-1.2 1.75H4.1l-1.2-1.75Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M9.35 18.25h5.3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}
