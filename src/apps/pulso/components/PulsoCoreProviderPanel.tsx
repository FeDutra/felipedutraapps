'use client';

import React from 'react';
import { X } from 'lucide-react';
import { pulsoCoreProvider } from '../services/pulsoCoreProvider';
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
});

export function PulsoCoreProviderPanel({ open, onClose, onConfigured }: PulsoCoreProviderPanelProps) {
  const [config, setConfig] = React.useState<PulsoProviderConfig>(() => (
    pulsoCoreProvider.readSavedConfig() || configFor('openai')
  ));
  const [secret, setSecret] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'test' | null>(null);
  const [health, setHealth] = React.useState<PulsoProviderHealth | null>(null);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    const saved = pulsoCoreProvider.readSavedConfig();
    if (saved) setConfig(saved);
    setSecret('');
    setError('');
    setMessage('');
    setHealth(null);
  }, [open]);

  if (!open) return null;

  const updateKind = (adapterKind: PulsoProviderAdapterKind) => {
    setConfig(configFor(adapterKind));
    setHealth(null);
    setMessage('');
    setError('');
    setSecret('');
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

  const inputClass = 'w-full bg-white/[0.045] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fbf9f5] placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors';
  const labelClass = 'text-[9px] tracking-[0.18em] text-[#fbf9f5]/42 uppercase';

  return (
    <div className="fixed top-4 right-4 bottom-4 z-[72] w-[min(25rem,calc(100vw-2rem))] bg-[#090909]/45 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-6 overflow-y-auto no-scrollbar flex flex-col text-left text-[#fbf9f5] animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/15 pb-4">
        <div>
          <span className="block text-xs font-bold tracking-widest text-white/90 lowercase">inteligência da pulso</span>
          <span className="block mt-1 text-[9px] tracking-[0.14em] text-[#fbf9f5]/35 uppercase">provider · modelo · keychain</span>
        </div>
        <button onClick={onClose} className="text-[#fbf9f5]/45 hover:text-white bg-transparent border-none cursor-pointer outline-none">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label className={labelClass}>provider</label>
          <select value={config.adapterKind} onChange={(event) => updateKind(event.target.value as PulsoProviderAdapterKind)} className="pulso-select w-full">
            <option value="openai" className="bg-[#121212]">OpenAI</option>
            <option value="anthropic" className="bg-[#121212]">Anthropic</option>
            <option value="ollama" className="bg-[#121212]">Ollama local</option>
            <option value="local" className="bg-[#121212]">local · compatível com OpenAI</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>modelo</label>
          <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} className={inputClass} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>endpoint</label>
          <input value={config.endpoint || ''} onChange={(event) => setConfig({ ...config, endpoint: event.target.value })} className={inputClass} autoComplete="off" />
        </div>

        {config.adapterKind !== 'local' && config.adapterKind !== 'ollama' && (
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

        {(message || error || health) && (
          <div className={`border-l pl-3 py-1 text-[10px] leading-relaxed ${error ? 'border-red-300/45 text-red-100/75' : 'border-white/25 text-[#fbf9f5]/60'}`}>
            {error || message}
            {health && <span className="block mt-1 text-[#fbf9f5]/30">{health.providerId} · {health.status} · {health.detail}</span>}
          </div>
        )}
      </div>

      <div className="mt-auto pt-8 flex flex-col gap-2">
        <button onClick={save} disabled={busy !== null} className="w-full text-center py-2 border border-white/20 rounded-full text-[9px] font-bold text-white/75 hover:text-white hover:border-white/40 disabled:opacity-35 transition-colors lowercase bg-transparent cursor-pointer outline-none">
          {busy === 'save' ? '[ configurando ]' : '[ salvar configuração ]'}
        </button>
        <button onClick={test} disabled={busy !== null} className="w-full text-center py-2 text-[9px] text-[#fbf9f5]/45 hover:text-white disabled:opacity-35 transition-colors lowercase bg-transparent border-none cursor-pointer outline-none">
          {busy === 'test' ? '[ testando conexão ]' : '[ testar conexão ]'}
        </button>
      </div>
    </div>
  );
}

export default PulsoCoreProviderPanel;
