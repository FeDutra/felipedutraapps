'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { authService } from '@/shared/services/authService';

const PluggyConnect = dynamic(() => import('react-pluggy-connect').then(module => module.PluggyConnect), { ssr: false });
type Scope = 'personal' | 'business';
type Session = { accessToken: string; connectorId: number; scope: Scope };
const API = process.env.NEXT_PUBLIC_PULSO_OPEN_FINANCE_API_BASE || '/api/open-finance';
const MESSAGES: Record<string, string> = {
  authentication_required: 'Entre na PULSO para conectar suas contas.',
  finance_access_not_configured: 'Seu acesso financeiro ainda precisa ser configurado no servidor.',
  pluggy_not_configured: 'A integração Pluggy ainda precisa ser configurada no servidor.',
  meupluggy_connector_unavailable: 'Habilite o conector MeuPluggy na aplicação do Dashboard da Pluggy.',
  try_again_shortly: 'Aguarde alguns segundos antes de tentar novamente.',
  item_owner_not_verified: 'A conexão foi recebida, mas o vínculo com seu usuário precisa ser conferido.',
  connection_binding_conflict: 'Esta conexão já possui outro vínculo. Confira a conta e o tipo selecionado.',
};
async function request(path: string, body: object, signal: AbortSignal) {
  const user = authService.getCurrentUser();
  if (!user || user.isAnonymous) throw new Error('authentication_required');
  const token = await user.getIdToken();
  const response = await fetch(`${API}${path}`, {
    method: 'POST', signal, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'request_failed');
  return data;
}

export default function OpenFinanceConnect() {
  const [scope, setScope] = useState<Scope>('personal');
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ itemId: string; scope: Scope } | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const receivedSuccess = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => { setSession(null); setMessage('A janela de conexão expirou. Abra uma nova conexão para continuar.'); }, 29 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [session]);
  function fail(error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return;
    setMessage(MESSAGES[error instanceof Error ? error.message : ''] || 'Não foi possível concluir. Tente novamente; suas conexões bancárias existentes não foram apagadas.');
  }
  async function open() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage(''); receivedSuccess.current = false;
    controller.current = new AbortController();
    try {
      const data = await request('/connect-token', {}, controller.current.signal);
      if (typeof data?.accessToken !== 'string' || !Number.isInteger(data?.connectorId)) throw new Error('invalid_response');
      setSession({ accessToken: data.accessToken, connectorId: data.connectorId, scope });
    } catch (error) { fail(error); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function save(itemId: string, selectedScope: Scope) {
    if (inFlight.current) return;
    inFlight.current = true; receivedSuccess.current = true; setSession(null); setBusy(true); setMessage('');
    setPending({ itemId, scope: selectedScope });
    controller.current = new AbortController();
    try {
      const data = await request('/connections', { itemId, scope: selectedScope }, controller.current.signal);
      if (typeof data?.connectionId !== 'string' || data.state !== 'connected_awaiting_sync') throw new Error('invalid_response');
      setPending(null); setMessage('Conexão vinculada à PULSO. A importação de saldos e movimentações ainda precisa ser ativada.');
    } catch (error) { fail(error); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const locked = busy || !!session || !!pending;
  return (
    <section aria-labelledby="open-finance-title" className="flex flex-col items-start gap-5 py-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/50">DINHEIRO · OPEN FINANCE</p>
        <h2 id="open-finance-title" className="text-xl font-light text-[#fbf9f5]">Suas contas, em continuidade</h2>
        <p className="max-w-md text-sm font-light text-white/70">Traga as conexões que você já autorizou no Meu Pluggy. Pessoal e empresa permanecem separados.</p>
      </div>
      <label className="flex items-center gap-3 text-xs text-white/75">
        Tipo de conta
        <select aria-label="Tipo de conta financeira" value={scope} disabled={locked} onChange={event => setScope(event.target.value as Scope)} className="bg-transparent text-inherit outline-none disabled:opacity-50">
          <option className="text-black" value="personal">Pessoal</option>
          <option className="text-black" value="business">Empresa</option>
        </select>
      </label>
      {pending ? (
        <button disabled={busy} onClick={() => void save(pending.itemId, pending.scope)} className="font-mono text-xs tracking-wide text-white/85 hover:text-white disabled:opacity-50">[ {busy ? 'vinculando…' : 'tentar salvar vínculo novamente'} ]</button>
      ) : (
        <button disabled={busy || !!session} onClick={() => void open()} className="font-mono text-xs tracking-wide text-white/85 hover:text-white disabled:opacity-50">[ {busy ? 'preparando conexão…' : 'conectar Meu Pluggy'} ]</button>
      )}
      <p role="status" aria-live="polite" className="max-w-lg text-xs text-white/75">{message}</p>
      <p className="max-w-md text-xs font-light text-white/50">A autorização acontece no provedor. Conectar não autoriza pagamentos nem movimentação de dinheiro.</p>
      {session && <PluggyConnect
        key={session.accessToken}
        connectToken={session.accessToken}
        includeSandbox={false}
        connectorIds={[session.connectorId]}
        selectedConnectorId={session.connectorId}
        language="pt"
        theme="dark"
        onSuccess={({ item }) => { void save(item.id, session.scope); }}
        onError={() => { setSession(null); setMessage('A conexão não foi concluída. Você pode tentar novamente.'); }}
        onLoadError={() => { setSession(null); setMessage('Não foi possível abrir a janela do provedor. Tente novamente.'); }}
        onClose={() => { if (!receivedSuccess.current) { setSession(null); setMessage('Janela de conexão fechada.'); } }}
      />}
    </section>
  );
}
