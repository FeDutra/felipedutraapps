import React, { useMemo } from 'react';
import { LotusPhysicalParams } from './types';

interface LotusOrbRendererProps {
  params: LotusPhysicalParams;
  triggerRipple?: boolean;
}

// True periodic closed Catmull-Rom spline generator
function getClosedSplinePath(points: { x: number; y: number }[]): string {
  const len = points.length;
  if (len < 3) return '';
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < len; i++) {
    // Wrap neighbors using modulo to guarantee a seamless closed curve
    const p0 = points[(i - 1 + len) % len];
    const p1 = points[i];
    const p2 = points[(i + 1) % len];
    const p3 = points[(i + 2) % len];

    // Cubic Bezier control points calculation
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  d += ' Z'; // Ensure the path closes perfectly
  return d;
}

export const LotusOrbRenderer: React.FC<LotusOrbRendererProps> = ({
  params,
}) => {
  const {
    borderWidth,
    scale,
    ovalnessX,
    ovalnessY,
    tension,
    asymmetry,
    wavePhase,
    waveAmplitude,
    waveFrequency,
    centerShiftX,
    centerShiftY,
    opacity,
    glow,
    colorTemp,
  } = params;

  // Generate coordinates around the circumference to form the closed path
  const pathData = useMemo(() => {
    const numPoints = 80;
    const points = [];
    const baseRadius = 135 * scale;

    // Sutil continuous breathing cycle (1.5% scale offset)
    const breathingFactor = Math.sin(wavePhase * 0.8) * 0.015;
    const activeRadius = baseRadius * (1.0 + breathingFactor);

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;

      // 1. Organic wave ripple (waveFrequency is always rounded to integer to prevent seam quinas)
      const wave = Math.sin(angle * Math.round(waveFrequency) - wavePhase) * waveAmplitude * activeRadius;
      
      // 2. Tensão Direcional (Dipole force stretching one side and compressing the opposite smoothly)
      const tensionOffset = Math.cos(angle) * tension * 0.08 * activeRadius;

      // 3. Asymmetric wobbly distortion (infinitely smooth low frequency harmonic)
      const asym = Math.sin(angle * 3.0) * asymmetry * 0.04 * activeRadius;

      // Combine radial forces
      const r = activeRadius + wave + tensionOffset + asym;

      // Map to X/Y with ovalness scaling
      let x = 200 + r * Math.cos(angle) * ovalnessX;
      let y = 200 + r * Math.sin(angle) * ovalnessY;

      // 4. Gravity sag: pulls the bottom points down smoothly based on Y-displacement
      // Continuous since sin(angle) is 0 at the horizontal seams (angle = 0 and pi)
      if (Math.sin(angle) > 0) {
        y += Math.sin(angle) * 15 * Math.max(0, Math.min(1, centerShiftY / 35));
      }

      // Add center shifts (gravitational shifts)
      x += centerShiftX;
      y += centerShiftY;

      points.push({ x, y });
    }

    return getClosedSplinePath(points);
  }, [scale, ovalnessX, ovalnessY, tension, asymmetry, wavePhase, waveAmplitude, waveFrequency, centerShiftX, centerShiftY]);

  const filterId = "lotus-clean-halo-filter-v2";

  return (
    <div className="relative w-96 h-96 flex items-center justify-center pointer-events-none select-none">
      
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={Math.max(1, glow / 4)} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <svg
        viewBox="0 0 400 400"
        className="w-85 h-85 overflow-visible"
      >
        {/* THE SINGLE INVARIANT CLOSED PATH (The Membrane) */}
        <path
          d={pathData}
          fill="none"
          stroke={colorTemp}
          strokeWidth={borderWidth} // Dynamic proportionally sized width, no vector-effect to allow proper scaling
          style={{
            opacity,
            // Subtle, elegant halo variation restricted strictly within 10%
            filter: glow > 0 ? `drop-shadow(0px 0px ${glow}px rgba(251, 249, 245, 0.4))` : 'none',
          }}
        />
      </svg>

    </div>
  );
};
