export interface BaseProperties {
  warmth: number;
  coldness: number;
  roughness: number;
  softness: number;
  density: number;
  etéreo: number;
  transparency: number;
  sagrado: number;
  erotico: number;
  infantil: number;
  friction: number;
  elevation: number;
  descent: number;
  expansion: number;
  contraction: number;
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  sanguine: number;
  choleric: number;
  melancholic: number;
  phlegmatic: number;
  colorRed: number;
  colorBlue: number;
  colorGold: number;
  eco: number;
  ressonancia: number;
  afinidade: number;
  contraste: number;
  continuidade: number;
  atravessamento: number;
  jardim: number;
  paisagem: number;
  ambiencia: number;
  joia: number;
  objeto: number;
  espaco: number;
  ritual: number;
  criativa: number;
  // Phase 1 Shaders
  liquidWarp: number;
  glitchIntensity: number;
  chromaticAberration: number;
  halftoneIntensity: number;
  ghostTrails: number;
  // Phase 2 Shaders
  pixelSort: number;
  threshold: number;
  ritualShapes: number;
  // Phase 1 Sound Parameters
  attack: number;
  decay: number;
  sustain: number;
  detune: number;
  resonance: number;
  delayFeedback: number;
  delayTime: number;
  // Phase 2 Sound Parameters
  spatiality: number;
  jitter: number;
}

export function getInitialProps(): BaseProperties {
  return {
    warmth: 0, coldness: 0, roughness: 0, softness: 0, density: 0,
    etéreo: 0, transparency: 0, sagrado: 0, erotico: 0, infantil: 0,
    friction: 0, elevation: 0, descent: 0, expansion: 0, contraction: 0,
    joy: 0, sadness: 0, anger: 0, fear: 0,
    sanguine: 0, choleric: 0, melancholic: 0, phlegmatic: 0,
    colorRed: 0, colorBlue: 0, colorGold: 0, eco: 0,
    ressonancia: 0, afinidade: 0, contraste: 0, continuidade: 0, atravessamento: 0,
    jardim: 0, paisagem: 0, ambiencia: 0, joia: 0, objeto: 0, espaco: 0, ritual: 0, criativa: 0,
    // Phase 1 Shaders
    liquidWarp: 0, glitchIntensity: 0, chromaticAberration: 0, halftoneIntensity: 0, ghostTrails: 0,
    // Phase 2 Shaders
    pixelSort: 0, threshold: 0, ritualShapes: 0,
    // Phase 1 Sound Parameters
    attack: 0, decay: 0, sustain: 0, detune: 0, resonance: 0, delayFeedback: 0, delayTime: 0,
    // Phase 2 Sound Parameters
    spatiality: 0, jitter: 0
  };
}

export const semioticGrammarEnabled = true;

export interface SemioticInfluence {
  label: string;
  type: string;
  dx: number;
  dy: number;
  dist: number;
  weight: number;
}
