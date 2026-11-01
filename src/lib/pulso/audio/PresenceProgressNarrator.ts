const MIN_STREAM_CHUNK_CHARS = 72;
const MAX_STREAM_CHUNK_CHARS = 280;
const MIN_RESERVED_TAIL_CHARS = 16;

export function normalizePresenceNarration(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_~>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function narrationKey(text: string) {
  return normalizePresenceNarration(text)
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function findNaturalBoundary(text: string, minimum: number, maximum: number) {
  const bounded = text.slice(0, maximum + 1);
  const sentencePattern = /[.!?](?=\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = sentencePattern.exec(bounded))) {
    const boundary = match.index + 1;
    if (
      boundary >= minimum
      && text.slice(boundary).trim().length >= MIN_RESERVED_TAIL_CHARS
    ) return boundary;
  }

  const paragraphBoundary = bounded.lastIndexOf('\n\n');
  if (
    paragraphBoundary >= minimum
    && text.slice(paragraphBoundary).trim().length >= MIN_RESERVED_TAIL_CHARS
  ) return paragraphBoundary;
  return -1;
}

/**
 * Converte apenas material público já produzido pelo runtime em unidades
 * faláveis. Não cria fillers, não resume raciocínio oculto e não inventa
 * estado de trabalho.
 */
export class PresenceProgressNarrator {
  private spokenKeys = new Set<string>();
  private streamedOffset = 0;
  private lastAccumulatedText = '';

  acceptCheckpoint(text: string): string | null {
    const normalized = normalizePresenceNarration(text);
    const key = narrationKey(normalized);
    if (!normalized || normalized.length < 12 || !key || this.spokenKeys.has(key)) return null;
    this.spokenKeys.add(key);
    return normalized.slice(0, MAX_STREAM_CHUNK_CHARS).trim();
  }

  /**
   * Recebe a resposta acumulada do Core. Só libera frases completas; o trecho
   * ainda em construção permanece reservado para a conclusão.
   */
  acceptAccumulatedResponse(accumulatedText: string): string | null {
    const source = String(accumulatedText || '');
    if (!source.startsWith(this.lastAccumulatedText)) {
      this.streamedOffset = 0;
    }
    this.lastAccumulatedText = source;

    const pending = source.slice(this.streamedOffset);
    if (pending.length < MIN_STREAM_CHUNK_CHARS) return null;
    const boundary = findNaturalBoundary(
      pending,
      MIN_STREAM_CHUNK_CHARS,
      MAX_STREAM_CHUNK_CHARS,
    );
    if (boundary < 0) return null;

    const rawChunk = pending.slice(0, boundary);
    this.streamedOffset += boundary;
    const normalized = normalizePresenceNarration(rawChunk);
    const key = narrationKey(normalized);
    if (!normalized || !key || this.spokenKeys.has(key)) return null;
    this.spokenKeys.add(key);
    return normalized;
  }

  finalRemainder(finalText: string): string {
    const rawRemainder = String(finalText || '').slice(this.streamedOffset);
    const normalized = normalizePresenceNarration(rawRemainder);
    if (normalized) return normalized;

    // Se a resposta inteira já foi vocalizada em progresso, não repetimos.
    return '';
  }
}
