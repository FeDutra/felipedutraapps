'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../shared/lib/firebase/client';
import { X, Plus, Trash2, FileText, Link as LinkIcon, UploadCloud } from 'lucide-react';

interface AreaFonte {
  id: string;
  type: 'notion' | 'link' | 'file';
  label: string;
  url: string;
  addedAt: number;
}

interface AreaConfigData {
  instrucoes: string;
  fontes: AreaFonte[];
}

const EMPTY_CONFIG: AreaConfigData = { instrucoes: '', fontes: [] };

interface AreaConfigPanelProps {
  areaId: string;
  areaName: string;
  onClose: () => void;
}

export const AreaConfigPanel: React.FC<AreaConfigPanelProps> = ({ areaId, areaName, onClose }) => {
  const [config, setConfig] = React.useState<AreaConfigData>(EMPTY_CONFIG);
  const [loading, setLoading] = React.useState(true);
  const [instrucoesDraft, setInstrucoesDraft] = React.useState('');
  const [newFonteUrl, setNewFonteUrl] = React.useState('');
  const [newFonteLabel, setNewFonteLabel] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [savedPulse, setSavedPulse] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const docRef = React.useMemo(() => doc(db, 'workspaces/felipe_dutra/areaConfig', areaId), [areaId]);

  React.useEffect(() => {
    const unsub = onSnapshot(docRef, (snap) => {
      const data = snap.exists() ? (snap.data() as AreaConfigData) : EMPTY_CONFIG;
      const normalized: AreaConfigData = {
        instrucoes: data.instrucoes || '',
        fontes: Array.isArray(data.fontes) ? data.fontes : [],
      };
      setConfig(normalized);
      setInstrucoesDraft(normalized.instrucoes);
      setLoading(false);
    });
    return () => unsub();
  }, [docRef]);

  const persist = React.useCallback(async (next: Partial<AreaConfigData>) => {
    const merged: AreaConfigData = { ...config, ...next };
    await setDoc(docRef, { ...merged, updatedAt: Date.now() }, { merge: true });
    setSavedPulse(true);
    setTimeout(() => setSavedPulse(false), 1500);
  }, [config, docRef]);

  const handleSaveInstrucoes = () => {
    persist({ instrucoes: instrucoesDraft });
  };

  const addFonte = (fonte: Omit<AreaFonte, 'id' | 'addedAt'>) => {
    const entry: AreaFonte = { ...fonte, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, addedAt: Date.now() };
    persist({ fontes: [...config.fontes, entry] });
  };

  const removeFonte = (id: string) => {
    persist({ fontes: config.fontes.filter(f => f.id !== id) });
  };

  const handleAddLinkFonte = () => {
    const url = newFonteUrl.trim();
    if (!url) return;
    const isNotion = /notion\.(so|site)/i.test(url) || /app\.notion\.com/i.test(url);
    addFonte({
      type: isNotion ? 'notion' : 'link',
      label: newFonteLabel.trim() || url,
      url,
    });
    setNewFonteUrl('');
    setNewFonteLabel('');
  };

  const handleFileUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `pulso/areaConfig/${areaId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
      const ref = storageRef(storage, path);
      const task = uploadBytesResumable(ref, file);
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', undefined, reject, () => resolve());
      });
      const url = await getDownloadURL(ref);
      addFonte({ type: 'file', label: file.name, url });
    } catch (err) {
      console.error('[AreaConfigPanel] upload falhou:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-[#0c0c0c]/76 backdrop-blur-xl flex items-stretch md:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full h-full md:h-auto md:max-h-[80vh] md:w-full md:max-w-md flex flex-col bg-[#0c0c0c]/40 md:border md:border-white/10 md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-light tracking-[0.24em] text-[#fbf9f5]/35 uppercase">configurar área</span>
            <span className="text-sm font-semibold tracking-[0.12em] text-[#fbf9f5]/90 lowercase">{areaName}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center justify-center"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 flex flex-col gap-8">
          {loading ? (
            <p className="text-[9px] tracking-widest uppercase text-[#fbf9f5]/35">carregando...</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-light tracking-[0.2em] text-[#fbf9f5]/45 uppercase">instruções</span>
                  {savedPulse && <span className="text-[9px] tracking-widest uppercase text-[#fbf9f5]/40">salvo</span>}
                </div>
                <textarea
                  value={instrucoesDraft}
                  onChange={(e) => setInstrucoesDraft(e.target.value)}
                  onBlur={handleSaveInstrucoes}
                  placeholder="contexto, resumo e regras específicas desta área..."
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-light text-[#fbf9f5]/90 placeholder:text-[#fbf9f5]/25 outline-none focus:border-white/25 transition-colors resize-none"
                />
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[9px] font-light tracking-[0.2em] text-[#fbf9f5]/45 uppercase">fontes</span>

                <div className="flex flex-col gap-2">
                  {config.fontes.length === 0 && (
                    <p className="text-[10px] text-[#fbf9f5]/30 font-light">nenhuma fonte ainda.</p>
                  )}
                  {config.fontes.map((f) => (
                    <div key={f.id} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      {f.type === 'file' ? <FileText size={12} className="text-[#fbf9f5]/40 shrink-0" /> : <LinkIcon size={12} className="text-[#fbf9f5]/40 shrink-0" />}
                      <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 text-[10px] text-[#fbf9f5]/70 truncate hover:text-white transition-colors">
                        {f.label}
                      </a>
                      <button
                        onClick={() => removeFonte(f.id)}
                        className="text-[#fbf9f5]/25 hover:text-[#b8283e] transition-colors bg-transparent border-none cursor-pointer outline-none shrink-0"
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <input
                    value={newFonteLabel}
                    onChange={(e) => setNewFonteLabel(e.target.value)}
                    placeholder="nome da fonte (opcional)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-[#fbf9f5]/90 placeholder:text-[#fbf9f5]/25 outline-none focus:border-white/25 transition-colors"
                  />
                  <div className="flex gap-2">
                    <input
                      value={newFonteUrl}
                      onChange={(e) => setNewFonteUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddLinkFonte(); }}
                      placeholder="link do Notion ou URL"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-[#fbf9f5]/90 placeholder:text-[#fbf9f5]/25 outline-none focus:border-white/25 transition-colors"
                    />
                    <button
                      onClick={handleAddLinkFonte}
                      className="px-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-[#fbf9f5]/70 hover:text-white border-none cursor-pointer outline-none flex items-center justify-center"
                      title="Adicionar fonte"
                    >
                      <Plus size={13} strokeWidth={1.5} />
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/15 hover:border-white/30 text-[10px] tracking-wide text-[#fbf9f5]/50 hover:text-white/80 transition-colors bg-transparent cursor-pointer outline-none disabled:opacity-40"
                  >
                    <UploadCloud size={12} strokeWidth={1.5} />
                    <span>{uploading ? 'enviando...' : 'upload de arquivo'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AreaConfigPanel;
