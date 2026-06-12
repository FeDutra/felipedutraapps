'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Activity, LayoutDashboard, Inbox, Globe, LogOut, HeartPulse, Zap, CheckSquare, Sparkles } from 'lucide-react';
import { AuthGate } from '@/apps/pulso/components/auth/AuthGate';
import { authService } from '@/shared/services/authService';
import { User } from 'firebase/auth';

export const PULSO_NAV_ITEMS = [
  { href: '/pulso/live', label: 'Lótus Live ✦', icon: Sparkles },
  { href: '/pulso/cockpit', label: 'Campo Vivo', icon: LayoutDashboard },
  { href: '/pulso/tarefas', label: 'Tarefas', icon: CheckSquare },
  { href: '/pulso/ecossistema', label: 'Ecossistema', icon: Activity },
  { href: '/pulso/inbox', label: 'Registro da Lótus', icon: Inbox },
  { href: '/pulso/metabolismo', label: 'Agentes', icon: Zap },
  { href: '/pulso/health', label: 'Saúde / Riscos', icon: HeartPulse },
  { href: '/pulso/eventos', label: 'Bastidor Técnico', icon: Activity },
];

export default function PulsoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    
    // Listen to user state for the header
    const unsubscribe = authService.onAuthStateChange((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const isLivePage = pathname === '/pulso/live';

  return (
    <div className={isLivePage ? "min-h-screen bg-[#cf735c] text-[#fbf9f5] w-full selection:bg-white/20" : "min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 w-full max-w-full flex flex-col xl:flex-row overflow-x-hidden"}>
      {isLivePage ? (
        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden">
          <AuthGate>
            {children}
          </AuthGate>
        </main>
      ) : (
        <>
          {/* MOBILE / TABLET TOP NAV (Hidden on Desktop xl) */}
          <nav className="xl:hidden relative p-3 md:p-4 flex flex-col items-stretch justify-between gap-3 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50 w-full max-w-full overflow-x-hidden">
            {/* Top bar layer: Logo securely on the left, Profile & Logout securely on the right */}
            <div className="flex items-center justify-between gap-4 w-full">
              {/* Logo & v0.1 */}
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                <Link href="/" className="p-1.5 hover:bg-white/5 rounded-xl transition-colors shrink-0">
                  <ArrowLeft size={16} className="text-white/40" />
                </Link>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30 shrink-0">
                    <Activity size={14} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xs font-black tracking-tight leading-none truncate">PULSO</h1>
                    <p className="text-[8px] text-white/30 font-medium mt-0.5 truncate">Central Viva</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[8px] font-black uppercase tracking-widest text-blue-400 shrink-0 ml-1">
                  v0.1
                </span>
              </div>

              {/* User info & Logout Button */}
              <div className="flex items-center gap-2 shrink-0">
                {user && (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:block text-right min-w-0 max-w-[160px]">
                      <p className="text-[9px] font-black text-white/80 leading-none mb-0.5 truncate">{user.displayName}</p>
                      <p className="text-[7px] font-medium text-white/20 leading-none truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => authService.logout()}
                      className="p-2 bg-white/2 border border-white/5 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-400/5 hover:border-red-400/20 transition-all group shrink-0"
                      title="Sair"
                    >
                      <LogOut size={12} className="group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Center Section: Navigation pill container */}
            <div className="flex items-center justify-start sm:justify-center gap-1 bg-white/2 p-1 rounded-xl border border-white/5 w-full max-w-full overflow-x-auto custom-scrollbar flex-nowrap shrink-0">
              {PULSO_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link 
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap ${
                      isActive 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                        : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    <item.icon size={12} />
                    <span className="block">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* DESKTOP SIDEBAR (Hidden on Mobile/Tablet, visible on Desktop xl) */}
          <aside className="hidden xl:flex flex-col justify-between w-64 min-w-[16rem] h-screen static xl:sticky top-0 border-r border-white/5 bg-[#020617]/80 backdrop-blur-xl z-50 p-4 shrink-0">
            {/* Top Section: Logo & Nav items */}
            <div className="flex flex-col gap-6">
              {/* Logo & Back button */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Link href="/" className="p-1.5 hover:bg-white/5 rounded-xl transition-colors shrink-0 -ml-1.5" title="Voltar para Home">
                    <ArrowLeft size={16} className="text-white/40" />
                  </Link>
                  <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30 shrink-0">
                    <Activity size={16} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm font-black tracking-tight leading-none truncate">PULSO</h1>
                    <p className="text-[9px] text-white/30 font-medium mt-0.5 truncate">Central Viva</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[8px] font-black uppercase tracking-widest text-blue-400 shrink-0">
                  v0.1
                </span>
              </div>

              {/* Vertical Navigation items */}
              <div className="flex flex-col gap-1.5 mt-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/20 px-3 mb-1">Navegação</p>
                {PULSO_NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link 
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        isActive 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                          : 'text-white/40 hover:text-white/90 hover:bg-white/2'
                      }`}
                    >
                      <item.icon size={16} className={isActive ? 'text-blue-400' : 'text-white/40'} />
                      <span className="block truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Bottom Section: Profile & Logout */}
            {user ? (
              <div className="flex items-center justify-between gap-3 p-2.5 bg-white/2 border border-white/5 rounded-2xl mt-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center font-bold text-xs text-white/80 shrink-0">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white/90 leading-tight truncate">{user.displayName || 'Usuário'}</p>
                    <p className="text-[9px] font-medium text-white/30 leading-tight truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => authService.logout()}
                  className="p-2 bg-white/2 border border-white/5 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-400/5 hover:border-red-400/20 transition-all group shrink-0"
                  title="Sair"
                >
                  <LogOut size={14} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            ) : (
              <div className="h-12" />
            )}
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden">
            <AuthGate>
              {children}
            </AuthGate>
          </main>
        </>
      )}
    </div>
  );
}


