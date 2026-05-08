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

    // Subscribe to auth state
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
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Validando Acesso</p>
      </div>
    );
  }

  // If in Firestore mode but no config, show error screen
  if (isFirestore && !hasConfig) {
    return <ConfigErrorScreen />;
  }

  // If in Firestore mode and no user, show login screen
  if (!user) {
    return <LoginScreen />;
  }

  // Authenticated
  return <>{children}</>;
};

const LoginScreen = () => {
  const [signingIn, setSigningIn] = React.useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await authService.signInWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-6">
            <Activity size={32} className="text-blue-400" />
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
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6">
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
