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
      whileHover={{ x: 2 }}
      onClick={() => onClick(item)}
      className={`relative py-5 border-b cursor-pointer transition-all ${
        isLaterality ? 'border-purple-500/10 shadow-[inset_2px_0_0_rgba(168,85,247,0.3)] pl-3' : 'border-white/5'
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* Top Row: Badges & Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <InboxTypeBadge type={item.type} />
            {isLaterality && <LateralityBadge state={item.lateralityState} />}
            <span className={`text-[8px] font-mono tracking-widest uppercase ${
              item.status === 'new' ? 'text-blue-400/80' : 'text-white/20'
            }`}>
              {getStatusLabel(item.status)}
            </span>
          </div>
          <PriorityBadge priority={item.priority} />
        </div>

        {/* Content Row */}
        <div>
          <h4 className="text-xs font-light text-white mb-1 group-hover:text-blue-400 transition-colors">
            {item.name}
          </h4>
          <p className="text-[11px] font-light text-white/50 line-clamp-2 leading-relaxed">
            {item.body}
          </p>
        </div>

        {/* Bottom Row: Meta */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4 text-white/30">
            <div className="flex items-center gap-1">
              <Zap size={10} strokeWidth={1} />
              <span className="text-[8px] font-mono tracking-wider uppercase">{item.originChannel || 'Manual'}</span>
            </div>
            {item.areaRef && (
              <div className="flex items-center gap-1">
                <Hash size={10} strokeWidth={1} />
                <span className="text-[8px] font-mono tracking-wider uppercase">{item.areaRef.replace('area_', '')}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar size={10} strokeWidth={1} />
              <span className="text-[8px] font-mono tracking-wider uppercase">{formatDate(item.createdAt)}</span>
            </div>
          </div>
          
          <ConfidenceBadge confidence={item.confidence as any || 'medium'} />
        </div>
      </div>
    </motion.div>
  );
};
