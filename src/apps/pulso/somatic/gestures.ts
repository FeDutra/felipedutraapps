export type SomaticGestureType =
  | 'descoberta'
  | 'acolhimento'
  | 'tensão'
  | 'decisão'
  | 'erro'
  | 'sucesso'
  | 'interrupção'
  | 'reconexão'
  | 'mudança_assunto'
  | 'início_ação'
  | 'conclusão_ação';

export interface ActiveGesture {
  type: SomaticGestureType;
  startTime: number;
  duration: number; // in ms
  scaleImpulse: number;
  tensionImpulse: number;
  glowImpulse: number;
  shiftYImpulse: number;
  asymmetryImpulse: number;
}

export function createGesture(type: SomaticGestureType): ActiveGesture {
  const now = Date.now();
  switch (type) {
    case 'sucesso':
      return {
        type,
        startTime: now,
        duration: 1200,
        scaleImpulse: 0.25, // sharp expansion
        tensionImpulse: -0.1, // softens briefly
        glowImpulse: 25,
        shiftYImpulse: -12, // floats up
        asymmetryImpulse: -0.05, // becomes symmetric
      };
    case 'erro':
      return {
        type,
        startTime: now,
        duration: 1800,
        scaleImpulse: -0.1, // brief compression
        tensionImpulse: 0.4, // stiffens
        glowImpulse: 10,
        shiftYImpulse: 15, // drops down
        asymmetryImpulse: 0.25, // high asymmetry
      };
    case 'descoberta':
      return {
        type,
        startTime: now,
        duration: 1500,
        scaleImpulse: 0.18,
        tensionImpulse: -0.05,
        glowImpulse: 30,
        shiftYImpulse: -8,
        asymmetryImpulse: 0.1,
      };
    case 'decisão':
      return {
        type,
        startTime: now,
        duration: 1000,
        scaleImpulse: -0.05, // brief squeeze
        tensionImpulse: 0.3, // locks/stiffens
        glowImpulse: 15,
        shiftYImpulse: 2,
        asymmetryImpulse: -0.08, // highly symmetric
      };
    case 'interrupção':
      return {
        type,
        startTime: now,
        duration: 800,
        scaleImpulse: -0.15,
        tensionImpulse: 0.5,
        glowImpulse: -8,
        shiftYImpulse: 8,
        asymmetryImpulse: 0.3, // sudden break
      };
    case 'reconexão':
      return {
        type,
        startTime: now,
        duration: 1600,
        scaleImpulse: 0.1,
        tensionImpulse: -0.15,
        glowImpulse: 20,
        shiftYImpulse: -4,
        asymmetryImpulse: -0.1,
      };
    case 'mudança_assunto':
      return {
        type,
        startTime: now,
        duration: 1400,
        scaleImpulse: 0.05,
        tensionImpulse: 0.05,
        glowImpulse: 10,
        shiftYImpulse: 0,
        asymmetryImpulse: 0.08,
      };
    case 'início_ação':
      return {
        type,
        startTime: now,
        duration: 1000,
        scaleImpulse: 0.04,
        tensionImpulse: 0.15,
        glowImpulse: 8,
        shiftYImpulse: -3,
        asymmetryImpulse: 0.03,
      };
    case 'conclusão_ação':
      return {
        type,
        startTime: now,
        duration: 1200,
        scaleImpulse: 0.18,
        tensionImpulse: -0.2, // relaxes
        glowImpulse: 25,
        shiftYImpulse: -8,
        asymmetryImpulse: -0.05,
      };
    default:
      return {
        type,
        startTime: now,
        duration: 1000,
        scaleImpulse: 0,
        tensionImpulse: 0,
        glowImpulse: 0,
        shiftYImpulse: 0,
        asymmetryImpulse: 0,
      };
  }
}

export function computeActiveGestureImpulse(
  activeGestures: ActiveGesture[]
): { scale: number; tension: number; glow: number; centerShiftY: number; asymmetry: number } {
  let scale = 0;
  let tension = 0;
  let glow = 0;
  let centerShiftY = 0;
  let asymmetry = 0;
  const now = Date.now();

  activeGestures.forEach((g) => {
    const elapsed = now - g.startTime;
    if (elapsed >= g.duration) return;

    const progress = elapsed / g.duration;
    let envelope = 0;
    if (progress < 0.15) {
      envelope = progress / 0.15; // attack
    } else {
      envelope = (1.0 - progress) / 0.85; // decay
      envelope = Math.pow(envelope, 2);
    }

    scale += g.scaleImpulse * envelope;
    tension += g.tensionImpulse * envelope;
    glow += g.glowImpulse * envelope;
    centerShiftY += g.shiftYImpulse * envelope;
    asymmetry += g.asymmetryImpulse * envelope;
  });

  return { scale, tension, glow, centerShiftY, asymmetry };
}
