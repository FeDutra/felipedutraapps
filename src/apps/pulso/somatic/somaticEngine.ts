import { LotusPhysicalParams } from './types';

function lerp(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * Math.min(1.0, speed * dt);
}

export function interpolateParams(
  current: LotusPhysicalParams,
  target: LotusPhysicalParams,
  dt: number
): LotusPhysicalParams {
  const borderLerpSpeed = 2.0; 
  const scaleLerpSpeed = 3.5;
  const tensionLerpSpeed = 4.5;
  const asymLerpSpeed = 2.5;
  const glowLerpSpeed = 3.0;
  const speedLerpSpeed = 2.0;
  const shiftLerpSpeed = 3.0; // physical center inertia

  return {
    borderWidth: target.borderWidth, // fixed 19px invariante
    scale: lerp(current.scale, target.scale, scaleLerpSpeed, dt),
    ovalnessX: lerp(current.ovalnessX, target.ovalnessX, scaleLerpSpeed, dt),
    ovalnessY: lerp(current.ovalnessY, target.ovalnessY, scaleLerpSpeed, dt),
    tension: lerp(current.tension, target.tension, tensionLerpSpeed, dt),
    asymmetry: lerp(current.asymmetry, target.asymmetry, asymLerpSpeed, dt),
    wavePhase: current.wavePhase + (target.speed * dt), // continuous accumulation
    waveAmplitude: lerp(current.waveAmplitude, target.waveAmplitude, scaleLerpSpeed, dt),
    waveFrequency: lerp(current.waveFrequency, target.waveFrequency, tensionLerpSpeed, dt),
    centerShiftX: lerp(current.centerShiftX, target.centerShiftX, shiftLerpSpeed, dt),
    centerShiftY: lerp(current.centerShiftY, target.centerShiftY, shiftLerpSpeed, dt),
    opacity: lerp(current.opacity, target.opacity, scaleLerpSpeed, dt),
    glow: lerp(current.glow, target.glow, glowLerpSpeed, dt),
    speed: lerp(current.speed, target.speed, speedLerpSpeed, dt),
    colorTemp: target.colorTemp
  };
}
