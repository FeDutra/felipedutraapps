'use client';

import React from 'react';
import { User } from 'firebase/auth';
import { authService } from '../../../../shared/services/authService';
import { isFirebaseConfigured } from '../../../../shared/lib/firebase/client';
import { Activity, LogIn, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @file AuthGate.tsx
 * @description A security wrapper that enforces authentication when in Firestore mode.
 */

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isFirestore, setIsFirestore] = React.useState(false);
  const [hasConfig, setHasConfig] = React.useState(true);

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
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="w-8 h-8 border border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Validando Acesso</p>
      </div>
    );
  }

  // If in Firestore mode but no config, show error screen
  if (isFirestore && !hasConfig) {
    return <ConfigErrorScreen />;
  }

  // If in Firestore mode and no user or anonymous user, show login screen
  if (!user || user.isAnonymous) {
    return <LoginScreen />;
  }

  // Authenticated
  return <>{children}</>;
};

const checkIsTauri = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'tauri:' ||
    window.location.protocol === 'file:' ||
    !!(window as any).__TAURI__ ||
    !!(window as any).__TAURI_INTERNALS__
  );
};

const LoginScreen = () => {
  const [signingIn, setSigningIn] = React.useState(false);
  const [isTauri, setIsTauri] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");

  React.useEffect(() => {
    // Show email/password login form in Tauri OR local development
    setIsTauri(checkIsTauri() || process.env.NODE_ENV === "development");
  }, []);

  const handleLogin = async () => {
    setSigningIn(true);
    setErrorMsg("");
    try {
      await authService.signInWithGoogle();
    } catch (error: any) {
      console.error("Login failed:", error);
      setErrorMsg(error.message || "Erro ao fazer login com Google.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSigningIn(true);
    setErrorMsg("");
    try {
      await authService.signInWithEmail(email, password);
    } catch (error: any) {
      console.error("Email login failed:", error);
      setErrorMsg("Credenciais inválidas ou erro de autenticação.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-white/10 rounded-2xl border border-white/20 mb-6">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">PULSO</h1>
          <p className="text-sm text-white/40">Central Viva do Ecossistema ÉDEN</p>
        </div>

        <div className="bg-white/2 border border-white/5 rounded-[32px] p-8 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-8 text-white/60">
            <ShieldCheck size={18} className="text-emerald-500/60" />
            <p className="text-xs font-medium leading-relaxed">
              Entre com sua conta Google para acessar o ecossistema com segurança.
            </p>
          </div>

          <button 
            onClick={handleLogin}
            disabled={signingIn}
            className="w-full group relative flex items-center justify-center gap-3 bg-white text-[#020617] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {signingIn ? (
              <div className="w-4 h-4 border-2 border-[#020617]/20 border-t-[#020617] rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={16} />
                Entrar com Google
              </>
            )}
          </button>

          {isTauri && (
            <form onSubmit={handleEmailLogin} className="mt-6 pt-6 border-t border-white/5 flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 text-center mb-1">
                Acesso Interno Desktop
              </p>
              <div>
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={signingIn}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={signingIn}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
              </div>
              
              {errorMsg && (
                <p className="text-[10px] font-medium text-red-400 text-center mt-1">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={signingIn}
                className="w-full bg-white/10 text-white hover:bg-white/15 border border-white/20 py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {signingIn ? "Acessando..." : "Entrar com Credencial"}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/10">
            Acesso Restrito • Felipe Dutra
          </p>
        </div>
      </motion.div>
    </div>
  );
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
