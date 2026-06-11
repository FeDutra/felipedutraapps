/**
 * @file intentInterpreter.ts
 * @description Local deterministic classifier for Lótus Live commands.
 * Matches keywords and maps them to canonical operations without calling external LLMs.
 */

export interface Interpretation {
  intent: 'consulta_tarefas' | 'consulta_projetos' | 'consulta_agentes' | 'consulta_fontes' | 'comando_mensagem' | 'comando_criacao' | 'comando_indefinido';
  domain: 'tarefas' | 'projetos' | 'agentes' | 'fontes' | 'mensagens' | 'criacao' | 'geral';
  sourcesNeeded: string[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  canExecuteNow: boolean;
  suggestedReply: string;
}

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export const interpretIntent = (rawText: string): Interpretation => {
  const text = normalizeText(rawText);

  // 1. comando_mensagem
  if (
    text.includes("mande mensagem") ||
    text.includes("enviar mensagem") ||
    text.includes("avise ") ||
    text.includes("avise-me") ||
    text.includes("mandar para") ||
    text.includes("fale com") ||
    text.includes("enviar para") ||
    text.includes("mensagem para")
  ) {
    return {
      intent: 'comando_mensagem',
      domain: 'mensagens',
      sourcesNeeded: ['pulso_events', 'pulso_people'],
      riskLevel: 'high',
      requiresConfirmation: true,
      canExecuteNow: false,
      suggestedReply: 'Identifiquei a intenção de enviar uma mensagem. Por segurança, este comando de escrita exige confirmação humana expressa.'
    };
  }

  // 2. comando_criacao
  if (
    text.includes("crie") ||
    text.includes("criar") ||
    text.includes("registre") ||
    text.includes("registrar") ||
    text.includes("adicione") ||
    text.includes("adicionar") ||
    text.includes("salve") ||
    text.includes("salvar") ||
    text.includes("nova tarefa") ||
    text.includes("novo projeto")
  ) {
    return {
      intent: 'comando_criacao',
      domain: 'criacao',
      sourcesNeeded: [],
      riskLevel: 'medium',
      requiresConfirmation: true,
      canExecuteNow: false,
      suggestedReply: 'Identifiquei a intenção de criar uma entidade estrutural. Por segurança, essa escrita no ecossistema exige confirmação humana expressa.'
    };
  }

  // 3. consulta_tarefas
  if (
    text.includes("tarefa") ||
    text.includes("atrasad") ||
    text.includes("depende de mim") ||
    text.includes("meu dia") ||
    text.includes("meus prazos") ||
    text.includes("prazos") ||
    text.includes("limite") ||
    text.includes("vencid")
  ) {
    return {
      intent: 'consulta_tarefas',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks', 'pulso_projects', 'pulso_people'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: 'Entendi como uma consulta operacional sobre tarefas. Posso analisar tarefas abertas, vencidas, sem responsável e vinculadas aos projetos ativos.'
    };
  }

  // 4. consulta_projetos
  if (
    text.includes("projeto") ||
    text.includes("travad") ||
    text.includes("frente") ||
    text.includes("ecossistema") ||
    text.includes("andamento")
  ) {
    return {
      intent: 'consulta_projetos',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects', 'pulso_tasks', 'pulso_areas'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: 'Entendi como uma consulta de ecossistema sobre projetos. Posso buscar o status de frentes ativas, marcos pendentes e desvios de prazo.'
    };
  }

  // 5. consulta_agentes
  if (
    text.includes("agente") ||
    text.includes("trabalhando") ||
    text.includes("caiu") ||
    text.includes("metabolismo") ||
    text.includes("cron") ||
    text.includes("rotina") ||
    text.includes("alerta") ||
    text.includes("instabilidade")
  ) {
    return {
      intent: 'consulta_agentes',
      domain: 'agentes',
      sourcesNeeded: ['pulso_agents', 'pulso_routines', 'pulso_alerts'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: 'Entendi como uma consulta de metabolismo sobre agentes. Posso atestar o batimento das rotinas recorrentes e integridade dos orquestradores.'
    };
  }

  // 6. consulta_fontes
  if (
    text.includes("fonte") ||
    text.includes("notion") ||
    text.includes("obsidian") ||
    text.includes("whatsapp") ||
    text.includes("calendar") ||
    text.includes("calendario") ||
    text.includes("gmail") ||
    text.includes("sheets") ||
    text.includes("planilha")
  ) {
    return {
      intent: 'consulta_fontes',
      domain: 'fontes',
      sourcesNeeded: ['pulso_sources'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: 'Entendi como uma consulta de infraestrutura sobre fontes sintonizadas. Posso listar conexões com Obsidian, Notion, Google e WhatsApp.'
    };
  }

  // 7. comando_indefinido
  return {
    intent: 'comando_indefinido',
    domain: 'geral',
    sourcesNeeded: [],
    riskLevel: 'low',
    requiresConfirmation: false,
    canExecuteNow: false,
    suggestedReply: 'Desculpe, não consegui compreender a intenção com clareza. Pode reescrever o comando descrevendo a tarefa ou consulta desejada?'
  };
};
