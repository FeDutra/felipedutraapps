'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Sparkles, RefreshCw, Layers } from 'lucide-react';
import Link from 'next/link';

interface OrbPreset {
  name: string;
  description: string;
  borderWidth: number;
  scale: number;
  baseFrequency: number;
  glow: number;
  speed: number;
  satellites: number;
  doubleRing: boolean;
  opacity: number;
}

const PRESETS: Record<string, OrbPreset> = {
  serenidade: {
    name: 'Serenidade',
    description: 'Silencioso, estável e translúcido. A forma retorna à pureza perfeita.',
    borderWidth: 16,
    scale: 2,
    baseFrequency: 0.01,
    glow: 35,
    speed: 8,
    satellites: 0,
    doubleRing: false,
    opacity: 0.9,
  },
  tensao: {
    name: 'Tensão',
    description: 'Geometria agitada e trêmula, expressando urgência ou complexidade.',
    borderWidth: 19,
    scale: 45,
    baseFrequency: 0.05,
    glow: 15,
    speed: 1.5,
    satellites: 0,
    doubleRing: false,
    opacity: 0.8,
  },
  energia: {
    name: 'Energia',
    description: 'Atividade intensa. Linhas concêntricas e satélites em rápida rotação.',
    borderWidth: 22,
    scale: 18,
    baseFrequency: 0.015,
    glow: 60,
    speed: 3,
    satellites: 3,
    doubleRing: true,
    opacity: 1.0,
  },
  melancolia: {
    name: 'Melancolia / Foco',
    description: 'Outline minimalista extremamente sutil, reduzido à essência etérea.',
    borderWidth: 3,
    scale: 4,
    baseFrequency: 0.008,
    glow: 8,
    speed: 14,
    satellites: 1,
    doubleRing: false,
    opacity: 0.25,
  },
  atelier: {
    name: 'Alquimia Ateliê (Emergência)',
    description: 'Estados híbridos imprevisíveis causados pela colisão de conceitos.',
    borderWidth: 12,
    scale: 32,
    baseFrequency: 0.08,
    glow: 40,
    speed: 4.5,
    satellites: 5,
    doubleRing: true,
    opacity: 0.75,
  }
};

