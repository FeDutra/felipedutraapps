'use client';

import React from 'react';
import { X } from 'lucide-react';
import { pulsoCoreProvider } from '../services/pulsoCoreProvider';
import { pulsoCoreClient } from '../services/pulsoCoreClient';
import type {
  PulsoProviderAdapterKind,
  PulsoProviderConfig,
  PulsoProviderHealth,
} from '../services/pulsoCoreClient';

interface PulsoCoreProviderPanelProps {
  open: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

const DEFAULTS: Record<PulsoProviderAdapterKind, Pick<PulsoProviderConfig, 'providerId' | 'displayName' | 'model' | 'endpoint'>> = {
  codex_subscription: {
    providerId: 'codex-fe',
    displayName: 'Fe · ChatGPT',
    model: 'auto',
    endpoint: null,
  },
  openai: {
    providerId: 'openai',
    displayName: 'OpenAI',
    model: 'gpt-5.1',
    endpoint: 'https://api.openai.com',
  },
  anthropic: {
    providerId: 'anthropic',
    displayName: 'Anthropic',
    model: 'claude-sonnet-4-5',
    endpoint: 'https://api.anthropic.com',
  },
  local: {
    providerId: 'local',
    displayName: 'Endpoint local compatível',
    model: 'qwen2.5-coder:7b',
    endpoint: 'http://127.0.0.1:11434',
  },
  ollama: {
    providerId: 'ollama-local',
    displayName: 'Ollama local',
    model: 'qwen3:4b',
    endpoint: 'http://127.0.0.1:11434',
  },
};

const configFor = (adapterKind: PulsoProviderAdapterKind): PulsoProviderConfig => ({
  ...DEFAULTS[adapterKind],
  adapterKind,
  allowExternalNetwork: adapterKind !== 'local' && adapterKind !== 'ollama',
  profileId: adapterKind === 'codex_subscription' ? 'fe-pessoal' : null,
});

export function PulsoCoreProviderPanel({ open, onClose, onConfigured }: PulsoCoreProviderPanelProps) {
  const [config, setConfig] = React.useState<PulsoProviderConfig>(() => (
    pulsoCoreProvider.readSavedConfig() || configFor('codex_subscription')
  ));
  const [secret, setSecret] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'test' | 'login' | 'logout' | null>(null);
  const [health, setHealth] = React.useState<PulsoProviderHealth | null>(null);
  const [account, setAccount] = React.useState<{ email: string | null; planType: string } | null>(null);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [accessMode, setAccessMode] = React.useState<'restricted' | 'integral'>('restricted');

  React.useEffect(() => {
    if (!open) return;
    const saved = pulsoCoreProvider.readSavedConfig();
    if (saved) setConfig(saved);
    setSecret('');
    setError('');
    setMessage('');
    setHealth(null);
    setAccount(null);
    pulsoCoreClient.readAccessMode()
      .then((result) => {
        if (result.ok) setAccessMode(result.result.mode);
      })
      .catch(() => {});
    const active = saved || config;
    if (active.adapterKind === 'codex_subscription') {
      pulsoCoreProvider.configure(active)
        .then(() => pulsoCoreProvider.readSubscriptionAccount(active.providerId))
        .then((status) => setAccount(status.account ? {
          email: status.account.email,
          planType: status.account.planType,
        } : null))
        .catch(() => setAccount(null));
    }
  }, [open]);

  if (!open) return null;

  const updateKind = (adapterKind: PulsoProviderAdapterKind) => {
    setConfig(configFor(adapterKind));
    setHealth(null);
    setMessage('');
    setError('');
    setSecret('');
    setAccount(null);
  };

  const save = async () => {
    setBusy('save');
    setError('');
    setMessage('');
    setHealth(null);
    try {
      await pulsoCoreProvider.configure(config, secret || undefined);
      setSecret('');
      setMessage('provider configurado no PULSO Core');
      onConfigured?.();
    } catch (cause: any) {
      setError(cause?.message || String(cause));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setError('');
    setMessage('');
    try {
      const report = await pulsoCoreProvider.test(config.providerId);
      setHealth(report);
      if (report.status === 'healthy') setMessage('conexão confirmada');
      else setError(report.detail || 'provider indisponível');
    } catch (cause: any) {
      setHealth(null);
      setError(cause?.message || String(cause));
    } finally {
      setBusy(null);
    }
  };

  const login = async () => {
    setBusy('login');
    setError('');
    setMessage('abrindo o login oficial do ChatGPT…');
    setHealth(null);
    try {
      const started = await pulsoCoreProvider.startSubscriptionLogin(config);
      setMessage('conclua o login no navegador; a PULSO reconhecerá a assinatura automaticamente');
      let connected = null;
      for (let attempt = 0; attempt < 150; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await pulsoCoreProvider.readSubscriptionAccount(config.providerId, attempt % 5 === 4);
        if (status.account?.type === 'chatgpt') {
          connected = status.account;
          break;
        }
      }
      if (!connected) {
        await pulsoCoreProvider.cancelSubscriptionLogin(config.providerId, started.loginId).catch(() => {});
        throw new Error('O login não foi concluído dentro da janela de cinco minutos.');
      }
      setAccount({ email: connected.email, planType: connected.planType });

      let nextConfig = config;
      try {
        const response = await pulsoCoreProvider.listSubscriptionModels(config.providerId) as any;
        const models = Array.isArray(response?.data) ? response.data : Array.isArray(response?.models) ? response.models : [];
        const firstModel = models.find((model: any) => !model?.hidden)?.id || models[0]?.id || null;
        if (config.model === 'auto' && firstModel) {
          nextConfig = { ...config, model: firstModel };
          setConfig(nextConfig);
        }
      } catch {
        // A conta autenticada já é suficiente; o app-server pode resolver o modelo padrão.
      }
      await pulsoCoreProvider.configure(nextConfig);
      setMessage(`assinatura conectada · ${connected.email || 'conta ChatGPT'} · ${connected.planType}`);
      onConfigured?.();
    } catch (cause: any) {
      setError(cause?.message || String(cause));
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    setBusy('logout');
    setError('');
    try {
      await pulsoCoreProvider.logoutSubscription(config.providerId);
      setAccount(null);
      setMessage('assinatura desconectada deste perfil');
    } catch (cause: any) {
      setError(cause?.message || String(cause));
    } finally {
      setBusy(null);
    }
  };

  const toggleAccessMode = async () => {
    setBusy('save');
    setError('');
    setMessage('');
    try {
      const next = accessMode === 'integral' ? 'restricted' : 'integral';
      const result = await pulsoCoreClient.setAccessMode(next);
      if (!result.ok) throw new Error(result.error.message);
      setAccessMode(result.result.mode);
      setMessage(next === 'integral'
        ? 'modo integral ativo · identidade, memória, Notion e execução liberados'
        : 'modo restrito ativo · ferramentas e execução desligadas');
    } catch (cause: any) {
      setError(cause?.message || String(cause));
    } finally {
      setBusy(null);
    }
  };

  const inputClass = 'w-full bg-white/[0.045] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fbf9f5] placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors';
  const labelClass = 'text-[9px] tracking-[0.18em] text-[#fbf9f5]/42 uppercase';

  return (
    <div className="fixed top-4 right-4 bottom-4 z-[72] w-[min(25rem,calc(100vw-2rem))] bg-[#090909]/45 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-6 overflow-y-auto no-scrollbar flex flex-col text-left text-[#fbf9f5] animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/15 pb-4">
        <div>
          <span className="block text-xs font-bold tracking-widest text-white/90 lowercase">inteligência da pulso</span>
          <span className="block mt-1 text-[9px] tracking-[0.14em] text-[#fbf9f5]/35 uppercase">assinatura · modelo · identidade soberana</span>
        </div>
        <button type="button" onClick={onClose} className="text-[#fbf9f5]/45 hover:text-white bg-transparent border-none cursor-pointer outline-none">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label className={labelClass}>provider</label>
          <select value={config.adapterKind} onChange={(event) => updateKind(event.target.value as PulsoProviderAdapterKind)} className="pulso-select w-full">
            <option value="codex_subscription" className="bg-[#121212]">ChatGPT · assinatura</option>
            <option value="ollama" className="bg-[#121212]">Ollama local</option>
            <option value="local" className="bg-[#121212]">local · compatível com OpenAI</option>
            <option value="openai" className="bg-[#121212]">OpenAI API · avançado</option>
            <option value="anthropic" className="bg-[#121212]">Anthropic API · avançado</option>
          </select>
        </div>

        {config.adapterKind === 'codex_subscription' && (
          <div className="space-y-1.5 border-l border-white/15 pl-3 py-1">
            <label className={labelClass}>perfil de assinatura</label>
            <span className="block text-[11px] text-[#fbf9f5]/72">Fe · pessoal</span>
            <p className="text-[9px] leading-relaxed text-[#fbf9f5]/32">Primeira rodada: uma assinatura isolada. Despertar e Mila entram depois da prova de separação entre contas; nenhuma credencial será copiada ou compartilhada.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className={labelClass}>modelo</label>
          <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} className={inputClass} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>endpoint</label>
          <input value={config.endpoint || ''} onChange={(event) => setConfig({ ...config, endpoint: event.target.value })} className={inputClass} autoComplete="off" />
        </div>

        {config.adapterKind !== 'codex_subscription' && config.adapterKind !== 'local' && config.adapterKind !== 'ollama' && (
          <div className="space-y-1.5">
            <label className={labelClass}>credencial</label>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className={inputClass}
              placeholder="deixe vazio para usar o Keychain"
              autoComplete="new-password"
              spellCheck={false}
            />
            <p className="text-[9px] leading-relaxed text-[#fbf9f5]/32">A chave é entregue diretamente ao Keychain do macOS. Não entra no banco, no histórico ou nos logs da PULSO.</p>
          </div>
        )}

        {config.adapterKind === 'codex_subscription' && account && (
          <div className="border-l border-white/20 pl-3 py-1 text-[10px] leading-relaxed text-[#fbf9f5]/60">
            <span className="block">{account.email || 'conta ChatGPT'}</span>
            <span className="block mt-1 text-[#fbf9f5]/30">plano {account.planType} · credencial no Keychain</span>
          </div>
        )}

        {config.adapterKind === 'codex_subscription' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className={labelClass}>acesso da lótus</span>
                <span className="block mt-1 text-[11px] text-[#fbf9f5]/75">
                  {accessMode === 'integral' ? 'integral' : 'restrito'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={accessMode === 'integral'}
                onClick={toggleAccessMode}
                disabled={busy !== null}
                className={`relative h-6 w-11 rounded-full border transition-colors ${accessMode === 'integral' ? 'bg-red-500/65 border-red-300/50' : 'bg-white/5 border-white/15'}`}
              >
                <span className={`absolute top-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-[#fbf9f5] transition-transform ${accessMode === 'integral' ? 'translate-x-[1.25rem]' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-[#fbf9f5]/35">
              {accessMode === 'integral'
                ? 'memória privada, arquivos, web, Notion, conectores e execução disponíveis'
                : 'somente conversa; ferramentas e alterações permanecem bloqueadas'}
            </p>
          </div>
        )}

        {(message || error || health) && (
          <div className={`border-l pl-3 py-1 text-[10px] leading-relaxed ${error ? 'border-red-300/45 text-red-100/75' : 'border-white/25 text-[#fbf9f5]/60'}`}>
            {error || message}
            {health && <span className="block mt-1 text-[#fbf9f5]/30">{health.providerId} · {health.status} · {health.detail}</span>}
          </div>
        )}
      </div>

      <div className="mt-auto pt-8 flex flex-col gap-2">
        {config.adapterKind === 'codex_subscription' ? (
          <>
            <button type="button" onClick={login} disabled={busy !== null} className="w-full text-center py-2 border border-white/20 rounded-full text-[9px] font-bold text-white/75 hover:text-white hover:border-white/40 disabled:opacity-35 transition-colors lowercase bg-transparent cursor-pointer outline-none">
              {busy === 'login' ? '[ aguardando login ]' : account ? '[ reconectar com ChatGPT ]' : '[ entrar com ChatGPT ]'}
            </button>
            {account && (
              <button type="button" onClick={logout} disabled={busy !== null} className="w-full text-center py-2 text-[9px] text-[#fbf9f5]/35 hover:text-white disabled:opacity-35 transition-colors lowercase bg-transparent border-none cursor-pointer outline-none">
                {busy === 'logout' ? '[ desconectando ]' : '[ sair desta assinatura ]'}
              </button>
            )}
          </>
        ) : (
          <>
        <button type="button" onClick={save} disabled={busy !== null} className="w-full text-center py-2 border border-white/20 rounded-full text-[9px] font-bold text-white/75 hover:text-white hover:border-white/40 disabled:opacity-35 transition-colors lowercase bg-transparent cursor-pointer outline-none">
          {busy === 'save' ? '[ configurando ]' : '[ salvar configuração ]'}
        </button>
        <button type="button" onClick={test} disabled={busy !== null} className="w-full text-center py-2 text-[9px] text-[#fbf9f5]/45 hover:text-white disabled:opacity-35 transition-colors lowercase bg-transparent border-none cursor-pointer outline-none">
          {busy === 'test' ? '[ testando conexão ]' : '[ testar conexão ]'}
        </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PulsoCoreProviderPanel;
