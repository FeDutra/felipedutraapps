'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Plug, Search, CheckCircle2, ChevronRight, Apple, MessageSquare, Box, Plus, Trash2, X } from 'lucide-react';
import { db } from '../../../shared/lib/firebase/client';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

interface UserConnection {
  id: string;      // ex: "notion_despertar"
  alias: string;   // ex: "Notion Despertar"
  type: 'notion' | 'whatsapp' | 'macos' | 'arc';
  token?: string;
  status: 'connected' | 'disconnected';
}

const PROVIDERS = [
  { type: 'notion', name: 'Notion', icon: Box, description: 'Leitura de páginas e databases' },
  { type: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, description: 'Envio e leitura de mensagens via QR Code' },
];

function WhatsAppConnector({ connId, alias }: { connId: string, alias: string }) {
  const [status, setStatus] = useState<string>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:3005/status');
        const data = await res.json();
        
        setStatus(data.status);
        if (data.status === 'qr_ready' && data.qr) {
          setQrCode(data.qr);
        } else {
          setQrCode(null);
        }
        setError(null);
      } catch (err) {
        setStatus('error');
        setError('O microsserviço do WhatsApp não está rodando na porta 3005.');
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 3000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col gap-4 items-center justify-center p-6 bg-black/20 rounded-2xl border border-white/5">
      {status === 'error' && (
        <div className="text-red-400 text-xs text-center bg-red-400/10 p-3 rounded-lg border border-red-400/20">
          <p className="font-bold mb-1">Microsserviço Desligado</p>
          <p>{error}</p>
        </div>
      )}
      
      {status === 'loading' && (
        <div className="w-48 h-48 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center animate-pulse">
           <span className="text-xs text-white/30">Iniciando motor...</span>
        </div>
      )}

      {status === 'qr_ready' && qrCode && (
        <div className="flex flex-col gap-2 items-center">
          <div className="p-2 bg-white rounded-xl shadow-lg shadow-white/10">
            <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 rounded-md" />
          </div>
          <p className="text-[10px] text-white/50 text-center font-bold tracking-widest uppercase">
            Aguardando Pareamento
          </p>
        </div>
      )}

      {status === 'connected' && (
        <div className="flex flex-col gap-3 items-center text-green-400">
          <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center border border-green-400/20">
            <CheckCircle2 size={32} />
          </div>
          <p className="font-bold text-sm tracking-tight text-white">Sessão Ativa</p>
          <p className="text-xs text-white/40 text-center">
            A PULSO agora pode ler e enviar mensagens através de <strong>{alias}</strong>.
          </p>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="w-48 h-48 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
           <span className="text-xs text-red-400/50">Desconectado</span>
        </div>
      )}

      {(status === 'loading' || status === 'qr_ready') && (
        <p className="text-xs text-white/50 text-center max-w-xs leading-relaxed">
          Abra o WhatsApp no celular e escaneie o código para parear <strong>{alias}</strong>.
        </p>
      )}
    </div>
  );
}