export default function OrbeTestPage() {
  const [activePreset, setActivePreset] = useState<string>('serenidade');
  
  // Orb parameters (state initialized to 'serenidade')
  const [borderWidth, setBorderWidth] = useState<number>(PRESETS.serenidade.borderWidth);
  const [scale, setScale] = useState<number>(PRESETS.serenidade.scale);
  const [baseFrequency, setBaseFrequency] = useState<number>(PRESETS.serenidade.baseFrequency);
  const [glow, setGlow] = useState<number>(PRESETS.serenidade.glow);
  const [speed, setSpeed] = useState<number>(PRESETS.serenidade.speed);
  const [satellites, setSatellites] = useState<number>(PRESETS.serenidade.satellites);
  const [doubleRing, setDoubleRing] = useState<boolean>(PRESETS.serenidade.doubleRing);
  const [opacity, setOpacity] = useState<number>(PRESETS.serenidade.opacity);
  
  // Chat input
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLog, setChatLog] = useState<{ text: string; vibe: string }[]>([
    { text: "sintonizando o playground experimental da orbe...", vibe: "neutral" }
  ]);
  
  // Ref to trigger wave animations (notification pulse)
  const [triggerRipple, setTriggerRipple] = useState<boolean>(false);

  // Apply preset
  const applyPreset = (key: string) => {
    setActivePreset(key);
    const p = PRESETS[key];
    setBorderWidth(p.borderWidth);
    setScale(p.scale);
    setBaseFrequency(p.baseFrequency);
    setGlow(p.glow);
    setSpeed(p.speed);
    setSatellites(p.satellites);
    setDoubleRing(p.doubleRing);
    setOpacity(p.opacity);
    
    // Trigger a ripple pulse on preset change
    setTriggerRipple(true);
    setTimeout(() => setTriggerRipple(false), 2000);
  };

  // Basic sentiment analyzer on typing/submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const text = chatInput.toLowerCase();
    let detectedVibe = "neutro";
    
    // Heuristic checking
    if (text.match(/(erro|falha|deu ruim|urgente|alerta|atrasado|tensa|tensao|medo|perigo)/)) {
      detectedVibe = "tensão";
      setBorderWidth(24);
      setScale(55);
      setBaseFrequency(0.06);
      setGlow(20);
      setSpeed(1.2);
      setOpacity(0.9);
      setActivePreset('tensao');
    } else if (text.match(/(calma|paz|tranquilo|sereno|serenidade|meditar|relaxar|suave)/)) {
      detectedVibe = "serenidade";
      setBorderWidth(16);
      setScale(1);
      setBaseFrequency(0.005);
      setGlow(45);
      setSpeed(9);
      setOpacity(0.9);
      setActivePreset('serenidade');
    } else if (text.match(/(criar|ideia|energia|fogo|entusiasmo|ateliê|atelier|musica|som)/)) {
      detectedVibe = "energia";
      setBorderWidth(20);
      setScale(22);
      setBaseFrequency(0.02);
      setGlow(55);
      setSpeed(2.5);
      setSatellites(4);
      setDoubleRing(true);
      setOpacity(1.0);
      setActivePreset('energia');
    } else if (text.match(/(foco|concentracao|estudar|silencio|triste|melancolia|sozinho)/)) {
      detectedVibe = "melancolia";
      setBorderWidth(4);
      setScale(3);
      setBaseFrequency(0.007);
      setGlow(10);
      setSpeed(12);
      setSatellites(1);
      setDoubleRing(false);
      setOpacity(0.3);
      setActivePreset('melancolia');
    } else {
      // Emergency/Unpredictable random morph when user enters unknown/experimental keywords
      if (text.match(/(colisao|imprevisivel|mistura|alquimia|caos|emergencia)/)) {
        detectedVibe = "alquimia/caos";
        setBorderWidth(Math.floor(Math.random() * 30) + 5);
        setScale(Math.floor(Math.random() * 60) + 10);
        setBaseFrequency(parseFloat((Math.random() * 0.12 + 0.01).toFixed(3)));
        setGlow(Math.floor(Math.random() * 70) + 15);
        setSpeed(parseFloat((Math.random() * 6 + 0.5).toFixed(1)));
        setSatellites(Math.floor(Math.random() * 6));
        setDoubleRing(Math.random() > 0.5);
        setOpacity(parseFloat((Math.random() * 0.6 + 0.3).toFixed(2)));
        setActivePreset('atelier');
      } else {
        // Normal text triggers a brief warp excitement
        setTriggerRipple(true);
        setTimeout(() => setTriggerRipple(false), 2000);
        setScale(prev => Math.min(prev + 10, 60));
        setTimeout(() => setScale(prev => Math.max(prev - 10, 0)), 1200);
      }
    }
    
    setChatLog(prev => [...prev, { text: chatInput, vibe: detectedVibe }]);
    setChatInput('');
  };

  return (
    <div className="theme-her min-h-[100dvh] w-full flex flex-col justify-between py-6 px-4 md:px-8 overflow-hidden font-sans text-[#fbf9f5] relative select-none">
      
      {/* SVG Liquid Filters injected dynamically */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="lotus-liquid-filter-test">
            {/* Turbulence noise */}
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency={baseFrequency} 
              numOctaves="3" 
              result="noise"
            />
            {/* Displacement map */}
            <feDisplacementMap 
              in="SourceGraphic" 
              in2="noise" 
              scale={scale} 
              xChannelSelector="R" 
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Header */}
      <header className="flex justify-between items-center w-full max-w-6xl mx-auto relative z-20">
        <div className="flex items-center gap-3">
          <Link 
            href="/pulso/live" 
            className="p-1 text-[#fbf9f5]/50 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer flex items-center justify-center"
            title="Voltar para Lótus Live"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <span className="text-sm font-semibold tracking-[0.2em] text-[#fbf9f5]/80 lowercase">lótus orbe playground</span>
          <span className="text-[9px] text-[#fbf9f5]/20 font-extralight select-none">/</span>
          <span className="text-[9px] font-extralight tracking-widest text-[#fbf9f5]/35 lowercase">protótipo local</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-6 mb-6 z-10">
        
        {/* Left/Center Panel: The Live Orbe Canvas */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative min-h-[400px] h-full">
          
          {/* Main Orbe Container with SVG Filters */}
          <div className="relative w-80 h-80 flex items-center justify-center">
            
            {/* Concentric Ripple/Wave ring (active on notifications or preset transitions) */}
            <div 
              className={`absolute w-full h-full rounded-full border border-white/40 pointer-events-none scale-0 opacity-0 ${
                triggerRipple ? 'orb-ripple-active' : ''
              }`}
              style={{
                filter: 'blur(4px) url(#lotus-liquid-filter-test)',
              }}
            />

            {/* Optional Outer Concentric Ring */}
            {doubleRing && (
              <div 
                className="absolute w-[360px] h-[360px] rounded-full border border-white/20 orb-spin-reverse pointer-events-none transition-all duration-[1000ms] ease-in-out"
                style={{
                  filter: 'blur(3px) url(#lotus-liquid-filter-test)',
                  opacity: opacity * 0.6
                }}
              />
            )}

            {/* Core Morphing Orbe (The Outline) */}
            <div 
              className="w-64 h-64 rounded-full transition-all duration-[1200ms] ease-in-out origin-center flex items-center justify-center"
              style={{
                borderWidth: `${borderWidth}px`,
                borderStyle: 'solid',
                borderColor: '#fbf9f5',
                filter: `drop-shadow(0 0 ${glow}px rgba(251, 249, 245, 0.65)) url(#lotus-liquid-filter-test)`,
                opacity: opacity,
                animation: `orb-spin-slow ${speed * 5}s linear infinite`,
              }}
            />

            {/* Background Atmosphere Blur inside the Orbe */}
            <div 
              className="absolute w-52 h-52 rounded-full bg-white/[0.03] backdrop-blur-xl -z-10 transition-opacity duration-1000"
              style={{ opacity: opacity }}
            />

            {/* Micro-Satélites (emergent particles orbiting the main Orbe) */}
            {Array.from({ length: satellites }).map((_, i) => {
              const rotationOffset = (360 / satellites) * i;
              const orbitRadius = 160 + (i * 10);
              return (
                <div 
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    width: `${orbitRadius * 2}px`,
                    height: `${orbitRadius * 2}px`,
                    transform: `rotate(${rotationOffset}deg)`,
                    animation: `orb-spin-slow ${8 + i * 4}s linear infinite`
                  }}
                >
                  <div 
                    className="w-2.5 h-2.5 bg-white rounded-full absolute top-0 left-1/2 -translate-x-1/2 blur-[1.5px]"
                    style={{
                      opacity: opacity * 0.8,
                      boxShadow: '0 0 10px rgba(251, 249, 245, 0.8)'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Text/Vibe Indicator beneath the Orbe */}
          <div className="mt-12 text-center select-none">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#fbf9f5]/40 block mb-1">estado de sintonia</span>
            <span className="text-xs uppercase tracking-[0.2em] font-medium text-[#fbf9f5]/85">
              {PRESETS[activePreset]?.name || 'Customizado'}
            </span>
          </div>

        </div>

        {/* Right Panel: Controls & Chat Simulation */}
        <div className="lg:col-span-5 flex flex-col gap-6 w-full lg:max-h-[80vh] overflow-y-auto pr-2 no-scrollbar">
          
          {/* Preset Buttons - Zero boxes, pure text & hover highlights */}
          <div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-semibold">presets de sintonia</span>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((key) => {
                const isActive = activePreset === key;
                return (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase transition-all duration-300 bg-transparent border outline-none cursor-pointer flex items-center gap-1 ${
                      isActive 
                        ? 'border-white text-[#b8283e] bg-white font-bold' 
                        : 'border-white/15 text-[#fbf9f5]/60 hover:text-white hover:border-white/40'
                    }`}
                  >
                    {isActive && <Sparkles size={10} className="animate-pulse" />}
                    {PRESETS[key].name}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] tracking-wider text-[#fbf9f5]/40 mt-2 lowercase font-light h-6">
              {PRESETS[activePreset]?.description}
            </p>
          </div>

          <hr className="border-[#fbf9f5]/10 my-1" />

          {/* Interactive Chat Simulation */}
          <div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-semibold">simulador de chat contextual</span>
            
            <div className="orb-input-minimalist rounded-xl p-3 min-h-[120px] max-h-[160px] overflow-y-auto mb-3 flex flex-col gap-1.5 no-scrollbar scroll-smooth">
              {chatLog.map((log, idx) => (
                <div key={idx} className="flex gap-2 items-start text-[10px] leading-relaxed">
                  <span className="text-[#fbf9f5]/20 font-mono">[{log.vibe}]</span>
                  <span className="text-[#fbf9f5]/70 lowercase">{log.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="digite algo (ex: 'alerta!', 'calma', 'criar ateliê'...)"
                className="flex-1 orb-input-minimalist rounded-lg px-3 py-2 lowercase"
              />
              <button 
                type="submit" 
                className="orb-input-minimalist rounded-lg px-3.5 py-2 hover:bg-white/10 hover:border-white/40 cursor-pointer flex items-center justify-center"
              >
                <Play size={11} className="text-[#fbf9f5]" />
              </button>
            </form>
          </div>

          <hr className="border-[#fbf9f5]/10 my-1" />

          {/* Manual Parameter Sliders */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 font-semibold">ajustes manuais finos</span>
              <button 
                onClick={() => applyPreset(activePreset)}
                className="text-[9px] text-[#fbf9f5]/30 hover:text-white/60 tracking-wider uppercase flex items-center gap-1 bg-transparent border-none outline-none cursor-pointer"
              >
                <RefreshCw size={9} /> reset
              </button>
            </div>

            {/* Slider: Border Width */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">
                <span>espessura da linha (outline)</span>
                <span>{borderWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={borderWidth}
                onChange={(e) => {
                  setBorderWidth(parseInt(e.target.value));
                  setActivePreset('custom');
                }}
                className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
              />
            </div>

            {/* Slider: Scale (Turbulence displacement) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">
                <span>deformação / turbulência</span>
                <span>{scale}</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={scale}
                onChange={(e) => {
                  setScale(parseInt(e.target.value));
                  setActivePreset('custom');
                }}
                className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
              />
            </div>

            {/* Slider: Base Frequency */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">
                <span>frequência de onda (rugosidade)</span>
                <span>{baseFrequency.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.15"
                step="0.001"
                value={baseFrequency}
                onChange={(e) => {
                  setBaseFrequency(parseFloat(e.target.value));
                  setActivePreset('custom');
                }}
                className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
              />
            </div>

            {/* Slider: Glow (Drop Shadow Radius) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">
                <span>aura de brilho (glow)</span>
                <span>{glow}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={glow}
                onChange={(e) => {
                  setGlow(parseInt(e.target.value));
                  setActivePreset('custom');
                }}
                className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
              />
            </div>

            {/* Slider: Satellites */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">
                <span>satélites de background</span>
                <span>{satellites}</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                value={satellites}
                onChange={(e) => {
                  setSatellites(parseInt(e.target.value));
                  setActivePreset('custom');
                }}
                className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
              />
            </div>

            {/* Toggle: Double Ring */}
            <div className="flex justify-between items-center py-1">
              <span className="text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase flex items-center gap-1.5">
                <Layers size={10} /> anel concêntrico duplo
              </span>
              <button
                type="button"
                onClick={() => {
                  setDoubleRing(!doubleRing);
                  setActivePreset('custom');
                }}
                className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 focus:outline-none cursor-pointer ${
                  doubleRing ? 'bg-white' : 'bg-white/10'
                }`}
              >
                <div 
                  className={`w-3 h-3 rounded-full bg-[#b8283e] transition-transform duration-300 ${
                    doubleRing ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto flex justify-between items-center text-[8px] tracking-[0.2em] text-[#fbf9f5]/20 uppercase relative z-20">
        <span>antigravity laboratory</span>
        <span>eden terra experimental module</span>
      </footer>

    </div>
  );
}
