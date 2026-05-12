'use client';

import React from 'react';
import { requestsService } from '@/apps/pulso/services/requestsService';
import { PulsoRequest } from '@/apps/pulso/types/pulso.types';
import { Terminal, Database, CheckCircle2, AlertTriangle, ArrowRight, Layers, FileCode } from 'lucide-react';

export default function RequestsDebugPage() {
  const [requests, setRequests] = React.useState<PulsoRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await requestsService.getRequests(50);
        // Sort descending by requestedAt safely
        const sorted = [...data].sort((a, b) => {
          const tA = a.requestedAt?.getTime() || 0;
          const tB = b.requestedAt?.getTime() || 0;
          return tB - tA;
        });
        setRequests(sorted);
      } catch (err: any) {
        console.error("Debug page error:", err);
        setError(err.message || "Erro ao carregar solicitações");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'running': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'needs_clarification': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'needs_approval': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'failed': return 'bg-red-500/10 border-red-500/20 text-red-400';
      default: return 'bg-white/5 border-white/10 text-white/40';
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-10 font-sans selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 flex items-center justify-between border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400">Operational Kit Diagnostics</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter">REQUESTS BRIDGE AUDIT</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Base Collection</p>
            <p className="text-xs font-mono text-white/40">workspaces/felipe_dutra/pulso_requests</p>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-400" />
            <p className="text-xs font-mono text-red-300">{error}</p>
          </div>
        )}

        <div className="bg-white/2 border border-white/5 rounded-3xl p-8 backdrop-blur-xl mb-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Database size={16} className="text-white/30" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Log de Ingestão e Materialização (Últimos 50)</h2>
            </div>
            <span className="text-[10px] font-mono text-white/20">Total Listado: {requests.length}</span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Sincronizando fila canônica...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
              <p className="text-xs italic text-white/20 font-mono">Nenhuma solicitação encontrada no workspace.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const resObj = req.result || {};
                const mat = resObj.matResult || null;
                const missing = resObj.missingFields || [];
                const question = resObj.question || null;
                const hasMat = !!(resObj.entityRef || resObj.entityPath || mat?.entityRef);

                return (
                  <div key={req.id} className="bg-white/2 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                    {/* Top Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono font-bold text-white/30">{req.id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-white/60">
                            {req.requestType}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{req.title || 'Solicitação Sem Título'}</h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {req.origin?.channel && (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight bg-white/5 text-white/30 border border-white/5">
                            {req.origin.channel}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(req.status)}`}>
                          {req.status}
                        </span>
                      </div>
                    </div>

                    {/* Summary/Payload */}
                    {req.summary && (
                      <p className="text-xs text-white/40 mb-4 leading-relaxed font-sans">{req.summary}</p>
                    )}

                    {/* Outcome Box */}
                    <div className="border-t border-white/5 pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/1 rounded-xl p-3">
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Resultado & Destino</span>
                        {hasMat ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                              <CheckCircle2 size={12} />
                              <span className="font-bold">ID Canônico:</span> {resObj.entityRef || mat?.entityRef || 'N/A'}
                            </div>
                            <div className="text-[10px] font-mono text-white/30 truncate">
                              <span className="text-white/20">Path:</span> {resObj.entityPath || mat?.entityPath || 'N/A'}
                            </div>
                          </div>
                        ) : question ? (
                          <div className="text-xs text-amber-300/90 font-mono">
                            <span className="font-bold block text-[9px] uppercase tracking-wider text-amber-400/80 mb-0.5">Questão Pendente:</span>
                            {question}
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-white/20 italic">Sem metadados de materialização estrutural gravados.</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20 block mb-1">Status Interno Lótus</span>
                        <div className="text-xs font-mono text-white/50 space-y-0.5 truncate">
                          {resObj.executionStatus && <p><span className="text-white/20">Exec:</span> {resObj.executionStatus}</p>}
                          {mat?.action && <p><span className="text-white/20">MatAction:</span> {mat.action}</p>}
                          {missing.length > 0 && (
                            <p className="text-red-400"><span className="text-red-500/50">Missing:</span> {missing.join(', ')}</p>
                          )}
                          {!resObj.executionStatus && !mat?.action && missing.length === 0 && (
                            <p className="text-white/20 italic">Dados do payload ou dispatcher de conclusão pendentes.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <footer className="text-center text-[10px] font-mono text-white/20">
          Kit Operacional da Lótus/OpenClaw • Sincronização e Leitura Direta de Documentos Canônicos do PULSO.
        </footer>
      </div>
    </div>
  );
}
