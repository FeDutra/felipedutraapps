'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Clock, User, Layers, MessageSquare, AlertCircle, CheckCircle2, HelpCircle, AlertTriangle, Shield } from 'lucide-react';
import { PulsoRequest } from '../../types/pulso.types';

interface RequestDetailDrawerProps {
  request: PulsoRequest | null;
  onClose: () => void;
}

export const RequestDetailDrawer = ({ request, onClose }: RequestDetailDrawerProps) => {
  if (!request) return null;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'requested': return { label: 'Solicitado', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'running': return { label: 'Em Processamento', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'completed': return { label: 'Concluído', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'failed': return { label: 'Falhou', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'needs_clarification': return { label: 'Esclarecimento Necessário', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      default: return { label: status, color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' };
    }
  };

  const statusInfo = getStatusInfo(request.status);

  return (
    <AnimatePresence>
      {request && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${statusInfo.bg} rounded-2xl flex items-center justify-center border ${statusInfo.border}`}>
                    <Zap size={24} className={statusInfo.color} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Detalhes da Solicitação</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">{request.requestType.replace('_', ' ')}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Status Section */}
                <div className={`${statusInfo.bg} border ${statusInfo.border} rounded-3xl p-6 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${statusInfo.color.replace('text', 'bg')}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                    ID: {request.id}
                  </div>
                </div>

                {/* Clarification Alert */}
                {request.status === 'needs_clarification' && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <HelpCircle size={20} className="text-purple-400" />
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Lótus pede esclarecimento</h3>
                    </div>
                    
                    {request.result?.question && (
                      <p className="text-sm text-purple-200 leading-relaxed bg-purple-500/5 p-4 rounded-xl border border-purple-500/10">
                        "{request.result.question}"
                      </p>
                    )}

                    {request.result?.missingFields && request.result.missingFields.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-purple-400/60 uppercase tracking-widest">Campos ausentes:</p>
                        <div className="flex flex-wrap gap-2">
                          {request.result.missingFields.map((field: string) => (
                            <span key={field} className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[9px] font-bold text-purple-300 uppercase tracking-tight">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <button className="w-full py-3 bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20">
                        Responder à Lótus (Em Breve)
                      </button>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Título</label>
                    <p className="text-lg font-black text-white mt-1">{request.title}</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Sumário / Missão</label>
                    <p className="text-sm text-white/60 mt-2 leading-relaxed whitespace-pre-wrap">{request.summary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Prioridade</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Shield size={14} className="text-blue-400" />
                        <span className="text-sm font-bold text-white uppercase">{request.priority}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Solicitado em</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={14} className="text-white/40" />
                        <span className="text-sm font-bold text-white/60">{new Date(request.requestedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 pt-4 border-t border-white/5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Autoria</label>
                      <div className="flex items-center gap-2 mt-1">
                        <User size={14} className={request.createdByType === 'agent' ? 'text-emerald-400' : 'text-blue-400'} />
                        <span className="text-sm font-bold text-white uppercase">{request.createdByType || 'user'} / {request.createdById || request.requestedBy}</span>
                      </div>
                    </div>
                  </div>

                  {request.origin && (
                    <div className="pt-4 border-t border-white/5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Origem da Solicitação</label>
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 bg-white/2 rounded-xl text-[10px] font-black text-white/60 uppercase tracking-widest border border-white/5 flex items-center gap-2">
                            <MessageSquare size={12} className="text-emerald-400" />
                            Canal: {request.origin.channel}
                          </div>
                          <div className="px-3 py-1.5 bg-white/2 rounded-xl text-[10px] font-black text-white/60 uppercase tracking-widest border border-white/5">
                            Fonte: {request.origin.source}
                          </div>
                        </div>
                        {request.origin.messageRef && (
                          <div className="px-3 py-2 bg-black/20 rounded-xl border border-white/5">
                            <p className="text-[9px] text-white/20 font-mono italic break-all">Message Ref: {request.origin.messageRef}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {request.areaRef && (
                    <div className="pt-4 border-t border-white/5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Contexto Estrutural</label>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                          <Layers size={14} className="text-blue-400" />
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{request.areaRef}</span>
                        </div>
                        {request.projectRef && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                            <Zap size={14} className="text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{request.projectRef}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payload Details */}
                  {request.payload && (
                    <div className="pt-6 border-t border-white/5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1 mb-4 block">Dados do Payload</label>
                      <div className="bg-white/2 border border-white/5 rounded-3xl p-6 overflow-hidden">
                        <pre className="text-[10px] text-blue-300 font-mono leading-relaxed overflow-x-auto custom-scrollbar">
                          {JSON.stringify(request.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Failure Info */}
                  {request.status === 'failed' && request.error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 space-y-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={18} className="text-red-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Falha no Processamento</h3>
                      </div>
                      <p className="text-xs text-red-200 leading-relaxed italic">"{request.error}"</p>
                      {request.recoverable && (
                        <div className="inline-block px-2 py-1 bg-red-500/20 rounded text-[8px] font-black text-red-400 uppercase tracking-widest">Recuperável</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-white/5">
                <button 
                  onClick={onClose}
                  className="w-full py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
                >
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
