export interface PresenceWakeWordMatch {
  matched: boolean;
  commandText: string;
  matchedAlias?: string;
}

export const DEFAULT_PRESENCE_WAKE_ALIASES = ['lótus', 'lotus', 'lotos'] as const;

function normalizeForWakeWord(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[“”"'\`´]/g, '')
    .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripOptionalCallPrefix(value: string) {
  return value.replace(/^(?:ei|ola|olá|oi)\s+/i, '');
}

/**
 * Reconhece a invocação local da Lótus no começo da fala e devolve somente o
 * pedido substantivo. A comparação ignora acentos porque o STT local alterna
 * entre "Lótus", "Lotus" e "Lotos"; nenhuma fala sem invocação é encaminhada.
 */
export function parsePresenceWakeUtterance(
  transcript: string,
  aliases: readonly string[] = DEFAULT_PRESENCE_WAKE_ALIASES,
): PresenceWakeWordMatch {
  const normalizedTranscript = normalizeForWakeWord(transcript);
  const callableTranscript = stripOptionalCallPrefix(normalizedTranscript);

  for (const alias of aliases) {
    const normalizedAlias = normalizeForWakeWord(alias);
    if (!normalizedAlias) continue;
    if (callableTranscript !== normalizedAlias && !callableTranscript.startsWith(`${normalizedAlias} `)) {
      continue;
    }

    const normalizedCommand = callableTranscript.slice(normalizedAlias.length).trim();
    const originalWords = transcript.trim().split(/\s+/);
    const prefixWords = normalizedTranscript === callableTranscript ? 0 : 1;
    const aliasWords = normalizedAlias.split(' ').length;
    const commandText = originalWords.slice(prefixWords + aliasWords).join(' ')
      .replace(/^[,.:;!?\-–—]+\s*/, '')
      .trim();

    return {
      matched: true,
      commandText: commandText || normalizedCommand,
      matchedAlias: alias,
    };
  }

  return { matched: false, commandText: '' };
}
