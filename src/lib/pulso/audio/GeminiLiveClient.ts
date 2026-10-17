/**
 * Cliente de voz-para-voz em tempo real usando a Gemini Live API, via o relay
 * WebSocket que mantém a chave no servidor (services/pulso-live-voice).
 *
 * Substitui, quando ativo, o pipeline turn-based (grava -> STT -> LLM -> TTS)
 * por uma sessão contínua: o microfone é transmitido em streaming e o áudio
 * de resposta chega e toca em pedaços, com barge-in detectado pelo próprio
 * Gemini (VAD do lado do servidor), sem precisar de RMS manual no cliente.
 */

import {
  createPresenceAudioWorkletSource,
  createRealtimeAudioEnvelope,
  PRESENCE_INPUT_SAMPLE_RATE,
  PRESENCE_PCM_FRAME_SAMPLES,
} from './PresenceAudioFrames';

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
   * Disparado quando a Live API fecha um turno de entrada e entrega a
   * transcrição. Toda fala segue para o pipeline canônico da Lótus, inclusive
   * conversa social. O áudio autônomo da Gemini fica restrito ao primeiro
   * reconhecimento curto; trabalho e resultado continuam sendo da Lótus.
   */
  onUserTurnStarted?: (turnId: string) => void;
  onUserTurnReady?: (turn: {
    turnId: string;
    userText: string;
    assistantText: string;
    socialOnly: boolean;
  }) => void;
  onAudioReceipt?: (receipt: PresenceAudioReceipt) => void;
}

export type PresenceAudioReceiptPhase =
  | 'playback_context_ready'
  | 'socket_open'
  | 'setup_complete'
  | 'mic_open'
  | 'audio_worklet_ready'
  | 'first_pcm_frame'
  | 'first_ws_frame'
  | 'input_transcript'
  | 'turn_closed'
  | 'first_output_audio'
  | 'playback_started'
  | 'capture_watchdog_failed'
  | 'canonical_dispatch_started'
  | 'canonical_routing_fallback'
  | 'canonical_request_created'
  | 'canonical_dispatch_failed'
  | 'canonical_result_received';

export interface PresenceAudioReceipt {
  sessionId: string;
  phase: PresenceAudioReceiptPhase;
  elapsedMs: number;
  turnId?: string;
  requestId?: string;
  frameCount?: number;
  bytes?: number;
  sampleRate?: number;
  contextState?: AudioContextState;
  failureStage?: 'routing' | 'canonical_dispatch';
  failureCode?: string;
}

export interface PresenceQuickReadResult {
  requestId: string;
  ok: boolean;
  capability?: string;
  responseText?: string;
  itemCount?: number;
  durationMs?: number;
  errorCode?: string;
}

type NarrationKind = 'acknowledgement' | 'checkpoint' | 'result';

interface NarrationItem {
  kind: NarrationKind;
  text: string;
  turnId: string;
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
  if (!normalized) return false;
  const remainder = normalized
    .replace(/\b(bom dia|boa tarde|boa noite|tudo bem|como vai|como voce esta|e voce|salve salve|ate logo|ate mais)\b/g, ' ')
    .replace(/\b(oi|ola|obrigado|obrigada|valeu|tchau|beleza)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return remainder.length === 0;
}

export class GeminiLiveClient {
  private config: GeminiLiveConfig;
  private ws: WebSocket | null = null;
  private state: GeminiLiveState = 'idle';

  // Captura de microfone
  private micStream: MediaStream | null = null;
  private captureContext: AudioContext | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  private captureProcessor: AudioWorkletNode | null = null;
  private captureSilentGain: GainNode | null = null;
  private captureWatchdog: ReturnType<typeof setTimeout> | null = null;
  private pcmFrameCount = 0;
  private pcmBytesSent = 0;
  private firstPcmFrameSeen = false;
  private firstWsFrameSent = false;
  private captureFramesSuppressedUntil = 0;
  private deepCueSuppressionTimer: ReturnType<typeof setTimeout> | null = null;
  private deepWorkPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private deepWorkPulseTurnId: string | null = null;
  private deepWorkPulseStartedAt = 0;
  private deepWorkPulsePaused = false;

