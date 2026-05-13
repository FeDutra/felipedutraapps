'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Activity, LayoutDashboard, Inbox, Globe, LogOut, HeartPulse, Zap } from 'lucide-react';
import { AuthGate } from '@/apps/pulso/components/auth/AuthGate';
import { authService } from '@/shared/services/authService';
import { User } from 'firebase/auth';

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

  const navItems = [
    { href: '/pulso', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pulso/ecossistema', label: 'Ecossistema', icon: Globe },
    { href: '/pulso/inbox', label: 'Inbox', icon: Inbox },
    { href: '/pulso/eventos', label: 'Eventos', icon: Activity },
    { href: '/pulso/health', label: 'Health', icon: HeartPulse },
    { href: '/pulso/metabolismo', label: 'Metabolismo', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 w-full max-w-full overflow-x-hidden">
      {/* Responsive Premium Top Nav */}
      <nav className="relative p-3 md:p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50 w-full max-w-full overflow-x-hidden">
        
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
        {/* On mobile: displayed as a smooth scrollable row below the top bar */}
        {/* On desktop: positioned with absolute center alignment to eliminate side-element push completely */}
        <div className="flex items-center justify-start sm:justify-center gap-1 bg-white/2 p-1 rounded-xl border border-white/5 w-full xl:w-auto max-w-full overflow-x-auto custom-scrollbar flex-nowrap shrink-0 xl:absolute xl:left-1/2 xl:-translate-x-1/2 xl:top-1/2 xl:-translate-y-1/2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
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

      <main className="min-h-screen w-full max-w-full overflow-x-hidden">
        <AuthGate>
          {children}
        </AuthGate>
      </main>
    </div>
  );
}
