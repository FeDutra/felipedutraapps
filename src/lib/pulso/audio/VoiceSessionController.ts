import { TTSAdapter } from '../TTSAdapter';

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
  activeContextNode: { contextId: string; areaId: string; chatId: string };
  handleSendMessage: (text: string, options: { originMode: 'presence' }) => Promise<{ responseText: string } | null | void>;
}

export class VoiceSessionController {
  private state: VoiceSessionState = 'idle';
  private config: VoiceSessionConfig;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
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

  constructor(config: VoiceSessionConfig) {
    this.config = config;
    this.ttsAdapter = new TTSAdapter();
  }

  private transition(newState: VoiceSessionState) {
    console.log(`[VOICE_SESSION_STATE_CHANGED] { state: "${newState}" }`);
    this.state = newState;
    this.config.onStateChange(newState);
  }

  private log(tag: string, details?: any) {
    console.log(`[${tag}]`, details ? JSON.stringify(details) : '');
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
    this.transition('starting');

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
      source.connect(this.analyser);
      
      // Conectar a destino silencioso no Safari para manter grafo vivo
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.analyser.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

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
    this.transition('presence_listening');
    this.log('LISTENING_STARTED');
    this.playSoundCue('start_listening');

    this.audioChunks = [];
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
      const blobMime = this.mediaRecorder?.mimeType || mimeType || 'application/octet-stream';
      const audioBlob = new Blob(this.audioChunks, { type: blobMime });
      this.audioChunks = [];

      if (this.state === 'transcribing' || this.state === 'user_speaking') {
        await this.processUserSpeech(audioBlob);
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
              this.log('VAD_SPEECH_START');
              this.transition('user_speaking');
            }
            this.silenceStart = Date.now();
          } else if (this.state === 'user_speaking') {
            this.silenceStart = Date.now();
          }
        } else {
          // Se o usuário já falou e agora está em silêncio por > 2s
          if (this.hasSpoken && this.silenceStart > 0 && Date.now() - this.silenceStart > 2000) {
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
  private async processUserSpeech(blob: Blob) {
    this.log('STT_REQUEST_STARTED');
    
    try {
      const isTauriEnv = typeof window !== 'undefined' && (
        window.location.protocol === 'tauri:' ||
        !!(window as any).__TAURI__ ||
        !!(window as any).__TAURI_INTERNALS__
      );

      const endpointUrl = isTauriEnv 
        ? 'https://felipedutraapps.web.app/api/pulso/transcribe' 
        : '/api/pulso/transcribe';

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
        },
        body: blob,
      });

      if (!response.ok) throw new Error('Falha no STT');

      const data = await response.json();
      const userText = data.text || '';
      this.log('STT_REQUEST_FINISHED', { text: userText });

      if (userText.trim().length === 0) {
        // Nada foi ouvido, reinicia loop de escuta
        this.startListeningLoop();
        return;
      }

      // Envia ao LLM local (AgentOrchestrator)
      this.transition('transcribing');
      this.log('LLM_REQUEST_STARTED');
      this.playSoundCue('sent');

      const res = await this.config.handleSendMessage(userText, { originMode: 'presence' });
      this.log('LLM_REQUEST_FINISHED');

      if (res && res.responseText) {
        this.config.onTextReceived(userText, res.responseText);
        await this.generateAndPlayTTS(res.responseText);
      } else {
        this.startListeningLoop();
      }

    } catch (err: any) {
      this.log('VOICE_SESSION_ERROR', err.message || err);
      this.playSoundCue('error');
      this.startListeningLoop();
    }
  }

  /**
   * Gera o áudio da resposta (TTS) e inicia a reprodução controlada.
   */
  private async generateAndPlayTTS(text: string) {
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
        },
        () => {
          if (this.isAssistantSpeaking) {
            this.log('ASSISTANT_AUDIO_ENDED');
            this.isAssistantSpeaking = false;
            this.log('SESSION_RETURNED_TO_LISTENING');
            this.startListeningLoop();
          }
        }
      );
    } catch (e) {
      console.warn('Erro ao reproduzir TTS:', e);
      this.isAssistantSpeaking = false;
      this.startListeningLoop();
    }
  }

  /**
   * Finaliza e limpa completamente todos os recursos abertos na sessão.
   */
  public stop() {
    this.log('VOICE_SESSION_STOPPED');
    this.transition('idle');

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
    this.ttsAdapter.cancel();
  }
}
