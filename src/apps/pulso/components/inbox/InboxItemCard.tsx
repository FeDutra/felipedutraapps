'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { InboxItem } from '../../types/pulso.types';
import { ConfidenceBadge, LateralityBadge, InboxTypeBadge } from './InboxBadges';
import { PriorityBadge } from '../BaseComponents';
import { formatDate } from '../../utils/formatters';
import { getStatusLabel } from '../../utils/statusHelpers';
import { Hash, Calendar, Zap } from 'lucide-react';

export const InboxItemCard = ({ 
  item, 
  onClick 
}: { 
  item: InboxItem, 
  onClick: (item: InboxItem) => void 
}) => {
  const isLaterality = item.type === 'laterality';

  return (
    <motion.div 
      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
      onClick={() => onClick(item)}
      className={`relative p-5 bg-white/2 border rounded-2xl cursor-pointer transition-all ${
        isLaterality ? 'border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.05)]' : 'border-white/5'
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Top Row: Badges & Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <InboxTypeBadge type={item.type} />
            {isLaterality && <LateralityBadge state={item.lateralityState} />}
            <span className={`text-[8px] font-bold uppercase tracking-widest ${
              item.status === 'new' ? 'text-blue-400' : 'text-white/20'
            }`}>
              {getStatusLabel(item.status)}
            </span>
          </div>
          <PriorityBadge priority={item.priority} />
        </div>

        {/* Content Row */}
        <div>
          <h4 className="text-sm font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
            {item.name}
          </h4>
          <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
            {item.body}
          </p>
        </div>

        {/* Bottom Row: Meta */}
        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Zap size={10} className="text-white/20" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-tight">{item.originChannel || 'Manual'}</span>
            </div>
            {item.areaRef && (
              <div className="flex items-center gap-1.5">
                <Hash size={10} className="text-white/20" />
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-tight">{item.areaRef.replace('area_', '')}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar size={10} className="text-white/20" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-tight">{formatDate(item.createdAt)}</span>
            </div>
          </div>
          
          <ConfidenceBadge confidence={item.confidence as any || 'medium'} />
        </div>
      </div>
    </motion.div>
  );
};
