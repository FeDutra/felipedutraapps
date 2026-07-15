export type TTSProvider = 'browser_native' | 'local_kokoro_sidecar' | 'local_kokoro' | 'kokoro_http' | 'cloud_google';

const isTauriApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'tauri:' ||
    window.location.protocol === 'file:' ||
    !!(window as any).__TAURI__ ||
    !!(window as any).__TAURI_INTERNALS__
  );
};

export interface TTSPreferences {
  ttsProvider: TTSProvider;
  voiceName: string;
  voiceURI: string;
  voiceLang: string;
  rate: number;
  pitch: number;
  volume: number;
}

const STORAGE_KEY = 'pulso_tts_preferences';

const DEFAULT_PREFERENCES: TTSPreferences = {
  ttsProvider: 'browser_native',
  voiceName: '',
  voiceURI: '',
  voiceLang: 'pt-BR',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0
};

const getKokoroEndpoint = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('pulso_tts_kokoro_endpoint');
    if (custom) return custom;
  }
  return process.env.NEXT_PUBLIC_KOKORO_ENDPOINT || 'http://127.0.0.1:8880/v1/audio/speech';
};

export class TTSAdapter {
  private preferences: TTSPreferences;

  constructor() {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.loadPreferences();
    // Silent warmup on startup
    this.warmup();
  }

