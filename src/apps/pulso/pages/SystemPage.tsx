'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Check,
  Clock3,
  KeyRound,
  LoaderCircle,
  PlugZap,
  ShieldCheck,
  Terminal,
  CalendarClock,
  Play,
  Pause,
  Plus,
  Trash2,
} from 'lucide-react';
import { authService } from '@/shared/services/authService';
import {
  operatorControlService,
  OperatorApprovalProjection,
  OperatorRuntimeProjection,
  OperatorAutomationProjection,
} from '../services/operatorControlService';

type SystemSection = 'decisions' | 'routines' | 'state' | 'connections' | 'keys';
const BUILD_REVISION = process.env.NEXT_PUBLIC_PULSO_BUILD_REVISION || 'local';

const SECTIONS: Array<{ id: SystemSection; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: 'decisions', label: 'Decisões', icon: ShieldCheck },
  { id: 'routines', label: 'Rotinas', icon: CalendarClock },
  { id: 'state', label: 'Estado', icon: Activity },
  { id: 'connections', label: 'Integrações', icon: PlugZap },
  { id: 'keys', label: 'Chaves e políticas', icon: KeyRound },
];

const DECISION_LABELS: Record<string, string> = {
  allow: 'Permitir',
  'allow-once': 'Permitir uma vez',
  'allow-always': 'Sempre permitir',
  approve: 'Aprovar',
  deny: 'Negar',
  reject: 'Negar',
};

