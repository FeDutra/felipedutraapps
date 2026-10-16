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
  getAccessToken: () => Promise<string | null>;
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
  onUserTurnStarted?: (turnId: string) => void;
  onUserTurnReady?: (turn: { turnId: string; userText: string }) => void;
}

type NarrationKind = 'acknowledgement' | 'checkpoint' | 'result';

interface NarrationItem {
  kind: NarrationKind;
  text: string;
  turnId: string;
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
  private playbackSources = new Set<AudioBufferSourceNode>();
  private playbackGeneration = 0;

  // Orquestração reconhecimento -> backend real -> narração do resultado
  private pendingUserTranscript = '';
  private pendingAssistantTranscript = '';
  private bufferedAutonomousAudio: string[] = [];
  private inputTurnFinalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private inputTurnMayUseAutonomousAudio = false;
  private awaitingResult = false;
  private turnSequence = 0;
  private activeTurnId: string | null = null;
  /**
   * A Live API aceita novos turnos enquanto reproduz áudio, mas não garante
   * a ordem deles. Para presença, ordem é presença: a confirmação curta vem
   * primeiro; checkpoints e resultado entram depois, sem se atropelarem nem
   * desaparecerem durante uma fala em curso.
   */
  private narrationQueue: NarrationItem[] = [];
  private narrationInFlight: NarrationItem | null = null;
  /** O chat pode produzir muitos eventos; a voz precisa de marcos, não de logs. */
  private deferredCheckpointText: string | null = null;
  private checkpointTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNarrationCompletedAt = 0;
  private lastCheckpointSpokenAt = 0;
  private checkpointSpokenThisTurn = false;

  // Equivale ao soft timeout recomendado para conversa: presença cedo, sem
  // virar relógio. O espaçamento longo vale apenas entre marcos posteriores.
  private static readonly FIRST_CHECKPOINT_DELAY_MS = 12_000;
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

