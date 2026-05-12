'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Clock, User, Layers, MessageSquare, AlertCircle, CheckCircle2, HelpCircle, AlertTriangle, Shield, Archive, Database, Code } from 'lucide-react';
import { PulsoRequest } from '../../types/pulso.types';

interface RequestDetailDrawerProps {
  request: PulsoRequest | null;
  onClose: () => void;
  onArchive?: (id: string) => void;
}

const safeFormatDateTime = (val: any) => {
  if (!val) return 'N/A';
  try {
    let d: Date;
    if (typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (val.seconds) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString();
  } catch (e) {
    return 'N/A';
  }
};

export const RequestDetailDrawer = ({ request, onClose, onArchive }: RequestDetailDrawerProps) => {
  if (!request) return null;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'requested': return { label: 'Solicitado', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'running': return { label: 'Em Processamento', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'completed': return { label: 'Concluído', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'needs_approval': return { label: 'Aprovação Necessária', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      case 'failed': return { label: 'Falhou', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'needs_clarification': return { label: 'Esclarecimento Necessário', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      default: return { label: status, color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' };
    }
  };

  const statusInfo = getStatusInfo(request.status);
  const resObj = request.result || {};
  const mat = resObj.matResult || null;
  const missing = resObj.missingFields || [];
  const question = resObj.question || resObj.reason || null;
  const isTest = (request as any).isTest || request.dedupeKey?.includes('test') || request.title?.toLowerCase().includes('test');

  const actionStr = mat?.action || resObj.action || (request.status === 'completed' ? 'created' : 'N/A');
  const typeStr = mat?.entityType || resObj.entityType || request.requestType.replace('register_', '').replace('create_', '');
  const refStr = resObj.entityRef || mat?.entityRef || 'N/A';
  const pathStr = resObj.entityPath || mat?.entityPath || 'N/A';
  const summaryStr = mat?.summary || resObj.summary || resObj.notes || 'Sem sumário técnico gravado.';

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
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${statusInfo.bg} rounded-2xl flex items-center justify-center border ${statusInfo.border}`}>
                    <Zap size={24} className={statusInfo.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-white">Detalhes da Solicitação</h2>
                      {isTest && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest">
                          Teste
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">{request.requestType.replace('_', ' ')}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Status Section */}
                <div className={`${statusInfo.bg} border ${statusInfo.border} rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${statusInfo.color.replace('text', 'bg')}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <div className="text-[10px] text-white/20 font-mono font-bold">
                    ID: {request.id}
                  </div>
                </div>

                {/* Resultado da Materialização (Task 2 Obrigatória) */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                    <Database size={16} className="text-purple-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Resultado da Materialização</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-white/1 rounded-2xl p-4 border border-white/5">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Ação Técnica</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{actionStr}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Entity Type</span>
                      <span className="text-xs font-mono text-white/60 uppercase">{typeStr}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Entity Ref (ID Destino)</span>
                      <span className="text-xs font-mono font-bold text-blue-400 break-all">{refStr}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Caminho Canônico (Entity Path)</span>
                      <span className="text-[10px] font-mono text-white/40 break-all select-all">{pathStr}</span>
                    </div>
                  </div>

                  {summaryStr && (
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Sumário Técnico do Dispatcher</span>
                      <p className="text-xs text-white/60 leading-relaxed font-sans bg-white/2 p-3 rounded-xl border border-white/5">
                        {summaryStr}
                      </p>
                    </div>
                  )}

                  {missing.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[9px] font-black text-amber-400/80 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                        <HelpCircle size={12} />
                        Campos Ausentes para Conclusão Automática:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((f: string) => (
                          <span key={f} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-mono text-amber-300">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {request.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mt-2">
                      <span className="text-[9px] font-black text-red-400 uppercase tracking-widest block mb-0.5">Erro no Processo:</span>
                      <p className="text-xs font-mono text-red-200">{request.error}</p>
                    </div>
                  )}
                </div>

                {/* Clarification/Approval Section */}
                {(request.status === 'needs_clarification' || request.status === 'needs_approval') && question && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-purple-400" />
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">
                        {request.status === 'needs_approval' ? 'Governança Exige Aprovação' : 'Lótus Pede Esclarecimento'}
                      </h3>
                    </div>
                    <p className="text-xs text-purple-200 leading-relaxed bg-purple-500/5 p-3 rounded-xl border border-purple-500/10 font-mono">
                      "{question}"
                    </p>
                  </div>
                )}

                {/* General Content */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-6 space-y-5">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Título</label>
                    <p className="text-base font-bold text-white">{request.title || 'Sem Título'}</p>
                  </div>

                  {request.summary && (
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Missão / Descrição da Intenção</label>
                      <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{request.summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Prioridade</label>
                      <span className="text-xs font-bold text-white uppercase">{request.priority || 'medium'}</span>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Solicitado em</label>
                      <span className="text-xs font-bold text-white/60">{safeFormatDateTime(request.requestedAt || (request as any).createdAt)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Autoria e Rastreabilidade</label>
                    <div className="flex items-center gap-2 mt-1">
                      <User size={14} className="text-blue-400" />
                      <span className="text-xs font-bold text-white uppercase">
                        {request.createdByType || 'agent'} / {request.createdById || request.requestedBy || 'lotus'}
                      </span>
                    </div>
                  </div>

                  {request.origin && (
                    <div className="pt-4 border-t border-white/5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-2">Canal de Origem</label>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-white/60 uppercase tracking-tight border border-white/5">
                          Canal: {request.origin.channel || 'N/A'}
                        </span>
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-white/60 uppercase tracking-tight border border-white/5">
                          Fonte: {request.origin.source || 'N/A'}
                        </span>
                      </div>
                      {request.origin.messageRef && (
                        <p className="text-[9px] text-white/20 font-mono italic mt-2 break-all">MsgRef: {request.origin.messageRef}</p>
                      )}
                    </div>
                  )}

                  {(request.areaRef || request.projectRef) && (
                    <div className="pt-4 border-t border-white/5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-2">Contexto Estrutural Ancorado</label>
                      <div className="flex flex-wrap gap-2">
                        {request.areaRef && (
                          <span className="px-2.5 py-1 bg-blue-500/5 border border-blue-500/10 rounded-lg text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            Área: {request.areaRef}
                          </span>
                        )}
                        {request.projectRef && (
                          <span className="px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            Proj: {request.projectRef}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payload JSON */}
                {request.payload && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <Code size={12} className="text-white/20" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Objeto de Payload Nativo</span>
                    </div>
                    <div className="bg-white/2 border border-white/5 rounded-3xl p-5 overflow-hidden">
                      <pre className="text-[10px] text-blue-300/80 font-mono leading-relaxed overflow-x-auto custom-scrollbar max-h-60">
                        {JSON.stringify(request.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Ações de Governança e Limpeza */}
                <div className="pt-6 border-t border-white/5 space-y-3">
                  {onArchive && (
                    <button 
                      onClick={() => onArchive(request.id)}
                      className="w-full py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-300 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Archive size={14} />
                      Arquivar Solicitação (Esconder Teste)
                    </button>
                  )}

                  <button 
                    onClick={onClose}
                    className="w-full py-3 bg-white/2 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
                  >
                    Fechar Painel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
