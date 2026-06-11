'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type EcosystemTabType = 'areas' | 'projects' | 'sources' | 'people';

interface Tab {
  id: EcosystemTabType;
  label: string;
  count?: number;
}

export const EcosystemTabs = ({ 
  activeTab, 
  onChange,
  tabs 
}: { 
  activeTab: EcosystemTabType, 
  onChange: (tab: EcosystemTabType) => void,
  tabs: Tab[]
}) => {
  return (
    <div className="flex items-center gap-1 bg-white/2 p-1 border border-white/5 rounded-2xl overflow-x-auto no-scrollbar flex-nowrap w-full max-w-full">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap ${
              isActive ? 'text-white' : 'text-white/30 hover:text-white/60'
            }`}
          >
            {isActive && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-blue-500/20 border border-blue-500/20 rounded-xl"
              />
            )}
            <div className="relative flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/20'
                }`}>
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
