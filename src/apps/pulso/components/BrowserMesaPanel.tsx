'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Folder,
  FolderPlus,
  Globe2,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type SpaceId = 'pulso' | 'trabalho' | 'referencias';
type RemotePage = { id: string; title: string; url: string };
type Collection = { id: string; label: string; items: string[] };

const SPACES: Array<{ id: SpaceId; label: string }> = [
  { id: 'pulso', label: 'PULSO' },
  { id: 'trabalho', label: 'trabalho' },
  { id: 'referencias', label: 'referências' },
];

const INITIAL_COLLECTIONS: Record<SpaceId, Collection[]> = {
  pulso: [{ id: 'fixadas', label: 'fixadas', items: ['PULSO · Notion'] }],
  trabalho: [{ id: 'projetos', label: 'projetos', items: [] }, { id: 'clientes', label: 'clientes', items: [] }],
  referencias: [{ id: 'arquivo', label: 'arquivo', items: [] }],
};

// Uma sessão real, externa e isolada. A PULSO desenha a cartografia e comanda
// a sessão pela ponte privada /api; ela nunca lê ou armazena cookies.
const BROWSER_REMOTE_URL = (process.env.NEXT_PUBLIC_PULSO_BROWSER_URL || '').replace(/\/$/, '');
const BROWSER_API_URL = BROWSER_REMOTE_URL ? `${BROWSER_REMOTE_URL}/api` : '';

const pageLabel = (page: RemotePage) => {
  if (page.title && page.title !== 'about:blank') return page.title;
  try { return new URL(page.url).hostname || 'nova página'; } catch { return 'nova página'; }
};

interface BrowserMesaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export function BrowserMesaPanel({ isOpen, onClose, onToggleCollapse, onExpandChange }: BrowserMesaPanelProps) {
  const [activeSpace, setActiveSpace] = React.useState<SpaceId>('pulso');
  const [collections, setCollections] = React.useState(INITIAL_COLLECTIONS);
  const [expanded, setExpanded] = React.useState(false);
  const [frameLoaded, setFrameLoaded] = React.useState(false);
  const [pages, setPages] = React.useState<RemotePage[]>([]);
  const [activeTargetId, setActiveTargetId] = React.useState<string | null>(null);
  const [omnibox, setOmnibox] = React.useState('');
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [folderName, setFolderName] = React.useState('');
  const [bridgeError, setBridgeError] = React.useState<string | null>(null);
  const omniboxRef = React.useRef<HTMLInputElement>(null);

