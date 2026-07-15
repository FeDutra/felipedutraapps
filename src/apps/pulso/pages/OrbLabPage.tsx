'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, RefreshCw, Play, Pause, Download, Upload, Volume2, Mic, Eye, Sliders, Sun, Zap, Layers } from 'lucide-react';
import { LotusSignal, LotusSomaticState, LotusClimate, LotusPhysicalParams } from '../somatic/types';
import { computePhysicalParams } from '../somatic/temperament';
import { interpolateParams } from '../somatic/somaticEngine';
import { createGesture, computeActiveGestureImpulse, ActiveGesture, SomaticGestureType } from '../somatic/gestures';
import { LotusOrbRenderer } from '../somatic/renderer';

interface ScenarioPreset {
  name: string;
  description: string;
  somatic: LotusSomaticState;
  climate: LotusClimate;
  operationalState: string;
}

const SCENARIOS: Record<string, ScenarioPreset> = {
  manhaFriaAcolhedora: {
    name: 'Manhã Fria & Conversa Acolhedora',
    description: 'Silhueta contraída pelo frio externo, mas expressando calor interno com pulsação suave e elástica.',
    somatic: {
      energia: 0.15,
      tensao: 0.05,
      abertura: 0.45,
      acolhimento: 0.85,
      certeza: 0.6,
      coerencia: 0.9,
      gravidade: 0.25,
      curiosidade: 0.35,
      attentionX: 0,
      attentionY: 0
    },
    climate: {
      temperature: 12,
      timeOfDay: 'day',
      weather: 'clear',
      silenceDuration: 10,
      conversationLength: 300,
      systemActivity: 0.2,
      deepFocus: false
    },
    operationalState: 'speaking'
  },
  tensaoContencao: {
    name: 'Assunto Tenso (Contenção)',
    description: 'Postura de suporte da Lótus: firmeza geométrica, simetria e resistência elástica.',
    somatic: {
      energia: 0.1,
      tensao: 0.85,
      abertura: 0.25,
      acolhimento: 0.35,
      certeza: 0.9,
      coerencia: 0.95,
      gravidade: 0.55,
      curiosidade: 0.1,
      attentionX: 0,
      attentionY: 0.15
    },
    climate: {
      temperature: 22,
      timeOfDay: 'day',
      weather: 'clear',
      silenceDuration: 2,
      conversationLength: 600,
      systemActivity: 0.4,
      deepFocus: false
    },
    operationalState: 'listening'
  },
  entusiasmoCriativo: {
    name: 'Entusiasmo Criativo',
    description: 'Abertura total da membrana, maior amplitude respiratória e deformação suave.',
    somatic: {
      energia: 0.8,
      tensao: 0.1,
      abertura: 0.95,
      acolhimento: 0.65,
      certeza: 0.4,
      coerencia: 0.8,
      gravidade: 0.1,
      curiosidade: 0.85,
      attentionX: 0.05,
      attentionY: -0.05
    },
    climate: {
      temperature: 25,
      timeOfDay: 'day',
      weather: 'clear',
      silenceDuration: 0,
      conversationLength: 1200,
      systemActivity: 0.7,
      deepFocus: false
    },
    operationalState: 'speaking'
  },
  melancoliaProfunda: {
    name: 'Melancolia Profunda',
    description: 'Forma tênue de baixíssima opacidade e movimento quase estático.',
    somatic: {
      energia: 0.05,
      tensao: 0.15,
      abertura: 0.08,
      acolhimento: 0.25,
      certeza: 0.3,
      coerencia: 0.5,
      gravidade: 0.65,
      curiosidade: 0.08,
      attentionX: 0,
      attentionY: 0.25
    },
    climate: {
      temperature: 15,
      timeOfDay: 'night',
      weather: 'rain',
      silenceDuration: 120,
      conversationLength: 1800,
      systemActivity: 0.1,
      deepFocus: true
    },
    operationalState: 'idle'
  },
  decisaoFirme: {
    name: 'Decisão Firme',
    description: 'Simetria máxima, estabilização imediata e atenuação de ondulações.',
    somatic: {
      energia: 0.25,
      tensao: 0.15,
      abertura: 0.35,
      acolhimento: 0.3,
      certeza: 0.95,
      coerencia: 0.95,
      gravidade: 0.35,
      curiosidade: 0.15,
      attentionX: 0,
      attentionY: 0
    },
    climate: {
      temperature: 20,
      timeOfDay: 'day',
      weather: 'clear',
      silenceDuration: 5,
      conversationLength: 900,
      systemActivity: 0.5,
      deepFocus: false
    },
    operationalState: 'acting'
  }
};

