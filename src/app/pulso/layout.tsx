'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Activity, LayoutDashboard, Inbox, Globe, LogOut, User as UserIcon } from 'lucide-react';
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
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30">
      {/* Top Nav */}
      <nav className="p-4 md:p-6 flex items-center justify-between border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-white/40" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                <Activity size={16} className="text-blue-400" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-black tracking-tight">PULSO</h1>
                <p className="text-[10px] text-white/30 font-medium">Central Viva</p>
              </div>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-white/5 mx-2 hidden sm:block" />

          {/* Navigation Links */}
          <div className="flex items-center gap-1 bg-white/2 p-1 rounded-xl border border-white/5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    isActive 
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  <item.icon size={14} />
                  <span className="hidden xs:block">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3 pr-4 border-r border-white/5">
              <div className="hidden md:block text-right">
                <p className="text-[10px] font-black text-white/80 leading-none mb-1">{user.displayName}</p>
                <p className="text-[8px] font-medium text-white/20 leading-none">{user.email}</p>
              </div>
              <button 
                onClick={() => authService.logout()}
                className="p-2.5 bg-white/2 border border-white/5 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-400/5 hover:border-red-400/20 transition-all group"
                title="Sair"
              >
                <LogOut size={14} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
          <span className="hidden xs:inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-400">
            PULSO v0.1
          </span>
        </div>
      </nav>

      <main className="min-h-screen">
        <AuthGate>
          {children}
        </AuthGate>
      </main>
    </div>
  );
}
