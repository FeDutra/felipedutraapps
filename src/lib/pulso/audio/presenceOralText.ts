const TECHNICAL_TOKEN = /(^|\s)(\/[^\s]+|[A-Za-z]:\\[^\s]*|https?:\/\/\S+|sha[- ]?256\b[^\s]*|pid\s+\d+)/gi;
const TECHNICAL_LINE = /^(stack trace|stderr|stdout|exit code)\b/i;

function cleanSurfaceText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]\s|\d+[.)]\s)/gm, '')
    .replace(/[*_~|]/g, '')
    .split('\n')
    .map(line => line.replace(TECHNICAL_TOKEN, ' ').trim())
    .filter(line => line && !TECHNICAL_LINE.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentences(value: string) {
  return value.match(/[^.!?]+[.!?]?/g)?.map(item => item.trim()).filter(Boolean) ?? [];
}

function clampWords(value: string, maxWords: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

/**
 * Projeta texto público para fala. Não consulta outro modelo, não inventa
 * andamento e não substitui a resposta integral preservada no chat.
 */
export function toPresenceCheckpointSpeech(value: string) {
  const clean = cleanSurfaceText(value);
  return clampWords(sentences(clean)[0] ?? clean, 24);
}

export function toPresenceResultSpeech(value: string) {
  const clean = cleanSurfaceText(value);
  const selected = sentences(clean).slice(0, 3).join(' ');
  return clampWords(selected || clean, 72);
}