  const request = React.useCallback(async (path: string, options?: RequestInit) => {
    if (!BROWSER_API_URL) throw new Error('sessão não configurada');
    const response = await fetch(`${BROWSER_API_URL}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'sessão indisponível');
    return body;
  }, []);

  const refreshPages = React.useCallback(async () => {
    if (!BROWSER_API_URL) return;
    try {
      const state = await request('/v1/state');
      setPages(state.pages || []);
      setActiveTargetId(state.activeTargetId || null);
      setBridgeError(null);
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : 'sessão indisponível');
    }
  }, [request]);

  React.useEffect(() => {
    if (!isOpen || !BROWSER_API_URL) return undefined;
    void refreshPages();
    const timer = window.setInterval(() => void refreshPages(), 2200);
    return () => window.clearInterval(timer);
  }, [isOpen, refreshPages]);

  if (!isOpen) return null;

  const openAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = omnibox.trim();
    if (!address) return omniboxRef.current?.focus();
    try {
      await request('/v1/navigate', { method: 'POST', body: JSON.stringify({ url: address, targetId: activeTargetId }) });
      setOmnibox('');
      await refreshPages();
    } catch (error) { setBridgeError(error instanceof Error ? error.message : 'não foi possível abrir'); }
  };

  const createPage = async () => {
    try {
      await request('/v1/pages', { method: 'POST', body: JSON.stringify({}) });
      await refreshPages();
      window.setTimeout(() => omniboxRef.current?.focus(), 80);
    } catch (error) { setBridgeError(error instanceof Error ? error.message : 'não foi possível criar página'); }
  };

  const activatePage = async (targetId: string) => {
    try {
      await request(`/v1/pages/${targetId}/activate`, { method: 'POST', body: '{}' });
      await refreshPages();
    } catch (error) { setBridgeError(error instanceof Error ? error.message : 'não foi possível abrir página'); }
  };

  const closePage = async (event: React.MouseEvent, targetId: string) => {
    event.stopPropagation();
    try {
      await request(`/v1/pages/${targetId}`, { method: 'DELETE' });
      await refreshPages();
    } catch (error) { setBridgeError(error instanceof Error ? error.message : 'não foi possível fechar página'); }
  };

  const createFolder = (event: React.FormEvent) => {
    event.preventDefault();
    const label = folderName.trim();
    if (!label) return;
    setCollections((current) => ({
      ...current,
      [activeSpace]: [...current[activeSpace], { id: `${activeSpace}-${Date.now()}`, label, items: [] }],
    }));
    setFolderName('');
    setIsCreatingFolder(false);
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-full overflow-hidden bg-[#0a0a0b] text-[#f3f1eb]"
      >
        <aside className="flex w-[228px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0d0d0e]">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2"><span className="text-[15px] leading-none" aria-hidden="true">○</span><span className="text-[9px] tracking-[0.2em] text-[#f3f1eb]/72 lowercase">navegador</span></div>
            <button onClick={createPage} className="text-[#f3f1eb]/46 transition-colors hover:text-white" title="Nova página" aria-label="Nova página"><Plus size={15} strokeWidth={1.25} /></button>
          </div>

          <form onSubmit={openAddress} className="px-3 pb-3">
            <div className="flex items-center gap-2 border border-white/[0.1] bg-white/[0.025] px-2.5 py-2 focus-within:border-white/[0.26]">
              <Search size={12} strokeWidth={1.2} className="shrink-0 text-[#f3f1eb]/36" />
              <input ref={omniboxRef} value={omnibox} onChange={(event) => setOmnibox(event.target.value)} placeholder="pesquisar ou abrir" className="min-w-0 flex-1 bg-transparent text-[10px] text-[#f3f1eb]/80 outline-none placeholder:text-[#f3f1eb]/32" aria-label="Pesquisar ou abrir endereço" />
            </div>
          </form>

          <div className="border-y border-white/[0.07] py-2">
            <p className="px-4 pb-1.5 text-[8px] tracking-[0.18em] text-[#f3f1eb]/28 lowercase">espaços</p>
            {SPACES.map((space) => <button key={space.id} onClick={() => setActiveSpace(space.id)} className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-[10px] transition-colors ${activeSpace === space.id ? 'bg-white/[0.06] text-[#f3f1eb]' : 'text-[#f3f1eb]/48 hover:bg-white/[0.035] hover:text-[#f3f1eb]/82'}`}><CircleDot size={9} strokeWidth={1.25} className={activeSpace === space.id ? 'text-[#e53f6f]' : 'text-[#f3f1eb]/28'} /><span className="truncate">{space.label}</span></button>)}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <div className="flex items-center justify-between px-4 pb-2"><p className="text-[8px] tracking-[0.18em] text-[#f3f1eb]/28 lowercase">coleções</p><button onClick={() => setIsCreatingFolder(true)} className="text-[#f3f1eb]/38 transition-colors hover:text-white" aria-label="Criar pasta" title="Criar pasta"><FolderPlus size={13} strokeWidth={1.25} /></button></div>
            {isCreatingFolder && <form onSubmit={createFolder} className="mx-3 mb-2 flex border border-white/[0.12] px-2 py-1"><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onBlur={() => !folderName.trim() && setIsCreatingFolder(false)} placeholder="nome da pasta" className="min-w-0 flex-1 bg-transparent text-[10px] text-[#f3f1eb] outline-none placeholder:text-[#f3f1eb]/28" /></form>}
            {collections[activeSpace].map((collection) => <div key={collection.id} className="mb-2"><div className="flex items-center gap-1.5 px-4 py-1 text-[10px] text-[#f3f1eb]/52"><ChevronDown size={11} strokeWidth={1.25} className="text-[#f3f1eb]/28" /><Folder size={11} strokeWidth={1.15} className="text-[#f3f1eb]/40" /><span className="truncate">{collection.label}</span></div>{collection.items.map((item) => <div key={item} className="flex items-center gap-2 px-8 py-1 text-[10px] text-[#f3f1eb]/43"><span className="h-1 w-1 shrink-0 rounded-full bg-[#e53f6f]" /><span className="truncate">{item}</span></div>)}</div>)}
            <div className="mt-4"><p className="px-4 pb-1.5 text-[8px] tracking-[0.18em] text-[#f3f1eb]/28 lowercase">em curso</p>{pages.map((page) => <button key={page.id} onClick={() => void activatePage(page.id)} className={`group flex w-full items-center gap-2 px-4 py-1.5 text-left text-[10px] transition-colors ${page.id === activeTargetId ? 'bg-white/[0.06] text-[#f3f1eb]' : 'text-[#f3f1eb]/46 hover:bg-white/[0.035] hover:text-[#f3f1eb]/82'}`} title={page.url}><Globe2 size={10} strokeWidth={1.15} className={page.id === activeTargetId ? 'text-[#e53f6f]' : 'text-[#f3f1eb]/28'} /><span className="min-w-0 flex-1 truncate">{pageLabel(page)}</span><span role="button" onClick={(event) => void closePage(event, page.id)} className="hidden text-[#f3f1eb]/34 group-hover:inline hover:text-[#f3f1eb]" aria-label={`Fechar ${pageLabel(page)}`}><X size={10} strokeWidth={1.25} /></span></button>)}</div>
          </div>