  private loadPreferences() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load TTS preferences from localStorage:', e);
    }
  }

  public getPreferences(): TTSPreferences {
    return this.preferences;
  }

  public updatePreferences(newPrefs: Partial<TTSPreferences>) {
    const oldProvider = this.preferences.ttsProvider;
    const oldVoice = this.preferences.voiceName;
    this.preferences = { ...this.preferences, ...newPrefs };
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
      } catch (e) {
        console.warn('Failed to save TTS preferences to localStorage:', e);
      }
    }

    const isKokoro = this.preferences.ttsProvider === 'local_kokoro' || this.preferences.ttsProvider === 'kokoro_http' || this.preferences.ttsProvider === 'local_kokoro_sidecar';
    const wasKokoro = oldProvider === 'local_kokoro' || oldProvider === 'kokoro_http' || oldProvider === 'local_kokoro_sidecar';
    
    if (isKokoro && (!wasKokoro || oldVoice !== this.preferences.voiceName)) {
      this.warmup();
    }
  }

  public async warmup() {
    const isKokoro = this.preferences.ttsProvider === 'local_kokoro' || this.preferences.ttsProvider === 'kokoro_http' || this.preferences.ttsProvider === 'local_kokoro_sidecar';
    if (!isKokoro) return;

    console.log('[PULSO_TTS_KOKORO_WARMUP_START]');
    try {
      const payloadText = this.normalizeTextForSpeech('ok');

      let endpoint = 'http://191.101.70.136:14321/v1/audio/speech'; // Default Kokoro VPS
      if (this.preferences.ttsProvider === 'local_kokoro' || this.preferences.ttsProvider === 'local_kokoro_sidecar') {
        endpoint = 'http://127.0.0.1:14321/v1/audio/speech';
      }

      const voice = this.preferences.voiceName || 'pf_dora';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro',
          input: payloadText,
          voice: voice,
          response_format: 'mp3',
          speed: 1.0
        })
      });

      if (response.ok) {
        console.log('[PULSO_TTS_KOKORO_WARMUP_OK]');
      } else {
        console.log('[PULSO_TTS_KOKORO_WARMUP_FAILED]', response.statusText);
      }
    } catch (err) {
      console.log('[PULSO_TTS_KOKORO_WARMUP_FAILED]', err);
    }
  }

  /**
   * Returns standard speech voices available in the browser.
   */
  public getVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }

  /**
   * Sorts and gets the best available Portuguese voices.
   */
  public getPortugueseVoices(): SpeechSynthesisVoice[] {
    const all = this.getVoices();
    // Filter and sort: pt-BR first, then pt-PT, then other Portuguese variants
    return all.filter(v => {
      const lang = v.lang.toLowerCase();
      return lang.startsWith('pt');
    }).sort((a, b) => {
      const aLang = a.lang.toLowerCase();
      const bLang = b.lang.toLowerCase();
      const aIsBR = aLang === 'pt-br' || aLang.includes('br');
      const bIsBR = bLang === 'pt-br' || bLang.includes('br');

      if (aIsBR && !bIsBR) return -1;
      if (!aIsBR && bIsBR) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public getDefaultPortugueseVoice(): SpeechSynthesisVoice | null {
    const ptVoices = this.getPortugueseVoices();
    if (ptVoices.length === 0) return null;
    
    // Priority 1: Known high-quality female voices (Google, Luciana, Maria, Francisca)
    const knownFemale = ptVoices.find(v => {
      const name = v.name.toLowerCase();
      return name.includes('google') || 
             name.includes('luciana') || 
             name.includes('maria') || 
             name.includes('francisca');
    });
    if (knownFemale) return knownFemale;

    // Priority 2: Exclude known male voices (Antonio, Daniel, Thiago)
    const anyFemaleOrNeutral = ptVoices.find(v => {
      const name = v.name.toLowerCase();
      return !name.includes('antonio') && !name.includes('daniel') && !name.includes('thiago');
    });
    if (anyFemaleOrNeutral) return anyFemaleOrNeutral;

    // Default to the first Portuguese voice
    return ptVoices[0];
  }

  private audioCache = new Map<string, Blob>();
  private globalPlaySessionId = 0;
  private currentPlaySessionId = 0;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAbortController: AbortController | null = null;
  private sessionStartTime = 0;

  /**
   * Cancel any active speaking.
   */
  public cancel() {
    if (this.currentPlaySessionId !== 0) {
      console.log('[PULSO_TTS_STOP_REQUESTED]');
      const elapsed = Math.round(performance.now() - this.sessionStartTime);
      console.log('[PULSO_TTS_CANCELLED]', { durationMs: elapsed });
    }
    this.currentPlaySessionId = 0;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Normalizes markdown text to natural plain text for speech synthesis.
   */
  public normalizeTextForSpeech(text: string): string {
    if (!text) return '';
    let s = text;

    // 1. Remove code blocks (fences) completely
    s = s.replace(/```[\s\S]*?```/g, ' ');

    // 2. Remove markdown images: ![alt](url) -> ""
    s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

    // 3. Remove inline code backticks: `code` -> code
    s = s.replace(/`([^`]+)`/g, '$1');

    // 4. Remove markdown links: [label](url) -> label
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 5. Remove bold & italic: **bold**, *italic*, __bold__, _italic_
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.replace(/\*([^*]+)\*/g, '$1');
    s = s.replace(/__([^_]+)__/g, '$1');
    s = s.replace(/_([^_]+)_/g, '$1');

    // 6. Remove headings symbols at start of lines: # Hello -> Hello
    s = s.replace(/^\s*#+\s+/gm, ' ');

    // 7. Replace list bullets at start of lines with a pause/comma: * item -> , item
    s = s.replace(/^\s*[-*+]\s+/gm, ', ');
    s = s.replace(/^\s*\d+\.\s+/gm, ', ');

    // 8. Remove raw URLs or replace with "link"
    s = s.replace(/https?:\/\/[^\s]+/gi, 'link');

    // 9. Remove technical files like sessions/2026-03-17.md#L1-L24, and "Fonte: " prefixes
    s = s.replace(/Fonte:\s*[a-zA-Z0-9_\.\-\/#:]+/gi, ' ');
    s = s.replace(/[a-zA-Z0-9_\.\-\/]+\.(md|ts|tsx|js|json|py|html|css)(#L\d+(-L\d+)?)?/gi, ' ');
    s = s.replace(/\bFonte\b/gi, ' ');

    // 10. Remove brackets, footnotes [1] or left-over brackets
    s = s.replace(/\[\d+\]/g, ' ');
    s = s.replace(/\[\s*\]/g, ' ');
    s = s.replace(/\(\s*\)/g, ' ');

    // 11. Reduce multiple newlines and spaces to keep simple punctuation pauses
    s = s.replace(/\n+/g, ' ');
    s = s.replace(/\s+/g, ' ');

    // 12. Trim whitespace
    return s.trim();
  }

  /**
   * Splits normalized speech text into chunks.
   * The first chunk is very small (120-180 chars) for low startup latency.
   * Subsequent chunks are larger (250-400 chars).
   */
  public splitIntoChunks(text: string): string[] {
    const normalized = this.normalizeTextForSpeech(text);
    if (!normalized) return [];

    // Split by common sentence terminators and pauses (., ?, !, ,, :) while keeping the delimiter
    const sentences = normalized.match(/[^.!?,\:]+[.!?,\:]*\s*/g) || [normalized];
    
    const chunks: string[] = [];
    let firstChunk = '';
    let sentenceIndex = 0;
    
    if (sentences.length > 0) {
      let firstSentence = sentences[0].trim();
      if (firstSentence.length > 220) {
        // First sentence is too long, we must split it
        let cutIdx = firstSentence.lastIndexOf(' ', 120);
        if (cutIdx === -1 || cutIdx < 50) {
          cutIdx = firstSentence.lastIndexOf(' ', 180);
        }
        if (cutIdx === -1 || cutIdx > 220) {
          cutIdx = firstSentence.lastIndexOf(' ', 220);
        }
        if (cutIdx === -1) {
          cutIdx = 120; // Hard cut
        }
        firstChunk = firstSentence.substring(0, cutIdx).trim();
        sentences[0] = firstSentence.substring(cutIdx).trim();
        sentenceIndex = 0;
      } else {
        // First sentence is <= 220. We will use it.
        // If it is < 80 characters, we try to merge next sentences/paragraphs to make it between 120 and 220 characters
        firstChunk = firstSentence;
        sentenceIndex = 1;
        
        if (firstChunk.length < 80) {
          while (firstChunk.length < 120 && sentenceIndex < sentences.length) {
            const nextSentence = sentences[sentenceIndex].trim();
            if (!nextSentence) {
              sentenceIndex++;
              continue;
            }
            
            if ((firstChunk + ' ' + nextSentence).length <= 220) {
              console.log('[PULSO_TTS_FIRST_CHUNK_TOO_SHORT_MERGED]', { 
                previous: firstChunk, 
                appended: nextSentence 
              });
              firstChunk = (firstChunk + ' ' + nextSentence).trim();
              sentenceIndex++;
            } else {
              const maxAdd = 220 - firstChunk.length - 1;
              if (maxAdd > 20) {
                let cutIdx = nextSentence.lastIndexOf(' ', maxAdd);
                if (cutIdx === -1 || cutIdx < 10) {
                  cutIdx = maxAdd;
                }
                const toAppend = nextSentence.substring(0, cutIdx).trim();
                const remainder = nextSentence.substring(cutIdx).trim();
                
                if (toAppend) {
                  console.log('[PULSO_TTS_FIRST_CHUNK_TOO_SHORT_MERGED]', {
                    previous: firstChunk,
                    appended: toAppend,
                    splitApplied: true
                  });
                  firstChunk = (firstChunk + ' ' + toAppend).trim();
                }
                
                if (remainder) {
                  sentences[sentenceIndex] = remainder;
                } else {
                  sentenceIndex++;
                }
              }
              break;
            }
          }
        }
      }
    }

    if (firstChunk) {
      chunks.push(firstChunk);
    }

    let currentChunk = '';
    for (let i = sentenceIndex; i < sentences.length; i++) {
      let sentence = sentences[i].trim();
      if (!sentence) continue;

      if ((currentChunk + ' ' + sentence).trim().length <= 400) {
        currentChunk = currentChunk ? (currentChunk + ' ' + sentence) : sentence;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        if (sentence.length > 400) {
          let remaining = sentence;
          while (remaining.length > 400) {
            let splitIdx = remaining.lastIndexOf(' ', 400);
            if (splitIdx === -1 || splitIdx < 100) {
              splitIdx = 400; // hard cut
            }
            chunks.push(remaining.substring(0, splitIdx).trim());
            remaining = remaining.substring(splitIdx).trim();
          }
          currentChunk = remaining;
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(c => c.length > 0);
  }

  private async getChunkAudio(chunkText: string, provider: TTSProvider, voice: string, rate: number, signal?: AbortSignal): Promise<Blob> {
    const cacheKey = `${provider}:${voice}:${rate}:${chunkText}`;
    if (this.audioCache.has(cacheKey)) {
      console.log('[PULSO_TTS_CACHE_HIT]', { cacheKey });
      return this.audioCache.get(cacheKey)!;
    }

    if (provider === 'local_kokoro_sidecar') {
      const response = await fetch('http://127.0.0.1:14321', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunkText,
          voice: voice || 'pf_dora',
          speed: rate,
          lang: 'pt-br'
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Kokoro sidecar returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Kokoro sidecar error: ${data.error}`);
      }

      const base64Wav = data.audio;
      const byteCharacters = atob(base64Wav);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      this.audioCache.set(cacheKey, blob);
      return blob;
    }

    let endpoint = getKokoroEndpoint();
    if (provider === 'local_kokoro_sidecar') {
      endpoint = 'http://127.0.0.1:14321/v1/audio/speech';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: chunkText,
        voice: voice || 'pf_dora',
        response_format: 'mp3',
        speed: rate
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Kokoro request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    this.audioCache.set(cacheKey, blob);
    return blob;
  }

  /**
   * Speaks the text using the selected provider.
   */
  public async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onPreparing?: () => void
  ) {
    const startTime = performance.now();
    console.log('[PULSO_TTS_CLICK]');

    // Cancel current speech to prevent queue overlapping
    this.cancel();

    if (!text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    const playSessionId = ++this.globalPlaySessionId;
    this.currentPlaySessionId = playSessionId;
    this.sessionStartTime = startTime;
    this.currentAbortController = new AbortController();
    const isSessionActive = () => this.currentPlaySessionId === playSessionId;

    if (onPreparing) onPreparing();

    const isTauri = isTauriApp();
    const isRemoteWeb = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1';
    
    let endpoint = getKokoroEndpoint();
    if (this.preferences.ttsProvider === 'local_kokoro_sidecar') {
      endpoint = 'http://127.0.0.1:14321/v1/audio/speech';
    }
    const isEndpointLocalhost = endpoint.includes('127.0.0.1') || endpoint.includes('localhost');

    console.log('[PULSO_WEB_TTS_PROVIDER_DETECTED]', { 
      provider: this.preferences.ttsProvider, 
      isTauri, 
      isRemoteWeb, 
      endpoint 
    });

    const isKokoro = this.preferences.ttsProvider === 'local_kokoro' || this.preferences.ttsProvider === 'kokoro_http' || this.preferences.ttsProvider === 'local_kokoro_sidecar';
    
    let skipKokoro = false;
    if (this.preferences.ttsProvider === 'local_kokoro_sidecar') {
      if (isRemoteWeb) {
        console.log('[PULSO_WEB_TTS_KOKORO_SKIPPED_REMOTE_WEB]');
        skipKokoro = true;
      }
    } else if (isKokoro && isRemoteWeb && isEndpointLocalhost) {
      console.log('[PULSO_WEB_TTS_KOKORO_SKIPPED_NOT_LOCAL]', { endpoint });
      skipKokoro = true;
    }

    if (!isKokoro || skipKokoro) {
      const normalized = this.normalizeTextForSpeech(text);
      console.log('[PULSO_TTS_TEXT_NORMALIZED]', normalized, { durationMs: Math.round(performance.now() - startTime) });
      this.speakNative(normalized, onStart, onEnd);
      return;
    }

    // Process using Kokoro
    const normalizedText = this.normalizeTextForSpeech(text);
    console.log('[PULSO_TTS_TEXT_NORMALIZED]', normalizedText, { durationMs: Math.round(performance.now() - startTime) });

    const chunks = this.splitIntoChunks(text);
    console.log('[PULSO_TTS_CHUNKS_CREATED]', { chunkCount: chunks.length, durationMs: Math.round(performance.now() - startTime) });
    if (chunks.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    const voice = this.preferences.voiceName || 'pf_dora';
    const rate = this.preferences.rate;
    const provider = this.preferences.ttsProvider;

    const fetchPromises: Promise<Blob>[] = [];
    const fetchStartTimes: number[] = [];
    const getFetchPromise = (idx: number): Promise<Blob> => {
      if (!fetchPromises[idx]) {
        fetchStartTimes[idx] = performance.now();
        if (idx === 0) {
          console.log('[PULSO_TTS_FIRST_CHUNK_REQUEST]', { durationMs: Math.round(performance.now() - startTime) });
        } else {
          console.log('[PULSO_TTS_NEXT_CHUNK_PREFETCH]', { index: idx, durationMs: Math.round(performance.now() - startTime) });
        }
        const signal = this.currentAbortController?.signal;
        fetchPromises[idx] = this.getChunkAudio(chunks[idx], provider, voice, rate, signal);
      }
      return fetchPromises[idx];
    };

    // Proactive timer to alert if first chunk audio generation is slow (exceeds 1.5s)
    let isFirstAudioFinishedPreparing = false;
    const slowTimer = setTimeout(() => {
      if (!isFirstAudioFinishedPreparing && isSessionActive()) {
        console.warn('[PULSO_TTS_FIRST_AUDIO_SLOW]', { durationMs: Math.round(performance.now() - startTime) });
      }
    }, 1500);

    // Pre-fetch the first chunk immediately
    getFetchPromise(0).then(() => {
      if (chunks.length > 1 && isSessionActive()) {
        console.log('[PULSO_TTS_PREFETCH_NEXT_STARTED]', { index: 1, durationMs: Math.round(performance.now() - startTime) });
        getFetchPromise(1).catch(() => {});
      }
    }).catch(() => {});

    let currentIdx = 0;
    let isFirstPlayingTriggered = false;
    let audioEndedTime = 0;

    const playNext = async () => {
      if (!isSessionActive()) {
        return;
      }

      if (currentIdx >= chunks.length) {
        console.log('[PULSO_TTS_QUEUE_DONE]', { totalDurationMs: Math.round(performance.now() - startTime) });
        clearTimeout(slowTimer);
        if (onEnd) onEnd();
        return;
      }

      const chunkText = chunks[currentIdx];
      try {
        const blob = await getFetchPromise(currentIdx);
        if (!isSessionActive()) {
          return;
        }

        if (currentIdx === 0) {
          isFirstAudioFinishedPreparing = true;
          clearTimeout(slowTimer);
          const now = performance.now();
          const clickToReady = Math.round(now - startTime);
          const requestToReady = Math.round(now - fetchStartTimes[0]);
          console.log('[PULSO_TTS_FIRST_AUDIO_READY]', { 
            durationMs: clickToReady, 
            requestDurationMs: requestToReady 
          });
        }

        // Calculate and log gap between chunks
        if (currentIdx > 0 && audioEndedTime > 0) {
          const gap = Math.round(performance.now() - audioEndedTime);
          console.log('[PULSO_TTS_GAP_BETWEEN_CHUNKS_MS]', { index: currentIdx, gapMs: gap });
          if (gap > 700) {
            console.warn('[PULSO_TTS_GAP_TOO_LARGE]', { index: currentIdx, gapMs: gap });
          }
        }

        console.log('[PULSO_TTS_CHUNK_PLAYING]', { index: currentIdx, text: chunkText, durationMs: Math.round(performance.now() - startTime) });

        if (!isFirstPlayingTriggered) {
          isFirstPlayingTriggered = true;
          console.log('[PULSO_TTS_FIRST_AUDIO_PLAYING]', { durationMs: Math.round(performance.now() - startTime) });
          console.log('[PULSO_WEB_TTS_FIRST_AUDIO_PLAYING]');
          if (onStart) onStart();
        }

        // Start pre-fetching the next chunk in the background
        if (currentIdx + 1 < chunks.length) {
          getFetchPromise(currentIdx + 1).catch(err => {
            if (isSessionActive()) {
              console.warn('Background pre-fetch failed for index:', currentIdx + 1, err);
            }
          });
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = this.preferences.volume;
        this.currentAudio = audio;

        let audioStartedTime = performance.now();

        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          audioEndedTime = performance.now();
          
          if (currentIdx === 0) {
            const chunkDuration = Math.round(audioEndedTime - audioStartedTime);
            console.log('[PULSO_TTS_FIRST_CHUNK_DURATION_MS]', { durationMs: chunkDuration });
          }
          
          currentIdx++;
          playNext();
        };

        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          if (!isSessionActive()) return;

          console.warn('[PULSO_TTS_KOKORO_UNAVAILABLE_FALLBACK_NATIVE] Error playing audio element. Falling back to native for remaining chunks.', e);
          
          const remainingText = chunks.slice(currentIdx).join(' ');
          this.speakNative(remainingText, !isFirstPlayingTriggered ? onStart : undefined, onEnd);
        };

        await audio.play();

      } catch (err) {
        if (!isSessionActive()) {
          return;
        }
        console.warn('[PULSO_TTS_KOKORO_UNAVAILABLE_FALLBACK_NATIVE] Failed to generate chunk. Falling back to native for remaining chunks.', err);
        const remainingText = chunks.slice(currentIdx).join(' ');
        this.speakNative(remainingText, !isFirstPlayingTriggered ? onStart : undefined, onEnd);
      }
    };

    playNext();
  }

  /**
   * Speaks the text using browser native synthesis.
   */
  private speakNative(text: string, onStart?: () => void, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this environment.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply preferences
    utterance.rate = this.preferences.rate;
    utterance.pitch = this.preferences.pitch;
    utterance.volume = this.preferences.volume;

    const voices = this.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (this.preferences.voiceURI) {
      selectedVoice = voices.find(v => v.voiceURI === this.preferences.voiceURI) || null;
    }
    if (!selectedVoice && this.preferences.voiceName) {
      selectedVoice = voices.find(v => v.name === this.preferences.voiceName) || null;
    }

    // Fallback to default Portuguese voice if none set/found
    if (!selectedVoice) {
      selectedVoice = this.getDefaultPortugueseVoice();
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = 'pt-BR'; // ultimate fallback
    }

    utterance.onstart = () => {
      console.log('[PULSO_WEB_TTS_FIRST_AUDIO_PLAYING]');
      if (onStart) onStart();
    };
    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }
}
