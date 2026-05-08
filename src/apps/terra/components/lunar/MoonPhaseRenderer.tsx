'use client';

import React from 'react';
import MoonVisual from './MoonVisual';

interface MoonPhaseRendererProps {
  moonPhase: number; // 0 to 1
  size?: number;
  className?: string;
  isMini?: boolean;
}

/**
 * Realistic Moon Phase Renderer.
 * Uses an elliptical terminator to simulate the moon's phase shadow.
 * Optimized for Southern Hemisphere orientation.
 */
const MoonPhaseRenderer: React.FC<MoonPhaseRendererProps> = ({ 
  moonPhase, 
  size = 320, 
  className = "", 
  isMini = false 
}) => {
  // Normalize moonPhase to 0-1 range
  const phase = moonPhase % 1;
  
  // Calculate illumination percentage (0-1)
  const illumination = phase <= 0.5 ? phase * 2 : 1 - (phase - 0.5) * 2;

  // Southern Hemisphere orientation:
  // Waxing grows from LEFT to RIGHT.
  // Waning shrinks from LEFT to RIGHT (shadow moves in from left).
  
  const r = 50; // SVG coordinate radius
  const sweep = illumination * 2 - 1; // Range -1 to 1
  const absSweep = Math.abs(sweep) * r;
  
  const getMaskPaths = () => {
    // illumination 0 = New Moon (Full Shadow)
    // illumination 1 = Full Moon (No Shadow)
    if (illumination > 0.99) return null;
    if (illumination < 0.01) return <circle cx="50" cy="50" r="50" fill="white" />;
    
    const leftSemicircle = "M 50 0 A 50 50 0 0 0 50 100 L 50 100 L 50 0 Z";
    const rightSemicircle = "M 50 0 A 50 50 0 0 1 50 100 L 50 100 L 50 0 Z";

    if (phase <= 0.5) {
      // Waxing (0 -> 0.5) - Light grows from Left
      if (illumination <= 0.5) {
        return (
          <>
            <path d={rightSemicircle} fill="white" />
            <path d={`M 50 0 A ${absSweep} 50 0 0 0 50 100 A 50 50 0 0 0 50 0`} fill="white" />
          </>
        );
      } else {
        return <path d={`M 50 0 A ${absSweep} 50 0 0 1 50 100 A 50 50 0 0 1 50 0`} fill="white" />;
      }
    } else {
      // Waning (0.5 -> 1) - Light shrinks from Left (Shadow enters from Left)
      if (illumination > 0.5) {
        return <path d={`M 50 0 A ${absSweep} 50 0 0 0 50 100 A 50 50 0 0 0 50 0`} fill="white" />;
      } else {
        return (
          <>
            <path d={leftSemicircle} fill="white" />
            <path d={`M 50 0 A ${absSweep} 50 0 0 1 50 100 A 50 50 0 0 1 50 0`} fill="white" />
          </>
        );
      }
    }
  };

  const maskId = `moonMask-${Math.round(phase * 1000)}-${size}`;

  return (
    <div className={`relative group ${className}`} style={{ width: size, height: size }}>
      {/* 1. Base Moon Image */}
      <MoonVisual size={size} />

      {/* 2. SVG Masked Shadow Overlay */}
      {illumination < 0.99 && (
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-95">
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
            <defs>
              <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={isMini ? "1" : "3"} />
              </filter>
              <mask id={maskId}>
                <rect x="0" y="0" width="100" height="100" fill="black" />
                <g filter="url(#softBlur)">
                  {getMaskPaths()}
                </g>
              </mask>
            </defs>
            <circle cx="50" cy="50" r="50" fill="rgba(0,0,0,1)" mask={`url(#${maskId})`} transform="rotate(180 50 50)" />
          </svg>
        </div>
      )}

      {/* 3. Subtle Lighting Polish (Only for large moon) */}
      {!isMini && (
        <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            style={{
              clipPath: 'circle(50% at 50% 50%)',
              opacity: illumination > 0.98 ? 0 : 0.3
            }}
          />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(255,255,255,0.05)]" />
        </div>
      )}
    </div>
  );
};

export default MoonPhaseRenderer;
