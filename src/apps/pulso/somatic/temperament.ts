import { LotusSomaticState, LotusClimate, LotusSignal, LotusPhysicalParams } from './types';

export function computePhysicalParams(
  somatic: LotusSomaticState,
  climate: LotusClimate,
  signals: LotusSignal,
  audioLevel: number,
  gestureImpulses: { scale: number; tension: number; glow: number; centerShiftY: number; asymmetry: number }
): LotusPhysicalParams {
  // Constants based on original production Orbe
  const borderWidth = 15.3; // Mathematically exact stroke width for 340px circle diameter inside 400px viewBox
  const colorTemp = 'rgba(251, 249, 245, 1)'; // Invariable white
  const opacity = 0.85; // Invariable opacity to guarantee legibility in all states
  
  // Base default parameters
  let scale = 1.0;
  let ovalnessX = 1.0;
  let ovalnessY = 1.0;
  let tension = 0.0;
  let asymmetry = 0.0;
  let wavePhase = 0;
  let waveAmplitude = 0.015; // very subtle idle wave
  let waveFrequency = 2.0; // low frequency
  let centerShiftX = 0;
  let centerShiftY = 0;
  let glow = 20; // baseline halo
  let speed = 1.2;

  // 1. CLIMATE LAYER (Slow context changes)
  if (climate.temperature < 18) {
    scale -= 0.05; // cold contraction (very subtle)
    speed *= 0.8;
  } else if (climate.temperature > 30) {
    scale += 0.05;
  }

  // Deep Focus: sutil scale reduction, keeping opacity high
  if (climate.deepFocus) {
    scale = 0.85;
    speed = 0.6;
    glow = 18;
  }

  // 2. AFFECTS & EMOTIONS LAYER
  // energy -> speed, pulse intensity, wave amplitude
  speed += somatic.energia * 1.5;
  scale += somatic.energia * 0.1;
  waveAmplitude += somatic.energia * 0.02;

  // tension -> stiffness/rigidity, ovalness/compression
  tension += somatic.tensao * 0.6;
  ovalnessX -= somatic.tensao * 0.08;
  ovalnessY += somatic.tensao * 0.06;
  waveFrequency = 3.0 + somatic.tensao * 2.0;

  // openness -> expansion (scale), slight glow increase
  scale += somatic.abertura * 0.15;
  glow += somatic.abertura * 4.0; // sutil halo variation (max 10% of 20 = 2px)

  // acolhimento -> smooth curves, slower speed, high elasticity
  speed *= (1.0 - somatic.acolhimento * 0.4);
  tension = Math.max(0.0, tension - somatic.acolhimento * 0.25);
  glow += somatic.acolhimento * 2.0;

  // certainty -> stability, symmetry (reduces asymmetry and wave amplitude)
  asymmetry = Math.max(0.0, asymmetry - somatic.certeza * 0.1);
  waveAmplitude = Math.max(0.005, waveAmplitude - somatic.certeza * 0.01);

  // doubt -> small oscillations / asymmetry
  if (somatic.certeza < 0.5) {
    const doubtFactor = 1.0 - somatic.certeza;
    asymmetry += doubtFactor * 0.06;
  }

  // gravity -> vertical displacement and bottom-half stretch
  centerShiftY += somatic.gravidade * 15;
  // gravidade details are passed to renderer via centerShiftY and asymmetry/ovalness
  ovalnessY += somatic.gravidade * 0.05;

  // attention -> shifts the center
  centerShiftX += somatic.attentionX * 25;
  centerShiftY += somatic.attentionY * 25;

  // curiosity -> localized wave deformation, exploratory waves
  if (somatic.curiosidade > 0.2) {
    waveAmplitude += somatic.curiosidade * 0.025;
    asymmetry += somatic.curiosidade * 0.04;
  }

  // 3. INTERACTION REFLEXES
  // Mouse Gravity
  if (signals.mouseProximity > 0) {
    centerShiftX += signals.mouseDx * 20 * signals.mouseProximity;
    centerShiftY += signals.mouseDy * 20 * signals.mouseProximity;
  }

  // Typing Reflex: micro-pulses
  if (signals.isTyping) {
    const typingFactor = Math.min(1.0, signals.typingSpeed / 10);
    waveAmplitude += typingFactor * 0.015;
  }

  // Audio Reflex: reactive scale expansion and glow pulse based on volume
  if (audioLevel > 0) {
    scale += audioLevel * 0.15;
    glow += audioLevel * 2.0;
    waveAmplitude += audioLevel * 0.03;
  }

  // 4. TEMPORARY GESTURES / IMPULSES
  scale += gestureImpulses.scale;
  tension += gestureImpulses.tension;
  glow += gestureImpulses.glow;
  centerShiftY += gestureImpulses.centerShiftY;
  asymmetry += gestureImpulses.asymmetry;

  // Clamps to ensure structural integrity and web performance
  scale = Math.max(0.7, Math.min(1.4, scale));
  ovalnessX = Math.max(0.8, Math.min(1.2, ovalnessX));
  ovalnessY = Math.max(0.8, Math.min(1.2, ovalnessY));
  tension = Math.max(0.0, Math.min(1.0, tension));
  asymmetry = Math.max(0.0, Math.min(0.2, asymmetry));
  waveAmplitude = Math.max(0.0, Math.min(0.08, waveAmplitude));
  
  // waveFrequency must be an integer to prevent seam quinas at angle 0/2pi
  waveFrequency = Math.round(Math.max(1, Math.min(8, waveFrequency)));
  
  // Halo (glow) constrained to sutil variations (max 10% range around 20, i.e., 18 to 22)
  glow = Math.max(18, Math.min(22, glow + gestureImpulses.glow * 0.05));

  return {
    borderWidth,
    scale,
    ovalnessX,
    ovalnessY,
    tension,
    asymmetry,
    wavePhase,
    waveAmplitude,
    waveFrequency,
    centerShiftX,
    centerShiftY,
    opacity,
    glow,
    speed,
    colorTemp
  };
}