  // Reprodução de áudio (PCM 24kHz vindo do Gemini)
  private playbackContext: AudioContext | null = null;
  private nextPlaybackTime = 0;
  private pendingSources = 0;
  private turnCompletePending = false;
  private playbackSources = new Set<AudioBufferSourceNode>();
  private deepWorkPulseSources = new Set<AudioBufferSourceNode>();
  private playbackGeneration = 0;
  private firstOutputAudioSeen = false;
  private firstPlaybackStarted = false;
  private transcriptReceiptTurnId: string | null = null;

  // Observabilidade local: metadados apenas, nunca áudio ou transcrição.
  private readonly receiptSessionId = `presence_audio_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  private readonly receiptStartedAt = Date.now();

  // Orquestração reconhecimento -> backend real -> narração do resultado
  private pendingUserTranscript = '';
  private pendingAssistantTranscript = '';
  private inputTurnFinalizeTimer: ReturnType<typeof setTimeout> | null = null;
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
  private checkpointSpokenCount = 0;

  // Equivale ao soft timeout recomendado para conversa: presença cedo, sem
  // virar relógio. O espaçamento longo vale apenas entre marcos posteriores.
  private static readonly FIRST_CHECKPOINT_DELAY_MS = 6_000;
  private static readonly MIN_CHECKPOINT_GAP_MS = 12_000;
  private static readonly MAX_SPOKEN_CHECKPOINTS = 3;
  private static readonly DEEP_PULSE_GAP_MS = 2_900;
  private static readonly DEEP_PULSE_MAX_MS = 90_000;

  private closedByUser = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_RECONNECT_ATTEMPTS = 2;
  private pendingQuickReads = new Map<string, {
    resolve: (result: PresenceQuickReadResult) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

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

  public start() {
    this.closedByUser = false;
    this.reconnectAttempts = 0;
    // Criar/retomar o contexto ainda dentro do gesto que abriu a Presença
    // evita o downlink silencioso por autoplay no WKWebView.
    try {
      const playbackContext = this.ensurePlaybackContext();
      if (playbackContext.state === 'suspended') {
        void playbackContext.resume()
          .then(() => this.receipt('playback_context_ready', { contextState: playbackContext.state }))
          .catch((error) => console.warn('[GEMINI_LIVE_PLAYBACK_CONTEXT_RESUME_FAILED]', error));
      } else {
        this.receipt('playback_context_ready', { contextState: playbackContext.state });
      }
    } catch (error) {
      console.warn('[GEMINI_LIVE_PLAYBACK_CONTEXT_PREPARE_FAILED]', error);
    }
    this.openSocket();
  }

  private receipt(
    phase: PresenceAudioReceiptPhase,
    details: Omit<PresenceAudioReceipt, 'sessionId' | 'phase' | 'elapsedMs'> = {},
  ) {
    const receipt: PresenceAudioReceipt = {
      sessionId: this.receiptSessionId,
      phase,
      elapsedMs: Date.now() - this.receiptStartedAt,
      ...details,
    };
    if (this.config.onAudioReceipt) {
      this.config.onAudioReceipt(receipt);
    } else {
      console.log('[PRESENCE_AUDIO_RECEIPT]', JSON.stringify(receipt));
    }
  }

  public recordCanonicalReceipt(
    phase: Extract<PresenceAudioReceiptPhase,
      | 'canonical_dispatch_started'
      | 'canonical_routing_fallback'
      | 'canonical_request_created'
      | 'canonical_dispatch_failed'
      | 'canonical_result_received'>,
    details: Pick<PresenceAudioReceipt, 'turnId' | 'requestId' | 'failureStage' | 'failureCode'> = {},
  ) {
    this.receipt(phase, details);
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
      this.receipt('socket_open');
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
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            // O default do servidor gira em torno de 800 ms. 600 ms reduz a
            // espera percebida sem fragmentar pausas naturais da fala.
            prefixPaddingMs: 40,
            silenceDurationMs: 600,
          },
        },
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

    if (msg.quickReadResult) {
      const result = msg.quickReadResult as PresenceQuickReadResult;
      const pending = this.pendingQuickReads.get(result.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pendingQuickReads.delete(result.requestId);
      pending.resolve(result);
      return;
    }

    if (msg.setupComplete) {
      console.log('[GEMINI_LIVE_SETUP_COMPLETE]');
      this.receipt('setup_complete');
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
        if (!this.pendingUserTranscript) {
          this.beginUserTurn();
        }
        if (this.transcriptReceiptTurnId !== this.activeTurnId) {
          this.transcriptReceiptTurnId = this.activeTurnId;
          this.receipt('input_transcript', { turnId: this.activeTurnId ?? undefined });
        }
        this.pendingUserTranscript += sc.inputTranscription.text;
        this.config.onTranscript?.('user', sc.inputTranscription.text);
        // `inputTranscription` e `turnComplete` não têm ordem garantida. Este
        // watchdog fecha o turno mesmo quando a transcrição final chega depois
        // do marcador; `turnComplete` ainda encurta a espera para 100 ms.
        this.scheduleInputTurnFinalization(850);
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
          this.scheduleInputTurnFinalization(220);
          return;
        }
        if (interruptedKind === 'result') {
          this.awaitingResult = false;
          this.stopDeepWorkPulse();
        } else if (interruptedKind === 'checkpoint') {
          this.resumeDeepWorkPulse();
        }
        this.narrationQueue = [];
        this.deferredCheckpointText = null;
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
          if (!this.firstOutputAudioSeen) {
            this.firstOutputAudioSeen = true;
            this.receipt('first_output_audio', { turnId: this.activeTurnId ?? undefined });
          }
          if (this.narrationInFlight) {
            this.enqueuePlayback(p.inlineData.data);
          } else {
            // A primeira fala do Gemini é somente uma confirmação curta,
            // limitada pela instrução de sistema. Tocar o streaming agora
            // evita esperar uma segunda geração só para dizer “estou vendo”.
            // Conteúdo substantivo continua vindo exclusivamente da Lótus.
            this.enqueuePlayback(p.inlineData.data);
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
          this.resumeDeepWorkPulse();
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
          this.receipt('turn_closed', { turnId: this.activeTurnId ?? undefined });
          this.turnCompletePending = true;
          this.scheduleInputTurnFinalization(100);
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

  private scheduleInputTurnFinalization(delayMs: number) {
    if (this.inputTurnFinalizeTimer) clearTimeout(this.inputTurnFinalizeTimer);
    this.inputTurnFinalizeTimer = setTimeout(() => {
      this.inputTurnFinalizeTimer = null;
      this.finalizeInputTurn();
    }, delayMs);
  }

  private finalizeInputTurn() {
    const userText = this.pendingUserTranscript.trim();
    const assistantText = this.pendingAssistantTranscript.trim();
    this.pendingUserTranscript = '';
    this.pendingAssistantTranscript = '';

    if (userText) {
      const turnId = this.activeTurnId || this.createTurnId();
      this.awaitingResult = true;
      this.checkpointSpokenCount = 0;
      this.lastCheckpointSpokenAt = 0;
      // Toda fala entra no fluxo canônico, inclusive saudações. O áudio curto
      // já começou a tocar em streaming; não geramos uma segunda confirmação.
      this.config.onUserTurnReady?.({
        turnId,
        userText,
        assistantText,
        socialOnly: isPurelySocialTurn(userText),
      });
      return;
    }

    this.setState('listening');
  }

  private beginUserTurn() {
    const turnId = this.createTurnId();
    this.activeTurnId = turnId;
    this.stopDeepWorkPulse();
    this.awaitingResult = false;
    this.narrationQueue = [];
    this.narrationInFlight = null;
    this.deferredCheckpointText = null;
    this.checkpointSpokenCount = 0;
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

  // ---- Captura de microfone (envio contínuo, full-duplex) ----

  private async startMic() {
    if (this.micStream) return;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    });
    this.receipt('mic_open');

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.captureContext = new AudioContextCtor();
    if (this.captureContext.state === 'suspended') {
      await this.captureContext.resume();
    }

    this.captureSource = this.captureContext.createMediaStreamSource(this.micStream);
    if (!this.captureContext.audioWorklet) {
      throw new Error('AudioWorklet indisponível neste WebView.');
    }

    const workletUrl = URL.createObjectURL(new Blob(
      [createPresenceAudioWorkletSource()],
      { type: 'application/javascript' },
    ));
    try {
      await this.captureContext.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    this.captureProcessor = new AudioWorkletNode(this.captureContext, 'pulso-presence-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        targetSampleRate: PRESENCE_INPUT_SAMPLE_RATE,
        frameSamples: PRESENCE_PCM_FRAME_SAMPLES,
      },
    });
    this.receipt('audio_worklet_ready', {
      sampleRate: this.captureContext.sampleRate,
      contextState: this.captureContext.state,
    });

    this.captureProcessor.port.onmessage = (event: MessageEvent<{ type?: string; buffer?: ArrayBuffer }>) => {
      if (event.data?.type !== 'pcm16' || !event.data.buffer) return;
      const pcm16 = new Int16Array(event.data.buffer);
      this.pcmFrameCount += 1;
      if (!this.firstPcmFrameSeen) {
        this.firstPcmFrameSeen = true;
        if (this.captureWatchdog) clearTimeout(this.captureWatchdog);
        this.captureWatchdog = null;
        this.receipt('first_pcm_frame', {
          frameCount: this.pcmFrameCount,
          bytes: pcm16.byteLength,
          sampleRate: PRESENCE_INPUT_SAMPLE_RATE,
        });
      }

      if (this.state === 'error' || this.closedByUser) return;
      if (Date.now() < this.captureFramesSuppressedUntil) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      // O relay limita filas; não acumulamos áudio indefinidamente se a rede
      // deixar de drenar o WebSocket.
      if (this.ws.bufferedAmount > 512 * 1024) return;

      this.ws.send(JSON.stringify(createRealtimeAudioEnvelope(pcm16)));
      this.pcmBytesSent += pcm16.byteLength;
      if (!this.firstWsFrameSent) {
        this.firstWsFrameSent = true;
        this.receipt('first_ws_frame', {
          frameCount: this.pcmFrameCount,
          bytes: this.pcmBytesSent,
          sampleRate: PRESENCE_INPUT_SAMPLE_RATE,
        });
      }
    };

    this.captureWatchdog = setTimeout(() => {
      if (this.firstPcmFrameSeen || this.closedByUser) return;
      this.receipt('capture_watchdog_failed', {
        contextState: this.captureContext?.state,
      });
      this.config.onError('O microfone abriu, mas a captura de áudio não iniciou.');
      this.setState('error');
      this.ws?.close(1011, 'capture watchdog failed');
    }, 2_000);

    // Destino de ganho zero mantém o grafo vivo no WKWebView sem realimentar
    // o microfone com a própria captura.
    const silentGain = this.captureContext.createGain();
    this.captureSilentGain = silentGain;
    silentGain.gain.setValueAtTime(0, this.captureContext.currentTime);
    this.captureSource.connect(this.captureProcessor);
    this.captureProcessor.connect(silentGain);
    silentGain.connect(this.captureContext.destination);
  }

  private teardownMic() {
    if (this.captureWatchdog) clearTimeout(this.captureWatchdog);
    this.captureWatchdog = null;
    if (this.captureProcessor) this.captureProcessor.port.onmessage = null;
    this.captureProcessor?.disconnect();
    this.captureSilentGain?.disconnect();
    this.captureSource?.disconnect();
    this.captureProcessor = null;
    this.captureSilentGain = null;
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

  /**
   * Assinatura curta da PULSO: indica que o pedido saiu do reflexo/consulta
   * direta e entrou em trabalho profundo. É local, imediata e não depende de
   * geração de voz. Os frames do microfone são brevemente suprimidos para o
   * próprio sinal não voltar como fala do usuário.
   */
  private emitDeepWorkPulse(turnId: string) {
    if (turnId !== this.activeTurnId || !this.awaitingResult || this.deepWorkPulsePaused) return;
    if (this.narrationInFlight || this.pendingSources > 0 || this.turnCompletePending) {
      this.scheduleDeepWorkPulse(700);
      return;
    }
    const ctx = this.ensurePlaybackContext();
    const now = Math.max(ctx.currentTime, this.nextPlaybackTime) + 0.03;
    const waitMs = Math.max(0, (now - ctx.currentTime) * 1_000);
    if (this.deepCueSuppressionTimer) clearTimeout(this.deepCueSuppressionTimer);
    this.deepCueSuppressionTimer = setTimeout(() => {
      this.deepCueSuppressionTimer = null;
      this.captureFramesSuppressedUntil = Date.now() + 760;
    }, waitMs);

    const durationSeconds = 0.62;
    const sampleRate = 24_000;
    const sampleCount = Math.round(durationSeconds * sampleRate);
    const buffer = ctx.createBuffer(1, sampleCount, sampleRate);
    const channel = buffer.getChannelData(0);
    const notes = [174.61, 261.63, 392];
    for (let index = 0; index < sampleCount; index += 1) {
      const time = index / sampleRate;
      const attack = Math.min(1, time / 0.025);
      const release = Math.max(0, 1 - time / durationSeconds);
      const chord = notes.reduce((sum, frequency, noteIndex) => {
        const delayedTime = Math.max(0, time - noteIndex * 0.045);
        if (delayedTime === 0 && time < noteIndex * 0.045) return sum;
        return sum + Math.sin(2 * Math.PI * frequency * delayedTime) * (noteIndex === 0 ? 0.55 : 0.22);
      }, 0);
      const breath = 0.82 + Math.sin(2 * Math.PI * 1.7 * time) * 0.18;
      channel[index] = chord * attack * release * release * breath * 0.12;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    this.playbackSources.add(source);
    this.deepWorkPulseSources.add(source);
    source.onended = () => {
      this.playbackSources.delete(source);
      this.deepWorkPulseSources.delete(source);
    };
    source.start(now);
    this.nextPlaybackTime = now + durationSeconds;
    void ctx.resume().catch(() => {});
    this.scheduleDeepWorkPulse(GeminiLiveClient.DEEP_PULSE_GAP_MS);
  }

  private scheduleDeepWorkPulse(delayMs: number) {
    if (this.deepWorkPulseTimer) clearTimeout(this.deepWorkPulseTimer);
    const turnId = this.deepWorkPulseTurnId;
    if (!turnId || this.deepWorkPulsePaused) return;
    if (Date.now() - this.deepWorkPulseStartedAt >= GeminiLiveClient.DEEP_PULSE_MAX_MS) return;
    this.deepWorkPulseTimer = setTimeout(() => {
      this.deepWorkPulseTimer = null;
      this.emitDeepWorkPulse(turnId);
    }, delayMs);
  }

  public startDeepWorkPulse(turnId = this.activeTurnId) {
    if (!turnId || turnId !== this.activeTurnId || !this.awaitingResult) return false;
    this.stopDeepWorkPulse();
    this.deepWorkPulseTurnId = turnId;
    this.deepWorkPulseStartedAt = Date.now();
    this.deepWorkPulsePaused = false;
    this.emitDeepWorkPulse(turnId);
    return true;
  }

  /** Compatibilidade com recibos/testes anteriores. */
  public playDeepWorkCue(turnId = this.activeTurnId) {
    return this.startDeepWorkPulse(turnId);
  }

  private pauseDeepWorkPulse() {
    if (!this.deepWorkPulseTurnId) return;
    this.deepWorkPulsePaused = true;
    if (this.deepWorkPulseTimer) clearTimeout(this.deepWorkPulseTimer);
    this.deepWorkPulseTimer = null;
    for (const source of this.deepWorkPulseSources) {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
      this.playbackSources.delete(source);
    }
    this.deepWorkPulseSources.clear();
    if (this.playbackContext) this.nextPlaybackTime = this.playbackContext.currentTime;
  }

  private resumeDeepWorkPulse() {
    if (!this.deepWorkPulseTurnId || !this.awaitingResult) return;
    this.deepWorkPulsePaused = false;
    this.scheduleDeepWorkPulse(1_400);
  }

  private stopDeepWorkPulse() {
    if (this.deepWorkPulseTimer) clearTimeout(this.deepWorkPulseTimer);
    this.deepWorkPulseTimer = null;
    this.deepWorkPulseTurnId = null;
    this.deepWorkPulseStartedAt = 0;
    this.deepWorkPulsePaused = false;
    for (const source of this.deepWorkPulseSources) {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
      this.playbackSources.delete(source);
    }
    this.deepWorkPulseSources.clear();
    if (this.playbackContext) this.nextPlaybackTime = this.playbackContext.currentTime;
  }

  public requestQuickRead(
    capability: string,
    args: Record<string, unknown>,
    timeoutMs = 5_000,
  ): Promise<PresenceQuickReadResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve({ requestId: '', ok: false, errorCode: 'relay_unavailable' });
    }
    const requestId = `quick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pendingQuickReads.delete(requestId);
        resolve({ requestId, ok: false, errorCode: 'quick_read_timeout' });
      }, timeoutMs);
      this.pendingQuickReads.set(requestId, { resolve, timer });
      this.ws?.send(JSON.stringify({ quickRead: { requestId, capability, args } }));
    });
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
    const markPlaybackStarted = () => {
      if (this.firstPlaybackStarted) return;
      this.firstPlaybackStarted = true;
      this.receipt('playback_started', {
        turnId: this.activeTurnId ?? undefined,
        contextState: ctx.state,
      });
    };
    if (ctx.state === 'running') {
      markPlaybackStarted();
    } else {
      void ctx.resume()
        .then(markPlaybackStarted)
        .catch((error) => console.warn('[GEMINI_LIVE_PLAYBACK_RESUME_FAILED]', error));
    }
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
    if (this.checkpointSpokenCount >= GeminiLiveClient.MAX_SPOKEN_CHECKPOINTS) return;
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
      if (this.checkpointSpokenCount >= GeminiLiveClient.MAX_SPOKEN_CHECKPOINTS) return;
      if (this.narrationQueue.some(item => item.kind === 'result') || this.narrationInFlight?.kind === 'result') return;
      const turnId = this.activeTurnId;
      if (!turnId) return;
      this.narrationQueue.push({ kind: 'checkpoint', text, turnId });
      this.lastCheckpointSpokenAt = Date.now();
      this.checkpointSpokenCount += 1;
      this.pauseDeepWorkPulse();
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
    this.stopDeepWorkPulse();
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
   * Uma saudação já recebeu resposta no primeiro áudio do Gemini. O pedido
   * continua canônico e pesquisável, mas o retorno do backend não precisa ser
   * falado uma segunda vez.
   */
  public completeResultSilently(turnId = this.activeTurnId) {
    if (!turnId || turnId !== this.activeTurnId || !this.awaitingResult) return false;
    this.awaitingResult = false;
    this.stopDeepWorkPulse();
    this.deferredCheckpointText = null;
    this.narrationQueue = [];
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    this.maybeReturnToListening();
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
    if (this.checkpointSpokenCount >= GeminiLiveClient.MAX_SPOKEN_CHECKPOINTS) return false;

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
    if (this.deepCueSuppressionTimer) clearTimeout(this.deepCueSuppressionTimer);
    this.deepCueSuppressionTimer = null;
    this.stopDeepWorkPulse();
    this.deferredCheckpointText = null;
    for (const [requestId, pending] of this.pendingQuickReads) {
      clearTimeout(pending.timer);
      pending.resolve({ requestId, ok: false, errorCode: 'client_stopped' });
    }
    this.pendingQuickReads.clear();
    this.activeTurnId = null;
    this.pendingUserTranscript = '';
    this.pendingAssistantTranscript = '';
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
