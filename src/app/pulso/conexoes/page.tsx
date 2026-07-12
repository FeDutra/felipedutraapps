'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Plug, Search, CheckCircle2, ChevronRight, Apple, MessageSquare, Box, Plus, Trash2, X } from 'lucide-react';
import { db } from '../../../shared/lib/firebase/client';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

interface UserConnection {
  id: string;      // ex: "notion_despertar"
  alias: string;   // ex: "Notion Despertar"
  type: 'notion' | 'whatsapp' | 'macos' | 'arc' | 'google' | 'slack' | 'canva';
  token?: string;
  auth?: any;
  status: 'connected' | 'disconnected';
}

const PROVIDERS = [
  { type: 'notion', name: 'Notion', icon: Box, description: 'Leitura de páginas e databases' },
  { type: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, description: 'Envio e leitura de mensagens via QR Code' },
  { type: 'google', name: 'Google (Calendar/Gmail/Drive)', icon: Globe, description: 'Modo Deus para agendas, e-mails e arquivos' },
  { type: 'slack', name: 'Slack', icon: MessageSquare, description: 'Comunicação multicanais em workspaces' },
  { type: 'canva', name: 'Canva', icon: Plug, description: 'Criação e edição de artes e designs' }
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
    <div className="flex flex-col gap-4 items-center justify-center py-6 border-b border-dashed border-white/5">
      {status === 'error' && (
        <div className="text-red-400 text-xs text-center border-l-2 border-red-400/20 pl-4 py-2">
          <p className="font-mono uppercase tracking-wider mb-1">Microsserviço Desligado</p>
          <p className="font-light">{error}</p>
        </div>
      )}
      
      {status === 'loading' && (
        <div className="w-48 h-48 flex items-center justify-center animate-pulse">
           <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">Iniciando motor...</span>
        </div>
      )}

      {status === 'qr_ready' && qrCode && (
        <div className="flex flex-col gap-2 items-center">
          <div className="p-2">
            <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
          </div>
          <p className="text-[9px] text-[#fbf9f5]/55 text-center font-mono tracking-widest uppercase mt-2">
            Aguardando Pareamento
          </p>
        </div>
      )}

      {status === 'connected' && (
        <div className="flex flex-col gap-3 items-center text-green-400 font-mono">
          <CheckCircle2 size={24} strokeWidth={1} />
          <p className="text-xs uppercase tracking-widest text-white">Sessão Ativa</p>
          <p className="text-xs text-white/40 text-center font-light font-sans max-w-sm">
            A PULSO agora pode ler e enviar mensagens através de <strong>{alias}</strong>.
          </p>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="w-48 h-48 flex items-center justify-center">
           <span className="text-xs font-mono tracking-widest uppercase text-red-400/50">Desconectado</span>
        </div>
      )}

      {(status === 'loading' || status === 'qr_ready') && (
        <p className="text-[11px] text-white/40 text-center max-w-xs leading-relaxed font-light">
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
  const [newType, setNewType] = useState<'notion' | 'whatsapp' | 'google' | 'slack' | 'canva' | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [newToken, setNewToken] = useState('');
  
  // Google Auth params
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');

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
        if (doc.id !== 'macos' && doc.id !== 'arc') {
          const isGoogleConnected = data.type === 'google' && (
            data.serviceAccount?.client_email || data.auth?.access_token
          );
          loaded.push({
            id: doc.id,
            alias: data.alias || doc.id,
            type: data.type || 'notion',
            token: data.token,
            auth: data.auth,
            status: (data.type === 'whatsapp' || data.token || isGoogleConnected) ? 'connected' : 'disconnected',
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
      const id = `${newType}_${newAlias.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const connRef = doc(db, 'workspaces/felipe_dutra/connections', id);
      
      let payload: any = {
        alias: newAlias,
        type: newType,
        updatedAt: new Date().toISOString()
      };

      if (newType === 'google') {
        let saJson: any = null;
        try {
          saJson = JSON.parse(newToken);
        } catch {
          alert('JSON inválido. Cole o conteúdo completo do arquivo Service Account.');
          setIsSaving(false);
          return;
        }
        if (!saJson.client_email || !saJson.private_key) {
          alert('JSON incompleto. Certifique-se de que contém "client_email" e "private_key".');
          setIsSaving(false);
          return;
        }
        payload.serviceAccount = {
          client_email: saJson.client_email,
          private_key: saJson.private_key,
          project_id: saJson.project_id || '',
        };
      } else {
        payload.token = newToken || null;
      }

      await setDoc(connRef, payload, { merge: true });
      
      setIsAdding(false);
      setNewType(null);
      setNewAlias('');
      setNewToken('');
      setGoogleClientSecret('');
      setGoogleClientId('');
      setGoogleRefreshToken('');
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
      case 'google': return Globe;
      case 'slack': return MessageSquare;
      case 'canva': return Plug;
      default: return Plug;
    }
  };

  return (
    <div className="min-h-screen p-8 md:p-12 max-w-4xl mx-auto flex flex-col gap-12 relative text-white">
      <header className="flex flex-col gap-2 relative z-10">
        <div className="flex items-center gap-3 text-white/30 mb-2 font-mono uppercase tracking-[0.2em] text-[8px]">
          <Plug size={12} strokeWidth={1} />
          <span>Plataforma Aberta</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-wide text-[#fbf9f5]">Conexões</h1>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-transparent border-none text-white/40 hover:text-white font-mono uppercase tracking-widest text-[10px] cursor-pointer outline-none transition-colors flex items-center gap-1.5"
          >
            <Plus size={12} strokeWidth={1.5} />
            <span>Nova Conexão</span>
          </button>
        </div>
        <p className="text-xs font-light text-white/40 max-w-md">
          O tecido nervoso da PULSO. Gerencie os múltiplos perfis conectados à sua mente.
        </p>
      </header>

      {/* Novo Modal Minimalista Adicionar Conexão */}
      {isAdding && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-lg bg-transparent p-8 flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-light text-[#fbf9f5] tracking-wide font-mono uppercase">[ Adicionar Integração ]</h2>
              <button 
                onClick={() => setIsAdding(false)} 
                className="text-white/40 hover:text-white bg-transparent border-none cursor-pointer p-2 transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            
            {!newType ? (
              <div className="flex flex-col gap-1 font-mono text-[10px] tracking-widest uppercase">
                {PROVIDERS.map(p => (
                  <button 
                    key={p.type}
                    onClick={() => setNewType(p.type as any)}
                    className="flex items-center justify-between py-3 border-b border-white/5 bg-transparent hover:text-white text-white/40 transition-colors cursor-pointer text-left w-full outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <p.icon size={14} strokeWidth={1.2} />
                      <span>{p.name}</span>
                    </div>
                    <ChevronRight size={12} className="opacity-40" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-white/30">
                  <button onClick={() => setNewType(null)} className="hover:text-white bg-transparent border-none cursor-pointer outline-none font-mono">
                    [ Voltar ]
                  </button>
                  <span>/</span>
                  <span className="text-white font-bold">{newType}</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[8px] font-mono tracking-widest text-white/40 uppercase">Apelido (Nome da Conexão)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Notion da Despertar"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="bg-transparent border-b border-white/10 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-all font-light"
                  />
                  <p className="text-[10px] text-white/30 mt-1 font-light">É assim que você vai pedir por áudio (ex: "Pesquisa no Notion da Despertar")</p>
                </div>

                {newType === 'notion' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[8px] font-mono tracking-widest text-white/40 uppercase">Token de Integração (Opcional)</label>
                    <input 
                      type="password" 
                      placeholder="secret_XXXXXXXXX..."
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      className="bg-transparent border-b border-white/10 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-all font-mono"
                    />
                  </div>
                )}
                
                {newType === 'whatsapp' && (
                  <div className="p-3 border-l border-blue-500/20 text-blue-300 text-[11px] leading-relaxed font-light">
                    A autenticação do WhatsApp é feita via QR Code. O código será exibido na lista após você salvar esta conexão.
                  </div>
                )}

                {newType === 'slack' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[8px] font-mono tracking-widest text-white/40 uppercase">Slack Bot/User OAuth Token</label>
                    <input 
                      type="password" 
                      placeholder="xoxb-XXXXXXXXX..."
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      className="bg-transparent border-b border-white/10 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-all font-mono"
                    />
                  </div>
                )}

                {newType === 'canva' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[8px] font-mono tracking-widest text-white/40 uppercase">Canva Connect Token</label>
                    <input 
                      type="password" 
                      placeholder="canva_token_XXXXXXXXX..."
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      className="bg-transparent border-b border-white/10 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-all font-mono"
                    />
                  </div>
                )}

                {newType === 'google' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-3 border-l border-indigo-500/20 text-indigo-300 text-[11px] leading-relaxed font-light">
                      <p className="font-mono uppercase tracking-wider mb-1">🔐 Conexão via Service Account</p>
                      <p>1. Acesse o Google Cloud Console</p>
                      <p>2. Crie uma Service Account e gere uma chave JSON</p>
                      <p>3. Cole o conteúdo do arquivo JSON abaixo</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[8px] font-mono tracking-widest text-white/40 uppercase">Service Account JSON</label>
                      <textarea
                        rows={6}
                        placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}'}
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        className="bg-transparent border border-white/10 p-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all font-mono resize-none"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleSaveConnection}
                  disabled={!newAlias || isSaving}
                  className="mt-4 py-3 bg-transparent border border-white/20 hover:border-white/50 text-[#fbf9f5] font-mono tracking-widest text-[10px] uppercase transition-colors cursor-pointer disabled:opacity-30"
                >
                  {isSaving ? 'Conectando...' : '[ Criar Conexão ]'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Conexões */}
      <main className="flex flex-col gap-2 relative z-10">
        {loading ? (
          <div className="text-center py-12 text-white/20 text-xs font-mono tracking-widest uppercase animate-pulse">Sincronizando conexões...</div>
        ) : connections.length === 0 ? (
          <div className="text-center py-12 text-white/25 text-xs font-light">Nenhuma conexão estabelecida.</div>
        ) : (
          connections.map((conn) => {
            const IconComponent = getIcon(conn.type);
            
            return (
            <div key={conn.id} className="group relative border-b border-white/5">
              <button 
                onClick={() => setActiveConnection(activeConnection === conn.id ? null : conn.id)}
                className="w-full flex items-center justify-between py-5 bg-transparent border-none cursor-pointer outline-none text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-1 h-1 rounded-full ${conn.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400/80'} shrink-0`} />
                  <IconComponent size={14} strokeWidth={1} className={conn.status === 'connected' ? 'text-white/70' : 'text-white/20'} />
                  <div>
                    <h2 className={`text-sm font-light tracking-wide ${conn.status === 'connected' ? 'text-[#fbf9f5]' : 'text-[#fbf9f5]/50'}`}>
                      {conn.alias}
                    </h2>
                    <p className="text-[8px] uppercase tracking-widest text-white/20 font-mono mt-0.5">{conn.type}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`text-[8px] font-mono tracking-widest uppercase ${conn.status === 'connected' ? 'text-green-400/50' : 'text-yellow-400/60'}`}>
                    {conn.status === 'connected' ? 'Ativo' : 'Requer Ação'}
                  </span>
                  <ChevronRight size={14} className={`text-white/20 transition-transform ${activeConnection === conn.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {activeConnection === conn.id && (
                <div className="pl-9 pr-2 pb-6 pt-1 animate-fade-in">
                  <div className="py-4 flex flex-col gap-6 font-sans">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1 font-mono text-[9px] tracking-wider text-white/30 uppercase">
                         <h3 className="font-bold text-white/50">Detalhes da Conexão</h3>
                         <p>ID: {conn.id}</p>
                      </div>
                      
                      {conn.type !== 'macos' && conn.type !== 'arc' && (
                        <button 
                          onClick={() => handleDelete(conn.id)}
                          className="flex items-center gap-1.5 text-red-400 hover:text-white bg-transparent border-none cursor-pointer outline-none transition-colors text-[9px] font-mono tracking-widest uppercase"
                        >
                          <Trash2 size={12} /> Remover
                        </button>
                      )}
                    </div>
                    
                    {conn.type === 'notion' && conn.status !== 'connected' && (
                      <div className="flex flex-col gap-3 max-w-sm">
                        <p className="text-xs text-white/40 font-light">Insira o Token para autenticar esta instância do Notion.</p>
                        <input 
                          type="password" 
                          placeholder="Colar Token..."
                          onChange={(e) => {
                            // TODO: Add logic to update token
                          }}
                          className="bg-transparent border-b border-white/10 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
                        />
                        <button className="py-2 px-3 border border-white/20 hover:border-white/50 bg-transparent text-white font-mono text-[9px] tracking-widest uppercase self-start cursor-pointer transition-all">Salvar Token</button>
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
