/**
 * Cliente de voz-para-voz em tempo real usando a Gemini Live API, via o relay
 * WebSocket que mantém a chave no servidor (services/pulso-live-voice).
 *
 * Substitui, quando ativo, o pipeline turn-based (grava -> STT -> LLM -> TTS)
 * por uma sessão contínua: o microfone é transmitido em streaming e o áudio
 * de resposta chega e toca em pedaços, com barge-in detectado pelo próprio
 * Gemini (VAD do lado do servidor), sem precisar de RMS manual no cliente.
 */

export type GeminiLiveState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

export interface GeminiLiveConfig {
  relayUrl: string;
  model?: string;
  systemInstruction: string;
  voiceName?: string;
  onStateChange: (state: GeminiLiveState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onError: (message: string) => void;
  /**
   * Disparado quando a Lótus-voz termina de falar o reconhecimento curto
   * ("peraí, deixa eu ver") logo após o Fê falar. É o sinal pra rodar o
   * pipeline de verdade (AgentOrchestrator) com o texto transcrito e, quando
   * o resultado sair, chamar sendResultText() com a resposta real.
   * A Gemini Live nunca responde por conta própria — só reconhece e narra.
   */
  onUserTurnReady?: (userText: string) => void;
}

function base64FromInt16(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function int16FromBase64(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function isPurelySocialTurn(text: string) {
  const normalized = text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(oi|ola|bom dia|boa tarde|boa noite|tudo bem|obrigado|obrigada|valeu|tchau|ate logo|ate mais)$/.test(normalized);
}

/** Downsample simples (decimação) de Float32 numa taxa de origem pra 16kHz. */
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputSampleRate / 16000;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, input[srcIndex]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export class GeminiLiveClient {
  private config: GeminiLiveConfig;
  private ws: WebSocket | null = null;
  private state: GeminiLiveState = 'idle';

  // Captura de microfone
  private micStream: MediaStream | null = null;
  private captureContext: AudioContext | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  private captureProcessor: ScriptProcessorNode | null = null;

  // Reprodução de áudio (PCM 24kHz vindo do Gemini)
  private playbackContext: AudioContext | null = null;
  private nextPlaybackTime = 0;
  private pendingSources = 0;
  private turnCompletePending = false;

  // Orquestração reconhecimento -> backend real -> narração do resultado
  private pendingUserTranscript = '';
  private awaitingResult = false;
  /**
   * A Live API aceita novos turnos enquanto reproduz áudio, mas não garante
   * a ordem deles. Para presença, ordem é presença: a confirmação curta vem
   * primeiro; checkpoints e resultado entram depois, sem se atropelarem nem
   * desaparecerem durante uma fala em curso.
   */
  private narrationQueue: Array<{ kind: 'checkpoint' | 'result'; text: string }> = [];
  private narrationInFlight: 'checkpoint' | 'result' | null = null;
  /** O chat pode produzir muitos eventos; a voz precisa de marcos, não de logs. */
  private deferredCheckpointText: string | null = null;
  private checkpointTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNarrationCompletedAt = 0;
  private lastCheckpointSpokenAt = 0;

  // Equivale ao soft timeout recomendado para conversa: presença cedo, sem
  // virar relógio. O espaçamento longo vale apenas entre marcos posteriores.
  private static readonly FIRST_CHECKPOINT_DELAY_MS = 3_000;
  private static readonly MIN_CHECKPOINT_GAP_MS = 10_000;

  private closedByUser = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_RECONNECT_ATTEMPTS = 2;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  private setState(next: GeminiLiveState) {
    this.state = next;
    this.config.onStateChange(next);
  }

  public getState(): GeminiLiveState {
    return this.state;
  }

  public async start() {
    this.closedByUser = false;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  private openSocket() {
    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.relayUrl);
    } catch (e: any) {
      this.scheduleReconnect(e.message || 'Falha ao abrir conexão com o relay de voz.');
      return;
    }

    this.ws.onopen = () => {
      console.log('[GEMINI_LIVE_RELAY_OPEN]');
      this.sendSetup();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      console.warn('[GEMINI_LIVE_WS_ERROR]');
    };

    this.ws.onclose = (event) => {
      console.log('[GEMINI_LIVE_WS_CLOSED]', event.code, event.reason);
      if (!this.closedByUser) {
        this.teardownMic();
        this.scheduleReconnect(event.reason || 'Conexão de voz encerrada inesperadamente.');
        return;
      }
      this.teardownMic();
    };
  }

  private scheduleReconnect(reason: string) {
    if (this.closedByUser) return;
    if (this.reconnectAttempts >= GeminiLiveClient.MAX_RECONNECT_ATTEMPTS) {
      this.config.onError(reason);
      this.setState('error');
      return;
    }
    this.reconnectAttempts += 1;
    const delay = this.reconnectAttempts * 750;
    console.warn('[GEMINI_LIVE_RECONNECT_SCHEDULED]', { attempt: this.reconnectAttempts, delay, reason });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private sendSetup() {
    const defaultVoice = this.config.voiceName || 'Kore';
    this.ws?.send(JSON.stringify({
      setup: {
        model: this.config.model || 'models/gemini-3.8-live',
        systemInstruction: { parts: [{ text: this.config.systemInstruction }] },
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: defaultVoice } },
            languageCode: 'pt-BR'
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    }));
  }

  private async handleMessage(raw: any) {
    let text: string;
    if (typeof raw === 'string') {
      text = raw;
    } else if (raw instanceof Blob) {
      text = await raw.text();
    } else {
      text = new TextDecoder().decode(raw);
    }

    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch (e) {
      console.warn('[GEMINI_LIVE_PARSE_ERROR]', e);
      return;
    }

    if (msg.setupComplete) {
      console.log('[GEMINI_LIVE_SETUP_COMPLETE]');
      this.reconnectAttempts = 0;
      try {
        await this.startMic();
      } catch (e: any) {
        console.error('[GEMINI_LIVE_MIC_START_FAILED]', e?.message || e);
        this.config.onError('Permissão de microfone negada ou indisponível.');
        this.setState('error');
        this.ws?.close(1011, 'mic start failed');
        return;
      }
      this.setState('listening');
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.interrupted) {
        console.log('[GEMINI_LIVE_INTERRUPTED]');
        this.flushPlayback();
        // Um barge-in durante a narração de um checkpoint/resultado corta o
        // turno sem nunca mandar turnComplete — sem isso, narrationInFlight
        // ficava preso pra sempre e travava toda fala seguinte (incluindo
        // resultados reais, que o chamador achava terem sido narrados).
        const interruptedKind = this.narrationInFlight;
        this.narrationInFlight = null;
        if (interruptedKind === 'result') {
          this.awaitingResult = false;
        }
        this.setState('listening');
        this.flushNarrationQueue();
        this.scheduleDeferredCheckpoint();
        return;
      }

      if (sc.inputTranscription?.text) {
        this.pendingUserTranscript += sc.inputTranscription.text;
        this.config.onTranscript?.('user', sc.inputTranscription.text);
      }
      if (sc.outputTranscription?.text) {
        this.config.onTranscript?.('assistant', sc.outputTranscription.text);
      }

      const parts = sc.modelTurn?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          this.enqueuePlayback(p.inlineData.data);
        }
      }

      if (sc.turnComplete) {
        this.turnCompletePending = true;
        this.maybeReturnToListening();

        if (this.narrationInFlight === 'checkpoint') {
          // Checkpoint narrado no meio de um processo longo — não mexe no
          // ciclo de reconhecimento/resultado, só libera a próxima fala.
          this.narrationInFlight = null;
          this.flushNarrationQueue();
        } else if (this.narrationInFlight === 'result') {
          // Resultado final: fecha o ciclo daquele pedido e libera uma nova
          // interação falada do Fê.
          this.narrationInFlight = null;
          this.awaitingResult = false;
          this.flushNarrationQueue();
        } else if (!this.awaitingResult) {
          // Esse turno foi o reconhecimento curto ("peraí, deixa eu ver").
          // Dispara o pipeline real com o que o Fê falou; a próxima fala do
          // Gemini só acontece quando sendResultText() for chamado por fora.
          const userText = this.pendingUserTranscript.trim();
          this.pendingUserTranscript = '';
          if (userText && !isPurelySocialTurn(userText)) {
            this.awaitingResult = true;
            this.config.onUserTurnReady?.(userText);
          }
        }
      }
      return;
    }

