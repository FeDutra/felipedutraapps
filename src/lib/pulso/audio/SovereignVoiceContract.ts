export type SovereignVoiceTracePhase =
  | 'speech_closed'
  | 'transcript_final'
  | 'answer_prepared'
  | 'sentences_committed'
  | 'canonical_dispatch_started'
  | 'canonical_request_created'
  | 'canonical_result_received'
  | 'first_output_audio'
  | 'playback_started'
  | 'playback_interrupted'
  | 'action_outcome_recorded';

export interface CommittedSpeechSentence {
  sentenceId: string;
  answerId: string;
  index: number;
  text: string;
  charCount: number;
}

export interface SovereignVoiceTracePoint {
  traceId: string;
  turnId: string;
  phase: SovereignVoiceTracePhase;
  turnElapsedMs: number;
  playbackEpoch: number;
  sentenceIndex?: number;
  requestBound?: boolean;
  occurredAt: string;
}

const splitLongSentence = (sentence: string, maxChars: number) => {
  const parts: string[] = [];
  let remaining = sentence.trim();
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(' ', maxChars);
    if (cut < Math.floor(maxChars * 0.55)) cut = maxChars;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
};

/** Unidades canônicas: o renderer pode antecipar áudio, nunca reescrever texto. */
export function commitSpeechSentences(
  answerId: string,
  text: string,
  maxChars = 240,
): ReadonlyArray<Readonly<CommittedSpeechSentence>> {
  const canonicalAnswerId = answerId.trim();
  const canonicalText = text.replace(/\s+/g, ' ').trim();
  if (!canonicalAnswerId || !canonicalText) return Object.freeze([]);
  if (!Number.isInteger(maxChars) || maxChars < 80) throw new Error('voice_sentence_max_chars_invalid');
  const raw = canonicalText.match(/[^.!?]+(?:[.!?]+|$)/g) || [canonicalText];
  const pieces = raw.flatMap(sentence => splitLongSentence(sentence, maxChars)).filter(Boolean);
  return Object.freeze(pieces.map((sentence, index) => Object.freeze({
    sentenceId: `${canonicalAnswerId}:sentence:${index + 1}`,
    answerId: canonicalAnswerId,
    index,
    text: sentence,
    charCount: sentence.length,
  })));
}

/** Barge-in avança a época e torna callbacks/buffers antigos inofensivos. */
export class PlaybackEpoch {
  private value = 0;

  current() { return this.value; }
  advance() { this.value += 1; return this.value; }
  accepts(epoch: number) { return epoch === this.value; }
}

/** Metadados somente. Conteúdo, áudio e transcrição nunca entram no trace. */
export class SovereignVoiceTrace {
  private starts = new Map<string, number>();
  private sequence = 0;
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) { this.now = now; }

  beginTurn(turnId: string) { this.starts.set(turnId, this.now()); }

  mark(
    turnId: string,
    phase: SovereignVoiceTracePhase,
    playbackEpoch: number,
    details: Pick<SovereignVoiceTracePoint, 'sentenceIndex' | 'requestBound'> = {},
  ): SovereignVoiceTracePoint {
    if (!this.starts.has(turnId)) this.beginTurn(turnId);
    const startedAt = this.starts.get(turnId) as number;
    const occurredAtMs = this.now();
    return Object.freeze({
      traceId: `voice_trace_${++this.sequence}`,
      turnId,
      phase,
      turnElapsedMs: Math.max(0, Math.round(occurredAtMs - startedAt)),
      playbackEpoch,
      ...details,
      occurredAt: new Date(occurredAtMs).toISOString(),
    });
  }

  closeTurn(turnId: string) { this.starts.delete(turnId); }
}
