export interface PresenceMesaArtifact {
  id: string;
  title: string;
  content: string;
  contextId?: string;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMesaDismissUtterance(input: string) {
  const text = normalize(input);
  if (!text) return false;

  if (/^(obrigado|obrigada|valeu|perfeito|beleza)$/.test(text)) return true;

  const asksToClose = /\b(fecha|fechar|feche|recolhe|recolher|recolha|some|tirar|tira|guarda|guardar|esconde|esconder)\b/.test(text);
  const namesSurface = /\b(mesa|lateral|painel|tela|resumo|analise|resultado|isso|ela)\b/.test(text);
  const asksToCenter = /\b(volta|voltar|retorna|retornar)\b/.test(text) && /\b(centro|lótus|lotus)\b/.test(text);

  return (asksToClose && namesSurface) || asksToCenter;
}

export function shouldOpenPresenceMesa(resultText: string) {
  const text = resultText.trim();
  if (!text) return false;
  if (/<pulso-doc\b/i.test(text)) return true;
  if (text.length >= 520) return true;

  const structuralSignals = [
    /^#{1,3}\s+/m,
    /^\s*[-*]\s+/m,
    /^\s*\d+[.)]\s+/m,
    /^\|.+\|$/m,
    /\*\*[^*]+\*\*/,
  ].filter(pattern => pattern.test(text)).length;

  return text.length >= 300 && structuralSignals >= 2;
}

export function createPresenceMesaArtifact(args: {
  requestId: string;
  resultText: string;
  contextId?: string;
  areaName?: string;
  sessionLabel?: string;
}): PresenceMesaArtifact {
  const docMatch = args.resultText.match(/<pulso-doc\s+id="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/pulso-doc>/i);
  if (docMatch) {
    return {
      id: docMatch[1],
      title: docMatch[2],
      content: docMatch[3].trim(),
      contextId: args.contextId,
    };
  }

  const subject = args.areaName || args.sessionLabel || 'Leitura da Lótus';
  return {
    id: `presence-${args.requestId}`,
    title: `${subject.toLocaleUpperCase('pt-BR')} · leitura`,
    content: args.resultText.trim(),
    contextId: args.contextId,
  };
}
