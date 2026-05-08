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
  isCreating,
  onClose, 
  onUpdate,
  onConvert,
  onCreate
}: { 
  item: InboxItem | null, 
  isCreating?: boolean,
  onClose: () => void,
  onUpdate: (id: string, data: Partial<InboxItem>) => void,
  onConvert: (id: string, type: string) => void,
  onCreate: (data: Partial<InboxItem>) => void
}) => {
  const [formData, setFormData] = React.useState<Partial<InboxItem>>({
    name: '',
    body: '',
    type: 'task',
    priority: 'medium',
    confidence: 'medium',
    originChannel: 'Manual'
  });

  const [editData, setEditData] = React.useState<{ name: string, body: string }>({
    name: '',
    body: ''
  });

  // Reset form when opening in create mode or update editData when item changes
  React.useEffect(() => {
    if (isCreating) {
      setFormData({
        name: '',
        body: '',
        type: 'task',
        priority: 'medium',
        confidence: 'medium',
        originChannel: 'Manual'
      });
    } else if (item) {
      setEditData({
        name: item.name || '',
        body: item.body || ''
      });
    }
  }, [isCreating, item]);

  if (!item && !isCreating) return null;

  const conversionTypes = [
    { id: 'task', label: 'Tarefa', icon: Check, color: 'text-emerald-400' },
    { id: 'decision', label: 'Decisão', icon: Target, color: 'text-blue-400' },
    { id: 'note', label: 'Nota', icon: FileText, color: 'text-amber-400' },
    { id: 'meeting', label: 'Reunião', icon: Users, color: 'text-purple-400' },
    { id: 'potential_project', label: 'Projeto Potencial', icon: Briefcase, color: 'text-indigo-400' },
  ];

  const handleSave = () => {
    if (!formData.name) return;
    onCreate(formData);
  };

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
          className="relative w-full max-w-lg bg-slate-950 border-l border-white/10 h-full overflow-y-auto pointer-events-auto p-8 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Novo Registro</span>
                </div>
              ) : item && (
                <>
                  <InboxTypeBadge type={item.type} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20">
                    {item.id}
                  </span>
                </>
              )}
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
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Título</h2>
            <input 
              autoFocus
              className="w-full bg-white/5 border border-white/5 rounded-2xl text-lg font-bold text-white focus:ring-1 focus:ring-blue-500/50 p-4 mb-6 placeholder:text-white/10 outline-none transition-all"
              placeholder="O que você quer registrar?"
              value={isCreating ? formData.name : editData.name}
              onChange={(e) => isCreating 
                ? setFormData({ ...formData, name: e.target.value }) 
                : setEditData({ ...editData, name: e.target.value })
              }
              onBlur={(e) => !isCreating && item && editData.name !== item.name 
                ? onUpdate(item.id, { name: e.target.value }) 
                : null
              }
            />
            
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Descrição</h2>
            <textarea 
              className="w-full bg-white/5 border border-white/5 rounded-2xl text-sm text-white/60 focus:ring-1 focus:ring-blue-500/50 p-4 min-h-[160px] resize-none leading-relaxed outline-none transition-all"
              placeholder="Adicione detalhes, contexto ou links..."
              value={isCreating ? formData.body : editData.body}
              onChange={(e) => isCreating 
                ? setFormData({ ...formData, body: e.target.value }) 
                : setEditData({ ...editData, body: e.target.value })
              }
              onBlur={(e) => !isCreating && item && editData.body !== item.body 
                ? onUpdate(item.id, { body: e.target.value }) 
                : null
              }
            />
          </div>

          {/* Fields Grid */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Tipo</p>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/80 p-3 outline-none"
                value={isCreating ? formData.type : item?.type}
                onChange={(e) => isCreating ? setFormData({ ...formData, type: e.target.value as any }) : item && onUpdate(item.id, { type: e.target.value as any })}
              >
                <option value="task">Tarefa</option>
                <option value="decision">Decisão</option>
                <option value="note">Nota</option>
                <option value="meeting">Reunião</option>
                <option value="potential_project">Projeto</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Prioridade</p>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/80 p-3 outline-none"
                value={isCreating ? formData.priority : item?.priority}
                onChange={(e) => isCreating ? setFormData({ ...formData, priority: e.target.value as any }) : item && onUpdate(item.id, { priority: e.target.value as any })}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Confiança</p>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/80 p-3 outline-none"
                value={isCreating ? formData.confidence : item?.confidence}
                onChange={(e) => isCreating ? setFormData({ ...formData, confidence: e.target.value as any }) : item && onUpdate(item.id, { confidence: e.target.value as any })}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            {!isCreating && item && (
               <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Status</p>
                 <div className="flex items-center gap-2 text-white/60 text-xs font-bold p-3">
                   <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'new' ? 'bg-blue-400' : 'bg-white/20'}`} />
                   {getStatusLabel(item.status)}
                 </div>
               </div>
            )}
          </div>

          {isCreating ? (
            <div className="mt-auto pt-8 border-t border-white/5 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-white/5 border border-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={!formData.name}
                className="flex-[2] py-4 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all"
              >
                Salvar no Inbox
              </button>
            </div>
          ) : item && (
            <>
              {/* Promotion / Conversion */}
              {item.status !== 'converted' && (
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
              )}

              {/* Actions */}
              <div className="mt-auto pt-8 border-t border-white/5 flex items-center gap-3">
                {item.status === 'new' && (
                  <button 
                    onClick={() => onUpdate(item.id, { 
                      status: 'triaged',
                      name: editData.name,
                      body: editData.body
                    })}
                    className="flex-1 py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500/20 transition-all"
                  >
                    Triar Item
                  </button>
                )}
                <button 
                  onClick={() => onUpdate(item.id, { status: 'archived' })}
                  className="p-4 bg-white/5 border border-white/5 text-white/40 rounded-2xl hover:bg-white/10 transition-all"
                  title="Arquivar"
                >
                  <Archive size={20} />
                </button>
                <button 
                  onClick={() => onUpdate(item.id, { status: 'discarded' })}
                  className="p-4 bg-red-500/5 border border-red-500/10 text-red-500/40 rounded-2xl hover:bg-red-500/10 transition-all"
                  title="Descartar"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
