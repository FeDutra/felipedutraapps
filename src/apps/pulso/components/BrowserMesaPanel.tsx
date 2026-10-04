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
type SavedItem = { id: string; title: string; url: string };
type Collection = { id: string; label: string; items: SavedItem[] };
type HistoryItem = SavedItem & { visitedAt: number };

const STATE_KEY = 'pulso-browser-arc-state-v1';
const HISTORY_KEY = 'pulso-browser-history-v1';
const BROWSER_RELEASE_MARK = 'arc-r2-pending';
const PULSO_CARMINE = '#b41643';

const SPACES: Array<{ id: SpaceId; label: string }> = [
  { id: 'pulso', label: 'PULSO' },
  { id: 'trabalho', label: 'trabalho' },
  { id: 'referencias', label: 'referências' },
];

const INITIAL_COLLECTIONS: Record<SpaceId, Collection[]> = {
  pulso: [{ id: 'fixadas', label: 'fixadas', items: [{ id: 'pulso-notion', title: 'PULSO · Notion', url: 'https://www.notion.so' }] }],
  trabalho: [{ id: 'projetos', label: 'projetos', items: [] }, { id: 'clientes', label: 'clientes', items: [] }],
  referencias: [{ id: 'arquivo', label: 'arquivo', items: [] }],
};

// Uma sessão real, externa e isolada. A PULSO desenha a cartografia e comanda
// a sessão pela ponte privada /api; ela nunca lê ou armazena cookies.
// The browser runtime is intentionally private to Fe's Tailnet. CI may
// override this endpoint, but the desktop build must retain the proven
// canonical bridge instead of silently shipping a non-functional panel.
const BROWSER_REMOTE_URL = (
  process.env.NEXT_PUBLIC_PULSO_BROWSER_URL
  || 'https://srv1499601.tailb70e29.ts.net:8443'
).replace(/\/$/, '');
const BROWSER_API_URL = BROWSER_REMOTE_URL ? `${BROWSER_REMOTE_URL}/api` : '';

const pageLabel = (page: RemotePage) => {
  if (page.title && page.title !== 'about:blank') return page.title;
  try { return new URL(page.url).hostname || 'nova página'; } catch { return 'nova página'; }
};

const navigableUrl = (value: string) => {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/i.test(raw)) return `https://${raw}`;
  return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
};

const asSavedItem = (page: RemotePage): SavedItem => ({
  id: `saved-${page.id}-${Date.now()}`,
  title: pageLabel(page),
  url: page.url,
});

const restoreCollections = (value: unknown): Record<SpaceId, Collection[]> => {
  if (!value || typeof value !== 'object') return INITIAL_COLLECTIONS;
  const candidate = value as Partial<Record<SpaceId, Collection[]>>;
  return SPACES.reduce((state, space) => {
    const entries = Array.isArray(candidate[space.id]) ? candidate[space.id]! : INITIAL_COLLECTIONS[space.id];
    state[space.id] = entries.map((collection) => ({
      ...collection,
      items: Array.isArray(collection.items)
        ? collection.items.map((item) => typeof item === 'string' ? { id: `legacy-${item}`, title: item, url: '' } : item)
        : [],
    }));
    return state;
  }, {} as Record<SpaceId, Collection[]>);
};

interface BrowserMesaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  onExpandChange?: (expanded: boolean) => void;
  requestedUrl?: string | null;
  onRequestedUrlConsumed?: () => void;
}

