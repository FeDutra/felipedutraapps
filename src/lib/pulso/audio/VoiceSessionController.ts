import { TTSAdapter } from '../TTSAdapter';
import {
  GeminiLiveClient,
  GeminiLiveState,
  PresenceAudioReceipt,
} from './GeminiLiveClient';
import { getGeminiLiveConfig } from './PresenceTransport';
import { executeLocalPresenceFastPath, LocalPresenceFastPathResult } from '../actions/localPresenceFastPath';
import type { PresenceRoutingDecision } from '../presence/PresenceCognitiveRouter';
import { classifyPresenceWork, PresenceWorkDecision } from '../presence/PresenceWorkRouter';
import { encodePcmWav } from './pcmWav';
import {
  PresenceNarrationKind,
  PresenceTurnEvent,
  PresenceTurnMachine,
} from './PresenceTurnMachine';

export type VoiceSessionState =
  | 'idle'
  | 'starting'
  | 'presence_listening'
  | 'user_speaking'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface VoiceSessionConfig {
  onStateChange: (state: VoiceSessionState) => void;
  onTextReceived: (userText: string, assistantText: string) => void;
  onError: (error: string) => void;
  /** Mantém a Orbe viva visualmente enquanto o cérebro da Lótus trabalha. */
  onPresenceWorkChange?: (working: boolean) => void;
  activeContextNode: { contextId: string; areaId: string; chatId: string };
  handleSendMessage: (text: string, options: {
    originMode: 'presence';
    targetContextNode?: PresenceRoutingDecision['target'];
    presenceRouting?: PresenceRoutingDecision;
  }) => Promise<{ responseText?: string; requestId?: string } | null | void>;
  recordLocalFastPath?: (text: string, result: LocalPresenceFastPathResult) => Promise<void>;
  handlePresenceUiIntent?: (text: string) => Promise<LocalPresenceFastPathResult> | LocalPresenceFastPathResult;
  routePresenceIntent?: (text: string) => Promise<PresenceRoutingDecision> | PresenceRoutingDecision;
  /**
   * Modo experimental: usa a Gemini Live API (voz-para-voz em streaming via
   * relay próprio) em vez do pipeline turn-based. A Gemini é somente a camada
   * de voz; pedidos e ferramentas seguem pelo fluxo canônico da Lótus.
   */
  useGeminiLive?: boolean;
  getGeminiAccessToken?: () => Promise<string | null>;
}

export interface PresenceNarrationContext {
  turnId?: string;
  requestId?: string;
  kind?: PresenceNarrationKind;
}

const PRESENCE_AUDIO_RECEIPTS_STORAGE_KEY = 'pulso_presence_audio_receipts_v1';
const MAX_PRESENCE_AUDIO_RECEIPTS = 120;

const GEMINI_LIVE_SYSTEM_INSTRUCTION = `Você é a voz da Lótus falando com o Fê (Felipe Dutra) em português do Brasil, no modo Presença.

Regra mais importante: você NÃO tem acesso a nenhuma informação real, ferramenta, memória ou dado — quem responde de verdade é outro sistema, por trás. Você nunca inventa fatos nem responde perguntas com conteúdo substantivo por conta própria.

Seu papel tem três partes:
1. Ao ouvir o microfone, responda imediatamente com UMA frase curta de presença. Se for uma saudação puramente social, responda naturalmente. Se houver pedido simples, confirme a ação concreta (por exemplo: “vou olhar sua agenda”). Se o pedido exigir análise, pesquisa, síntese ou decisão, diga apenas “Só um instante, vou olhar isso com cuidado.” Não forneça fatos, resultados ou conteúdo substantivo nessa primeira fala. Nunca diga que não consegue fazer algo, não cite limitações, não prometa prazo e não repita o pedido inteiro. A PULSO encaminha a fala ao executor correto em paralelo.
2. Quando receber uma mensagem começando com "[CONFIRMAÇÃO]", diga UMA frase curta, concreta e adulta confirmando que começou. Não responda ao pedido, não cite limitações, não infantilize, não seja efusiva, não prometa prazo e não repita o pedido inteiro.
3. Quando receber uma mensagem começando com "[RESULTADO]", é a resposta real — narre o conteúdo dela pro Fê de forma breve, natural e conversacional (resuma, não leia literalmente, sem listas nem markdown). Se receber uma mensagem começando com "[CHECKPOINT]", é uma atualização no meio de um processo longo — narre só a mudança concreta de fase, em uma frase, e volte a esperar sem soar como se tivesse terminado.

Para saudações puramente sociais (oi, tudo bem, obrigado, tchau) sem pedido nenhum, pode responder naturalmente sem esperar resultado.
Ritmo é parte da sua personalidade: checkpoint é exceção, não batida de relógio. Nunca narre atualizações técnicas em sequência nem transforme cada passo interno em fala. Depois de um checkpoint, fique em silêncio produtivo até haver resultado, bloqueio ou nova mudança relevante.
Nunca use linguagem clichê de IA ("Com certeza! Aqui está..."). Trate o Fê sempre como "Fê".`;

