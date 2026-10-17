export const PRESENCE_INPUT_SAMPLE_RATE = 16_000;
export const PRESENCE_PCM_FRAME_SAMPLES = 320;

export function encodePcm16Base64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function createRealtimeAudioEnvelope(samples: Int16Array) {
  return {
    realtimeInput: {
      audio: {
        data: encodePcm16Base64(samples),
        mimeType: `audio/pcm;rate=${PRESENCE_INPUT_SAMPLE_RATE}`,
      },
    },
  };
}

/**
 * Referência pura do reamostrador usado dentro do AudioWorklet.
 *
 * Mantém a posição fracionária entre blocos e aplica interpolação linear;
 * portanto não perde amostras na fronteira dos callbacks como a antiga
 * decimação independente por bloco.
 */
export class StreamingPcm16Resampler {
  private pending = new Float32Array(0);
  private readPosition = 0;
  private readonly ratio: number;

  constructor(
    sourceSampleRate: number,
    targetSampleRate = PRESENCE_INPUT_SAMPLE_RATE,
  ) {
    if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
      throw new Error('sourceSampleRate must be positive');
    }
    if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
      throw new Error('targetSampleRate must be positive');
    }
    this.ratio = sourceSampleRate / targetSampleRate;
  }

  push(input: Float32Array): Int16Array {
    if (input.length === 0) return new Int16Array(0);

    const joined = new Float32Array(this.pending.length + input.length);
    joined.set(this.pending);
    joined.set(input, this.pending.length);
    this.pending = joined;

    const output: number[] = [];
    while (this.readPosition + 1 < this.pending.length) {
      const leftIndex = Math.floor(this.readPosition);
      const fraction = this.readPosition - leftIndex;
      const left = this.pending[leftIndex];
      const right = this.pending[leftIndex + 1];
      const sample = left + ((right - left) * fraction);
      const clipped = Math.max(-1, Math.min(1, sample));
      output.push(clipped < 0 ? Math.round(clipped * 0x8000) : Math.round(clipped * 0x7fff));
      this.readPosition += this.ratio;
    }

    // readPosition pode ultrapassar o fim do bloco em até `ratio - 1`.
    // Preservar esse avanço evita reiniciar a fase em zero no bloco seguinte.
    const consumed = Math.min(Math.floor(this.readPosition), this.pending.length);
    if (consumed > 0) {
      this.pending = this.pending.slice(consumed);
      this.readPosition -= consumed;
    }

    return Int16Array.from(output);
  }
}

/**
 * O worklet é carregado por Blob para funcionar igualmente no Next exportado
 * e no asset protocol do Tauri, sem depender de URL pública ou cache antigo.
 */
export function createPresenceAudioWorkletSource() {
  return `
class PulsoPresenceCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions || {};
    this.targetSampleRate = config.targetSampleRate || 16000;
    this.frameSamples = config.frameSamples || 320;
    this.ratio = sampleRate / this.targetSampleRate;
    this.pending = new Float32Array(0);
    this.readPosition = 0;
    this.frame = new Int16Array(this.frameSamples);
    this.frameOffset = 0;
  }

  append(input) {
    const joined = new Float32Array(this.pending.length + input.length);
    joined.set(this.pending);
    joined.set(input, this.pending.length);
    this.pending = joined;
  }

  emit(sample) {
    const clipped = Math.max(-1, Math.min(1, sample));
    this.frame[this.frameOffset++] = clipped < 0
      ? Math.round(clipped * 0x8000)
      : Math.round(clipped * 0x7fff);
    if (this.frameOffset !== this.frameSamples) return;
    const transferable = this.frame.buffer;
    this.port.postMessage({ type: 'pcm16', buffer: transferable }, [transferable]);
    this.frame = new Int16Array(this.frameSamples);
    this.frameOffset = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;
    this.append(input);

    while (this.readPosition + 1 < this.pending.length) {
      const leftIndex = Math.floor(this.readPosition);
      const fraction = this.readPosition - leftIndex;
      const left = this.pending[leftIndex];
      const right = this.pending[leftIndex + 1];
      this.emit(left + ((right - left) * fraction));
      this.readPosition += this.ratio;
    }

    const consumed = Math.min(Math.floor(this.readPosition), this.pending.length);
    if (consumed > 0) {
      this.pending = this.pending.slice(consumed);
      this.readPosition -= consumed;
    }
    return true;
  }
}

registerProcessor('pulso-presence-capture', PulsoPresenceCaptureProcessor);
`;
}