          <div className="border-t border-white/[0.07] px-4 py-3"><span className="flex items-center gap-2 text-[9px] text-[#f3f1eb]/34"><ShieldCheck size={11} strokeWidth={1.15} />perfil isolado</span>{bridgeError && <p className="mt-1 text-[8px] text-[#e53f6f]/80">{bridgeError}</p>}</div>
        </aside>

        <section className="relative min-w-0 flex-1 bg-[#09090a]">
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
            <button onClick={toggleExpanded} className="bg-[#0b0b0c]/88 p-2 text-[#f3f1eb]/48 backdrop-blur transition-colors hover:text-[#f3f1eb]" title={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'} aria-label={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'}>{expanded ? <Minimize2 size={14} strokeWidth={1.25} /> : <Maximize2 size={14} strokeWidth={1.25} />}</button>
            {onToggleCollapse && <button onClick={onToggleCollapse} className="bg-[#0b0b0c]/88 p-2 text-[#f3f1eb]/48 backdrop-blur transition-colors hover:text-[#f3f1eb]" title="Recolher painel" aria-label="Recolher painel"><ChevronRight size={14} strokeWidth={1.25} /></button>}
            <button onClick={onClose} className="bg-[#0b0b0c]/88 p-2 text-[#f3f1eb]/48 backdrop-blur transition-colors hover:text-[#f3f1eb]" title="Fechar navegador" aria-label="Fechar navegador"><X size={14} strokeWidth={1.25} /></button>
          </div>
          {BROWSER_REMOTE_URL ? <>{!frameLoaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#09090a] text-center"><div><span className="text-base text-[#f3f1eb]">○</span><p className="mt-3 text-[9px] tracking-[0.18em] text-[#f3f1eb]/35 lowercase">abrindo sessão isolada</p></div></div>}<iframe title="Navegador PULSO" src={BROWSER_REMOTE_URL} onLoad={() => setFrameLoaded(true)} className="h-full w-full border-0 bg-[#09090a]" allow="clipboard-read; clipboard-write; fullscreen" /></> : <div className="flex h-full items-center justify-center p-8 text-center"><div className="max-w-sm"><Globe2 size={19} strokeWidth={1.15} className="mx-auto text-[#f3f1eb]/60" /><p className="mt-4 text-[9px] tracking-[0.2em] text-[#f3f1eb]/38 lowercase">sessão ainda não conectada</p><p className="mt-3 text-sm font-light leading-6 text-[#f3f1eb]/58">A PULSO organiza espaços, coleções e contexto. O Chromium permanece uma sessão isolada.</p></div></div>}
        </section>
      </motion.div>
    </AnimatePresence>
  );
}
