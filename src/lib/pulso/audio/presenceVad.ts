export interface PresenceVadState {
  noiseFloor: number;
  speechFrames: number;
  speechReferenceRms: number;
}

export interface PresenceVadSample {
  rms: number;
  peak: number;
  noiseFloor: number;
  threshold: number;
  speech: boolean;
  state: PresenceVadState;
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

export const createPresenceVadState = (): PresenceVadState => ({
  noiseFloor: 0.0015,
  speechFrames: 0,
  speechReferenceRms: 0,
});

export function analyzePresenceAudio(
  samples: Float32Array,
  previous: PresenceVadState,
  speaking: boolean,
): PresenceVadSample {
  let squareSum = 0;
  let peak = 0;
  for (const sample of samples) {
    const absolute = Math.abs(sample);
    squareSum += sample * sample;
    peak = Math.max(peak, absolute);
  }
  const rms = samples.length > 0 ? Math.sqrt(squareSum / samples.length) : 0;

  // Calibra apenas quadros compatíveis com ruído ambiente. Fala clara não
  // pode elevar o piso e tornar a frase seguinte invisível.
  const canCalibrate = !speaking && rms < 0.012 && peak < 0.035;
  const noiseFloor = canCalibrate
    ? clamp((previous.noiseFloor * 0.96) + (rms * 0.04), 0.0008, 0.008)
    : previous.noiseFloor;

  const speechReferenceRms = speaking
    ? Math.max(previous.speechReferenceRms || rms, rms)
    : 0;
  const threshold = speaking
    // Depois que a fala abre o turno, o encerramento precisa comparar a
    // energia atual também com a energia real daquela voz. No iMac, o ruído
    // contínuo do ambiente fica acima do piso calibrado inicial; usar apenas
    // `noiseFloor` mantém a sessão eternamente em `user_speaking`.
    ? Math.max(0.0022, noiseFloor * 1.1, speechReferenceRms * 0.58)
    : clamp((noiseFloor * 1.65) + 0.0006, 0.0035, 0.012);
  const peakThreshold = Math.max(0.012, threshold * 3);
  const candidate = speaking
    ? rms >= threshold
    : rms >= threshold || peak >= peakThreshold;

  // Dois quadros consecutivos removem estalos sem acrescentar latência
  // perceptível à abertura de um turno humano.
  const speechFrames = candidate
    ? Math.min(previous.speechFrames + 1, 3)
    : Math.max(previous.speechFrames - 1, 0);
  const speech = speaking ? candidate : speechFrames >= 2;

  const nextSpeechReferenceRms = speaking
    ? speechReferenceRms
    : (speech ? rms : 0);

  return {
    rms,
    peak,
    noiseFloor,
    threshold,
    speech,
    state: { noiseFloor, speechFrames, speechReferenceRms: nextSpeechReferenceRms },
  };
}