export function BrowserMesaPanel({ isOpen, onClose, onToggleCollapse, onExpandChange, requestedUrl, onRequestedUrlConsumed }: BrowserMesaPanelProps) {
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
  const [suggestionIndex, setSuggestionIndex] = React.useState(0);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [draggedItem, setDraggedItem] = React.useState<SavedItem | null>(null);
  const [dropCollectionId, setDropCollectionId] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const savedCollections = localStorage.getItem(STATE_KEY);
        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedCollections) setCollections(restoreCollections(JSON.parse(savedCollections)));
        if (savedHistory) setHistory(JSON.parse(savedHistory));
      } catch {
        // Persistência local é uma conveniência; a sessão nunca depende dela.
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  React.useEffect(() => {
    if (hydrated) localStorage.setItem(STATE_KEY, JSON.stringify(collections));
  }, [collections, hydrated]);

  React.useEffect(() => {
    if (hydrated) localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 60)));
  }, [history, hydrated]);

  const rememberPage = React.useCallback((page: RemotePage) => {
    if (!page.url || page.url === 'about:blank') return;
    const next = { id: page.id, title: pageLabel(page), url: page.url, visitedAt: Date.now() };
    setHistory((current) => [next, ...current.filter((entry) => entry.url !== next.url)].slice(0, 60));
  }, []);

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
      const nextPages = state.pages || [];
      setPages(nextPages);
      setActiveTargetId(state.activeTargetId || null);
      nextPages.forEach(rememberPage);
      setBridgeError(null);
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : 'sessão indisponível');
    }
  }, [rememberPage, request]);

  React.useEffect(() => {
    if (!isOpen || !BROWSER_API_URL) return undefined;
    const initialRefresh = window.setTimeout(() => void refreshPages(), 0);
    const timer = window.setInterval(() => void refreshPages(), 2200);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [isOpen, refreshPages]);

  const navigate = React.useCallback(async (rawUrl: string) => {
    const url = navigableUrl(rawUrl);
    rememberPage({ id: `typed-${url}`, title: rawUrl, url });
    await request('/v1/navigate', { method: 'POST', body: JSON.stringify({ url, targetId: activeTargetId }) });
    setOmnibox('');
    await refreshPages();
  }, [activeTargetId, refreshPages, rememberPage, request]);

  React.useEffect(() => {
    if (!requestedUrl || !isOpen) return;
    const navigation = window.setTimeout(() => {
      void navigate(requestedUrl).catch((error) => setBridgeError(error instanceof Error ? error.message : 'não foi possível abrir'));
      onRequestedUrlConsumed?.();
    }, 0);
    return () => window.clearTimeout(navigation);
  }, [isOpen, navigate, onRequestedUrlConsumed, requestedUrl]);

  const suggestions = React.useMemo(() => {
    const value = omnibox.trim();
    if (!value) return [];
    const query = encodeURIComponent(value);
    const seen = new Set<string>();
    const remembered = [...pages, ...history]
      .filter((page) => `${pageLabel(page)} ${page.url}`.toLowerCase().includes(value.toLowerCase()))
      .filter((page) => (seen.has(page.url) ? false : (seen.add(page.url), true)))
      .slice(0, 5)
      .map((page) => ({ label: pageLabel(page), value: page.url, hint: history.some((entry) => entry.url === page.url) ? 'histórico' : 'em curso' }));
    const candidates = [
      { label: `abrir ${value}`, value, hint: 'endereço' },
      { label: `buscar “${value}”`, value: `https://www.google.com/search?q=${query}`, hint: 'web' },
      ...remembered,
    ];
    return candidates;
  }, [history, omnibox, pages]);

  if (!isOpen) return null;

  const openAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = omnibox.trim();
    if (!address) return omniboxRef.current?.focus();
    try {
      await navigate(suggestions[suggestionIndex]?.value || address);
    } catch (error) { setBridgeError(error instanceof Error ? error.message : 'não foi possível abrir'); }
  };

  const focusSearch = () => requestAnimationFrame(() => omniboxRef.current?.focus({ preventScroll: true }));

  const createPage = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOmnibox('');
    // O foco é imediato e não pode depender da saúde da ponte remota.
    focusSearch();
    try {
      await request('/v1/pages', { method: 'POST', body: JSON.stringify({}) });
      await refreshPages();
      focusSearch();
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

  const placeInCollection = (collectionId: string) => {
    if (!draggedItem) return;
    setCollections((current) => ({
      ...current,
      [activeSpace]: current[activeSpace].map((collection) => ({
        ...collection,
        items: collection.id === collectionId
          ? [draggedItem, ...collection.items.filter((item) => item.url !== draggedItem.url)]
          : collection.items.filter((item) => item.id !== draggedItem.id),
      })),
    }));
    setDraggedItem(null);
    setDropCollectionId(null);
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
        data-browser-release={BROWSER_RELEASE_MARK}
        className="relative flex h-full w-full overflow-visible bg-[#0a0a0b] text-[#f3f1eb]"
      >
        <aside className="flex w-[228px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0d0d0e]">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2"><span className="text-[15px] leading-none" aria-hidden="true">○</span><span className="text-[9px] tracking-[0.2em] text-[#f3f1eb]/72 lowercase">navegador</span></div>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={createPage} className="text-[#f3f1eb]/46 transition-colors hover:text-white" title="Nova página" aria-label="Nova página"><Plus size={15} strokeWidth={1.25} /></button>
          </div>

          <form onSubmit={openAddress} className="px-3 pb-3">
            <div className="flex items-center gap-2 border border-white/[0.1] bg-white/[0.025] px-2.5 py-2 focus-within:border-white/[0.26]">
              <Search size={12} strokeWidth={1.2} className="shrink-0 text-[#f3f1eb]/36" />
              <input ref={omniboxRef} value={omnibox} onChange={(event) => { setOmnibox(event.target.value); setSuggestionIndex(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setSuggestionIndex((current) => (current + 1) % suggestions.length); } if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length); } if (event.key === 'Escape') setOmnibox(''); }} placeholder="pesquisar ou abrir" className="min-w-0 flex-1 bg-transparent text-[10px] text-[#f3f1eb]/80 outline-none placeholder:text-[#f3f1eb]/32" aria-label="Pesquisar ou abrir endereço" />
            </div>
            {suggestions.length > 0 && <div className="relative z-40"><div className="absolute left-0 right-0 top-1 bg-[#111113] py-1 shadow-2xl">{suggestions.map((suggestion, index) => <button type="button" key={`${suggestion.value}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => void navigate(suggestion.value)} className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[10px] ${index === suggestionIndex ? 'bg-white/[0.08] text-white' : 'text-[#f3f1eb]/62 hover:bg-white/[0.05]'}`}><span className="min-w-0 truncate">{suggestion.label}</span><span className="shrink-0 text-[8px] tracking-[0.12em]" style={{ color: PULSO_CARMINE }}>{suggestion.hint}</span></button>)}</div></div>}
          </form>

          <div className="border-y border-white/[0.07] py-2">
            <p className="px-4 pb-1.5 text-[8px] tracking-[0.18em] text-[#f3f1eb]/28 lowercase">espaços</p>
            {SPACES.map((space) => <button type="button" key={space.id} onClick={() => setActiveSpace(space.id)} className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-[10px] transition-colors ${activeSpace === space.id ? 'text-[#f3f1eb]' : 'text-[#f3f1eb]/48 hover:text-[#f3f1eb]/82'}`}><CircleDot size={9} strokeWidth={1.25} style={activeSpace === space.id ? { color: PULSO_CARMINE } : undefined} className={activeSpace === space.id ? '' : 'text-[#f3f1eb]/28'} /><span className="truncate">{space.label}</span></button>)}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <div className="flex items-center justify-between px-4 pb-2"><p className="text-[8px] tracking-[0.18em] text-[#f3f1eb]/28 lowercase">coleções</p><button type="button" onClick={() => setIsCreatingFolder(true)} className="text-[#f3f1eb]/38 transition-colors hover:text-white" aria-label="Criar coleção" title="Criar coleção"><FolderPlus size={13} strokeWidth={1.25} /></button></div>
            {isCreatingFolder && <form onSubmit={createFolder} className="mx-3 mb-2 flex border-b border-white/[0.18] px-1 py-1"><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onBlur={() => !folderName.trim() && setIsCreatingFolder(false)} placeholder="nome da coleção" className="min-w-0 flex-1 bg-transparent text-[10px] text-[#f3f1eb] outline-none placeholder:text-[#f3f1eb]/28" /></form>}
            {collections[activeSpace].map((collection) => <div key={collection.id} onDragOver={(event) => { event.preventDefault(); setDropCollectionId(collection.id); }} onDragLeave={() => setDropCollectionId(null)} onDrop={(event) => { event.preventDefault(); placeInCollection(collection.id); }} className={`mb-2 py-1 transition-colors ${dropCollectionId === collection.id ? 'bg-white/[0.06]' : ''}`}><div className="flex items-center gap-1.5 px-4 py-1 text-[10px] text-[#f3f1eb]/52"><ChevronDown size={11} strokeWidth={1.25} className="text-[#f3f1eb]/28" /><Folder size={11} strokeWidth={1.15} className="text-[#f3f1eb]/40" /><span className="truncate">{collection.label}</span><span className="ml-auto text-[7px] tracking-[0.12em] text-[#f3f1eb]/18">{dropCollectionId === collection.id ? 'soltar' : collection.items.length || ''}</span></div>{collection.items.map((item) => <button type="button" draggable key={item.id} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedItem(item); }} onDragEnd={() => { setDraggedItem(null); setDropCollectionId(null); }} onClick={() => item.url && void navigate(item.url)} className="flex w-full items-center gap-2 px-8 py-1 text-left text-[10px] text-[#f3f1eb]/43 hover:text-[#f3f1eb]/78"><span className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: PULSO_CARMINE }} /><span className="truncate">{item.title}</span></button>)}</div>)}
            <div className="mt-4"><p className="px-4 pb-1.5 text-[8px] tracking-[0.18em] text-[#f3f1eb]/28 lowercase">em curso</p>{pages.map((page) => <button draggable key={page.id} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedItem(asSavedItem(page)); }} onDragEnd={() => { setDraggedItem(null); setDropCollectionId(null); }} onClick={() => void activatePage(page.id)} className={`group flex w-full items-center gap-2 px-4 py-1.5 text-left text-[10px] transition-colors ${page.id === activeTargetId ? 'text-[#f3f1eb]' : 'text-[#f3f1eb]/46 hover:text-[#f3f1eb]/82'}`} title={`${page.url} · arraste para uma coleção`}><Globe2 size={10} strokeWidth={1.15} style={page.id === activeTargetId ? { color: PULSO_CARMINE } : undefined} className={page.id === activeTargetId ? '' : 'text-[#f3f1eb]/28'} /><span className="min-w-0 flex-1 truncate">{pageLabel(page)}</span><span role="button" onClick={(event) => void closePage(event, page.id)} className="hidden text-[#f3f1eb]/34 group-hover:inline hover:text-[#f3f1eb]" aria-label={`Fechar ${pageLabel(page)}`}><X size={10} strokeWidth={1.25} /></span></button>)}</div>
          </div>

          <div className="px-4 py-3"><span className="flex items-center gap-2 text-[9px] text-[#f3f1eb]/34"><ShieldCheck size={11} strokeWidth={1.15} />perfil isolado</span>{bridgeError && <p className="mt-1 text-[8px]" style={{ color: PULSO_CARMINE }}>{bridgeError}</p>}</div>
        </aside>

        <section className="relative min-w-0 flex-1 bg-[#09090a]">
          <div className="absolute -right-[37px] top-0 z-30 flex flex-col overflow-hidden border border-white/[0.12] bg-[#0b0b0c] shadow-xl">
            <button onClick={toggleExpanded} className="p-2 text-[#f3f1eb]/48 transition-colors hover:bg-white/[0.07] hover:text-[#f3f1eb]" title={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'} aria-label={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'}>{expanded ? <Minimize2 size={14} strokeWidth={1.25} /> : <Maximize2 size={14} strokeWidth={1.25} />}</button>
            {onToggleCollapse && <button onClick={onToggleCollapse} className="border-t border-white/[0.08] p-2 text-[#f3f1eb]/48 transition-colors hover:bg-white/[0.07] hover:text-[#f3f1eb]" title="Recolher painel" aria-label="Recolher painel"><ChevronRight size={14} strokeWidth={1.25} /></button>}
            <button onClick={onClose} className="border-t border-white/[0.08] p-2 text-[#f3f1eb]/48 transition-colors hover:bg-white/[0.07] hover:text-[#f3f1eb]" title="Fechar navegador" aria-label="Fechar navegador"><X size={14} strokeWidth={1.25} /></button>
          </div>
          {BROWSER_REMOTE_URL ? <>{!frameLoaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#09090a] text-center"><div><span className="text-base text-[#f3f1eb]">○</span><p className="mt-3 text-[9px] tracking-[0.18em] text-[#f3f1eb]/35 lowercase">abrindo sessão isolada</p></div></div>}<iframe title="Navegador PULSO" src={BROWSER_REMOTE_URL} onLoad={() => setFrameLoaded(true)} className="h-full w-full border-0 bg-[#09090a]" allow="clipboard-read; clipboard-write; fullscreen" /></> : <div className="flex h-full items-center justify-center p-8 text-center"><div className="max-w-sm"><Globe2 size={19} strokeWidth={1.15} className="mx-auto text-[#f3f1eb]/60" /><p className="mt-4 text-[9px] tracking-[0.2em] text-[#f3f1eb]/38 lowercase">sessão ainda não conectada</p><p className="mt-3 text-sm font-light leading-6 text-[#f3f1eb]/58">A PULSO organiza espaços, coleções e contexto. O Chromium permanece uma sessão isolada.</p></div></div>}
        </section>
      </motion.div>
    </AnimatePresence>
  );
}
