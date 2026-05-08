'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Map, 
  TreePine, 
  CloudRain, 
  Moon, 
  Calendar, 
  Sparkles, 
  BarChart3, 
  Settings,
  Plus
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { motion } from 'framer-motion';

const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: 'Hoje', href: '/terra' },
    { icon: CloudRain, label: 'Chuva', href: '/terra/chuva' },
    { icon: Moon, label: 'Lua', href: '/terra/lua' },
    { icon: Map, label: 'Áreas', href: '/terra/areas' },
    { icon: TreePine, label: 'Plantas', href: '/terra/plantas' },
    { icon: Sparkles, label: 'IA', href: '/terra/ia' },
    { icon: Calendar, label: 'Calendário', href: '/terra/calendario' },
    { icon: BarChart3, label: 'Relatórios', href: '/terra/relatorios' },
    { icon: Settings, label: 'Config', href: '/terra/configuracoes' },
  ];

  // Split items for central CTA
  const leftItems = navItems.slice(0, 5);
  const rightItems = navItems.slice(5);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 md:pb-10 pointer-events-none flex justify-center">
      <div className="glass rounded-[2.5rem] flex items-center p-2 md:p-3 shadow-[0_25px_60px_rgba(0,0,0,0.3)] pointer-events-auto max-w-[95vw] md:max-w-5xl overflow-x-auto no-scrollbar border-white/30">
        <div className="flex items-center gap-1 md:gap-4 px-2">
          {leftItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-500 relative min-w-[44px] md:min-w-[56px] group",
                  isActive ? "text-[var(--text-primary)] scale-110" : "text-[var(--text-secondary)] opacity-70 hover:opacity-100"
                )}
              >
                <item.icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                {isActive && (
                  <motion.div
                    layoutId="activeNavTab"
                    className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl border border-emerald-500/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {isActive && (
                   <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full"
                   />
                )}
              </Link>
            );
          })}

          {/* Central CTA */}
          <Link href="/terra/registrar" className="mx-2 md:mx-6 flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.1, y: -4 }}
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 md:w-16 md:h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-[0_15px_35px_rgba(16,185,129,0.4)] border-4 border-white/20 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
              <Plus size={32} strokeWidth={3} className="relative z-10" />
            </motion.div>
          </Link>

          {rightItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-500 relative min-w-[44px] md:min-w-[56px] group",
                  isActive ? "text-[var(--text-primary)] scale-110" : "text-[var(--text-secondary)] opacity-70 hover:opacity-100"
                )}
              >
                <item.icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                {isActive && (
                  <motion.div
                    layoutId="activeNavTab"
                    className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl border border-emerald-500/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {isActive && (
                   <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full"
                   />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
