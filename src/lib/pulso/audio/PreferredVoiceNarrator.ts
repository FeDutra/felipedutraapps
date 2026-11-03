import { TTSAdapter } from '../TTSAdapter';
import { GeminiLiveClient } from './GeminiLiveClient';
import type { GeminiLiveConfig } from './GeminiLiveClient';
import { getGeminiLiveConfig } from './PresenceTransport';

const READING_INSTRUCTION = `Você é a voz da Lótus em português do Brasil.
Quando receber uma mensagem iniciada por "[LEITURA]", leia fielmente o texto que vem depois, com ritmo natural e sóbrio. Não introduza, não comente, não resuma e não responda ao conteúdo. Ignore markdown residual e nunca acrescente informação.`;

export interface PreferredVoiceNarratorCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onPreparing?: () => void;
}

type NarrationClient = Pick<GeminiLiveClient, 'start' | 'stop' | 'sendReadingText'>;

export class PreferredVoiceNarrator {
  private readonly ttsAdapter: TTSAdapter;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly createClient: (config: GeminiLiveConfig) => NarrationClient;
  private client: NarrationClient | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(options: {
    ttsAdapter: TTSAdapter;
    getAccessToken: () => Promise<string | null>;
    createClient?: (config: GeminiLiveConfig) => NarrationClient;
  }) {
    this.ttsAdapter = options.ttsAdapter;
    this.getAccessToken = options.getAccessToken;
    this.createClient = options.createClient ?? (config => new GeminiLiveClient(config));
  }

  public cancel() {
    this.generation += 1;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    this.client?.stop();
    this.client = null;
    this.ttsAdapter.cancel();
  }

  public speak(
    text: string,
    narrationId: string,
    callbacks: PreferredVoiceNarratorCallbacks = {},
    options: { allowKokoroFallback: boolean } = { allowKokoroFallback: true },
  ) {
    this.cancel();
    const generation = this.generation;
    const normalized = this.ttsAdapter.normalizeTextForSpeech(text);
    if (!normalized) {
      callbacks.onEnd?.();
      return false;
    }

    callbacks.onPreparing?.();
    const { relayUrl } = getGeminiLiveConfig();
    let playbackStarted = false;
    let settled = false;
    let fallbackStarted = false;

    const isCurrent = () => generation === this.generation;
    const finish = () => {
      if (settled || !isCurrent()) return;
      settled = true;
      if (this.startupTimer) clearTimeout(this.startupTimer);
      this.startupTimer = null;
      this.client?.stop();
      this.client = null;
      callbacks.onEnd?.();
    };
    const startFallback = () => {
      if (settled || playbackStarted || fallbackStarted || !isCurrent()) return;
      if (!options.allowKokoroFallback) {
        finish();
        return;
      }
      fallbackStarted = true;
      if (this.startupTimer) clearTimeout(this.startupTimer);
      this.startupTimer = null;
      this.client?.stop();
      this.client = null;
      void this.ttsAdapter.speak(
        normalized,
        callbacks.onStart,
        finish,
        callbacks.onPreparing,
        { fallbackToNative: false },
      ).catch(finish);
    };

    this.client = this.createClient({
      relayUrl,
      getAccessToken: this.getAccessToken,
      inputMode: 'output_only',
      systemInstruction: READING_INSTRUCTION,
      onStateChange: () => undefined,
      onReady: () => {
        if (!isCurrent() || !this.client?.sendReadingText(normalized, narrationId)) startFallback();
      },
      onNarrationStarted: (narration) => {
        if (!isCurrent() || narration.id !== narrationId) return;
        playbackStarted = true;
        if (this.startupTimer) clearTimeout(this.startupTimer);
        this.startupTimer = null;
        callbacks.onStart?.();
      },
      onNarrationFinished: (narration) => {
        if (narration.id === narrationId) finish();
      },
      onNarrationUnavailable: (narration) => {
        if (narration.id === narrationId) startFallback();
      },
      onError: () => {
        if (playbackStarted) finish();
        else startFallback();
      },
    });
    this.client.start();
    this.startupTimer = setTimeout(startFallback, 8_000);
    return true;
  }
}