    if (msg.toolCall) {
      // Reservado para quando as ferramentas (Notion/memória) forem plugadas
      // como function declarations da Live API. Por ora, sem handler.
      console.warn('[GEMINI_LIVE_TOOL_CALL_UNHANDLED]', msg.toolCall);
    }
  }

  // ---- Captura de microfone (envio contínuo, full-duplex) ----

  private async startMic() {
    if (this.micStream) return;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    });

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.captureContext = new AudioContextCtor();
    if (this.captureContext.state === 'suspended') {
      await this.captureContext.resume();
    }

    this.captureSource = this.captureContext.createMediaStreamSource(this.micStream);
    // ScriptProcessorNode é deprecated mas universalmente suportado; migrar
    // pra AudioWorklet é melhoria futura, não bloqueante pra essa primeira versão.
    this.captureProcessor = this.captureContext.createScriptProcessor(4096, 1, 1);

    const nativeSampleRate = this.captureContext.sampleRate;

    this.captureProcessor.onaudioprocess = (event) => {
      if (this.state === 'error' || this.closedByUser) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleTo16k(input, nativeSampleRate);
      const base64 = base64FromInt16(pcm16);

      this.ws.send(JSON.stringify({
        realtimeInput: {
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
        }
      }));
    };

    // Destino de ganho zero: necessário no Safari pra manter o grafo de áudio vivo
    const silentGain = this.captureContext.createGain();
    silentGain.gain.setValueAtTime(0, this.captureContext.currentTime);
    this.captureSource.connect(this.captureProcessor);
    this.captureProcessor.connect(silentGain);
    silentGain.connect(this.captureContext.destination);
  }

  private teardownMic() {
    this.captureProcessor?.disconnect();
    this.captureSource?.disconnect();
    this.captureProcessor = null;
    this.captureSource = null;
    if (this.captureContext) {
      this.captureContext.close().catch(() => {});
      this.captureContext = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  // ---- Reprodução de áudio (PCM 24kHz, streaming, sem gaps) ----

  private ensurePlaybackContext(): AudioContext {
    if (!this.playbackContext) {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextCtor({ sampleRate: 24000 });
      this.nextPlaybackTime = this.playbackContext.currentTime;
    }
    return this.playbackContext;
  }

  private enqueuePlayback(base64: string) {
    const ctx = this.ensurePlaybackContext();
    const pcm16 = int16FromBase64(base64);

    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(this.nextPlaybackTime, ctx.currentTime);
    source.start(startTime);
    this.nextPlaybackTime = startTime + buffer.duration;

    this.pendingSources++;
    if (this.pendingSources === 1) {
      this.setState('speaking');
    }

    source.onended = () => {
      this.pendingSources--;
      if (this.pendingSources <= 0) {
        this.pendingSources = 0;
        this.maybeReturnToListening();
      }
    };
  }

  private maybeReturnToListening() {
    if (this.turnCompletePending && this.pendingSources === 0) {
      this.turnCompletePending = false;
      this.lastNarrationCompletedAt = Date.now();
      this.setState('listening');
      this.flushNarrationQueue();
      this.scheduleDeferredCheckpoint();
    }
  }

  private normalizeCheckpoint(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Um checkpoint só fala depois que a confirmação inicial assentou. Eventos
   * sucessivos se fundem no marco mais recente; resultado final sempre vence.
   */
  private scheduleDeferredCheckpoint() {
    if (!this.deferredCheckpointText || !this.awaitingResult) return;
    if (this.narrationQueue.some(item => item.kind === 'result') || this.narrationInFlight === 'result') return;
    // A confirmação inicial ainda está tocando: guarda o marco e só calcula
    // sua janela depois da fala terminar de fato.
    if (this.narrationInFlight || this.turnCompletePending || this.pendingSources > 0) return;
    if (this.checkpointTimer) clearTimeout(this.checkpointTimer);

    const now = Date.now();
    const firstEligibleAt = this.lastNarrationCompletedAt + GeminiLiveClient.FIRST_CHECKPOINT_DELAY_MS;
    const nextEligibleAt = this.lastCheckpointSpokenAt
      ? Math.max(firstEligibleAt, this.lastCheckpointSpokenAt + GeminiLiveClient.MIN_CHECKPOINT_GAP_MS)
      : firstEligibleAt;
    const delay = Math.max(0, nextEligibleAt - now);

    this.checkpointTimer = setTimeout(() => {
      this.checkpointTimer = null;
      const text = this.deferredCheckpointText;
      this.deferredCheckpointText = null;
      if (!text || !this.awaitingResult) return;
      if (this.narrationQueue.some(item => item.kind === 'result') || this.narrationInFlight === 'result') return;
      this.narrationQueue.push({ kind: 'checkpoint', text });
      this.lastCheckpointSpokenAt = Date.now();
      this.flushNarrationQueue();
    }, delay);
  }

  /** Envia uma fala pendente somente quando a fala anterior já terminou. */
  private flushNarrationQueue() {
    if (this.narrationInFlight || this.turnCompletePending || this.pendingSources > 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const next = this.narrationQueue.shift();
    if (!next) return;

    this.narrationInFlight = next.kind;
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: next.kind === 'result' ? `[RESULTADO] ${next.text}` : `[CHECKPOINT] ${next.text}` }]
        }],
        turnComplete: true
      }
    }));
  }

  private flushPlayback() {
    // Barge-in: os buffers já agendados vão tocar até o ponto atual e parar;
    // não temos handle individual pra cortar no meio, então só resetamos o
    // relógio de agendamento pra próxima resposta não empilhar atrás do áudio antigo.
    if (this.playbackContext) {
      this.nextPlaybackTime = this.playbackContext.currentTime;
    }
    this.pendingSources = 0;
    this.turnCompletePending = false;
  }

  /**
   * Injeta o resultado real (vindo do AgentOrchestrator) como uma fala que o
   * Gemini deve narrar de forma breve e natural — nunca literal. Só deve ser
   * chamado depois de onUserTurnReady disparar.
   */
  public sendResultText(resultText: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.deferredCheckpointText = null;
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    this.narrationQueue = this.narrationQueue.filter(item => item.kind !== 'checkpoint');
    this.narrationQueue.push({ kind: 'result', text: resultText });
    this.flushNarrationQueue();
    return true;
  }

  /**
   * Checkpoint intermediário durante um processo longo (ex: programar algo).
   * Não fecha o ciclo de awaitingResult — usa role 'user' com um marcador
   * diferente pra o Gemini narrar sem soltar o "aguardando resultado final".
   * Chamar só um de cada vez (espera o anterior terminar de falar) — vários
   * checkpoints em sequência rápida não são suportados ainda.
   */
  public sendCheckpointText(checkpointText: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const text = this.normalizeCheckpoint(checkpointText);
    if (!text || !this.awaitingResult) return false;

    const queuedCheckpoint = this.narrationQueue.find(item => item.kind === 'checkpoint');
    if (queuedCheckpoint) {
      queuedCheckpoint.text = text;
    } else {
      this.deferredCheckpointText = text;
    }
    this.scheduleDeferredCheckpoint();
    return true;
  }

  public isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public stop() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.checkpointTimer) clearTimeout(this.checkpointTimer);
    this.checkpointTimer = null;
    this.deferredCheckpointText = null;
    this.teardownMic();
    this.flushPlayback();
    if (this.playbackContext) {
      this.playbackContext.close().catch(() => {});
      this.playbackContext = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'client stop');
      this.ws = null;
    }
    this.setState('idle');
  }
}