function mapGeminiLiveState(state: GeminiLiveState): VoiceSessionState {
  switch (state) {
    case 'idle': return 'idle';
    case 'connecting': return 'starting';
    case 'listening': return 'presence_listening';
    case 'speaking': return 'speaking';
    case 'error': return 'error';
    default: return 'idle';
  }
}

export class VoiceSessionController {
  private state: VoiceSessionState = 'idle';
  private config: VoiceSessionConfig;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private silentGainNode: GainNode | null = null;
  private pcmProcessor: ScriptProcessorNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private pcmSampleRate = 48000;
  private silenceStart: number = 0;
  private hasSpoken: boolean = false;
  private animationFrameId: number | null = null;
  
  // Players e controles
  private activeAudio: HTMLAudioElement | null = null;
  private ttsAdapter: TTSAdapter;
  private maxRecordTimeout: NodeJS.Timeout | null = null;
  
  // Barge-in (Interrupção)
  private isAssistantSpeaking = false;
  private assistantSpeechStartMs = 0;

  // Modo experimental Gemini Live
  private geminiLiveClient: GeminiLiveClient | null = null;
  private activeGeminiTurnId: string | null = null;
  private activePresenceRequestId: string | null = null;
  private deepFallbackCheckpointTimer: ReturnType<typeof setTimeout> | null = null;
  private activeTurnBasedTurnId: string | null = null;
  private readonly turnMachine = new PresenceTurnMachine();

  constructor(config: VoiceSessionConfig) {
    this.config = config;
    this.ttsAdapter = new TTSAdapter();
    // O Modo Presença tem uma identidade vocal única. Não herda a voz nativa
    // ou outra preferência eventualmente escolhida para leitura de mensagens.
    const isTauri = this.isTauriRuntime();
    this.ttsAdapter.updatePreferences({
      ttsProvider: isTauri ? 'local_kokoro_sidecar' : 'kokoro_http',
      voiceName: 'pf_dora(0.70)+af_bella(0.30)',
      voiceLang: 'pt-BR',
      rate: 0.95,
      pitch: 1,
      volume: 1
    }, false);
  }

  private isTauriRuntime() {
    return typeof window !== 'undefined' && (
      window.location.protocol === 'tauri:'
      || window.location.protocol === 'file:'
      || !!(window as any).__TAURI__
      || !!(window as any).__TAURI_INTERNALS__
    );
  }

  /**
   * WKWebView grava MediaRecorder como MP4 fragmentado. Embora o arquivo tenha
   * bytes e o endpoint responda 200, alguns fragmentos chegam ao transcritor
   * sem fala decodificável. No Tauri, capturamos o mesmo microfone como PCM e
   * enviamos WAV mono determinístico; o MediaRecorder permanece como fallback
   * para navegadores comuns.
   */
  private async executeImmediatePresenceAction(userText: string) {
    const uiResult = await this.config.handlePresenceUiIntent?.(userText);
    const result = uiResult?.handled ? uiResult : await executeLocalPresenceFastPath(userText);
    if (!result.handled || !result.responseText) return null;

    this.log('PRESENCE_LOCAL_FAST_PATH_COMPLETED', result);
    return result;
  }

  private recordLocalInteractionInBackground(userText: string, result: LocalPresenceFastPathResult) {
    if (!this.config.recordLocalFastPath) return;
    void this.config.recordLocalFastPath(userText, result).catch(error => {
      this.log('PRESENCE_LOCAL_RECORD_FAILED', error instanceof Error ? error.message : String(error));
    });
  }

