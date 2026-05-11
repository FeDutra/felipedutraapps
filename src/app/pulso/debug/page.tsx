'use client';

import React from 'react';
import { authService } from '@/shared/services/authService';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase/client';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { Activity, Shield, Database, Terminal, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function PulsoDebugPage() {
  const [authStatus, setAuthStatus] = React.useState<any>({ ready: false });
  const [env, setEnv] = React.useState<any>({});
  const [tests, setTests] = React.useState<any>([]);
  const [loading, setLoading] = React.useState(true);

  const runTests = React.useCallback(async (user: any) => {
    const results = [];
    const workspaceId = process.env.NEXT_PUBLIC_PULSO_WORKSPACE_ID || 'felipe_dutra';

    const testConfigs = [
      { id: 'A', name: 'Events', path: `workspaces/${workspaceId}/pulso_events` },
      { id: 'B', name: 'Inbox', path: `workspaces/${workspaceId}/pulso_inbox_items` },
      { id: 'C', name: 'Areas', path: `workspaces/${workspaceId}/pulso_areas` },
      { id: 'D', name: 'Specific Event', path: `workspaces/${workspaceId}/pulso_events`, filter: ['entityRef', '==', 'evt_project_update_20260510_binding_real_001'] },
    ];

    for (const config of testConfigs) {
      try {
        let q = query(collection(db!, config.path), limit(1));
        if (config.filter) {
          q = query(collection(db!, config.path), where(config.filter[0], config.filter[1] as any, config.filter[2]), limit(1));
        }
        
        const snap = await getDocs(q);
        results.push({
          ...config,
          success: true,
          count: snap.size,
          data: snap.empty ? 'Empty' : 'Found data'
        });
      } catch (err: any) {
        results.push({
          ...config,
          success: false,
          error: {
            code: err.code,
            message: err.message
          }
        });
      }
    }
    setTests(results);
  }, []);

  React.useEffect(() => {
    // 1. Env
    setEnv({
      DATA_MODE: process.env.NEXT_PUBLIC_PULSO_DATA_MODE,
      AUTH_MODE: process.env.NEXT_PUBLIC_PULSO_AUTH_MODE,
      WORKSPACE_ID: process.env.NEXT_PUBLIC_PULSO_WORKSPACE_ID,
      firebaseConfigured: isFirebaseConfigured,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'n/a',
      version: 'debug-rollback-v1.1',
      timestamp: new Date().toISOString()
    });

    // 2. Auth
    const unsubscribe = authService.onAuthStateChange(async (user) => {
      setAuthStatus({
        ready: true,
        exists: !!user,
        uid: user?.uid,
        isAnonymous: user?.isAnonymous,
        email: user?.email,
        displayName: user?.displayName
      });

      if (user) {
        runTests(user);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [runTests]);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-10 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">System Diagnostics</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter">PULSO DEBUG</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Build Version</p>
            <p className="text-xs font-mono text-white/40">{env.version}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Environment */}
          <Section icon={Terminal} title="Ambiente">
            <div className="space-y-2">
              <DebugRow label="Data Mode" value={env.DATA_MODE} />
              <DebugRow label="Auth Mode" value={env.AUTH_MODE} />
              <DebugRow label="Workspace" value={env.WORKSPACE_ID} />
              <DebugRow label="Firebase CFG" value={env.firebaseConfigured ? 'OK' : 'MISSING'} />
              <DebugRow label="Hostname" value={env.hostname} />
              <DebugRow label="Timestamp" value={env.timestamp} />
            </div>
          </Section>

          {/* Auth */}
          <Section icon={Shield} title="Autenticação">
            <div className="space-y-2">
              <DebugRow label="Auth Ready" value={authStatus.ready ? 'YES' : 'NO'} />
              <DebugRow label="User Exists" value={authStatus.exists ? 'YES' : 'NO'} />
              <DebugRow label="UID" value={authStatus.uid || '---'} />
              <DebugRow label="Anonymous" value={authStatus.isAnonymous ? 'YES' : 'NO'} />
              {authStatus.error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-[9px] font-black text-red-400 uppercase mb-1">Auth Error</p>
                  <p className="text-[10px] font-mono text-red-300/70">{authStatus.error.code}: {authStatus.error.message}</p>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Firestore Tests */}
        <Section icon={Database} title="Testes Firestore (workspaces/felipe_dutra)">
          <div className="grid grid-cols-1 gap-4">
            {tests.map((test: any) => (
              <div key={test.id} className="bg-white/2 border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black">{test.id}</div>
                    <h3 className="text-sm font-bold">{test.name}</h3>
                  </div>
                  <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${
                    test.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {test.success ? 'SUCCESS' : 'FAILED'}
                  </div>
                </div>
                <div className="space-y-1 text-[10px] font-mono text-white/30">
                  <p><span className="text-white/10 uppercase mr-2">Path:</span> {test.path}</p>
                  {test.success ? (
                    <p><span className="text-white/10 uppercase mr-2">Docs:</span> {test.count} ({test.data})</p>
                  ) : (
                    <div className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                      <p className="text-red-400 font-bold mb-1">{test.error.code}</p>
                      <p className="text-red-300/50 break-words">{test.error.message}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="text-center py-10 animate-pulse text-white/20">Aguardando Auth...</div>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: any) {
  return (
    <div className="bg-white/2 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon size={16} className="text-white/30" />
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DebugRow({ label, value }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/20">{label}</span>
      <span className="text-[10px] font-mono text-white/60 truncate max-w-[200px]">{String(value)}</span>
    </div>
  );
}
