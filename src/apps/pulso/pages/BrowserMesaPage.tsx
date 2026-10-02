'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import { ArrowLeft, Bookmark, CircleDot, ExternalLink, Globe2, LockKeyhole, MoreHorizontal, Plus, RotateCcw, ShieldCheck, X } from 'lucide-react';

type TabKind = 'pinned' | 'in_progress' | 'reference';

type BrowserTab = {
  id: string;
  title: string;
  domain: string;
  kind: TabKind;
  active?: boolean;
};

const INITIAL_TABS: BrowserTab[] = [
  { id: 'notion', title: 'PULSO · Notion', domain: 'notion.so', kind: 'pinned', active: true },
  { id: 'google', title: 'Pesquisa', domain: 'google.com', kind: 'in_progress' },
  { id: 'referencia', title: 'Referência de trabalho', domain: 'aguardando sessão', kind: 'reference' },
];

const KIND_COPY: Record<TabKind, string> = {
  pinned: 'fixadas',
  in_progress: 'em curso',
  reference: 'referências',
};

function safeReturnPath(value: string | null) {
  return value?.startsWith('/pulso/') ? value : '/pulso/live';
}

export default function BrowserMesaPage() {
  const params = useSearchParams();
  const returnPath = safeReturnPath(params.get('return'));
  const [tabs, setTabs] = React.useState(INITIAL_TABS);
  const [closedTabs, setClosedTabs] = React.useState<BrowserTab[]>([]);
  const activeTab = tabs.find((tab) => tab.active) ?? tabs[0];

  const selectTab = (id: string) => {
    setTabs((current) => current.map((tab) => ({ ...tab, active: tab.id === id })));
  };

  const togglePin = (id: string) => {
    setTabs((current) => current.map((tab) => (
      tab.id === id ? { ...tab, kind: tab.kind === 'pinned' ? 'in_progress' : 'pinned' } : tab
    )));
  };

  const closeTab = (id: string) => {
    const closing = tabs.find((tab) => tab.id === id);
    if (closing) setClosedTabs((closed) => [closing, ...closed]);
    setTabs((current) => {
      const remaining = current.filter((tab) => tab.id !== id);
      if (closing?.active && remaining[0]) remaining[0] = { ...remaining[0], active: true };
      return remaining;
    });
  };

  const reopenTab = (id: string) => {
    const reopening = closedTabs.find((tab) => tab.id === id);
    if (!reopening) return;
    setTabs((current) => [...current.map((tab) => ({ ...tab, active: false })), { ...reopening, active: true }]);
    setClosedTabs((current) => current.filter((tab) => tab.id !== id));
  };

  const addTab = () => {
    const id = `nova-${Date.now()}`;
    setTabs((current) => [
      ...current.map((tab) => ({ ...tab, active: false })),
      { id, title: 'Nova navegação', domain: 'sessão ainda não iniciada', kind: 'in_progress', active: true },
    ]);
  };

  return (
    <main className="min-h-[100dvh] bg-[#0f0f0f] text-[#fbf9f5] selection:bg-[#b8283e]/45">
      <div className="fixed inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 72% 18%, rgba(184,40,62,.22), transparent 30%), radial-gradient(circle at 18% 90%, rgba(255,255,255,.06), transparent 26%)' }} />
      <div className="relative min-h-[100dvh] grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="border-b lg:border-b-0 lg:border-r border-white/10 bg-black/15 backdrop-blur-xl">
          <div className="p-5 lg:p-6 flex lg:block items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">[ mesa / navegador ]</div>
              <h1 className="mt-3 font-light text-xl tracking-wide">Navegador</h1>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45 max-w-[190px]">A mesma continuidade da conversa, agora diante da web.</p>
            </div>
            <Link href={returnPath} className="lg:mt-8 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/60 hover:text-white transition-colors" prefetch={false}>
              <ArrowLeft size={14} /> conversa
            </Link>
          </div>

          <div className="hidden lg:block px-4 pb-6 space-y-6">
            {(['pinned', 'in_progress', 'reference'] as TabKind[]).map((kind) => {
              const group = tabs.filter((tab) => tab.kind === kind);
              return (
                <section key={kind}>
                  <div className="flex items-center justify-between px-2 mb-2 text-[9px] uppercase tracking-[0.2em] text-white/32">
                    <span>{KIND_COPY[kind]}</span><span>{group.length}</span>
                  </div>
                  <div className="space-y-1">
                    {group.map((tab) => (
                      <button key={tab.id} onClick={() => selectTab(tab.id)} className={`w-full text-left group px-3 py-2.5 transition-colors ${tab.active ? 'bg-white/[.09] text-white' : 'text-white/53 hover:bg-white/[.04] hover:text-white'}`}>
                        <span className="flex items-center gap-2 min-w-0">
                          <CircleDot size={12} strokeWidth={1.4} className={tab.active ? 'text-[#d85a6e]' : 'text-white/32'} />
                          <span className="truncate text-xs font-light tracking-wide">{tab.title}</span>
                        </span>
                        <span className="block truncate pl-5 mt-1 text-[9px] text-white/32">{tab.domain}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {closedTabs.length > 0 && (
              <section className="border-t border-white/8 pt-5">
                <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.2em] text-white/32">fechadas agora</p>
                {closedTabs.map((tab) => <button key={tab.id} onClick={() => reopenTab(tab.id)} className="w-full px-3 py-2 text-left text-[10px] text-white/45 hover:text-white"><RotateCcw size={11} className="inline mr-2" />{tab.title}</button>)}
              </section>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex flex-col p-3 sm:p-5 lg:p-7">
          <header className="flex items-center gap-2 min-w-0 border border-white/10 bg-white/[.035] px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 shrink-0 text-white/45"><Globe2 size={15} /><span className="hidden sm:inline text-[9px] uppercase tracking-[.18em]">PULSO</span></div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex-1 min-w-0 font-mono text-[11px] text-white/68 truncate">{activeTab?.domain ?? 'nenhuma sessão aberta'}</div>
            <button onClick={addTab} className="p-1.5 text-white/50 hover:text-white" title="Nova aba"><Plus size={15} /></button>
            <button className="p-1.5 text-white/50 hover:text-white" title="Mais opções"><MoreHorizontal size={16} /></button>
          </header>

          <div className="flex gap-1 overflow-x-auto py-3 border-b border-white/10">
            {tabs.map((tab) => (
              <div key={tab.id} className={`flex shrink-0 max-w-[210px] items-center gap-2 px-3 py-2 border-b-2 transition-colors ${tab.active ? 'border-[#d85a6e] bg-white/[.055] text-white' : 'border-transparent text-white/42 hover:text-white/75'}`}>
                <button onClick={() => selectTab(tab.id)} className="flex items-center gap-2 min-w-0 text-left"><CircleDot size={11} /><span className="truncate text-[11px]">{tab.title}</span></button>
                <button onClick={() => togglePin(tab.id)} className={tab.kind === 'pinned' ? 'text-[#d85a6e]' : 'text-white/30 hover:text-white'} title={tab.kind === 'pinned' ? 'Desfixar' : 'Fixar'}><Bookmark size={11} fill={tab.kind === 'pinned' ? 'currentColor' : 'none'} /></button>
                <button onClick={() => closeTab(tab.id)} className="text-white/25 hover:text-white" title="Fechar"><X size={12} /></button>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-[520px] mt-5 border border-white/10 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6 sm:p-12">
            <div className="max-w-xl text-center">
              <div className="mx-auto w-12 h-12 border border-[#d85a6e]/50 flex items-center justify-center text-[#e47787]"><Globe2 size={20} strokeWidth={1.3} /></div>
              <p className="mt-7 text-[10px] uppercase tracking-[.25em] text-white/38">sessão remota</p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-light tracking-wide">A web entra aqui.</h2>
              <p className="mt-4 text-sm leading-7 text-white/52">A superfície, as abas e o retorno à conversa já pertencem à PULSO. O próximo encaixe é a sessão Chromium isolada, com identidade, permissões e aprovações — sem misturar seus cookies com a infraestrutura.</p>
              <div className="mt-8 grid sm:grid-cols-2 gap-3 text-left">
                <div className="border border-white/10 p-4"><LockKeyhole size={15} className="text-[#df7281]" /><p className="mt-3 text-xs text-white/78">Sessão isolada</p><p className="mt-1 text-[11px] leading-relaxed text-white/40">Perfil por pessoa e organização.</p></div>
                <div className="border border-white/10 p-4"><ShieldCheck size={15} className="text-[#df7281]" /><p className="mt-3 text-xs text-white/78">Ação visível</p><p className="mt-1 text-[11px] leading-relaxed text-white/40">Publicar, enviar e pagar sempre pedem você.</p></div>
              </div>
              <p className="mt-7 text-[10px] text-white/30"><ExternalLink size={11} className="inline mr-1" />Ainda não há navegador remoto conectado nesta versão web.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
