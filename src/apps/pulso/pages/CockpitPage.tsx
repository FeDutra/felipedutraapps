'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, AlertCircle, User } from 'lucide-react';
import { tasksService } from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { PulsoHeader } from '../components/BaseComponents';
import { Task } from '../types/pulso.types';

// 1. Error Boundary Local
class SafeBlock extends React.Component<{ children: React.ReactNode, name: string }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.error(`[SafeBlock Error] ${this.props.name}:`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-dashed border-red-500/20 rounded-xl bg-red-500/5">
          <p className="text-xs text-red-400 font-bold flex items-center gap-2">
            <AlertCircle size={14} />
            Não foi possível carregar este bloco ({this.props.name})
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CockpitPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);

  React.useEffect(() => {
    async function load() {
      try {
        await authService.ensurePulsoAuthReady();
        const allTasks = await tasksService.getAll();
        
        if (Array.isArray(allTasks)) {
          setTasks(allTasks);
        } else {
          setTasks([]);
        }
      } catch (err: any) {
        console.error('Cockpit load error:', err);
        setError(err?.message || 'Erro ao carregar ecossistema vivo.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 font-black uppercase tracking-widest text-[10px]">Sintonizando Campo Vivo</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Falha na Sintonização</h2>
        <p className="text-sm text-white/40 max-w-sm mb-8 leading-relaxed">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full max-w-full min-w-0">
      <PulsoHeader 
        title="Campo Vivo" 
        subtitle="O estado real da operação entre Fê, Lótus e os projetos em movimento."
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full max-w-full min-w-0">
        <div className="xl:col-span-8 space-y-6 w-full max-w-full min-w-0">
          
          <SafeBlock name="Depende do Fê">
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-5 md:p-6 w-full max-w-full min-w-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest truncate">Depende do Fê</h2>
                  <p className="text-[10px] text-amber-500/60 truncate">Decisão, aprovação ou execução.</p>
                </div>
              </div>

              <div className="space-y-3">
                {Array.isArray(tasks) && tasks
                  .filter(t => t && t.status !== 'completed' && t.archived !== true)
                  .filter(t => {
                    const refs = t.ownerRefs;
                    if (!refs || !Array.isArray(refs) || refs.length === 0) return true;
                    return refs.includes('felipe') || refs.includes('Felipe');
                  })
                  .slice(0, 10)
                  .map((t, idx) => {
                    const safeId = t?.id || `unknown-${idx}`;
                    const safeTitle = t?.title || t?.name || 'Tarefa sem título';
                    const safePriority = t?.priority || 'medium';

                    return (
                      <div key={`task-${safeId}`} className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 bg-white/5 border border-white/5 hover:border-amber-500/30 transition-colors rounded-2xl cursor-pointer group w-full min-w-0">
                        <div className="hidden sm:block pt-0.5 shrink-0">
                          <CheckSquare size={16} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0 w-full">
                          <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate break-words leading-tight">{safeTitle}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border whitespace-nowrap bg-white/5 text-white/40 border-white/10">
                              Prioridade: {safePriority}
                            </span>
                            <span className="text-[10px] text-white/30 truncate hidden sm:inline">
                              ID: {safeId.substring(0, 6)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </SafeBlock>

        </div>
      </div>
    </div>
  );
}
