'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, onClick, hoverEffect = true }) => {
  return (
    <motion.div
      whileHover={hoverEffect && onClick ? { scale: 0.98 } : {}}
      whileTap={hoverEffect && onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={cn(
        "glass glass-glow rounded-[2rem] p-6 shadow-2xl transition-all duration-300",
        onClick && "cursor-pointer active:scale-[0.98]",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