  private localDateParts() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const value = (type: string) => parts.find(part => part.type === type)?.value || '';
    return { timezone, localDate: `${value('year')}-${value('month')}-${value('day')}` };
  }

  private async executeQuickRead(decision: PresenceWorkDecision) {
    const capability = decision.quickReadCapability;
    if (!capability || !this.geminiLiveClient) return null;
    const startedAt = performance.now();
    const result = await this.geminiLiveClient.requestQuickRead(capability, {
      ...this.localDateParts(),
      ...decision.quickReadArgs,
    });
    if (!result.ok || !result.responseText) {
      this.log('PRESENCE_QUICK_READ_FAILED', { capability, errorCode: result.errorCode });
      return null;
    }
    return {
      handled: true,
      action: 'quick_read' as const,
      target: capability,
      capability,
      routeKind: 'quick_read' as const,
      responseText: result.responseText,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  private transition(newState: VoiceSessionState) {
    console.log(`[VOICE_SESSION_STATE_CHANGED] { state: "${newState}" }`);
    this.state = newState;
    this.config.onStateChange(newState);
  }

  private createVoiceTurnId() {
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    return `presence-${Date.now()}-${randomId}`;
  }

  private advanceTurn(event: PresenceTurnEvent) {
    const result = this.turnMachine.dispatch(event);
    this.log('PRESENCE_TURN_EVENT', {
      event: event.type,
      turnId: result.turnId,
      decision: result.decision,
      reason: result.reason,
      phase: result.state.phase,
      activeTurnId: result.state.activeTurnId,
    });
    return result;
  }

  private clearDeepFallbackCheckpoint() {
    if (this.deepFallbackCheckpointTimer) clearTimeout(this.deepFallbackCheckpointTimer);
    this.deepFallbackCheckpointTimer = null;
  }

  private scheduleDeepFallbackCheckpoint(turnId: string) {
    this.clearDeepFallbackCheckpoint();
    this.deepFallbackCheckpointTimer = setTimeout(() => {
      this.deepFallbackCheckpointTimer = null;
      if (turnId !== this.activeGeminiTurnId) return;
      const accepted = this.geminiLiveClient?.sendCheckpointText(
        'Ainda estou cruzando as informações.',
        turnId,
      ) ?? false;
      if (accepted) this.advanceTurn({ type: 'narration_started', turnId, kind: 'checkpoint' });
    }, 12_000);
  }

  private log(tag: string, details?: any) {
    console.log(`[${tag}]`, details ? JSON.stringify(details) : '');
  }

  private persistAudioReceipt(receipt: PresenceAudioReceipt) {
    this.log('PRESENCE_AUDIO_RECEIPT', receipt);
    if (typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(
        window.localStorage.getItem(PRESENCE_AUDIO_RECEIPTS_STORAGE_KEY) || '[]',
      );
      const receipts = Array.isArray(existing) ? existing : [];
      receipts.push(receipt);
      window.localStorage.setItem(
        PRESENCE_AUDIO_RECEIPTS_STORAGE_KEY,
        JSON.stringify(receipts.slice(-MAX_PRESENCE_AUDIO_RECEIPTS)),
      );
    } catch {
      // A observabilidade falha aberta: nunca bloqueia captura ou reprodução.
    }
  }

  /**
   * Determina o melhor tipo de codec de áudio suportado pelo navegador atual.
   */
  private getBestAudioMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mp4;codecs=mp4a',
      'audio/aac'
    ];
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      return '';
    }
    for (const type of types) {
      if (window.MediaRecorder.isTypeSupported?.(type)) {
        return type;
      }
    }
    return '';
  }

  /**
   * Toca um aviso sonoro (Cue) usando Web Audio API.
   */
  private playSoundCue(type: 'start_listening' | 'sent' | 'response_arrived' | 'error') {
    if (!this.audioContext) return;
    try {
      const ctx = this.audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'start_listening') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'sent') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'response_arrived') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('Falha ao tocar Sound Cue:', e);
    }
  }

  private debugMicStream(stream: MediaStream, ctx: AudioContext, recorder?: MediaRecorder) {
    const tracks = stream.getAudioTracks();

    console.log("[MIC_DEBUG_STREAM]", {
      active: stream.active,
      trackCount: tracks.length,
      ctxState: ctx.state,
      sampleRate: ctx.sampleRate
    });

    for (const track of tracks) {
      console.log("[MIC_DEBUG_TRACK]", {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
        constraints: track.getConstraints()
      });

      track.onmute = () => console.warn("[MIC_TRACK_MUTED]");
      track.onunmute = () => console.warn("[MIC_TRACK_UNMUTED]");
      track.onended = () => console.warn("[MIC_TRACK_ENDED]");
    }

    if (recorder) {
      console.log("[RECORDER_DEBUG]", {
        state: recorder.state,
        mimeType: recorder.mimeType
      });
    }
  }

  /**
   * Inicia a sessão de voz e solicita permissões e AudioContext.
   */
  public async start(passedAudioContext?: AudioContext) {
    this.log('VOICE_SESSION_START_REQUESTED');
    this.advanceTurn({ type: 'session_started' });
    this.transition('starting');

    if (this.config.useGeminiLive) {
      const started = await this.startGeminiLive();
      if (started) return;
      return;
    }

    await this.startTurnBased(passedAudioContext);
  }

  private async startTurnBased(passedAudioContext?: AudioContext) {
    this.config.onPresenceWorkChange?.(false);

    try {
      this.log('MIC_PERMISSION_REQUESTED');
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.stream = micStream;
      this.log('MIC_OPENED');

      if (passedAudioContext) {
        this.audioContext = passedAudioContext;
        this.log('AUDIO_CONTEXT_PASSED');
      } else {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextCtor();
        this.log('AUDIO_CONTEXT_CREATED');
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        this.log('AUDIO_CONTEXT_RESUMED');
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.minDecibels = -70;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = 0.85;
      
      const source = this.audioContext.createMediaStreamSource(micStream);
      this.sourceNode = source;
      source.connect(this.analyser);
      
      // Conectar a destino silencioso no Safari para manter grafo vivo
      const gainNode = this.audioContext.createGain();
      this.silentGainNode = gainNode;
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.analyser.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      if (this.isTauriRuntime() && typeof this.audioContext.createScriptProcessor === 'function') {
        this.pcmSampleRate = this.audioContext.sampleRate;
        this.pcmProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.pcmProcessor.onaudioprocess = (event) => {
          if (this.state !== 'presence_listening' && this.state !== 'user_speaking') return;
          const input = event.inputBuffer.getChannelData(0);
          this.pcmChunks.push(new Float32Array(input));
        };
        source.connect(this.pcmProcessor);
        this.pcmProcessor.connect(gainNode);
        this.log('PCM_WAV_CAPTURE_READY', { sampleRate: this.pcmSampleRate });
      }

      this.log('VAD_READY');

      // Inicializa e começa escuta
      this.startListeningLoop();

    } catch (err: any) {
      this.log('VOICE_SESSION_ERROR', err.message || err);
      this.config.onError('Permissão de microfone negada ou erro ao iniciar AudioContext.');
      this.transition('error');
    }
  }

  /**
   * Começa o loop de gravação contínuo e detecção de silêncio (VAD).
   */
  private startListeningLoop() {
    if (!this.stream) return;
    if (this.activeTurnBasedTurnId) {
      this.advanceTurn({ type: 'listening_resumed', turnId: this.activeTurnBasedTurnId });
      this.activeTurnBasedTurnId = null;
    } else {
      this.advanceTurn({ type: 'listening_resumed' });
    }
    this.transition('presence_listening');
    this.log('LISTENING_STARTED');
    this.playSoundCue('start_listening');

    this.audioChunks = [];
    this.pcmChunks = [];
    const mimeType = this.getBestAudioMimeType();

    try {
      const options = mimeType ? { mimeType } : undefined;
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.debugMicStream(this.stream, this.audioContext!, this.mediaRecorder);

    this.mediaRecorder.ondataavailable = (event) => {
      console.log("[RECORDER_CHUNK_DEBUG]", {
        size: event.data?.size,
        type: event.data?.type,
        recorderState: this.mediaRecorder?.state
      });
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      const turnId = this.activeTurnBasedTurnId;
      const blobMime = this.mediaRecorder?.mimeType || mimeType || 'application/octet-stream';
      const pcmChunks = this.pcmChunks;
      const audioBlob = this.isTauriRuntime() && pcmChunks.length > 0
        ? encodePcmWav(pcmChunks, this.pcmSampleRate)
        : new Blob(this.audioChunks, { type: blobMime });
      this.audioChunks = [];
      this.pcmChunks = [];

      if (this.state === 'transcribing' || this.state === 'user_speaking') {
        await this.processUserSpeech(audioBlob, turnId);
      }
    };

    this.hasSpoken = false;
    this.silenceStart = 0;
    this.mediaRecorder.start(250);

    // VAD (checkSilence) usando time domain (RMS)
    const analyser = this.analyser;
    const ctx = this.audioContext;
    const stream = this.stream;
    if (analyser && ctx) {
      analyser.fftSize = 256;
      const bufferLength = analyser.fftSize;
      const timeData = new Uint8Array(bufferLength);

      const checkSilence = () => {
        if (this.state !== 'presence_listening' && this.state !== 'speaking' && this.state !== 'user_speaking') {
          this.animationFrameId = requestAnimationFrame(checkSilence);
          return;
        }

        analyser.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const value = (timeData[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Print debug VAD de sinal em tempo real
        if (Math.random() < 0.05) { // throttled print
          console.log("[VAD_RMS_DEBUG]", {
            rms,
            ctxState: ctx.state,
            streamActive: stream.active,
            trackMuted: stream.getAudioTracks()[0]?.muted,
            trackReadyState: stream.getAudioTracks()[0]?.readyState
          });
        }

        // Se o usuário falou (threshold RMS de 0.015)
        if (rms > 0.015) {
          // Interrompe assistente se estiver falando (Barge-in)
          // Mas impede interrupção nos primeiros 1200ms de reprodução (evita eco inicial e falsas interrupções de início de frase)
          if (this.isAssistantSpeaking && (Date.now() - this.assistantSpeechStartMs) > 1200) {
            this.interruptAssistant();
            return;
          }

          if (this.state === 'presence_listening') {
            if (!this.hasSpoken) {
              this.hasSpoken = true;
              this.activeTurnBasedTurnId = this.createVoiceTurnId();
              this.advanceTurn({ type: 'turn_opened', turnId: this.activeTurnBasedTurnId });
              this.log('VAD_SPEECH_START');
              this.transition('user_speaking');
            }
            this.silenceStart = Date.now();
          } else if (this.state === 'user_speaking') {
            this.silenceStart = Date.now();
          }
        } else {
          // Uma pausa natural encerra o turno sem impor a demora de um chat gravado.
          if (this.hasSpoken && this.silenceStart > 0 && Date.now() - this.silenceStart > 1100) {
            this.log('VAD_SPEECH_END');
            this.finalizeUserTurn();
            return;
          }
        }

        this.animationFrameId = requestAnimationFrame(checkSilence);
      };

      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = requestAnimationFrame(checkSilence);
    }

    // Timeout máximo de segurança (60 segundos)
    if (this.maxRecordTimeout) clearTimeout(this.maxRecordTimeout);
    this.maxRecordTimeout = setTimeout(() => {
      if (this.state === 'presence_listening' || this.state === 'user_speaking') {
        this.finalizeUserTurn();
      }
    }, 60000);
  }

  /**
   * Finaliza o turno atual de gravação para enviar para transcrição.
   */
  private finalizeUserTurn() {
    if (!this.activeTurnBasedTurnId) {
      this.activeTurnBasedTurnId = this.createVoiceTurnId();
      this.advanceTurn({ type: 'turn_opened', turnId: this.activeTurnBasedTurnId });
    }
    this.advanceTurn({ type: 'turn_closed', turnId: this.activeTurnBasedTurnId });
    this.advanceTurn({ type: 'transcription_started', turnId: this.activeTurnBasedTurnId });
    this.log('USER_TURN_FINALIZED');
    this.transition('transcribing');
    if (this.maxRecordTimeout) clearTimeout(this.maxRecordTimeout);
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Interrompe imediatamente qualquer reprodução de áudio da assistente (Barge-in).
   */
  public interruptAssistant() {
    if (!this.isAssistantSpeaking) return;
    this.log('ASSISTANT_INTERRUPTED');
    const interruptedTurnId = this.turnMachine.getSnapshot().audibleTurnId
      ?? this.activeTurnBasedTurnId
      ?? this.activeGeminiTurnId
      ?? undefined;
    this.advanceTurn({ type: 'turn_interrupted', turnId: interruptedTurnId });
    this.transition('interrupted');

    this.isAssistantSpeaking = false;
    
    // Aborta audio
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.currentTime = 0;
      this.activeAudio.src = '';
      this.activeAudio = null;
    }
    
    // Aborta requests pendentes de TTS
    this.ttsAdapter.cancel();

    // Volta imediatamente para escuta do novo turno do usuário
    this.startListeningLoop();
  }

  /**
   * Transcreve e processa o áudio enviado pelo usuário.
   */
  private async processUserSpeech(blob: Blob, turnId: string | null) {
    this.log('STT_REQUEST_STARTED');
    
    try {
      const isTauriEnv = this.isTauriRuntime();

      const endpointUrl = isTauriEnv
        ? 'http://127.0.0.1:14323/transcribe'
        : '/api/pulso/transcribe';
      // plugin-http atravessa a fronteira nativa do Tauri sem depender do
      // CORS do WKWebView. No navegador comum, preservamos o fetch padrão.
      const requestFetch: typeof fetch = isTauriEnv
        ? (await import('@tauri-apps/plugin-http')).fetch
        : fetch;

      const response = await requestFetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
        },
        body: blob,
      });

      if (!response.ok) throw new Error(`Falha no STT (${response.status})`);

      const data = await response.json();
      const userText = data.text || '';
      this.log('STT_REQUEST_FINISHED', {
        text: userText,
        engine: data.engine || (isTauriEnv ? 'local' : 'cloud'),
        durationMs: data.durationMs,
      });

      if (userText.trim().length === 0) {
        // Nada foi ouvido, reinicia loop de escuta
        this.advanceTurn({ type: 'turn_failed', turnId: turnId ?? undefined });
        this.startListeningLoop();
        return;
      }

      if (turnId) {
        this.advanceTurn({ type: 'transcription_ready', turnId });
        this.advanceTurn({ type: 'routing_started', turnId });
      }

      // A captura fica parada enquanto a mesma sessão da Lótus processa o turno.
      this.transition('thinking');
      this.log('LLM_REQUEST_STARTED');
      this.playSoundCue('sent');

      const localResult = await this.executeImmediatePresenceAction(userText);
      if (localResult?.handled && localResult.responseText) {
        this.recordLocalInteractionInBackground(userText, localResult);
        await this.speakAssistant(localResult.responseText, undefined, undefined, {
          turnId: turnId ?? undefined,
          kind: 'result',
        });
        return;
      }

      const presenceRouting = await this.config.routePresenceIntent?.(userText);
      const rawDispatch = await this.config.handleSendMessage(userText, {
        originMode: 'presence',
        targetContextNode: presenceRouting?.target,
        presenceRouting,
      });
      const res = rawDispatch && typeof rawDispatch === 'object' ? rawDispatch : null;
      this.log('LLM_REQUEST_FINISHED');

      if (turnId && res?.requestId) {
        this.activePresenceRequestId = res.requestId;
        this.advanceTurn({ type: 'request_bound', turnId, requestId: res.requestId });
      }

      if (!res?.requestId && !res?.responseText) {
        // Nunca deixar a Orbe morrer em `thinking` quando a camada de envio
        // recusar ou não confirmar o pedido.
        this.log('PRESENCE_DISPATCH_NOT_CONFIRMED');
        this.advanceTurn({ type: 'turn_failed', turnId: turnId ?? undefined });
        this.startListeningLoop();
        return;
      }

      if (res && res.responseText) {
        this.config.onTextReceived(userText, res.responseText);
        await this.speakAssistant(res.responseText, undefined, undefined, {
          turnId: turnId ?? undefined,
          requestId: res.requestId,
          kind: 'result',
        });
      }

    } catch (err: any) {
      this.log('VOICE_SESSION_ERROR', err.message || err);
      this.advanceTurn({ type: 'turn_failed', turnId: turnId ?? undefined });
      this.playSoundCue('error');
      this.startListeningLoop();
    }
  }

  /**
   * Gera o áudio da resposta (TTS) e inicia a reprodução controlada.
   */
  public async speakAssistant(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    context: PresenceNarrationContext = {},
  ) {
    const turnId = context.turnId
      ?? (context.requestId ? this.turnMachine.findTurnIdByRequestId(context.requestId) : undefined)
      ?? this.activeTurnBasedTurnId
      ?? this.activeGeminiTurnId
      ?? undefined;

    if (turnId) {
      const result = this.advanceTurn({
        type: 'result_received',
        turnId,
        requestId: context.requestId,
      });
      if (result.decision !== 'narrate') {
        this.log('PRESENCE_NARRATION_SUPPRESSED', {
          turnId,
          requestId: context.requestId,
          decision: result.decision,
          reason: result.reason,
        });
        return false;
      }
    }

    if (!text.trim()) {
      this.startListeningLoop();
      return false;
    }

    // Uma resposta Firestore pode chegar depois de o modo ter sido encerrado.
    if (!this.stream) {
      if (turnId) this.advanceTurn({ type: 'turn_interrupted', turnId });
      return false;
    }

    if (turnId) {
      this.advanceTurn({
        type: 'narration_started',
        turnId,
        kind: context.kind ?? 'result',
      });
    }

    this.transition('speaking');
    this.log('TTS_REQUEST_STARTED');
    this.isAssistantSpeaking = true;

    try {
      // Usaremos o próprio TTSAdapter para buscar o áudio via API
      this.assistantSpeechStartMs = Date.now();
      this.ttsAdapter.speak(
        text,
        () => {
          this.assistantSpeechStartMs = Date.now();
          this.log('ASSISTANT_AUDIO_STARTED');
          onStart?.();
        },
        () => {
          if (this.isAssistantSpeaking) {
            this.log('ASSISTANT_AUDIO_ENDED');
            this.isAssistantSpeaking = false;
            if (turnId) this.advanceTurn({ type: 'narration_finished', turnId });
            onEnd?.();
            this.log('SESSION_RETURNED_TO_LISTENING');
            this.startListeningLoop();
          }
        },
        undefined,
        { fallbackToNative: false }
      );
    } catch (e) {
      console.warn('Erro ao reproduzir TTS:', e);
      this.isAssistantSpeaking = false;
      if (turnId) this.advanceTurn({ type: 'narration_finished', turnId });
      this.startListeningLoop();
    }
    return true;
  }

  // ---- Modo experimental Gemini Live ----

  private async startGeminiLive() {
    const { relayUrl } = getGeminiLiveConfig();

    if (!relayUrl || !this.config.getGeminiAccessToken) {
      this.log('GEMINI_LIVE_CONFIG_MISSING');
      this.config.onError('Conversa em tempo real sem autenticação disponível.');
      this.transition('error');
      return false;
    }

    this.geminiLiveClient = new GeminiLiveClient({
      relayUrl,
      getAccessToken: this.config.getGeminiAccessToken,
      systemInstruction: GEMINI_LIVE_SYSTEM_INSTRUCTION,
      onStateChange: (state) => {
        this.transition(mapGeminiLiveState(state));
      },
      onTranscript: (role, text) => {
        this.log('GEMINI_LIVE_TRANSCRIPT', { role, chars: text.length });
        // onTextReceived espera (userText, assistantText) juntos por turno;
        // nesse modo os dois chegam em eventos separados, então repassamos
        // cada um isoladamente pro chamador decidir como exibir.
        if (role === 'user') {
          this.config.onTextReceived(text, '');
        } else {
          this.config.onTextReceived('', text);
        }
      },
      onError: (message) => {
        this.log('GEMINI_LIVE_ERROR', message);
        this.config.onPresenceWorkChange?.(false);
        this.config.onError(`Conversa em tempo real indisponível: ${message}`);
        this.transition('error');
      },
      onAudioReceipt: (receipt) => {
        this.persistAudioReceipt(receipt);
      },
      onUserTurnStarted: (turnId) => {
        this.clearDeepFallbackCheckpoint();
        this.activeGeminiTurnId = turnId;
        this.activePresenceRequestId = null;
        this.advanceTurn({ type: 'turn_opened', turnId });
        this.config.onPresenceWorkChange?.(false);
        this.log('GEMINI_LIVE_USER_TURN_STARTED', { turnId });
      },
      onUserTurnReady: async ({ turnId, userText, assistantText, socialOnly }) => {
        if (turnId !== this.activeGeminiTurnId) return;
        this.advanceTurn({ type: 'turn_closed', turnId });
        this.advanceTurn({ type: 'transcription_started', turnId });
        this.advanceTurn({ type: 'transcription_ready', turnId });
        this.advanceTurn({ type: 'routing_started', turnId });
        this.log('GEMINI_LIVE_USER_TURN_READY', { turnId, userText });
        this.config.onPresenceWorkChange?.(true);
        try {
          const workDecision = classifyPresenceWork(userText);
          if (workDecision.kind === 'social' || socialOnly) {
            this.recordLocalInteractionInBackground(userText, {
              handled: true,
              action: 'social_exchange',
              target: 'presence_dialogue',
              responseText: assistantText || undefined,
              durationMs: 0,
              routeKind: 'social',
              capability: 'social_exchange',
            });
            this.config.onPresenceWorkChange?.(false);
            this.advanceTurn({ type: 'result_received', turnId });
            this.geminiLiveClient?.completeResultSilently(turnId);
            return;
          }
          const localResult = await this.executeImmediatePresenceAction(userText);
          if (turnId !== this.activeGeminiTurnId) return;
          if (localResult?.handled && localResult.responseText) {
            this.recordLocalInteractionInBackground(userText, localResult);
            this.config.onPresenceWorkChange?.(false);
            const disposition = this.advanceTurn({ type: 'result_received', turnId });
            if (
              disposition.decision === 'narrate'
              && this.geminiLiveClient?.sendResultText(localResult.responseText, turnId)
            ) {
              this.advanceTurn({ type: 'narration_started', turnId, kind: 'result' });
            }
            return;
          }

          if (workDecision.kind === 'quick_read') {
            const quickResult = await this.executeQuickRead(workDecision);
            if (turnId !== this.activeGeminiTurnId) return;
            if (quickResult?.responseText) {
              this.recordLocalInteractionInBackground(userText, quickResult);
              this.config.onPresenceWorkChange?.(false);
              const disposition = this.advanceTurn({ type: 'result_received', turnId });
              if (
                disposition.decision === 'narrate'
                && this.geminiLiveClient?.sendResultText(quickResult.responseText, turnId)
              ) {
                this.advanceTurn({ type: 'narration_started', turnId, kind: 'result' });
              }
              return;
            }
          }

          // O pulso sonoro comunica explicitamente a mudança para trabalho
          // profundo. Consultas rápidas devem permanecer silenciosas e voltar
          // em poucos segundos, sem sugerir uma escalada que não aconteceu.
          if (workDecision.kind === 'deep_work') {
            this.geminiLiveClient?.startDeepWorkPulse(turnId);
          }

          this.geminiLiveClient?.recordCanonicalReceipt('canonical_dispatch_started', { turnId });

          // handleSendMessage persiste o pedido e devolve antes do OpenClaw
          // concluir. A resposta real chega pelo listener canônico do
          // Firestore; LivePage então chama narratePresenceResult().
          let presenceRouting: PresenceRoutingDecision | undefined;
          try {
            presenceRouting = await this.config.routePresenceIntent?.(userText);
          } catch (routingError: unknown) {
            // Roteamento é uma otimização. Uma falha nele jamais pode engolir
            // uma fala já reconhecida; o pedido segue para a sessão ativa.
            this.log(
              'GEMINI_LIVE_ROUTING_FALLBACK',
              routingError instanceof Error ? routingError.message : String(routingError),
            );
            this.geminiLiveClient?.recordCanonicalReceipt('canonical_routing_fallback', {
              turnId,
              failureStage: 'routing',
              failureCode: 'route_fallback',
            });
          }
          const rawDispatch = await this.config.handleSendMessage(userText, {
            originMode: 'presence',
            targetContextNode: presenceRouting?.target,
            presenceRouting,
          });
          const dispatch = rawDispatch && typeof rawDispatch === 'object' ? rawDispatch : null;
          if (turnId !== this.activeGeminiTurnId) return;
          this.activePresenceRequestId = dispatch?.requestId || null;
          if (dispatch?.requestId) {
            this.advanceTurn({ type: 'request_bound', turnId, requestId: dispatch.requestId });
            this.geminiLiveClient?.recordCanonicalReceipt('canonical_request_created', {
              turnId,
              requestId: dispatch.requestId,
            });
            this.scheduleDeepFallbackCheckpoint(turnId);
          } else if (!dispatch?.responseText) {
            this.geminiLiveClient?.recordCanonicalReceipt('canonical_dispatch_failed', { turnId });
            this.advanceTurn({ type: 'turn_failed', turnId });
            this.config.onPresenceWorkChange?.(false);
            this.geminiLiveClient?.sendResultText('O pedido não entrou no chat. Vou continuar ouvindo.', turnId);
          }
        } catch (err: any) {
          this.log('GEMINI_LIVE_ORCHESTRATOR_ERROR', err.message || err);
          this.geminiLiveClient?.recordCanonicalReceipt('canonical_dispatch_failed', {
            turnId,
            failureStage: 'canonical_dispatch',
            failureCode: err?.name || 'dispatch_error',
          });
          this.advanceTurn({ type: 'turn_failed', turnId });
          this.config.onPresenceWorkChange?.(false);
          this.geminiLiveClient?.sendResultText('Tive um erro tentando processar isso.', turnId);
        }
      }
    });

    this.geminiLiveClient.start();
    return true;
  }

  /**
   * Chamado por fora (LivePage) quando um processo longo disparado durante o
   * modo Presença solta uma atualização de progresso — repassa pra Gemini
   * narrar como checkpoint, sem quebrar a lei de "nunca parecer perdida".
   */
  public notifyPresenceCheckpoint(checkpointText: string, requestId?: string) {
    const turnId = requestId
      ? this.turnMachine.findTurnIdByRequestId(requestId)
      : this.activeGeminiTurnId ?? undefined;
    const disposition = this.advanceTurn({ type: 'checkpoint_received', turnId, requestId });
    if (disposition.decision !== 'narrate' || !turnId) return false;
    const accepted = this.geminiLiveClient?.sendCheckpointText(checkpointText, turnId) ?? false;
    if (accepted) {
      this.clearDeepFallbackCheckpoint();
      this.advanceTurn({ type: 'narration_started', turnId, kind: 'checkpoint' });
    }
    return accepted;
  }

  /** Entrega à voz um resultado já produzido pela Lótus/OpenClaw. */
  public narratePresenceResult(resultText: string, requestId?: string) {
    this.clearDeepFallbackCheckpoint();
    const turnId = requestId
      ? this.turnMachine.findTurnIdByRequestId(requestId)
      : this.activeGeminiTurnId ?? undefined;
    const disposition = this.advanceTurn({ type: 'result_received', turnId, requestId });
    if (disposition.decision !== 'narrate' || !turnId) return false;
    this.geminiLiveClient?.recordCanonicalReceipt('canonical_result_received', { turnId, requestId });
    const accepted = this.geminiLiveClient?.sendResultText(resultText, turnId) ?? false;
    if (accepted) this.advanceTurn({ type: 'narration_started', turnId, kind: 'result' });
    if (accepted) this.config.onPresenceWorkChange?.(false);
    return accepted;
  }

  public isGeminiLiveActive() {
    return this.geminiLiveClient?.isConnected() ?? false;
  }

  /**
   * Finaliza e limpa completamente todos os recursos abertos na sessão.
   */
  public stop() {
    this.log('VOICE_SESSION_STOPPED');
    this.advanceTurn({ type: 'session_stopped' });
    this.transition('idle');
    this.clearDeepFallbackCheckpoint();

    if (this.geminiLiveClient) {
      this.geminiLiveClient.stop();
      this.geminiLiveClient = null;
      this.activeGeminiTurnId = null;
      this.activePresenceRequestId = null;
      this.activeTurnBasedTurnId = null;
      this.config.onPresenceWorkChange?.(false);
      return;
    }

    if (this.maxRecordTimeout) clearTimeout(this.maxRecordTimeout);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    this.isAssistantSpeaking = false;

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.src = '';
      this.activeAudio = null;
    }
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.silentGainNode?.disconnect();
    this.silentGainNode = null;
    if (this.pcmProcessor) {
      this.pcmProcessor.onaudioprocess = null;
      this.pcmProcessor.disconnect();
      this.pcmProcessor = null;
    }
    this.pcmChunks = [];
    this.activeTurnBasedTurnId = null;
    const audioContext = this.audioContext;
    this.audioContext = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close();
    }
    this.ttsAdapter.cancel();
  }
}