    this.ws.onopen = async () => {
      console.log('[GEMINI_LIVE_RELAY_OPEN]');
      try {
        const firebaseIdToken = await this.config.getAccessToken();
        if (!firebaseIdToken) throw new Error('Sessão PULSO sem autenticação.');
        this.ws?.send(JSON.stringify({ auth: { firebaseIdToken } }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : null;
        this.config.onError(message || 'Falha ao autenticar a conversa em tempo real.');
        this.setState('error');
        this.ws?.close(1008, 'auth unavailable');
      }
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

    if (msg.authComplete) {
      console.log('[GEMINI_LIVE_AUTH_COMPLETE]');
      this.sendSetup();
      return;
    }

    if (msg.authError) {
      this.config.onError('Sessão de voz não autorizada.');
      this.setState('error');
      this.ws?.close(1008, 'auth rejected');
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

      // A Live API pode entregar inputTranscription no mesmo pacote que marca
      // uma interrupção. A transcrição precisa ser preservada antes de tratar
      // o cancelamento da resposta autônoma; caso contrário o pedido inteiro
      // desaparece sem chegar à Lótus.
      if (sc.inputTranscription?.text) {
        const interruptedTurnWasWaitingForTranscript = Boolean(this.inputTurnFinalizeTimer);
        if (!this.pendingUserTranscript) {
          this.beginUserTurn();
        }
        this.pendingUserTranscript += sc.inputTranscription.text;
        this.config.onTranscript?.('user', sc.inputTranscription.text);
        if (interruptedTurnWasWaitingForTranscript || this.inputTurnFinalizeTimer) {
          this.scheduleInputTurnFinalization(this.inputTurnMayUseAutonomousAudio, 180);
        }
      }

      if (sc.interrupted) {
        console.log('[GEMINI_LIVE_INTERRUPTED]');
        this.flushPlayback();
        // Um barge-in durante a narração de um checkpoint/resultado corta o
        // turno sem nunca mandar turnComplete — sem isso, narrationInFlight
        // ficava preso pra sempre e travava toda fala seguinte (incluindo
        // resultados reais, que o chamador achava terem sido narrados).
        const interruptedKind = this.narrationInFlight?.kind;
        this.narrationInFlight = null;
        if (!interruptedKind) {
          // A resposta espontânea do Gemini foi interrompida, não o pedido do
          // Fê. Fecha o turno a partir da transcrição já recebida ou espera
          // brevemente caso o fragmento de transcrição venha no pacote logo
          // seguinte ao marcador de interrupção.
          this.pendingAssistantTranscript = '';
          this.bufferedAutonomousAudio = [];
          this.scheduleInputTurnFinalization(false, 220);
          return;
        }
        if (interruptedKind === 'result') {
          this.awaitingResult = false;
        }
        this.narrationQueue = [];
        this.deferredCheckpointText = null;
        this.bufferedAutonomousAudio = [];
        this.pendingAssistantTranscript = '';
        this.setState('listening');
        return;
      }

      if (sc.outputTranscription?.text) {
        if (this.narrationInFlight) {
          this.config.onTranscript?.('assistant', sc.outputTranscription.text);
        } else {
          // A resposta espontânea do Gemini ao microfone nunca é publicada
          // antes de sabermos se o turno é social ou operacional.
          this.pendingAssistantTranscript += sc.outputTranscription.text;
        }
      }

      const parts = sc.modelTurn?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          if (this.narrationInFlight) {
            this.enqueuePlayback(p.inlineData.data);
          } else {
            // Retém o áudio autônomo do turno de entrada. Em pedidos
            // operacionais ele será descartado para que apenas a Lótus fale.
            this.bufferedAutonomousAudio.push(p.inlineData.data);
          }
        }
      }

      if (sc.turnComplete) {
        if (this.narrationInFlight?.kind === 'checkpoint') {
          // Checkpoint narrado no meio de um processo longo — não mexe no
          // ciclo de reconhecimento/resultado, só libera a próxima fala.
          this.narrationInFlight = null;
          this.turnCompletePending = true;
          this.maybeReturnToListening();
          this.flushNarrationQueue();
        } else if (this.narrationInFlight?.kind === 'acknowledgement') {
          this.narrationInFlight = null;
          this.turnCompletePending = true;
          this.maybeReturnToListening();
          this.flushNarrationQueue();
        } else if (this.narrationInFlight?.kind === 'result') {
          // Resultado final: fecha o ciclo daquele pedido e libera uma nova
          // interação falada do Fê.
          this.narrationInFlight = null;
          this.awaitingResult = false;
          this.turnCompletePending = true;
          this.maybeReturnToListening();
          this.flushNarrationQueue();
        } else {
          // Algumas versões da Live API fecham o turno antes do último
          // fragmento de inputTranscription. Um debounce curto evita perder a
          // cauda sem adicionar latência perceptível à conversa.
          this.scheduleInputTurnFinalization(true, 100);
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

  private createTurnId() {
    this.turnSequence += 1;
    return `voice_${Date.now()}_${this.turnSequence}`;
  }

  private scheduleInputTurnFinalization(mayUseAutonomousAudio: boolean, delayMs: number) {
    this.inputTurnMayUseAutonomousAudio = mayUseAutonomousAudio;
    if (this.inputTurnFinalizeTimer) clearTimeout(this.inputTurnFinalizeTimer);
    this.inputTurnFinalizeTimer = setTimeout(() => {
      this.inputTurnFinalizeTimer = null;
      this.finalizeInputTurn(this.inputTurnMayUseAutonomousAudio);
    }, delayMs);
  }

  private finalizeInputTurn(mayUseAutonomousAudio: boolean) {
    const userText = this.pendingUserTranscript.trim();
    const assistantText = this.pendingAssistantTranscript.trim();
    const autonomousAudio = mayUseAutonomousAudio ? this.bufferedAutonomousAudio : [];
    this.pendingUserTranscript = '';
    this.pendingAssistantTranscript = '';
    this.bufferedAutonomousAudio = [];

    if (userText && isPurelySocialTurn(userText) && autonomousAudio.length > 0) {
      if (assistantText) this.config.onTranscript?.('assistant', assistantText);
      this.turnCompletePending = true;
      autonomousAudio.forEach(chunk => this.enqueuePlayback(chunk));
      this.maybeReturnToListening();
      return;
    }

    if (userText) {
      const turnId = this.activeTurnId || this.createTurnId();
      this.awaitingResult = true;
      this.checkpointSpokenThisTurn = false;
      this.lastCheckpointSpokenAt = 0;
      this.config.onUserTurnReady?.({ turnId, userText });
      this.queueAcknowledgement(turnId, userText);
      return;
    }

    this.setState('listening');
  }

  private beginUserTurn() {
    const turnId = this.createTurnId();
    this.activeTurnId = turnId;
    this.awaitingResult = false;
    this.narrationQueue = [];
    this.narrationInFlight = null;
    this.deferredCheckpointText = null;
    this.checkpointSpokenThisTurn = false;
    this.lastCheckpointSpokenAt = 0;
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    if (this.inputTurnFinalizeTimer) {
      clearTimeout(this.inputTurnFinalizeTimer);
      this.inputTurnFinalizeTimer = null;
    }
    this.flushPlayback();
    this.config.onUserTurnStarted?.(turnId);
  }

  private queueAcknowledgement(turnId: string, userText: string) {
    if (turnId !== this.activeTurnId) return;
    this.narrationQueue.push({
      kind: 'acknowledgement',
      turnId,
      text: userText,
    });
    this.flushNarrationQueue();
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
    const generation = this.playbackGeneration;
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
    this.playbackSources.add(source);

    const startTime = Math.max(this.nextPlaybackTime, ctx.currentTime);
    source.start(startTime);
    this.nextPlaybackTime = startTime + buffer.duration;

    this.pendingSources++;
    if (this.pendingSources === 1) {
      this.setState('speaking');
    }

    source.onended = () => {
      this.playbackSources.delete(source);
      if (generation !== this.playbackGeneration) return;
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
    if (this.checkpointSpokenThisTurn) return;
    if (this.narrationQueue.some(item => item.kind === 'result') || this.narrationInFlight?.kind === 'result') return;
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
      if (this.checkpointSpokenThisTurn) return;
      if (this.narrationQueue.some(item => item.kind === 'result') || this.narrationInFlight?.kind === 'result') return;
      const turnId = this.activeTurnId;
      if (!turnId) return;
      this.narrationQueue.push({ kind: 'checkpoint', text, turnId });
      this.lastCheckpointSpokenAt = Date.now();
      this.checkpointSpokenThisTurn = true;
      this.flushNarrationQueue();
    }, delay);
  }

  /** Envia uma fala pendente somente quando a fala anterior já terminou. */
  private flushNarrationQueue() {
    if (this.narrationInFlight || this.turnCompletePending || this.pendingSources > 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const next = this.narrationQueue.shift();
    if (!next) return;
    if (next.turnId !== this.activeTurnId) {
      this.flushNarrationQueue();
      return;
    }

    this.narrationInFlight = next;
    const marker = next.kind === 'result'
      ? '[RESULTADO]'
      : next.kind === 'checkpoint'
        ? '[CHECKPOINT]'
        : '[CONFIRMAÇÃO]';
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: `${marker} ${next.text}` }]
        }],
        turnComplete: true
      }
    }));
  }

  private flushPlayback() {
    // Barge-in real: cada AudioBufferSourceNode agendado é retido para poder
    // ser interrompido. Apenas zerar o relógio deixa áudio antigo tocando.
    this.playbackGeneration += 1;
    for (const source of this.playbackSources) {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    }
    this.playbackSources.clear();
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
  public sendResultText(resultText: string, turnId = this.activeTurnId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (!turnId || turnId !== this.activeTurnId || !this.awaitingResult) return false;
    this.deferredCheckpointText = null;
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    this.narrationQueue = [];
    this.narrationQueue.push({ kind: 'result', text: resultText, turnId });
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
  public sendCheckpointText(checkpointText: string, turnId = this.activeTurnId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (!turnId || turnId !== this.activeTurnId) return false;
    const text = this.normalizeCheckpoint(checkpointText);
    if (!text || !this.awaitingResult) return false;
    if (this.checkpointSpokenThisTurn) return false;

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
    if (this.inputTurnFinalizeTimer) clearTimeout(this.inputTurnFinalizeTimer);
    this.inputTurnFinalizeTimer = null;
    this.deferredCheckpointText = null;
    this.activeTurnId = null;
    this.pendingUserTranscript = '';
    this.pendingAssistantTranscript = '';
    this.bufferedAutonomousAudio = [];
    this.narrationQueue = [];
    this.narrationInFlight = null;
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