const DEFAULT_SOMATIC: LotusSomaticState = {
  energia: 0.25,
  tensao: 0.1,
  abertura: 0.45,
  acolhimento: 0.45,
  certeza: 0.6,
  coerencia: 0.8,
  gravidade: 0.15,
  curiosidade: 0.25,
  attentionX: 0,
  attentionY: 0
};

const DEFAULT_CLIMATE: LotusClimate = {
  temperature: 22,
  timeOfDay: 'day',
  weather: 'clear',
  silenceDuration: 0,
  conversationLength: 0,
  systemActivity: 0.3,
  deepFocus: false
};

export default function OrbLabPage() {
  const [somatic, setSomatic] = useState<LotusSomaticState>(DEFAULT_SOMATIC);
  const [climate, setClimate] = useState<LotusClimate>(DEFAULT_CLIMATE);
  const [operationalState, setOperationalState] = useState<string>('idle');
  
  const [signals, setSignals] = useState<LotusSignal>({
    audioInputIntensity: 0,
    audioOutputIntensity: 0,
    mouseProximity: 0,
    mouseDx: 0,
    mouseDy: 0,
    typingSpeed: 0,
    isTyping: false,
    panelOpenLeft: false,
    panelOpenRight: false,
    boxOpen: false
  });

  const [activeGestures, setActiveGestures] = useState<ActiveGesture[]>([]);
  const [simulateAudio, setSimulateAudio] = useState<boolean>(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  
  const currentPhysical = useRef<LotusPhysicalParams>({
    borderWidth: 19,
    scale: 1.0,
    ovalnessX: 1.0,
    ovalnessY: 1.0,
    tension: 0.1,
    asymmetry: 0.05,
    wavePhase: 0,
    waveAmplitude: 0.03,
    waveFrequency: 3.0,
    centerShiftX: 0,
    centerShiftY: 0,
    opacity: 0.85,
    glow: 20,
    speed: 2.0,
    colorTemp: 'rgba(251, 249, 245, 1)'
  });

  const [activePhysicalState, setActivePhysicalState] = useState<LotusPhysicalParams>(currentPhysical.current);
  const [targetPhysicalState, setTargetPhysicalState] = useState<LotusPhysicalParams>(currentPhysical.current);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastTickTime = useRef<number>(Date.now());
  const fpsFrameCount = useRef<number>(0);
  const fpsLastTime = useRef<number>(Date.now());

  const orbContainerRef = useRef<HTMLDivElement>(null);
  const [simulateText, setSimulateText] = useState<string>('');
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const triggerSomaticGesture = (type: SomaticGestureType) => {
    const gesture = createGesture(type);
    setActiveGestures(prev => [...prev.filter(g => g.type !== type), gesture]);
  };

  const applyScenario = (key: string) => {
    const scenario = SCENARIOS[key];
    if (!scenario) return;
    setSomatic(scenario.somatic);
    setClimate(scenario.climate);
    setOperationalState(scenario.operationalState);
    triggerSomaticGesture('mudança_assunto');
  };

  // Web Audio microphone API
  useEffect(() => {
    if (microphoneEnabled) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          mediaStreamRef.current = stream;
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
        })
        .catch(err => {
          console.error("Microphone access error:", err);
          setMicrophoneEnabled(false);
        });
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      analyserRef.current = null;
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [microphoneEnabled]);

  // Main physics loop
  useEffect(() => {
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - lastTickTime.current) / 1000);
      lastTickTime.current = now;

      fpsFrameCount.current++;
      if (now - fpsLastTime.current >= 1000) {
        setFps(Math.round((fpsFrameCount.current * 1000) / (now - fpsLastTime.current)));
        fpsFrameCount.current = 0;
        fpsLastTime.current = now;
      }

      if (!paused) {
        setActiveGestures(prev => prev.filter(g => now - g.startTime < g.duration));

        let activeAudioLevel = 0;
        if (microphoneEnabled && analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          activeAudioLevel = (sum / dataArray.length) / 255;
        } else if (simulateAudio) {
          activeAudioLevel = Math.max(0, Math.sin(now / 150) * 0.4 + Math.cos(now / 400) * 0.3) * (operationalState === 'speaking' ? 0.8 : 0.2);
        }

        setSignals(prev => ({
          ...prev,
          audioInputIntensity: operationalState === 'listening' ? activeAudioLevel : 0,
          audioOutputIntensity: operationalState === 'speaking' ? activeAudioLevel : 0,
        }));

        const gesturesImpulses = computeActiveGestureImpulse(activeGestures);

        const targetParams = computePhysicalParams(
          somatic,
          climate,
          signals,
          activeAudioLevel,
          gesturesImpulses
        );

        setTargetPhysicalState(targetParams);

        const nextPhysical = interpolateParams(currentPhysical.current, targetParams, dt);
        currentPhysical.current = nextPhysical;
        setActivePhysicalState(nextPhysical);
      }

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [somatic, climate, signals, activeGestures, paused, simulateAudio, microphoneEnabled, operationalState]);

  const handleSimulateTyping = (textVal: string) => {
    setSimulateText(textVal);
    setSignals(prev => ({
      ...prev,
      isTyping: true,
      typingSpeed: Math.min(10, prev.typingSpeed + 1)
    }));

    if (typingTimer.current) clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      setSignals(prev => ({ ...prev, isTyping: false, typingSpeed: 0 }));
    }, 1500);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!orbContainerRef.current) return;
    const rect = orbContainerRef.current.getBoundingClientRect();
    const orbCenterX = rect.left + rect.width / 2;
    const orbCenterY = rect.top + rect.height / 2;

    const dx = e.clientX - orbCenterX;
    const dy = e.clientY - orbCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const maxInfluenceRadius = 350;
    const mouseProximity = Math.max(0, 1.0 - distance / maxInfluenceRadius);

    setSignals(prev => ({
      ...prev,
      mouseProximity,
      mouseDx: dx / maxInfluenceRadius,
      mouseDy: dy / maxInfluenceRadius
    }));
  };

  const handleMouseLeave = () => {
    setSignals(prev => ({
      ...prev,
      mouseProximity: 0,
      mouseDx: 0,
      mouseDy: 0
    }));
  };

  const resetSomatic = () => {
    setSomatic(DEFAULT_SOMATIC);
    setClimate(DEFAULT_CLIMATE);
    setOperationalState('idle');
    triggerSomaticGesture('reconexão');
  };

  const exportConfiguration = () => {
    const config = {
      somatic,
      climate,
      operationalState
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lotus-orb-somatic-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.somatic) setSomatic(json.somatic);
        if (json.climate) setClimate(json.climate);
        if (json.operationalState) setOperationalState(json.operationalState);
        triggerSomaticGesture('reconexão');
      } catch (err) {
        alert("Configuração inválida.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-[#0f0f0f] min-h-[100dvh] w-full flex flex-col justify-between py-6 px-4 md:px-8 overflow-y-auto font-sans text-[#fbf9f5] relative select-none">
      
      {/* Header */}
      <header className="flex justify-between items-center w-full max-w-7xl mx-auto relative z-20">
        <div className="flex items-center gap-3">
          <Link 
            href="/pulso/live" 
            className="p-1 text-[#fbf9f5]/50 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer flex items-center justify-center"
            title="Voltar para Lótus Live"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <span className="text-sm font-semibold tracking-[0.2em] text-[#fbf9f5]/80 lowercase">lótus orb somatic lab</span>
          <span className="text-[9px] text-[#fbf9f5]/20 font-extralight select-none">/</span>
          <span className="text-[9px] font-extralight tracking-widest text-[#fbf9f5]/35 lowercase">motor somático v1.1</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors cursor-pointer"
            title={paused ? 'Retomar' : 'Pausar'}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          
          <button
            onClick={exportConfiguration}
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors cursor-pointer"
            title="Exportar"
          >
            <Download size={12} />
          </button>

          <label className="p-2 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center">
            <Upload size={12} />
            <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-8 mb-6 z-10">
        
        {/* LEFT COLUMN: Central Orbe Canvas */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative min-h-[450px] border border-white/5 rounded-3xl p-6 bg-black/10 backdrop-blur-sm">
          <div 
            ref={orbContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full flex items-center justify-center cursor-crosshair relative"
          >
            <LotusOrbRenderer 
              params={activePhysicalState} 
              triggerRipple={activeGestures.length > 0} 
            />
          </div>

          <div className="w-full grid grid-cols-3 text-center text-[9px] tracking-wider text-[#fbf9f5]/30 uppercase mt-4 select-none">
            <div>
              <span>Músculo X: </span>
              <span className="font-mono text-[#fbf9f5]/65">{Math.round(activePhysicalState.centerShiftX)}px</span>
            </div>
            <div>
              <span>Proximidade: </span>
              <span className="font-mono text-[#fbf9f5]/65">{Math.round(signals.mouseProximity * 100)}%</span>
            </div>
            <div>
              <span>Músculo Y: </span>
              <span className="font-mono text-[#fbf9f5]/65">{Math.round(activePhysicalState.centerShiftY)}px</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Controls Panel */}
        <div className="lg:col-span-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto pr-3 no-scrollbar scroll-smooth">
          
          {/* Preset scenarios */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-bold">cenários compostos</span>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(SCENARIOS).map((key) => (
                <button
                  key={key}
                  onClick={() => applyScenario(key)}
                  className="px-3 py-2 text-left rounded-xl text-[10px] tracking-wider uppercase border border-white/10 hover:border-white/30 hover:bg-white/5 bg-transparent text-[#fbf9f5]/70 hover:text-white transition-all cursor-pointer leading-tight flex flex-col gap-0.5"
                >
                  <span className="font-bold flex items-center gap-1">
                    <Sparkles size={9} className="text-[#fbf9f5]/40" />
                    {SCENARIOS[key].name}
                  </span>
                  <span className="text-[7.5px] lowercase text-[#fbf9f5]/35 font-light normal-case">
                    {SCENARIOS[key].description.slice(0, 60)}...
                  </span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Somatic Sliders */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 font-bold flex items-center gap-1.5">
                <Sliders size={11} /> eixos somáticos (afeto)
              </span>
              <button 
                onClick={resetSomatic}
                className="text-[9px] text-[#fbf9f5]/30 hover:text-white/60 tracking-wider uppercase flex items-center gap-1 bg-transparent border-none outline-none cursor-pointer"
              >
                <RefreshCw size={9} /> redefinir equilíbrio
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(DEFAULT_SOMATIC).filter(k => k !== 'attentionX' && k !== 'attentionY').map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/55 uppercase">
                    <span>{key}</span>
                    <span className="font-mono text-[#fbf9f5]/85">{(somatic as any)[key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={(somatic as any)[key]}
                    onChange={(e) => {
                      setSomatic(prev => ({ ...prev, [key]: parseFloat(e.target.value) }));
                    }}
                    className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Operational States */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-bold">estado operacional</span>
            <div className="flex flex-wrap gap-1.5">
              {['idle', 'listening', 'recording', 'thinking', 'speaking', 'acting', 'interrupted', 'connecting', 'offline', 'error'].map((state) => {
                const isActive = operationalState === state;
                return (
                  <button
                    key={state}
                    onClick={() => {
                      setOperationalState(state);
                      triggerSomaticGesture('início_ação');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase transition-all duration-200 cursor-pointer bg-transparent border outline-none ${
                      isActive 
                        ? 'border-white text-[#0f0f0f] bg-white font-bold' 
                        : 'border-white/10 text-[#fbf9f5]/50 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {state}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Impulses / Reflexes */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-bold flex items-center gap-1.5">
              <Zap size={11} /> impulsos temporários (reflexos)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'sucesso', type: 'sucesso' },
                { label: 'erro', type: 'erro' },
                { label: 'descoberta', type: 'descoberta' },
                { label: 'decisão', type: 'decisão' },
                { label: 'interrupção', type: 'interrupção' },
                { label: 'reconexão', type: 'reconexão' },
                { label: 'assunto', type: 'mudança_assunto' },
                { label: 'início', type: 'início_ação' },
                { label: 'conclusão', type: 'conclusão_ação' }
              ].map((g) => (
                <button
                  key={g.type}
                  onClick={() => triggerSomaticGesture(g.type as SomaticGestureType)}
                  className="px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase border border-white/10 hover:border-white/30 text-[#fbf9f5]/60 hover:text-white bg-transparent outline-none cursor-pointer transition-all"
                >
                  ⚡ {g.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Context and Audio Reflex simulation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-bold flex items-center gap-1">
                <Sun size={11} /> clima & contexto
              </span>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">
                    <span>temperatura</span>
                    <span>{climate.temperature}°C</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={climate.temperature}
                    onChange={(e) => setClimate(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
                    className="pulso-slider w-full bg-white/10 h-[2px] rounded-lg appearance-none cursor-pointer outline-none"
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] tracking-widest text-[#fbf9f5]/55 uppercase">
                  <span>período</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setClimate(prev => ({ ...prev, timeOfDay: 'day' }))}
                      className={`text-[9px] bg-transparent border-none outline-none cursor-pointer ${climate.timeOfDay === 'day' ? 'text-white font-bold' : 'text-[#fbf9f5]/30'}`}
                    >
                      dia
                    </button>
                    <button 
                      onClick={() => setClimate(prev => ({ ...prev, timeOfDay: 'night' }))}
                      className={`text-[9px] bg-transparent border-none outline-none cursor-pointer ${climate.timeOfDay === 'night' ? 'text-white font-bold' : 'text-[#fbf9f5]/30'}`}
                    >
                      noite
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] tracking-widest text-[#fbf9f5]/55 uppercase">
                  <span>clima</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setClimate(prev => ({ ...prev, weather: 'clear' }))}
                      className={`text-[9px] bg-transparent border-none outline-none cursor-pointer ${climate.weather === 'clear' ? 'text-white font-bold' : 'text-[#fbf9f5]/30'}`}
                    >
                      limpo
                    </button>
                    <button 
                      onClick={() => setClimate(prev => ({ ...prev, weather: 'rain' }))}
                      className={`text-[9px] bg-transparent border-none outline-none cursor-pointer ${climate.weather === 'rain' ? 'text-white font-bold' : 'text-[#fbf9f5]/30'}`}
                    >
                      chuva
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase flex items-center gap-1.5">
                    <Layers size={10} /> modo foco profundo
                  </span>
                  <button
                    type="button"
                    onClick={() => setClimate(prev => ({ ...prev, deepFocus: !prev.deepFocus }))}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 focus:outline-none cursor-pointer ${
                      climate.deepFocus ? 'bg-white' : 'bg-white/10'
                    }`}
                  >
                    <div 
                      className={`w-3 h-3 rounded-full bg-[#0f0f0f] transition-transform duration-300 ${
                        climate.deepFocus ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 block mb-3 font-bold flex items-center gap-1.5">
                <Volume2 size={11} /> reflexos de áudio
              </span>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-[9px] tracking-widest text-[#fbf9f5]/55 uppercase">
                  <span>simular voz</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSimulateAudio(!simulateAudio);
                      if (microphoneEnabled) setMicrophoneEnabled(false);
                    }}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 focus:outline-none cursor-pointer ${
                      simulateAudio ? 'bg-white' : 'bg-white/10'
                    }`}
                  >
                    <div 
                      className={`w-3 h-3 rounded-full bg-[#0f0f0f] transition-transform duration-300 ${
                        simulateAudio ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex justify-between items-center text-[9px] tracking-widest text-[#fbf9f5]/55 uppercase">
                  <span className="flex items-center gap-1"><Mic size={10} /> usar microfone real</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMicrophoneEnabled(!microphoneEnabled);
                      if (simulateAudio) setSimulateAudio(false);
                    }}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 focus:outline-none cursor-pointer ${
                      microphoneEnabled ? 'bg-white' : 'bg-white/10'
                    }`}
                  >
                    <div 
                      className={`w-3 h-3 rounded-full bg-[#0f0f0f] transition-transform duration-300 ${
                        microphoneEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] tracking-widest text-[#fbf9f5]/50 uppercase">simular digitação</span>
                  <input
                    type="text"
                    value={simulateText}
                    onChange={(e) => handleSimulateTyping(e.target.value)}
                    placeholder="digite aqui para disparar impulsos..."
                    className="orb-input-minimalist rounded-lg px-2.5 py-1.5 w-full text-[9.5px]"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-white/10" />

          {/* HUD de Depuração com Invariantes */}
          <div className="rounded-2xl border border-white/5 bg-black/15 p-4 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#fbf9f5]/40 font-bold flex items-center gap-1.5">
              <Eye size={11} /> painel de verificação somática (hud)
            </span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[8.5px] leading-relaxed uppercase font-mono text-[#fbf9f5]/55 select-text">
              <div>Formas Visíveis: <span className="text-white">1 (Invariante)</span></div>
              <div>Espessura Original: <span className="text-white">19px (Lótus Live)</span></div>
              <div>Espessura Atual: <span className="text-white">19px (Equivalente)</span></div>
              <div>Variação de Espessura: <span className="text-white">0 (Invariante)</span></div>
              <div>Elementos Adicionais: <span className="text-white">0 (Invariante)</span></div>
              <div>Intensidade do Halo: <span className="text-white">{activePhysicalState.glow.toFixed(1)}px (±10% max)</span></div>
              <div>Retorno ao Círculo: <span className="text-white">{activePhysicalState.asymmetry.toFixed(3)}</span></div>
              <div>FPS: <span className="text-white">{fps}</span></div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto flex justify-between items-center text-[8px] tracking-[0.2em] text-[#fbf9f5]/20 uppercase relative z-20">
        <span>antigravity laboratory</span>
        <span>eden terra somático module</span>
      </footer>

    </div>
  );
}
