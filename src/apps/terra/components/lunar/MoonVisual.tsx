'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface MoonVisualProps {
  className?: string;
  size?: number;
}

/**
 * Premium Moon Visual component.
 * Uses a high-resolution realistic moon asset with transparency.
 * Implements a very slow, subtle rotation for a "living" effect.
 */
const MoonVisual: React.FC<MoonVisualProps> = ({ className, size = 320 }) => {
  return (
    <div 
      className={`relative rounded-full select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Atmospheric Glow */}
      <div className="absolute inset-0 rounded-full bg-white/5 blur-3xl scale-110 pointer-events-none" />
      
      {/* Base Texture Container */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 800, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 w-full h-full rounded-full overflow-hidden flex items-center justify-center"
      >
        {/* Scaled up to 118% to remove the transparent border of the source asset */}
        <img 
          src="/assets/lunar/moon-premium.png" 
          alt="" 
          className="w-full h-full object-cover brightness-110 contrast-110 scale-[1.18]"
          style={{ width: '100%', height: '100%' }}
        />
      </motion.div>

      {/* Sphere/Depth Effect Overlays */}
      <div className="absolute inset-0 rounded-full shadow-[inset_-30px_-30px_60px_rgba(0,0,0,0.8),inset_30px_30px_60px_rgba(255,255,255,0.15)] pointer-events-none" />
      
      {/* Premium Tight Inner Shadow for Edge Definition (Volume) */}
      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_15px_rgba(0,0,0,1)] pointer-events-none" />
      
      {/* Surface Rim Light */}
      <div className="absolute inset-0 rounded-full ring-1 ring-white/20 pointer-events-none" />
    </div>
  );
};

export default MoonVisual;
