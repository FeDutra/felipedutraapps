'use client';

import React from 'react';
import {
  Bookmark,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Globe2,
  Maximize2,
  Minimize2,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type BrowserGroup = 'pinned' | 'working' | 'reference';

type BrowserTab = {
  id: string;
  title: string;
  group: BrowserGroup;
  active?: boolean;
};

const GROUPS: Array<{ id: BrowserGroup; label: string }> = [
  { id: 'pinned', label: 'fixadas' },
  { id: 'working', label: 'em curso' },
  { id: 'reference', label: 'referências' },
];

const INITIAL_TABS: BrowserTab[] = [
  { id: 'pulso', title: 'PULSO', group: 'pinned', active: true },
  { id: 'notion', title: 'Notion', group: 'pinned' },
  { id: 'research', title: 'Pesquisa', group: 'working' },
];

/**
 * The remote session is intentionally a separate origin. PULSO owns the
 * surrounding context and controls; Chromium owns cookies, logins and tabs.
 * Set NEXT_PUBLIC_PULSO_BROWSER_URL in the deployed environment.
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
  const [tabs, setTabs] = React.useState<BrowserTab[]>(INITIAL_TABS);
  const [expanded, setExpanded] = React.useState(false);
  const [frameLoaded, setFrameLoaded] = React.useState(false);

  const activeTab = tabs.find((tab) => tab.active) || tabs[0];
  const selectTab = (id: string) => setTabs((current) => current.map((tab) => ({ ...tab, active: tab.id === id })));
  const addTab = () => setTabs((current) => [
    ...current.map((tab) => ({ ...tab, active: false })),
    { id: `tab-${Date.now()}`, title: 'nova página', group: 'working', active: true },
  ]);
  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="h-full w-full flex flex-col overflow-hidden bg-[#100f0e]/95 text-[#fbf9f5]"
      >
        <header className="shrink-0 border-b border-[#fbf9f5]/10 bg-[#171412]/70">
          <div className="flex items-center gap-2 px-3 sm:px-5 pt-3 pb-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-[#d2694c] text-sm leading-none" aria-hidden="true">○</span>
              <span className="text-[9px] font-light tracking-[0.22em] text-[#fbf9f5]/42 lowercase">mesa / navegador</span>
              <span className="h-3 w-px bg-[#fbf9f5]/10" />
              <span className="truncate text-[11px] font-light tracking-wide text-[#fbf9f5]/78">{activeTab?.title || 'navegador'}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={addTab} className="p-1.5 text-[#fbf9f5]/48 hover:text-[#fbf9f5] transition-colors" title="Nova página" aria-label="Nova página"><Plus size={14} strokeWidth={1.3} /></button>
              <button onClick={toggleExpanded} className="hidden sm:inline-flex p-1.5 text-[#fbf9f5]/48 hover:text-[#fbf9f5] transition-colors" title={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'} aria-label={expanded ? 'Voltar ao painel lateral' : 'Expandir navegador'}>{expanded ? <Minimize2 size={14} strokeWidth={1.3} /> : <Maximize2 size={14} strokeWidth={1.3} />}</button>
              {onToggleCollapse && <button onClick={onToggleCollapse} className="p-1.5 text-[#fbf9f5]/48 hover:text-[#fbf9f5] transition-colors" title="Recolher painel" aria-label="Recolher painel"><ChevronRight size={15} strokeWidth={1.3} /></button>}
              <span className="mx-1 h-4 w-px bg-[#fbf9f5]/10" />
              <button onClick={onClose} className="p-1.5 text-[#fbf9f5]/48 hover:text-[#fbf9f5] transition-colors" title="Fechar navegador" aria-label="Fechar navegador"><X size={15} strokeWidth={1.3} /></button>
            </div>
          </div>

          <div className="flex items-stretch border-t border-[#fbf9f5]/[0.07]">
            <aside className="hidden w-32 shrink-0 border-r border-[#fbf9f5]/10 py-2 sm:block">
              {GROUPS.map((group) => {
                const groupTabs = tabs.filter((tab) => tab.group === group.id);
                return (
                  <div key={group.id} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between px-3 pb-1 text-[8px] tracking-[0.16em] text-[#fbf9f5]/30 lowercase"><span>{group.label}</span><span>{groupTabs.length || ''}</span></div>
                    {groupTabs.map((tab) => (
                      <button key={tab.id} onClick={() => selectTab(tab.id)} className={`group flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors ${tab.active ? 'bg-[#d2694c]/12 text-[#fbf9f5]' : 'text-[#fbf9f5]/44 hover:bg-[#fbf9f5]/[0.035] hover:text-[#fbf9f5]/82'}`}>
                        <CircleDot size={9} strokeWidth={1.25} className={tab.active ? 'text-[#d2694c]' : 'text-[#fbf9f5]/26'} />
                        <span className="truncate text-[10px] font-light">{tab.title}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </aside>
            <div className="min-w-0 flex-1 overflow-x-auto px-2 py-2">
              <div className="flex min-w-max gap-1">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => selectTab(tab.id)} className={`flex max-w-36 items-center gap-1.5 border-b px-2.5 py-1.5 text-left transition-colors ${tab.active ? 'border-[#d2694c] bg-[#fbf9f5]/[0.06] text-[#fbf9f5]' : 'border-transparent text-[#fbf9f5]/40 hover:text-[#fbf9f5]/75'}`}>
                    <Bookmark size={9} fill={tab.group === 'pinned' ? 'currentColor' : 'none'} strokeWidth={1.2} className={tab.group === 'pinned' ? 'text-[#d2694c]' : ''} />
                    <span className="truncate text-[10px] font-light">{tab.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="relative min-h-0 flex-1 bg-[#0a0908]">
          {BROWSER_REMOTE_URL ? (
            <>
              {!frameLoaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0908] text-center"><div><span className="text-[#d2694c] text-base">○</span><p className="mt-3 text-[10px] tracking-[0.18em] text-[#fbf9f5]/35 lowercase">abrindo sessão isolada</p></div></div>}
              <iframe
                title="Navegador PULSO"
                src={BROWSER_REMOTE_URL}
                onLoad={() => setFrameLoaded(true)}
                className="h-full w-full border-0 bg-[#0a0908]"
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <Globe2 size={19} strokeWidth={1.15} className="mx-auto text-[#d2694c]" />
                <p className="mt-4 text-[10px] tracking-[0.2em] text-[#fbf9f5]/38 lowercase">sessão ainda não conectada</p>
                <p className="mt-3 text-sm font-light leading-6 text-[#fbf9f5]/60">A PULSO já tem o lugar do navegador. A sessão remota entra aqui sem levar identidade, cookies ou decisões para fora do seu perfil.</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[10px] text-[#fbf9f5]/32"><ShieldCheck size={12} strokeWidth={1.2} />perfil isolado · ação visível</span>
              </div>
            </div>
          )}
        </section>

        {BROWSER_REMOTE_URL && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#fbf9f5]/10 bg-[#171412]/70 px-3 py-2 text-[9px] text-[#fbf9f5]/36">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><ShieldCheck size={11} strokeWidth={1.2} className="text-[#d2694c]" />sessão isolada · PULSO preserva contexto e aprovações</span>
            <a href={BROWSER_REMOTE_URL} target="_blank" rel="noreferrer" className="shrink-0 text-[#fbf9f5]/48 hover:text-[#fbf9f5] transition-colors" title="Abrir sessão em janela própria"><ExternalLink size={12} strokeWidth={1.2} /></a>
          </footer>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
