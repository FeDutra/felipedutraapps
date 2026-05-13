'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Clock, User, Layers, MessageSquare, AlertCircle, CheckCircle2, HelpCircle, AlertTriangle, Shield, Archive, Database, Code, Check, Send } from 'lucide-react';
import { PulsoRequest } from '../../types/pulso.types';

interface RequestDetailDrawerProps {
  request: PulsoRequest | null;
  onClose: () => void;
  onArchive?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onClarify?: (id: string, answers: any) => void;
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

export const RequestDetailDrawer = ({ 
  request, 
  onClose, 
  onArchive,
  onApprove,
  onReject,
  onClarify
}: RequestDetailDrawerProps) => {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [genericAnswer, setGenericAnswer] = React.useState('');

  // Auto-reset buffer when opened envelope changes
  React.useEffect(() => {
    setAnswers({});
    setGenericAnswer('');
  }, [request?.id]);

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

  const actionStr = mat?.action || resObj.action || (request.status === 'completed' ? 'updated' : 'N/A');
  const typeStr = mat?.entityType || resObj.entityType || request.requestType.replace('register_', '').replace('create_', '');
  const refStr = resObj.entityRef || mat?.entityRef || 'N/A';
  const pathStr = resObj.entityPath || mat?.entityPath || 'N/A';
  const summaryStr = mat?.summary || resObj.summary || resObj.notes || 'Sem sumário técnico gravado.';

  const handleSendClarification = () => {
    if (!onClarify) return;
    const finalAnswers: any = { ...answers };
    if (genericAnswer) {
      finalAnswers.clarificationResponse = genericAnswer;
      // If a single critical missing attribute is queried, map shortcut string natively
      if (missing.length === 1) {
        finalAnswers[missing[0]] = genericAnswer;
      }
    }
    onClarify(request.id, finalAnswers);
  };

  return (
    <AnimatePresence>
      {request && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] w-full max-w-full"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl sm:max-w-md md:max-w-xl bg-[#020617] border-l border-white/5 z-[101] overflow-y-auto custom-scrollbar shrink-0"
          >
            <div className="p-6 md:p-8 w-full max-w-full min-w-0">
              <div className="flex items-center justify-between mb-8 pb-2 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 ${statusInfo.bg} rounded-2xl flex items-center justify-center border ${statusInfo.border} shrink-0`}>
                    <Zap size={20} className={statusInfo.color} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base md:text-lg font-black text-white truncate">Envelope da Solicitação</h2>
                      {isTest && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest shrink-0">
                          Teste
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-0.5 truncate">{request.requestType.replace('_', ' ')}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/20 transition-all shrink-0">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6 w-full max-w-full min-w-0">
                {/* 1. Status Section */}
                <div className={`${statusInfo.bg} border ${statusInfo.border} rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusInfo.color.replace('text', 'bg')}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <div className="text-[9px] text-white/20 font-mono font-bold truncate max-w-full">
                    ID: {request.id}
                  </div>
                </div>

                {/* 2. Deduplication Key Tracing */}
                {request.dedupeKey && (
                  <div className="px-3 py-1.5 bg-white/1 border border-white/5 rounded-xl text-[9px] font-mono text-white/30 truncate select-all">
                    DedupeKey: {request.dedupeKey}
                  </div>
                )}

                {/* 3. Human Governance Practical Action Box (needs_approval) */}
                {request.status === 'needs_approval' && (
                  <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-3xl p-5 space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-purple-400 shrink-0" />
                      <h3 className="text-xs font-black text-purple-300 uppercase tracking-widest">Aprovação de Barreira Ativa</h3>
                    </div>

                    <p className="text-xs text-purple-200/80 leading-relaxed font-sans">
                      O agente propôs uma materialização estrutural ou novo *blueprint* que requer sua chancela direta para liberação no sistema.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-2">
                      {onApprove && (
                        <button
                          onClick={() => onApprove(request.id)}
                          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5"
                        >
                          <Check size={14} />
                          Aprovar e Materializar
                        </button>
                      )}
                      {onReject && (
                        <button
                          onClick={() => onReject(request.id)}
                          className="py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center justify-center gap-1"
                        >
                          <X size={12} />
                          Rejeitar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Practical Clarification Box (needs_clarification) */}
                {request.status === 'needs_clarification' && (
                  <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-amber-400 shrink-0" />
                      <h3 className="text-xs font-black text-amber-300 uppercase tracking-widest">Esclarecimento Pendente</h3>
                    </div>

                    {question && (
                      <p className="text-xs text-amber-200/90 leading-relaxed bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 font-mono">
                        "{question}"
                      </p>
                    )}

                    <div className="space-y-3 pt-1">
                      {missing.length > 0 && (
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/80 block mb-1.5">
                            Preenchimento das Chaves Ausentes:
                          </span>
                          <div className="space-y-2">
                            {missing.map((field: string) => (
                              <div key={field} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-white/40 w-24 shrink-0 truncate">{field}:</span>
                                <input
                                  type="text"
                                  placeholder="Inserir valor canônico..."
                                  value={answers[field] || ''}
                                  onChange={(e) => setAnswers({ ...answers, [field]: e.target.value })}
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-amber-500/40 outline-none font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-1.5">
                          {missing.length > 0 ? "Ou Resposta de Contexto Livre:" : "Resposta de Clarificação:"}
                        </span>
                        <textarea
                          rows={2}
                          placeholder="Instrua o agente ou preencha a informação faltante para destravar a máquina..."
                          value={genericAnswer}
                          onChange={(e) => setGenericAnswer(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/20 focus:border-amber-500/40 outline-none font-sans leading-relaxed resize-none custom-scrollbar"
                        />
                      </div>

                      {onClarify && (
                        <button
                          onClick={handleSendClarification}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5"
                        >
                          <Send size={12} />
                          Transmitir Respostas à Lótus
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Resultado da Materialização */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Database size={14} className="text-purple-400 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Resultado da Materialização</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white/1 rounded-2xl p-3 border border-white/5 w-full max-w-full min-w-0">
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Ação Técnica</span>
                      <span className="text-xs font-mono font-bold text-emerald-400 truncate block">{actionStr}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Entity Type</span>
                      <span className="text-xs font-mono text-white/60 uppercase truncate block">{typeStr}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Entity Ref (ID Destino)</span>
                      <span className="text-xs font-mono font-bold text-blue-400 break-all block select-all">{refStr}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Caminho Canônico (Path)</span>
                      <span className="text-[9px] font-mono text-white/40 break-all select-all block">{pathStr}</span>
                    </div>
                  </div>

                  {summaryStr && (
                    <div className="w-full max-w-full min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Sumário Técnico do Dispatcher</span>
                      <p className="text-xs text-white/60 leading-relaxed font-sans bg-white/2 p-3 rounded-xl border border-white/5">
                        {summaryStr}
                      </p>
                    </div>
                  )}

                  {missing.length > 0 && request.status !== 'needs_clarification' && (
                    <div className="pt-2 w-full max-w-full min-w-0">
                      <span className="text-[9px] font-black text-amber-400/80 uppercase tracking-widest block mb-1.5 flex items-center gap-1 truncate">
                        <HelpCircle size={12} className="shrink-0" />
                        Campos Ausentes Registrados:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {missing.map((f: string) => (
                          <span key={f} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-mono text-amber-300">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {request.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mt-2 w-full max-w-full min-w-0">
                      <span className="text-[9px] font-black text-red-400 uppercase tracking-widest block mb-0.5">Erro no Processo:</span>
                      <p className="text-xs font-mono text-red-200 break-all">{request.error}</p>
                    </div>
                  )}
                </div>

                {/* 6. General Content */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4 w-full max-w-full min-w-0">
                  <div className="min-w-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Título</label>
                    <p className="text-sm font-bold text-white break-words">{request.title || 'Sem Título'}</p>
                  </div>

                  {request.summary && (
                    <div className="min-w-0">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Missão / Descrição</label>
                      <p className="text-xs text-white/60 leading-relaxed break-words">{request.summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 w-full max-w-full min-w-0">
                    <div className="min-w-0">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Prioridade</label>
                      <span className="text-xs font-bold text-white uppercase truncate block">{request.priority || 'medium'}</span>
                    </div>
                    <div className="min-w-0">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Solicitado em</label>
                      <span className="text-xs font-bold text-white/60 block truncate">{safeFormatDateTime(request.requestedAt || (request as any).createdAt)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 min-w-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Autoria e Rastreabilidade</label>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                      <User size={12} className="text-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-white uppercase truncate block">
                        {request.createdByType || 'agent'} / {request.createdById || request.requestedBy || 'lotus'}
                      </span>
                    </div>
                  </div>

                  {request.origin && (
                    <div className="pt-3 border-t border-white/5 min-w-0">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1.5">Canal de Origem</label>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 bg-white/5 rounded-md text-[8px] font-bold text-white/60 uppercase tracking-tight border border-white/5 truncate max-w-full">
                          Canal: {request.origin.channel || 'N/A'}
                        </span>
                        <span className="px-2 py-0.5 bg-white/5 rounded-md text-[8px] font-bold text-white/60 uppercase tracking-tight border border-white/5 truncate max-w-full">
                          Fonte: {request.origin.source || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. Payload JSON */}
                {request.payload && (
                  <div className="w-full max-w-full min-w-0 space-y-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1.5 px-1">
                        <Code size={10} className="text-white/20 shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20 truncate">Objeto de Payload Nativo</span>
                      </div>
                      <div className="bg-white/2 border border-white/5 rounded-2xl p-3 overflow-hidden max-w-full">
                        <pre className="text-[9px] text-blue-300/80 font-mono leading-relaxed overflow-x-auto custom-scrollbar max-h-40">
                          {JSON.stringify(request.payload, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Patch Aplicado / Trilha Before-After */}
                    {(mat?.patch || resObj.patch) && (
                      <div className="pt-2">
                        <div className="flex items-center gap-1 mb-1.5 px-1">
                          <Code size={10} className="text-emerald-400/50 shrink-0" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400/80 truncate">Patch Aplicado (Rastreabilidade de Mutação)</span>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3 overflow-hidden max-w-full">
                          <pre className="text-[9px] text-emerald-300 font-mono leading-relaxed overflow-x-auto custom-scrollbar max-h-40">
                            {JSON.stringify(mat?.patch || resObj.patch, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Ações de Governança e Limpeza */}
                <div className="pt-4 border-t border-white/5 space-y-2 w-full max-w-full">
                  {onArchive && !request.archived && (
                    <button 
                      onClick={() => onArchive(request.id)}
                      className="w-full py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-purple-300 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Archive size={12} />
                      Arquivar Solicitação (Esconder Teste)
                    </button>
                  )}

                  <button 
                    onClick={onClose}
                    className="w-full py-2.5 bg-white/2 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all"
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
