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
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type SpaceId = 'pulso' | 'trabalho' | 'referencias';

type Collection = {
  id: string;
  label: string;
  items: string[];
};

const SPACES: Array<{ id: SpaceId; label: string }> = [
  { id: 'pulso', label: 'PULSO' },
  { id: 'trabalho', label: 'trabalho' },
  { id: 'referencias', label: 'referências' },
];

const INITIAL_COLLECTIONS: Record<SpaceId, Collection[]> = {
  pulso: [
    { id: 'fixadas', label: 'fixadas', items: ['PULSO · Notion'] },
    { id: 'em-curso', label: 'em curso', items: ['Pesquisa'] },
  ],
  trabalho: [
    { id: 'projetos', label: 'projetos', items: [] },
    { id: 'clientes', label: 'clientes', items: [] },
  ],
  referencias: [
    { id: 'arquivo', label: 'arquivo', items: [] },
  ],
};

/**
 * O render é remoto porque o Chromium é uma sessão isolada. PULSO não lê nem
 * compartilha seus cookies: ela organiza contexto, espaços e ações ao redor.
 */
const BROWSER_REMOTE_URL = process.env.NEXT_PUBLIC_PULSO_BROWSER_URL || '';

interface BrowserMesaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export function BrowserMesaPanel({
  isOpen,
  onClose,
  onToggleCollapse,
  onExpandChange,
}: BrowserMesaPanelProps) {
  const [activeSpace, setActiveSpace] = React.useState<SpaceId>('pulso');
  const [collections, setCollections] = React.useState(INITIAL_COLLECTIONS);
  const [expanded, setExpanded] = React.useState(false);
  const [frameLoaded, setFrameLoaded] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  if (!isOpen) return null;

  const addFolder = () => {
    const label = `pasta ${collections[activeSpace].length + 1}`;
    setCollections((current) => ({
      ...current,
      [activeSpace]: [...current[activeSpace], { id: `${activeSpace}-${Date.now()}`, label, items: [] }],
    }));
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-full overflow-hidden bg-[#0b0b0c] text-[#f3f1eb]"
      >
        <aside className="flex w-[176px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0d0d0e]">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm leading-none text-[#f3f1eb]" aria-hidden="true">○</span>
              <span className="text-[10px] tracking-[0.16em] text-[#f3f1eb]/78 lowercase">navegador</span>
            </div>
            <button
              onClick={() => setSearchOpen((current) => !current)}
              className="text-[#f3f1eb]/40 transition-colors hover:text-[#f3f1eb]"
              aria-label="Pesquisar espaços e pastas"
              title="Pesquisar"
            >
              <Search size={14} strokeWidth={1.35} />
            </button>
          </div>

          {searchOpen && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 border border-white/[0.1] px-2.5 py-2 text-[10px] text-[#f3f1eb]/38">
                <Search size={11} strokeWidth={1.2} />
                <span>encontrar na navegação</span>
              </div>
            </div>
          )}

          <div className="border-y border-white/[0.07] py-2">
            <p className="px-4 pb-1.5 text-[8px] tracking-[0.17em] text-[#f3f1eb]/28 lowercase">espaços</p>
            {SPACES.map((space) => (
              <button
                key={space.id}
                onClick={() => setActiveSpace(space.id)}
                className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-[10px] transition-colors ${
                  activeSpace === space.id
                    ? 'bg-white/[0.055] text-[#f3f1eb]'
                    : 'text-[#f3f1eb]/48 hover:bg-white/[0.035] hover:text-[#f3f1eb]/82'
                }`}
              >
                <CircleDot size={9} strokeWidth={1.25} className={activeSpace === space.id ? 'text-[#b8283e]' : 'text-[#f3f1eb]/28'} />
                <span className="truncate">{space.label}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <div className="flex items-center justify-between px-4 pb-2">
              <p className="text-[8px] tracking-[0.17em] text-[#f3f1eb]/28 lowercase">coleções</p>
              <button onClick={addFolder} className="text-[#f3f1eb]/34 transition-colors hover:text-[#f3f1eb]" aria-label="Criar pasta" title="Criar pasta">
                <FolderPlus size={13} strokeWidth={1.25} />
              </button>
            </div>
            {collections[activeSpace].map((collection) => (
              <div key={collection.id} className="mb-2">
                <div className="flex items-center gap-1.5 px-4 py-1 text-[10px] text-[#f3f1eb]/52">
                  <ChevronDown size={11} strokeWidth={1.25} className="text-[#f3f1eb]/28" />
                  <Folder size={11} strokeWidth={1.15} className="text-[#f3f1eb]/40" />
                  <span className="truncate">{collection.label}</span>
                </div>
                {collection.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 px-8 py-1 text-[10px] text-[#f3f1eb]/43">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[#b8283e]" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="border-t border-white/[0.07] px-4 py-3">
            <span className="flex items-center gap-2 text-[9px] text-[#f3f1eb]/34">
              <ShieldCheck size={11} strokeWidth={1.15} /> perfil isolado
            </span>
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 bg-[#09090a]">
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
            <button onClick={toggleExpanded} className="bg-[#0b0b0c]/88 p-2 text-[#f3f1eb]/48 backdrop-blur transition-colors hover:text-[#f3f1eb]" title={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'} aria-label={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'}>
              {expanded ? <Minimize2 size={14} strokeWidth={1.25} /> : <Maximize2 size={14} strokeWidth={1.25} />}
            </button>
            {onToggleCollapse && <button onClick={onToggleCollapse} className="bg-[#0b0b0c]/88 p-2 text-[#f3f1eb]/48 backdrop-blur transition-colors hover:text-[#f3f1eb]" title="Recolher painel" aria-label="Recolher painel"><ChevronRight size={14} strokeWidth={1.25} /></button>}
            <button onClick={onClose} className="bg-[#0b0b0c]/88 p-2 text-[#f3f1eb]/48 backdrop-blur transition-colors hover:text-[#f3f1eb]" title="Fechar navegador" aria-label="Fechar navegador"><X size={14} strokeWidth={1.25} /></button>
          </div>

          {BROWSER_REMOTE_URL ? (
            <>
              {!frameLoaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#09090a] text-center"><div><span className="text-base text-[#f3f1eb]">○</span><p className="mt-3 text-[9px] tracking-[0.18em] text-[#f3f1eb]/35 lowercase">abrindo sessão isolada</p></div></div>}
              <iframe
                title="Navegador PULSO"
                src={BROWSER_REMOTE_URL}
                onLoad={() => setFrameLoaded(true)}
                className="h-full w-full border-0 bg-[#09090a]"
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <Globe2 size={19} strokeWidth={1.15} className="mx-auto text-[#f3f1eb]/60" />
                <p className="mt-4 text-[9px] tracking-[0.2em] text-[#f3f1eb]/38 lowercase">sessão ainda não conectada</p>
                <p className="mt-3 text-sm font-light leading-6 text-[#f3f1eb]/58">A PULSO organiza espaços, coleções e contexto. O Chromium permanece uma sessão isolada.</p>
              </div>
            </div>
          )}
        </section>
      </motion.div>
    </AnimatePresence>
  );
}
