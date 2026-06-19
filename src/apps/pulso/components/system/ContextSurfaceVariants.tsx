import React from 'react';
import { 
  Activity, Layers, Database, Clock, 
  AlertTriangle, Zap, Check, Lock, Terminal
} from 'lucide-react';

interface ContextSurfaceProps {
  variant: 'a' | 'b' | 'c';
  isOpen: boolean;
  onClose: () => void;
  activeContext?: string;
  data?: any;
}

export const ContextSurfaceVariants: React.FC<ContextSurfaceProps> = ({ variant, isOpen, onClose, activeContext, data }) => {
  if (!isOpen) return null;

  // Mock data for the context layer
  const contextName = activeContext || "Visão Global";
  const activeSources = ["Arca", "E-mail", "Calendário"];
  const activeProjects = ["PULSO Live", "Reestruturação"];
  const locks = ["Dependência de aprovação", "Falta de escopo"];

  if (variant === 'a') {
    return (
      <div className="fixed top-20 left-0 w-full px-8 z-40 animate-fade-in pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-start pointer-events-auto">
          {/* Left Panel */}
          <div className="w-64 space-y-4">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-[#fbf9f5]">
              <h3 className="text-[10px] font-bold tracking-widest uppercase mb-3 text-white/50">Contexto Atual</h3>
              <p className="text-lg font-light mb-2">{contextName}</p>
              <div className="flex flex-wrap gap-2">
                {activeSources.map(s => <span key={s} className="px-2 py-1 bg-white/5 rounded-md text-[9px]">{s}</span>)}
              </div>
            </div>
            
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-[#fbf9f5]">
              <h3 className="text-[10px] font-bold tracking-widest uppercase mb-3 text-white/50">Travas</h3>
              <ul className="space-y-2">
                {locks.map(l => (
                  <li key={l} className="flex items-center gap-2 text-xs font-light">
                    <Lock size={12} className="text-[#b8544a]" /> {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-64 space-y-4">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-[#fbf9f5]">
              <h3 className="text-[10px] font-bold tracking-widest uppercase mb-3 text-white/50">Projetos Ativos</h3>
              <ul className="space-y-2">
                {activeProjects.map(p => (
                  <li key={p} className="flex items-center gap-2 text-xs font-light">
                    <Activity size={12} className="text-white/50" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-[#fbf9f5]">
              <h3 className="text-[10px] font-bold tracking-widest uppercase mb-3 text-white/50">Logs Técnicos</h3>
              <div className="font-mono text-[9px] text-white/40 space-y-1">
                <p>[sys] Sincronização ok</p>
                <p>[sys] 3 eventos agendados</p>
                <p>[ia] OpenClaw pronto</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'b') {
    return (
      <div className="fixed inset-0 z-40 pointer-events-none">
        {/* Floating cards distributed in empty spaces */}
        <div className="absolute top-24 left-16 animate-fade-in pointer-events-auto">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 text-[#fbf9f5] flex items-center gap-3 shadow-2xl">
            <Layers size={14} className="text-white/50" />
            <span className="text-xs font-light tracking-wide">{contextName}</span>
          </div>
        </div>

        <div className="absolute top-32 right-20 animate-fade-in pointer-events-auto" style={{ animationDelay: '100ms' }}>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 text-[#fbf9f5] w-48 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Database size={12} className="text-white/50" />
              <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">Fontes</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeSources.map(s => <span key={s} className="px-2 py-1 bg-white/10 rounded-full text-[9px]">{s}</span>)}
            </div>
          </div>
        </div>

        <div className="absolute bottom-40 left-20 animate-fade-in pointer-events-auto" style={{ animationDelay: '200ms' }}>
           <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 text-[#fbf9f5] w-48 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={12} className="text-white/50" />
              <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">Foco Atual</span>
            </div>
            <div className="text-xs font-light space-y-1">
              {activeProjects.map(p => <div key={p}>{p}</div>)}
            </div>
          </div>
        </div>

        <div className="absolute bottom-32 right-16 animate-fade-in pointer-events-auto" style={{ animationDelay: '150ms' }}>
           <div className="bg-[#b8544a]/10 backdrop-blur-xl border border-[#b8544a]/20 rounded-full px-5 py-3 text-[#fbf9f5] flex items-center gap-3 shadow-2xl">
            <AlertTriangle size={14} className="text-[#b8544a]" />
            <span className="text-xs font-light tracking-wide">{locks.length} travas ativas</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'c') {
    return (
      <div className="fixed top-24 inset-x-0 bottom-32 z-30 pointer-events-none flex justify-center items-start pt-8">
        {/* Organized grid that hugs the central circle but provides structure */}
        <div className="w-full max-w-5xl px-8 pointer-events-auto grid grid-cols-12 gap-6 animate-fade-in">
          
          <div className="col-span-3 space-y-4">
            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-5 text-[#fbf9f5]">
               <h2 className="text-sm font-light mb-4 flex items-center gap-2"><Layers size={14}/> {contextName}</h2>
               <div className="space-y-3">
                 <div>
                   <h3 className="text-[9px] font-bold tracking-widest uppercase text-white/40 mb-1.5">Fontes de Dados</h3>
                   <div className="text-xs font-light text-white/80 flex flex-col gap-1">
                     {activeSources.map(s => <span key={s}>• {s}</span>)}
                   </div>
                 </div>
               </div>
            </div>
          </div>

          <div className="col-span-6">
            {/* Center column intentionally left empty to not overlap with the Lótus circle */}
          </div>

          <div className="col-span-3 space-y-4">
             <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-5 text-[#fbf9f5]">
               <h3 className="text-[9px] font-bold tracking-widest uppercase text-white/40 mb-3 flex items-center gap-2"><Activity size={12}/> Operação</h3>
               <div className="space-y-3">
                 {activeProjects.map(p => (
                   <div key={p} className="text-xs font-light bg-white/5 p-2 rounded-lg border border-white/5">
                     {p}
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-[#b8544a]/10 backdrop-blur-md border border-[#b8544a]/20 rounded-xl p-5 text-[#fbf9f5]">
               <h3 className="text-[9px] font-bold tracking-widest uppercase text-[#b8544a] mb-2 flex items-center gap-2"><Lock size={12}/> Gargalos</h3>
               <div className="text-xs font-light text-white/80 flex flex-col gap-1.5">
                  {locks.map(l => <span key={l}>- {l}</span>)}
               </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return null;
};