function formatTime(timestamp?: number | null, includeDate = false) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    ...(includeDate ? { day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function approvalTitle(approval: OperatorApprovalProjection) {
  if (approval.title) return approval.title;
  if (approval.toolName) return `Autorizar ${approval.toolName}`;
  if (approval.kind === 'exec') return 'Autorizar execução';
  if (approval.kind === 'plugin') return 'Autorizar ferramenta';
  return 'Autorizar operação do sistema';
}

function decisionTone(decision: string) {
  if (decision === 'deny' || decision === 'reject') return 'border-rose-300/20 text-rose-100 hover:bg-rose-300/10';
  if (decision.includes('always')) return 'border-white/15 text-white/70 hover:bg-white/8';
  return 'border-emerald-200/20 text-emerald-100 hover:bg-emerald-200/10';
}

function ApprovalCard({ approval }: { approval: OperatorApprovalProjection }) {
  const [submitting, setSubmitting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const decide = async (decision: string) => {
    setSubmitting(decision);
    setError(null);
    try {
      await operatorControlService.requestDecision(approval, decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a decisão.');
      setSubmitting(null);
    }
  };

  const body = approval.commandPreview || approval.commandText || approval.description || approval.detail;

  return (
    <article className="rounded-[26px] border border-white/10 bg-black/20 backdrop-blur-2xl p-5 md:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-white/35">
              <span>{approval.kind}</span>
              {approval.pluginId ? <><span>·</span><span>{approval.pluginId}</span></> : null}
              {approval.host ? <><span>·</span><span>{approval.host}</span></> : null}
            </div>
            <h2 className="text-base font-light tracking-wide text-white">{approvalTitle(approval)}</h2>
          </div>
          <span className="shrink-0 text-[9px] font-mono uppercase tracking-widest text-amber-200/70">
            {approval.status === 'resolving' ? 'enviando' : `expira · ${formatTime(approval.expiresAtMs)}`}
          </span>
        </div>

        {body ? (
          <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-black/25 p-4 font-mono text-[11px] leading-relaxed text-white/65">
            {body}
          </pre>
        ) : null}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[9px] font-mono uppercase tracking-wider text-white/28">
          {approval.agentId ? <span>agente · {approval.agentId}</span> : null}
          {approval.sessionKey ? <span className="max-w-full truncate">sessão · {approval.sessionKey}</span> : null}
          <span>recebida · {formatTime(approval.requestedAtMs, true)}</span>
        </div>

        {error ? <p className="text-xs text-rose-200/80">{error}</p> : null}

        <div className="flex flex-wrap gap-2 border-t border-white/7 pt-4">
          {approval.allowedDecisions.map(decision => (
            <button
              key={decision}
              type="button"
              disabled={approval.status !== 'pending' || submitting !== null}
              onClick={() => decide(decision)}
              className={`rounded-full border px-4 py-2 text-[10px] font-mono uppercase tracking-[0.14em] transition disabled:cursor-wait disabled:opacity-40 ${decisionTone(decision)}`}
            >
              {submitting === decision ? <LoaderCircle size={12} className="mr-2 inline animate-spin" /> : null}
              {DECISION_LABELS[decision] || decision}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function RuntimeStatus({ runtime }: { runtime: OperatorRuntimeProjection | null }) {
  const connected = runtime?.status === 'connected';

  return (
    <div className="rounded-[26px] border border-white/10 bg-black/18 p-5 backdrop-blur-2xl md:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.22em] text-white/30">PULSO OPERATOR</p>
          <h2 className="text-lg font-light text-white">Ponte com o runtime</h2>
        </div>
        <span className={`flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest ${connected ? 'text-emerald-200/75' : 'text-amber-200/75'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-300' : 'bg-amber-300'}`} />
          {connected ? 'conectada' : 'não ativada'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/7 bg-white/7 md:grid-cols-4">
        {[
          ['pendências', runtime?.pendingApprovals ?? 0],
          ['sessões', runtime?.activeSessions ?? '—'],
          ['gateway', runtime?.gatewayVersion ?? '—'],
          ['último pulso', formatTime(runtime?.lastSeenAtMs)],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#101010]/80 px-4 py-4">
            <p className="text-[8px] font-mono uppercase tracking-widest text-white/25">{label}</p>
            <p className="mt-2 truncate text-sm font-light text-white/75">{value}</p>
          </div>
        ))}
      </div>

      {!connected ? (
        <p className="mt-5 max-w-xl text-xs font-light leading-relaxed text-white/40">
          A superfície já está pronta. A ponte contínua ainda precisa ser ativada no bastidor para receber decisões do Gateway e devolver aprovações à OpenClaw.
        </p>
      ) : null}
    </div>
  );
}

export default function SystemPage() {
  const [section, setSection] = React.useState<SystemSection>('decisions');
  const [approvals, setApprovals] = React.useState<OperatorApprovalProjection[]>([]);
  const [runtime, setRuntime] = React.useState<OperatorRuntimeProjection | null>(null);
  const [automations, setAutomations] = React.useState<OperatorAutomationProjection[]>([]);
  const [automationBusy, setAutomationBusy] = React.useState<string | null>(null);
  const [showAutomationForm, setShowAutomationForm] = React.useState(false);
  const [automationDraft, setAutomationDraft] = React.useState({ name: '', cron: '0 9 * * *', message: '' });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let stopApprovals: () => void = () => {};
    let stopRuntime: () => void = () => {};
    let stopAutomations: () => void = () => {};
    let alive = true;

    authService.ensurePulsoAuthReady().then(() => {
      if (!alive) return;
      stopApprovals = operatorControlService.subscribeApprovals(
        value => {
          setApprovals(value);
          setLoading(false);
        },
        cause => {
          setError(cause.message);
          setLoading(false);
        },
      );
      stopRuntime = operatorControlService.subscribeRuntime(setRuntime, cause => setError(cause.message));
      stopAutomations = operatorControlService.subscribeAutomations(setAutomations, cause => setError(cause.message));
    }).catch(cause => {
      setError(cause instanceof Error ? cause.message : 'Falha ao autenticar a superfície operacional.');
      setLoading(false);
    });

    return () => {
      alive = false;
      stopApprovals();
      stopRuntime();
      stopAutomations();
    };
  }, []);

  const pending = approvals.filter(item => item.status === 'pending' || item.status === 'resolving');
  const recent = approvals.filter(item => item.status !== 'pending' && item.status !== 'resolving').slice(0, 8);

  const requestAutomation = async (key: string, command: Parameters<typeof operatorControlService.requestAutomationCommand>[0]) => {
    setAutomationBusy(key); setError(null);
    try { await operatorControlService.requestAutomationCommand(command); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível comandar a rotina.'); }
    finally { setAutomationBusy(null); }
  };

  const createAutomation = async () => {
    if (!automationDraft.name.trim() || !automationDraft.message.trim() || !automationDraft.cron.trim()) return;
    await requestAutomation('create', {
      action: 'create',
      job: {
        name: automationDraft.name.trim(),
        enabled: false,
        schedule: { kind: 'cron', expr: automationDraft.cron.trim(), tz: 'America/Sao_Paulo' },
        sessionTarget: 'isolated',
        payload: { kind: 'agentTurn', message: automationDraft.message.trim() },
        delivery: { mode: 'none' },
      },
    });
    setAutomationDraft({ name: '', cron: '0 9 * * *', message: '' });
    setShowAutomationForm(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0d0e] text-[#fbf9f5]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_16%,rgba(119,105,72,0.12),transparent_32%),radial-gradient(circle_at_20%_78%,rgba(43,91,77,0.08),transparent_35%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-8 md:px-9 md:py-12">
        <header className="mb-9 flex flex-col gap-6 border-b border-white/8 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3 text-[9px] font-mono uppercase tracking-[0.24em] text-white/30">
              <span>⌘</span><span>SISTEMA</span><span>·</span><span>bastidor</span>
            </div>
            <h1 className="text-3xl font-extralight tracking-[-0.03em] md:text-4xl">Autoridade operacional</h1>
            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-white/38">
              A PULSO decide. A OpenClaw executa. Infraestrutura, políticas e chaves permanecem atrás desta membrana.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-white/30">
            <Clock3 size={12} strokeWidth={1.5} />
            {pending.length} {pending.length === 1 ? 'decisão pendente' : 'decisões pendentes'}
          </div>
        </header>

        <nav className="mb-9 flex max-w-full gap-2 overflow-x-auto pb-2" aria-label="Seções do sistema">
          {SECTIONS.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-mono uppercase tracking-[0.14em] transition ${active ? 'border-white/20 bg-white/10 text-white' : 'border-white/8 text-white/35 hover:border-white/15 hover:text-white/70'}`}
              >
                <Icon size={12} strokeWidth={1.5} />{item.label}
              </button>
            );
          })}
        </nav>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/5 p-4 text-xs text-rose-100/70">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : null}

        {section === 'decisions' ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <main>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Agora</h2>
                {loading ? <LoaderCircle size={14} className="animate-spin text-white/30" /> : null}
              </div>
              <div className="space-y-4">
                {!loading && pending.length === 0 ? (
                  <div className="rounded-[26px] border border-dashed border-white/10 bg-black/10 px-6 py-14 text-center backdrop-blur-xl">
                    <Check size={19} className="mx-auto mb-4 text-emerald-200/55" strokeWidth={1.4} />
                    <p className="text-sm font-light text-white/55">Nada pede sua decisão agora.</p>
                    <p className="mt-2 text-xs text-white/25">Quando uma ferramenta, execução ou agente pedir autoridade, ela aparece aqui.</p>
                  </div>
                ) : null}
                {pending.map(approval => <ApprovalCard key={approval.id} approval={approval} />)}
              </div>

              {recent.length > 0 ? (
                <section className="mt-10">
                  <h2 className="mb-4 text-[10px] font-mono uppercase tracking-[0.2em] text-white/25">Decisões recentes</h2>
                  <div className="divide-y divide-white/6 border-y border-white/6">
                    {recent.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-3 text-xs">
                        <span className="truncate text-white/45">{approvalTitle(item)}</span>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-white/25">{item.resolvedDecision || item.status}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </main>
            <aside className="space-y-4">
              <RuntimeStatus runtime={runtime} />
              <div className="rounded-[24px] border border-white/8 bg-black/14 p-5 text-xs font-light leading-relaxed text-white/35 backdrop-blur-xl">
                <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.2em] text-white/25">Regra</p>
                Aprovações são autoridade de execução. A PULSO exibe apenas projeções sanitizadas; credenciais e segredos nunca atravessam esta tela.
              </div>
            </aside>
          </div>
        ) : null}

        {section === 'state' ? (
          <div className="space-y-6">
            <RuntimeStatus runtime={runtime} />
            <Link href="/pulso/health" className="flex items-center justify-between rounded-[24px] border border-white/8 bg-black/12 p-5 text-sm text-white/50 transition hover:border-white/15 hover:text-white/75">
              <span><span className="mr-3 font-mono text-white/25">↗</span>Ver sinais de saúde legados</span>
              <Activity size={14} />
            </Link>
          </div>
        ) : null}

        {section === 'routines' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-light">Agenda operacional da OpenClaw</h2>
                <p className="mt-1 text-xs text-white/35">{automations.filter(item => item.enabled).length} ativas · {automations.length} totais · Gateway como fonte canônica</p>
              </div>
              <button type="button" onClick={() => setShowAutomationForm(value => !value)} className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-white/60 hover:bg-white/8">
                <Plus size={12} /> nova rotina
              </button>
            </div>
            {showAutomationForm ? (
              <div className="grid gap-3 rounded-[24px] border border-white/10 bg-black/18 p-5 backdrop-blur-2xl md:grid-cols-2">
                <input value={automationDraft.name} onChange={event => setAutomationDraft(value => ({ ...value, name: event.target.value }))} placeholder="nome da rotina" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs outline-none" />
                <input value={automationDraft.cron} onChange={event => setAutomationDraft(value => ({ ...value, cron: event.target.value }))} placeholder="cron · 0 9 * * *" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none" />
                <textarea value={automationDraft.message} onChange={event => setAutomationDraft(value => ({ ...value, message: event.target.value }))} placeholder="o que a rotina deve fazer" className="min-h-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs outline-none md:col-span-2" />
                <button type="button" disabled={automationBusy === 'create'} onClick={createAutomation} className="rounded-full border border-emerald-200/20 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-emerald-100 disabled:opacity-40">criar pausada</button>
              </div>
            ) : null}
            <div className="grid gap-3">
              {automations.map(job => (
                <article key={job.id} className="flex flex-col gap-4 rounded-[22px] border border-white/8 bg-black/14 p-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${job.enabled ? 'bg-emerald-300' : 'bg-white/20'}`} /><h3 className="truncate text-sm font-light text-white/75">{job.name}</h3></div>
                    <p className="mt-2 truncate font-mono text-[9px] uppercase tracking-wider text-white/25">{job.payloadKind || 'job'} · {job.ownerAgentId || 'sistema'} · próxima {formatTime(job.nextRunAtMs, true)}</p>
                    {job.lastError ? <p className="mt-2 text-xs text-rose-200/65">{job.lastError}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" title={job.enabled ? 'Pausar' : 'Ativar'} disabled={automationBusy === job.id} onClick={() => requestAutomation(job.id, { action: 'update', automationId: job.id, patch: { enabled: !job.enabled } })} className="rounded-full border border-white/10 p-2 text-white/45 hover:text-white"><span className="sr-only">{job.enabled ? 'Pausar' : 'Ativar'}</span>{job.enabled ? <Pause size={13} /> : <Play size={13} />}</button>
                    <button type="button" title="Executar agora" disabled={automationBusy === job.id} onClick={() => requestAutomation(job.id, { action: 'run', automationId: job.id })} className="rounded-full border border-white/10 p-2 text-white/45 hover:text-white"><Play size={13} /></button>
                    <button type="button" title="Remover" disabled={automationBusy === job.id} onClick={() => requestAutomation(job.id, { action: 'remove', automationId: job.id })} className="rounded-full border border-rose-200/10 p-2 text-rose-200/35 hover:text-rose-100"><Trash2 size={13} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {section === 'connections' ? (
          <div className="rounded-[28px] border border-white/9 bg-black/16 p-6 backdrop-blur-2xl md:p-8">
            <PlugZap size={18} className="mb-5 text-white/40" strokeWidth={1.4} />
            <h2 className="text-lg font-light">Integrações entram aqui, sem expor credenciais.</h2>
            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-white/38">
              O painel antigo de Conexões ficará em quarentena. Esta nova superfície mostrará estado, dono, origem e última verificação; configuração sensível será feita pelo operador seguro.
            </p>
          </div>
        ) : null}

        {section === 'keys' ? (
          <div className="rounded-[28px] border border-white/9 bg-black/16 p-6 backdrop-blur-2xl md:p-8">
            <KeyRound size={18} className="mb-5 text-white/40" strokeWidth={1.4} />
            <h2 className="text-lg font-light">Cofre e políticas, não campos de texto.</h2>
            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-white/38">
              A PULSO poderá criar, substituir e revogar segredos por referência. Nunca exibirá o valor depois da gravação e nunca persistirá chaves no Firestore.
            </p>
          </div>
        ) : null}

        <footer className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/6 pt-5 text-[9px] font-mono uppercase tracking-widest text-white/20">
          <span className="flex items-center gap-2"><Terminal size={11} /> OpenClaw · runtime</span>
          <span>PULSO · autoridade humana</span>
          <span>Control UI · contingência</span>
          <span data-pulso-revision={BUILD_REVISION}>rev · {BUILD_REVISION.slice(0, 8)}</span>
        </footer>
      </div>
    </div>
  );
}
