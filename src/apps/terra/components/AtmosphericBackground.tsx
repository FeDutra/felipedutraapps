'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AtmosphericBackgroundProps {
  condition?: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'clear_night' | 'night_lua' | 'morning' | 'afternoon' | 'evening' | 'night';
  children: ReactNode;
}

const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({ condition: propCondition, children }) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getAutoCondition = () => {
    const hour = currentTime.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 20) return 'evening';
    return 'night';
  };

  const condition = propCondition || getAutoCondition();

  React.useEffect(() => {
    // Only these conditions will use the DARK theme (white text)
    const isDark = ['evening', 'night', 'clear_night', 'night_lua', 'stormy', 'rainy'].includes(condition);
    // cloudy, foggy, morning, afternoon, sunny will use LIGHT theme (dark text)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [condition]);

  const getBackgroundStyles = (): React.CSSProperties => {
    switch (condition) {
      case 'morning':
        return { background: 'var(--morning-gradient)' };
      case 'afternoon':
        return { background: 'var(--afternoon-gradient)' };
      case 'evening':
        return { background: 'var(--evening-gradient)' };
      case 'night':
      case 'clear_night':
      case 'night_lua':
        return { background: 'var(--night-gradient)' };
      case 'sunny':
        return { background: 'linear-gradient(135deg, #4fc3f7 0%, #81d4fa 50%, #fff9c4 100%)' };
      case 'cloudy':
        return { background: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 50%, #64748b 100%)' };
      case 'rainy':
        return { background: 'var(--rainy-gradient)' };
      case 'stormy':
        return { background: 'var(--stormy-gradient)' };
      case 'foggy':
        return { background: 'linear-gradient(135deg, #cbd5e1 0%, #f1f5f9 50%, #94a3b8 100%)' };
      default:
        return { background: 'var(--morning-gradient)' };
    }
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full transition-all duration-[2000ms] ease-in-out"
      style={getBackgroundStyles()}
    >
      {/* Decorative elements */}
      {(condition === 'morning' || condition === 'sunny') && (
        <motion.div 
          className="absolute top-12 left-12 w-48 h-48 bg-amber-200/40 rounded-full blur-[80px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      )}

      {condition === 'afternoon' && (
        <motion.div 
          className="absolute top-20 right-20 w-64 h-64 bg-amber-100/30 rounded-full blur-[100px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      )}

      {condition === 'evening' && (
        <motion.div 
          className="absolute bottom-20 left-0 right-0 h-96 bg-gradient-to-t from-orange-500/20 to-transparent blur-[120px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      
      {(condition === 'night' || condition === 'clear_night' || condition === 'night_lua') && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 120 }).map((_, i) => (
            <motion.div 
              key={i} 
              className="absolute bg-white rounded-full" 
              style={{ 
                width: `${Math.random() * 2 + 1}px`, 
                height: `${Math.random() * 2 + 1}px`, 
                top: `${Math.random() * 100}%`, 
                left: `${Math.random() * 100}%`,
              }}
              animate={{ 
                opacity: [0.1, Math.random() * 0.8 + 0.2, 0.1],
                scale: [1, Math.random() * 0.5 + 1, 1]
              }}
              transition={{ 
                duration: 3 + Math.random() * 5, 
                repeat: Infinity,
                delay: Math.random() * 5
              }}
            />
          ))}
          {/* Subtle moon glow */}
          <motion.div 
            className="absolute top-20 right-20 w-32 h-32 bg-indigo-300/10 rounded-full blur-[60px]"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        </div>
      )}

      {condition === 'rainy' && (
        <div className="rain-container">
          {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i} 
              className="rain-drop" 
              style={{ 
                left: `${Math.random() * 100}%`, 
                animationDuration: `${0.5 + Math.random() * 0.5}s`,
                animationDelay: `${Math.random() * 2}s`
              }} 
            />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export default AtmosphericBackground;
