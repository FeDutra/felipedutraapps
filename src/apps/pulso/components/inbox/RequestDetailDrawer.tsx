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

  const requestedByStr = request.createdById || request.requestedBy || 'lotus';
  const requestedAtStr = safeFormatDateTime(request.requestedAt || (request as any).createdAt);
  const processedByStr = request.processedBy || 'dispatcher/matResult';
  const processedAtStr = safeFormatDateTime(request.processedAt || request.updatedAt);

  const actionStr = mat?.action || resObj.action || (request.status === 'completed' ? 'updated' : 'N/A');
  const typeStr = mat?.entityType || resObj.entityType || request.requestType.replace('register_', '').replace('create_', '');
  const refStr = resObj.entityRef || mat?.entityRef || 'N/A';
  const pathStr = resObj.entityPath || mat?.entityPath || 'N/A';
  const matOkStr = mat?.ok !== undefined ? String(mat.ok) : (resObj.ok !== undefined ? String(resObj.ok) : 'N/A');
  const summaryStr = mat?.summary || resObj.summary || resObj.notes || 'Sem sumário técnico gravado.';

  const handleSendClarification = () => {
    if (!onClarify) return;
    const finalAnswers: any = { ...answers };
    if (genericAnswer) {
      finalAnswers.clarificationResponse = genericAnswer;
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
                {/* 1. Matriz de Auditoria Operacional Consolidada */}
                <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Shield size={14} className="text-purple-400 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest truncate">Rastreabilidade Visual e Auditoria</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 rounded-2xl p-3 border border-white/5 text-[10px] font-mono">
                    {/* 1. requestId */}
                    <div className="col-span-1 sm:col-span-2 pb-1.5 border-b border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-purple-400/80 block font-sans">1. Request ID (Raiz do Envelope)</span>
                      <span className="text-xs font-bold text-white break-all select-all block">{request.id}</span>
                    </div>

                    {/* 10. result.entityRef */}
                    <div className="col-span-1 sm:col-span-2 pb-1.5 border-b border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-400/80 block font-sans">10. Entity Ref (ID do Alvo Materializado)</span>
                      <span className="text-xs font-bold text-blue-400 break-all select-all block">{refStr}</span>
                    </div>

                    {/* 2. requestType */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">2. Request Type</span>
                      <span className="text-white/80 truncate block">{request.requestType}</span>
                    </div>

                    {/* 3. status */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans mb-0.5">3. Status Final</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border} truncate max-w-full`}>
                        {request.status}
                      </span>
                    </div>

                    {/* 4. requestedBy */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">4. Requested By</span>
                      <span className="text-white/80 truncate block">{requestedByStr}</span>
                    </div>

                    {/* 5. requestedAt */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">5. Requested At</span>
                      <span className="text-white/60 truncate block">{requestedAtStr}</span>
                    </div>

                    {/* 6. processedBy */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">6. Processed By</span>
                      <span className="text-white/80 truncate block">{processedByStr}</span>
                    </div>

                    {/* 7. processedAt */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">7. Processed At</span>
                      <span className="text-white/60 truncate block">{processedAtStr}</span>
                    </div>

                    {/* 8. result.action */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">8. Result Action</span>
                      <span className="text-emerald-400 font-bold truncate block">{actionStr}</span>
                    </div>

                    {/* 9. result.entityType */}
                    <div className="min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">9. Result Entity Type</span>
                      <span className="text-white/80 uppercase truncate block">{typeStr}</span>
                    </div>

                    {/* 11. result.entityPath */}
                    <div className="col-span-1 sm:col-span-2 pt-1 border-t border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">11. Result Entity Path</span>
                      <span className="text-white/40 break-all select-all block text-[9px]">{pathStr}</span>
                    </div>

                    {/* 12. matResult.ok */}
                    <div className="col-span-1 sm:col-span-2 pt-1 border-t border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block font-sans">12. Materialization OK (matResult.ok)</span>
                      <span className={`font-bold block truncate ${matOkStr === 'true' ? 'text-emerald-400' : (matOkStr === 'false' ? 'text-red-400' : 'text-white/40')}`}>
                        {matOkStr}
                      </span>
                    </div>
                  </div>

                  {/* 13. missingFields */}
                  {missing.length > 0 && (
                    <div className="pt-2 border-t border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 block mb-1 font-sans">
                        13. Missing Fields (Chaves Ausentes)
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {missing.map((f: string) => (
                          <span key={f} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded font-mono text-[9px] text-amber-300">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 14. error */}
                  {request.error && (
                    <div className="pt-2 border-t border-white/5 min-w-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-400 block mb-1 font-sans">
                        14. Error Log (Falha Capturada)
                      </span>
                      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl font-mono text-[10px] text-red-200 break-all">
                        {request.error}
                      </div>
                    </div>
                  )}
                </div>

                {/* Deduplication Key Tracing */}
                {request.dedupeKey && (
                  <div className="px-3 py-1.5 bg-white/1 border border-white/5 rounded-xl text-[9px] font-mono text-white/30 truncate select-all">
                    DedupeKey: {request.dedupeKey}
                  </div>
                )}

                {/* Sumário Técnico / Detalhe Adicional */}
                {summaryStr && summaryStr !== 'Sem sumário técnico gravado.' && (
                  <div className="bg-white/2 border border-white/5 rounded-3xl p-5 w-full max-w-full min-w-0">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1.5">Sumário / Notas Técnicas</span>
                    <p className="text-xs text-white/60 leading-relaxed font-sans bg-white/1 p-3 rounded-xl border border-white/5">
                      {summaryStr}
                    </p>
                  </div>
                )}

                {/* Ações de Barreira Humana Ativa */}
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
                          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check size={14} />
                          Aprovar e Materializar
                        </button>
                      )}
                      {onReject && (
                        <button
                          onClick={() => onReject(request.id)}
                          className="py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <X size={12} />
                          Rejeitar
                        </button>
                      )}
                    </div>
                  </div>
                )}

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
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Send size={12} />
                          Transmitir Respostas à Lótus
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Payload JSON Original */}
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

                {/* Ações de Limpeza */}
                <div className="pt-4 border-t border-white/5 space-y-2 w-full max-w-full">
                  {onArchive && !request.archived && (
                    <button 
                      onClick={() => onArchive(request.id)}
                      className="w-full py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-purple-300 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Archive size={12} />
                      Arquivar Solicitação (Esconder Teste)
                    </button>
                  )}

                  <button 
                    onClick={onClose}
                    className="w-full py-2.5 bg-white/2 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all cursor-pointer"
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
