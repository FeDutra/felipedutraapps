'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, Archive, Share2, Briefcase, FileText, Target, Users, Calendar } from 'lucide-react';
import { InboxItem } from '../../types/pulso.types';
import { getStatusLabel } from '../../utils/statusHelpers';
import { InboxTypeBadge, ConfidenceBadge } from './InboxBadges';
import { PriorityBadge } from '../BaseComponents';

export const InboxDetailDrawer = ({ 
  item, 
  onClose, 
  onUpdate,
  onConvert
}: { 
  item: InboxItem | null, 
  onClose: () => void,
  onUpdate: (id: string, data: Partial<InboxItem>) => void,
  onConvert: (id: string, type: string) => void
}) => {
  if (!item) return null;

  const conversionTypes = [
    { id: 'task', label: 'Tarefa', icon: Check, color: 'text-emerald-400' },
    { id: 'decision', label: 'Decisão', icon: Target, color: 'text-blue-400' },
    { id: 'note', label: 'Nota', icon: FileText, color: 'text-amber-400' },
    { id: 'meeting', label: 'Reunião', icon: Users, color: 'text-purple-400' },
    { id: 'potential_project', label: 'Projeto Potencial', icon: Briefcase, color: 'text-indigo-400' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Drawer Content */}
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-slate-900 border-l border-white/10 h-full overflow-y-auto pointer-events-auto p-8 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <InboxTypeBadge type={item.type} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">
                {item.id}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Title & Body */}
          <div className="mb-10">
            <input 
              className="w-full bg-transparent border-none text-2xl font-black text-white focus:ring-0 p-0 mb-4 placeholder:text-white/10"
              defaultValue={item.name}
              onBlur={(e) => onUpdate(item.id, { name: e.target.value })}
            />
            <textarea 
              className="w-full bg-transparent border-none text-sm text-white/60 focus:ring-0 p-0 min-h-[120px] resize-none leading-relaxed"
              defaultValue={item.body}
              placeholder="Adicione uma descrição detalhada..."
              onBlur={(e) => onUpdate(item.id, { body: e.target.value })}
            />
          </div>

          {/* Meta Grid */}
          <div className="grid grid-cols-2 gap-6 mb-12">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Status</p>
              <div className="flex items-center gap-2 text-white/60 text-xs font-bold">
                <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'new' ? 'bg-blue-400' : 'bg-white/20'}`} />
                {getStatusLabel(item.status)}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Prioridade</p>
              <PriorityBadge priority={item.priority} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Confiança</p>
              <ConfidenceBadge confidence={item.confidence as any || 'medium'} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Origem</p>
              <p className="text-xs font-bold text-white/60">{item.originChannel || 'Manual'}</p>
            </div>
          </div>

          {/* Promotion / Conversion */}
          <div className="mb-12">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4">Promover Item</h5>
            <div className="grid grid-cols-1 gap-2">
              {conversionTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => onConvert(item.id, type.id)}
                  className="flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/5 border border-white/5 ${type.color}`}>
                      <type.icon size={16} />
                    </div>
                    <span className="text-xs font-bold text-white/80 group-hover:text-white">{type.label}</span>
                  </div>
                  <Share2 size={14} className="text-white/10 group-hover:text-white/30" />
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-white/5 pt-8">
            <button 
              onClick={() => onUpdate(item.id, { status: 'triaged' })}
              className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500/20 transition-all"
            >
              Triar Item
            </button>
            <button 
              onClick={() => onUpdate(item.id, { status: 'archived' })}
              className="p-3 bg-white/5 border border-white/5 text-white/40 rounded-xl hover:bg-white/10 transition-all"
              title="Arquivar"
            >
              <Archive size={18} />
            </button>
            <button 
              onClick={() => onUpdate(item.id, { status: 'discarded' })}
              className="p-3 bg-red-500/5 border border-red-500/10 text-red-500/40 rounded-xl hover:bg-red-500/10 transition-all"
              title="Descartar"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
