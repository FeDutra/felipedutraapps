'use client';

import React from 'react';
import { User } from 'firebase/auth';
import { authService } from '../../../../shared/services/authService';
import { isFirebaseConfigured } from '../../../../shared/lib/firebase/client';
import { AlertTriangle } from 'lucide-react';

/**
 * @file AuthGate.tsx
 * @description A security wrapper that enforces authentication when in Firestore mode.
 */

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isFirestore, setIsFirestore] = React.useState(false);
  const [hasConfig, setHasConfig] = React.useState(true);
  const isBrowserSurface = React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    React.useCallback(() => new URLSearchParams(window.location.search).get('surface') === 'pulso-browser-contextual', []),
    React.useCallback(() => false, []),
  );

  React.useEffect(() => {
    // Check if we are in firestore mode
    const mode = process.env.NEXT_PUBLIC_PULSO_DATA_MODE;
    const isFS = mode === 'firestore';
    
    // Check for temporary bypass via URL
    const searchParams = new URLSearchParams(window.location.search);
    const bypass = searchParams.get('bypass') === 'true';
    
    setIsFirestore(isFS && !bypass);
    setHasConfig(isFirebaseConfigured);

    if ((!isFirebaseConfigured && isFS) || bypass) {
      setLoading(false);
      return;
    }

    const unsubscribe = authService.onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // If in mock mode or loading is still happening, we might just bypass or show loader
  if (!isFirestore) {
    return <>{children}</>;
  }

  if (loading) {
    if (isBrowserSurface) {
      return <BrowserAuthState label="lótus · sintonizando sessão" />;
    }
    return (
      <div className="theme-her min-h-screen overflow-hidden" aria-label="Abrindo Pulso" />
    );
  }

  // If in Firestore mode but no config, show error screen
  if (isFirestore && !hasConfig) {
    return <ConfigErrorScreen />;
  }

  // If in Firestore mode and no user or anonymous user, show login screen
  if (!user || user.isAnonymous) {
    return <LoginScreen compact={isBrowserSurface} />;
  }

  // Authenticated
  return <>{children}</>;
};

const BrowserAuthState = ({ label, action, onAction, disabled = false }: { label: string; action?: string; onAction?: () => void; disabled?: boolean }) => {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const context = [params.get('area'), params.get('folder'), params.get('profile')].filter(Boolean).join(' · ');
  return (
    <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#080808] px-5 pb-4 pt-4 text-[#fbf9f5]" style={{ backgroundColor: '#080808', color: '#fbf9f5' }}>
      <p className="text-[8px] font-medium uppercase tracking-[0.22em] text-white/25">PULSO · presença contextual</p>
      <h1 className="mt-1 text-[18px] font-light tracking-[0.08em] text-white/90">LÓTUS</h1>
      <div className="mt-3 flex min-w-0 items-center gap-2 text-[9px] text-white/45"><span className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-[#b8283e]" /><span className="truncate uppercase tracking-[0.11em]">{context || 'contexto de navegação'}</span></div>
      <p className="mt-1 truncate text-[10px] font-light text-white/28">{params.get('title') || 'navegação sem título'}</p>
      <div className="mt-4 h-px bg-white/[0.06]" />
      <div className="flex flex-1 flex-col justify-center pb-20">
        <p className="text-[9px] uppercase tracking-[0.2em] text-[#b8283e]/75">{label}</p>
        <p className="mt-3 max-w-[30ch] text-[12px] font-light leading-5 text-white/42">A conversa continua protegida. A navegação permanece disponível enquanto a sessão é recuperada.</p>
        {action && onAction && <button type="button" onClick={onAction} disabled={disabled} className="mt-5 w-fit border-none bg-transparent p-0 text-[9px] uppercase tracking-[0.12em] text-[#d3475d] disabled:text-white/20">[ {action} ]</button>}
      </div>
    </div>
  );
};

const LoginScreen = (_props: { compact?: boolean }) => {
  const [signingIn, setSigningIn] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || signingIn) return;
    setSigningIn(true); setErrorMsg('');
    try { await authService.signInWithEmail(email, password); }
    catch { setErrorMsg('Não foi possível entrar. Confira seu e-mail e senha.'); }
    finally { setSigningIn(false); }
  };
  return <div className="min-h-screen flex items-center justify-center p-6 bg-transparent text-white">
    <form onSubmit={handleEmailLogin} className="w-full max-w-sm space-y-5">
      <h1 className="text-xl font-light tracking-widest">PULSO</h1>
      <p className="text-xs text-white/50">Entre com seu e-mail. Sua sessão permanece neste dispositivo.</p>
      <input aria-label="E-mail" autoComplete="username" type="email" value={email} onChange={event=>setEmail(event.target.value)} required disabled={signingIn} placeholder="E-mail" className="w-full bg-white/5 rounded-xl p-3 text-sm" />
      <input aria-label="Senha" autoComplete="current-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} required disabled={signingIn} placeholder="Senha" className="w-full bg-white/5 rounded-xl p-3 text-sm" />
      {errorMsg && <p role="alert" className="text-xs text-red-300">{errorMsg}</p>}
      <button type="submit" disabled={signingIn} className="text-xs tracking-widest disabled:opacity-40">[ {signingIn ? 'entrando…' : 'entrar'} ]</button>
    </form>
  </div>;
};

const ConfigErrorScreen = () => {
  return (
    <div className="min-h-screen bg-transparent text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex p-4 bg-red-500/10 rounded-2xl border border-red-500/20 mb-6">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <h2 className="text-xl font-black mb-2">Firebase não configurado</h2>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          O modo Firestore está ativo, mas as credenciais estão ausentes. 
          Preencha o <code className="text-red-400/60">.env.local</code> para usar a persistência real.
        </p>
        <div className="p-4 bg-white/2 border border-white/5 rounded-2xl">
           <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Ação Necessária</p>
           <p className="text-[10px] text-white/40 mt-1">Defina as chaves no .env.local ou mude para modo mock.</p>
        </div>
      </div>
    </div>
  );
};