export default function ConexoesPage() {
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  // Formulário de Adicionar
  const [newType, setNewType] = useState<'notion' | 'whatsapp' | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [newToken, setNewToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const collRef = collection(db, 'workspaces/felipe_dutra/connections');
      const snap = await getDocs(collRef);
      
      const loaded: UserConnection[] = [
        { id: 'macos', alias: 'macOS Native', type: 'macos', status: 'connected' },
        { id: 'arc', alias: 'Arc Browser', type: 'arc', status: 'connected' },
      ];

      snap.forEach(doc => {
        const data = doc.data();
        if (doc.id !== 'macos' && doc.id !== 'arc') { // just in case
          loaded.push({
            id: doc.id,
            alias: data.alias || doc.id,
            type: data.type || 'notion',
            token: data.token,
            status: (data.type === 'whatsapp' || data.token) ? 'connected' : 'disconnected',
          });
        }
      });
      
      setConnections(loaded);
    } catch (e) {
      console.error("Erro ao carregar conexões", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleSaveConnection = async () => {
    if (!newType || !newAlias) return;
    setIsSaving(true);
    try {
      // Cria ID seguro para o firebase
      const id = `${newType}_${newAlias.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      
      const connRef = doc(db, 'workspaces/felipe_dutra/connections', id);
      await setDoc(connRef, { 
        alias: newAlias, 
        type: newType, 
        token: newToken || null,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      
      setIsAdding(false);
      setNewType(null);
      setNewAlias('');
      setNewToken('');
      await loadConnections();
    } catch (e) {
      console.error("Erro ao salvar", e);
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workspaces/felipe_dutra/connections', id));
      await loadConnections();
    } catch (e) {
      console.error("Erro ao deletar", e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'macos': return Apple;
      case 'arc': return Globe;
      case 'notion': return Box;
      case 'whatsapp': return MessageSquare;
      default: return Plug;
    }
  };

  return (
    <div className="min-h-screen p-8 md:p-12 max-w-4xl mx-auto flex flex-col gap-12 relative text-white">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />

      <header className="flex flex-col gap-2 relative z-10">
        <div className="flex items-center gap-3 text-white/50 mb-2">
          <Plug size={16} />
          <span className="text-[10px] uppercase tracking-[0.2em] font-black">Plataforma Aberta</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black tracking-tighter">Conexões</h1>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm transition-all"
          >
            <Plus size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Nova Conexão</span>
          </button>
        </div>
        <p className="text-sm font-medium text-white/40 max-w-md">
          O tecido nervoso da PULSO. Gerencie os múltiplos perfis conectados à sua mente.
        </p>
      </header>

      {/* Novo Modal Minimalista Adicionar Conexão */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-black/60 border border-white/10 p-8 rounded-[2rem] backdrop-blur-xl flex flex-col gap-8 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold tracking-tight">Adicionar Integração</h2>
              <button onClick={() => setIsAdding(false)} className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {!newType ? (
              <div className="grid grid-cols-2 gap-4">
                {PROVIDERS.map(p => (
                  <button 
                    key={p.type}
                    onClick={() => setNewType(p.type as any)}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/20 transition-all text-left"
                  >
                    <p.icon size={28} className="text-white/80" />
                    <div className="text-center">
                      <h3 className="font-bold text-sm">{p.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-white/60 mb-2">
                  <button onClick={() => setNewType(null)} className="hover:text-white transition-colors">
                    Voltar
                  </button>
                  <span>/</span>
                  <span className="text-white capitalize font-medium">{newType}</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Apelido (Nome da Conexão)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Notion da Despertar"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all"
                  />
                  <p className="text-xs text-white/30 mt-1">É assim que você vai pedir por áudio (ex: "Pesquisa no Notion da Despertar")</p>
                </div>

                {newType === 'notion' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Token de Integração (Opcional agora)</label>
                    <input 
                      type="password" 
                      placeholder="secret_XXXXXXXXX..."
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                )}
                
                {newType === 'whatsapp' && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs leading-relaxed">
                    A autenticação do WhatsApp é feita via QR Code. O código será exibido na lista após você salvar esta conexão.
                  </div>
                )}

                <button 
                  onClick={handleSaveConnection}
                  disabled={!newAlias || isSaving}
                  className="mt-4 px-6 py-4 bg-white text-black font-black tracking-wide text-xs uppercase rounded-xl hover:bg-white/90 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Conectando...' : 'Criar Conexão'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Conexões */}
      <main className="flex flex-col gap-2 relative z-10">
        {loading ? (
          <div className="text-center py-12 text-white/40 text-sm animate-pulse">Sincronizando conexões...</div>
        ) : connections.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">Nenhuma conexão estabelecida.</div>
        ) : (
          connections.map((conn) => {
            const IconComponent = getIcon(conn.type);
            
            return (
            <div key={conn.id} className="group relative">
              <button 
                onClick={() => setActiveConnection(activeConnection === conn.id ? null : conn.id)}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${conn.status === 'connected' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse' : 'bg-yellow-400/80'} shrink-0`} />
                  <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/[0.02]">
                    <IconComponent size={18} className={conn.status === 'connected' ? 'text-white' : 'text-white/40'} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold tracking-tight ${conn.status === 'connected' ? 'text-white' : 'text-white/60'}`}>
                      {conn.alias}
                    </h2>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold">{conn.type}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] uppercase tracking-widest font-black ${conn.status === 'connected' ? 'text-green-400/80' : 'text-yellow-400/80'}`}>
                    {conn.status === 'connected' ? 'Ativo' : 'Requer Ação'}
                  </span>
                  <ChevronRight size={16} className={`text-white/20 transition-transform ${activeConnection === conn.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {activeConnection === conn.id && (
                <div className="pl-16 pr-4 pb-6 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-md flex flex-col gap-6">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                         <h3 className="font-bold text-white/80">Detalhes da Conexão</h3>
                         <p className="text-xs text-white/40">ID: {conn.id}</p>
                      </div>
                      
                      {conn.type !== 'macos' && conn.type !== 'arc' && (
                        <button 
                          onClick={() => handleDelete(conn.id)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-bold"
                        >
                          <Trash2 size={12} /> Remover
                        </button>
                      )}
                    </div>
                    
                    {conn.type === 'notion' && conn.status !== 'connected' && (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-white/60">Insira o Token para autenticar esta instância do Notion.</p>
                        <input 
                          type="password" 
                          placeholder="Colar Token..."
                          onChange={(e) => {
                            // TODO: Add logic to update token
                          }}
                          className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                        />
                        <button className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl self-start">Salvar Token</button>
                      </div>
                    )}
                    
                    {conn.type === 'whatsapp' && (
                      <WhatsAppConnector connId={conn.id} alias={conn.alias} />
                    )}

                  </div>
                </div>
              )}
            </div>
          );
          })
        )}
      </main>
    </div>
  );
}
