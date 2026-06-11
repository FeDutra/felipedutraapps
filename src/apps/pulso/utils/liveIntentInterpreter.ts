/**
 * @file liveIntentInterpreter.ts
 * @description Local deterministic classifier for Lótus Live.
 * Queries real-time Firestore context and builds:
 *   - natural-language summaries (suggestedReply)
 *   - structured handoff contracts for OpenClaw (read-only + proposal mode)
 *
 * v1.3: Added LiveHandoff interface with executionPrompt generation.
 * No executions are triggered here — all output is proposal-only.
 */

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────

export interface LiveContext {
  tasks: any[];
  projects: any[];
  areas: any[];
  agents: any[];
  routines: any[];
  requests: any[];
  logs: any[];
  sources: any[];
}

export interface LiveHandoff {
  /** Always 'openclaw' — the execution target for this contract */
  target: 'openclaw';
  /** Always 'proposal_only' in v1.3 — no automatic execution */
  mode: 'proposal_only';
  canExecuteNow: boolean;
  requiresHumanConfirmation: boolean;
  intent: string;
  domain: string;
  riskLevel: 'low' | 'medium' | 'high';
  actionType: 'read' | 'create_proposal' | 'update_proposal' | 'external_message_proposal' | 'undefined';
  /** People, tools, or systems explicitly mentioned in the raw command */
  entitiesMentioned: string[];
  /** Human-readable next recommended step */
  suggestedNextStep: string;
  /**
   * Structured prompt ready to be sent to OpenClaw/Lótus for processing.
   * This is the core deliverable of the handoff contract.
   */
  executionPrompt: string;
}

export interface LiveInterpretation {
  intent: string;
  domain: 'tarefas' | 'projetos' | 'agentes' | 'fontes' | 'mensagens' | 'criacao' | 'comunicacao' | 'geral';
  sourcesNeeded: string[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  canExecuteNow: boolean;
  suggestedReply: string;
  /** OpenClaw handoff contract — generated deterministically, never auto-executed */
  handoff: LiveHandoff;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const safeGetTime = (dateInput: any): number => {
  if (!dateInput) return 0;
  if (dateInput instanceof Date) return dateInput.getTime();
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    return dateInput.toDate().getTime();
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return dateInput.seconds * 1000;
  }
  if (typeof dateInput === 'string') {
    const t = Date.parse(dateInput);
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

/** Extracts recognized entities (people, tools) from normalized command text */
const extractEntities = (normalizedText: string): string[] => {
  const entities: string[] = [];

  const knownPeople = [
    { key: 'bruna', label: 'Bruna' },
    { key: 'nati', label: 'Nati' },
    { key: 'natalia', label: 'Natália' },
    { key: 'felipe', label: 'Felipe' },
    { key: ' fe ', label: 'Felipe' },
  ];
  const knownTools = [
    { key: 'notion', label: 'Notion' },
    { key: 'obsidian', label: 'Obsidian' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'gmail', label: 'Gmail' },
    { key: 'calendar', label: 'Google Calendar' },
    { key: 'sheets', label: 'Google Sheets' },
    { key: 'openclaw', label: 'OpenClaw' },
  ];

  knownPeople.forEach(p => { if (normalizedText.includes(p.key)) entities.push(p.label); });
  knownTools.forEach(t => { if (normalizedText.includes(t.key)) entities.push(t.label); });

  return [...new Set(entities)];
};

// ─────────────────────────────────────────────
// Main Interpreter
// ─────────────────────────────────────────────

export const interpretLiveIntent = (rawText: string, ctx: LiveContext): LiveInterpretation => {
  const text = normalizeText(rawText);
  const now = Date.now();
  const entities = extractEntities(text);

  // ── Safe selectors ──────────────────────────
  const tasks = (ctx.tasks || []).filter(t => t && t.archived !== true);
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const projects = (ctx.projects || []).filter(p => p && p.archived !== true);
  const activeProjects = projects.filter(p => p.status === 'active');
  const agents = (ctx.agents || []).filter(a => a && a.archived !== true);
  const routines = (ctx.routines || []).filter(r => r && r.archived !== true);
  const requests = (ctx.requests || []).filter(r => r && r.archived !== true);
  const sources = (ctx.sources || []).filter(s => s && s.status === 'active');

  const feTasks = openTasks.filter((t: any) => {
    const refs = t.ownerRefs;
    if (!refs || !Array.isArray(refs) || refs.length === 0) return true;
    return refs.some((ref: string) => ref.toLowerCase() === 'felipe' || ref.toLowerCase() === 'fe');
  });

  const overdueTasks = openTasks.filter((t: any) => {
    const due = t.dueDate || t.dueAt;
    if (!due) return false;
    const dueTime = safeGetTime(due);
    return dueTime > 0 && dueTime < now;
  });

  const steplessProjects = activeProjects.filter(
    (p: any) => !p.nextStep || p.nextStep.trim() === ''
  );

  const brokenRoutines = routines.filter(r => r.status === 'broken' || r.status === 'failed');
  const inactiveAgents = agents.filter(a => a.status !== 'active');

  // ── 1. comando_mensagem ──────────────────────
  if (
    text.includes('mande mensagem') ||
    text.includes('enviar mensagem') ||
    text.includes('avise ') ||
    text.includes('avise-me') ||
    text.includes('mandar para') ||
    text.includes('fale com') ||
    text.includes('enviar para') ||
    text.includes('mensagem para')
  ) {
    const recipient = text.includes('bruna') ? 'Bruna' : text.includes('nati') ? 'Nati' : 'destinatário';
    const allEntities = [...new Set([...entities, recipient !== 'destinatário' ? recipient : ''])].filter(Boolean);

    return {
      intent: 'comando_mensagem',
      domain: 'comunicacao',
      sourcesNeeded: ['pulso_events', 'pulso_people'],
      riskLevel: 'high',
      requiresConfirmation: true,
      canExecuteNow: false,
      suggestedReply:
        `Entendi. Eu enviaria uma mensagem para ${recipient}, mas nesta versão ainda estou operando em modo de leitura/proposta. A ação de envio está bloqueada por segurança.\n\nSugestão de conteúdo: "Olá, gostaria de alinhar as pendências operacionais hoje."\nDestinatário provável: ${recipient}.`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: true,
        intent: 'comando_mensagem',
        domain: 'comunicacao',
        riskLevel: 'high',
        actionType: 'external_message_proposal',
        entitiesMentioned: allEntities,
        suggestedNextStep: `Confirmar conteúdo da mensagem para ${recipient} e aguardar aprovação humana antes de qualquer envio.`,
        executionPrompt: `Preparar proposta de mensagem para ${recipient}. Não enviar. Solicitar conteúdo da mensagem caso não tenha sido informado. Confirmar canal de envio (WhatsApp ou email). Aguardar confirmação humana explícita antes de qualquer despacho.`,
      },
    };
  }

  // ── 2. comando_criacao ───────────────────────
  if (
    text.includes('crie') ||
    text.includes('criar') ||
    text.includes('registre') ||
    text.includes('registrar') ||
    text.includes('adicione') ||
    text.includes('adicionar') ||
    text.includes('salve') ||
    text.includes('salvar')
  ) {
    let entityType = 'entidade';
    if (text.includes('tarefa')) entityType = 'tarefa';
    else if (text.includes('projeto')) entityType = 'projeto';
    else if (text.includes('area') || text.includes('área')) entityType = 'área';

    return {
      intent: 'comando_criacao',
      domain: 'criacao',
      sourcesNeeded: [],
      riskLevel: 'medium',
      requiresConfirmation: true,
      canExecuteNow: false,
      suggestedReply: `Entendi. Eu criaria um(a) novo(a) ${entityType} no sistema, mas nesta versão a execução automática está suspensa (modo leitura/proposta). A criação real está bloqueada.\n\nSugestão de proposta:\n• Tipo: ${entityType.toUpperCase()}\n• Título proposto: "${rawText.substring(0, 50)}"\n• Prioridade recomendada: média.`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: true,
        intent: 'comando_criacao',
        domain: 'criacao',
        riskLevel: 'medium',
        actionType: 'create_proposal',
        entitiesMentioned: entities,
        suggestedNextStep: `Apresentar preview do(a) ${entityType} que seria criado(a) e aguardar confirmação humana antes de qualquer persistência.`,
        executionPrompt: `Propor criação de ${entityType} com base no comando: "${rawText.substring(0, 100)}". Extrair: título, responsável, prazo, projeto/área relacionado. Antes de criar, confirmar projeto/área se estiver ambíguo. Apresentar proposta estruturada. Não executar sem confirmação humana explícita.`,
      },
    };
  }

  // ── 3. tarefas_sem_responsavel ───────────────
  if (
    text.includes('sem responsavel') ||
    text.includes('sem dono') ||
    text.includes('sem atribu')
  ) {
    const unassigned = openTasks.filter(
      t => !t.ownerRefs || !Array.isArray(t.ownerRefs) || t.ownerRefs.length === 0
    );
    const names = unassigned
      .slice(0, 3)
      .map(t => `"${t.title || t.name}"`)
      .join(', ');
    const listText =
      unassigned.length > 0
        ? `As principais são: ${names}${unassigned.length > 3 ? ` e mais ${unassigned.length - 3} itens` : ''}.`
        : 'Nenhuma tarefa aberta sem responsável foi encontrada.';

    return {
      intent: 'tarefas_sem_responsavel',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Identifiquei **${unassigned.length}** tarefas ativas sem responsável claro designado no momento. ${listText} Minha recomendação é atribuir responsáveis para essas frentes para evitar gargalos.`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'tarefas_sem_responsavel',
        domain: 'tarefas',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Listar tarefas sem ownerRefs e sugerir responsáveis baseados em histórico de atribuições similares.',
        executionPrompt: `Consultar pulso_tasks filtrando tarefas onde ownerRefs está vazio ou ausente e status !== 'completed'. Listar os resultados com título, área e projeto vinculados. Sugerir responsáveis baseados em histórico de trabalho. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 4. tarefas_sem_projeto ───────────────────
  if (
    text.includes('sem projeto') ||
    text.includes('sem vinculo') ||
    text.includes('soltas')
  ) {
    const projectless = openTasks.filter(t => !t.projectRef && !t.projectId);
    const names = projectless
      .slice(0, 3)
      .map(t => `"${t.title || t.name}"`)
      .join(', ');
    const listText =
      projectless.length > 0
        ? `As mais urgentes parecem ser: ${names}${projectless.length > 3 ? ` e mais ${projectless.length - 3} itens` : ''}.`
        : 'Não encontrei nenhuma tarefa ativamente sem projeto.';

    return {
      intent: 'tarefas_sem_projeto',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Encontrei **${projectless.length}** tarefas abertas que estão sem vínculo a qualquer projeto do ecossistema. ${listText} Sugiro associá-las a frentes de trabalho ativas para manter o alinhamento.`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'tarefas_sem_projeto',
        domain: 'tarefas',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Exibir lista de tarefas sem projectRef e propor vinculação a projetos ativos.',
        executionPrompt: `Consultar pulso_tasks filtrando tarefas onde projectRef e projectId estão ausentes e status !== 'completed'. Listar resultados com título e área. Sugerir projeto de vinculação baseado em palavras-chave do título. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 5. consulta_tarefas ──────────────────────
  if (
    text.includes('como estao minhas tarefas') ||
    text.includes('o que depende de mim') ||
    text.includes('minhas tarefas') ||
    text.includes('tarefa') ||
    text.includes('meus prazos')
  ) {
    const overdueList = overdueTasks
      .slice(0, 3)
      .map(t => `"${t.title || t.name}"`)
      .join(', ');
    const reply =
      `Você possui **${openTasks.length}** tarefas ativas no ecossistema, sendo que **${feTasks.length}** estão atribuídas diretamente a você.\n` +
      `Identifiquei **${overdueTasks.length}** tarefas em atraso${overdueTasks.length > 0 ? ` (como ${overdueList})` : ''}.\n` +
      `Minha recomendação é focar em resolver primeiro as tarefas atrasadas e aquelas atreladas a você.`;

    return {
      intent: 'consulta_tarefas',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks', 'pulso_projects', 'pulso_people'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'consulta_tarefas',
        domain: 'tarefas',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: ['Felipe', ...entities],
        suggestedNextStep: 'Detalhar tarefas atrasadas e propor ordem de priorização para o dia.',
        executionPrompt: `Consultar tarefas ativas relacionadas ao Felipe (ownerRefs contém 'felipe' ou 'fe'), priorizando: (1) atrasadas por prazo, (2) sem responsável definido, (3) sem projeto vinculado, (4) alta prioridade. Retornar contagens e lista dos top-5 itens. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 6. projetos_sem_passo ────────────────────
  if (
    text.includes('sem proximo passo') ||
    text.includes('sem passo') ||
    text.includes('projetos sem passo')
  ) {
    const names = steplessProjects
      .slice(0, 3)
      .map(p => `"${p.name}"`)
      .join(', ');
    const listText =
      steplessProjects.length > 0
        ? `As frentes afetadas incluem: ${names}${steplessProjects.length > 3 ? ` e mais ${steplessProjects.length - 3} projetos` : ''}.`
        : 'Excelente! Todos os projetos ativos possuem próximos passos definidos.';

    return {
      intent: 'projetos_sem_passo',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Existem **${steplessProjects.length}** projetos ativos sem próximo passo configurado. ${listText} Recomendo abrir o Mapa Estratégico e registrar a próxima ação em cada um.`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'projetos_sem_passo',
        domain: 'projetos',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Listar projetos sem nextStep e sugerir próxima ação para cada um.',
        executionPrompt: `Consultar pulso_projects filtrando projetos ativos (status === 'active') onde nextStep está vazio ou ausente. Listar resultados com nome, área e última movimentação. Sugerir próximo passo para cada um baseado no histórico de tarefas associadas. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 7. projetos_travados ─────────────────────
  if (
    text.includes('travado') ||
    text.includes('estagnado') ||
    text.includes('bloqueado')
  ) {
    const names = steplessProjects
      .slice(0, 3)
      .map(p => `"${p.name}"`)
      .join(', ');
    const listText =
      steplessProjects.length > 0
        ? `Identifiquei frentes estagnadas por falta de marcos: ${names}${steplessProjects.length > 3 ? ` e mais ${steplessProjects.length - 3} projetos` : ''}.`
        : 'Não encontrei projetos ativamente travados ou estagnados no momento.';

    return {
      intent: 'projetos_travados',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects', 'pulso_tasks'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Análise operacional do ecossistema: temos **${activeProjects.length}** projetos ativos. **${steplessProjects.length}** deles estão travados/sem próximo passo. ${listText}`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'projetos_travados',
        domain: 'projetos',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Identificar causa-raiz de cada bloqueio e propor ação de desbloqueio.',
        executionPrompt: `Identificar projetos ativos (status === 'active') sem campo nextStep ou com nextStep vazio. Para cada um, verificar se há tarefas abertas bloqueadas ou sem responsável. Listar frentes estagnadas e propor ação de desbloqueio para cada uma. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 8. consulta_projetos ─────────────────────
  if (
    text.includes('projeto') ||
    text.includes('como estao meus projetos') ||
    text.includes('ecossistema')
  ) {
    const reply =
      `Atualmente temos **${activeProjects.length}** projetos ativos no ecossistema operando.\n` +
      `Dessas frentes, **${steplessProjects.length}** estão sem próximo passo definido.\n` +
      `Minha sugestão de ação é preencher os próximos passos dos projetos afetados para destravar o andamento das frentes de trabalho.`;

    return {
      intent: 'consulta_projetos',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects', 'pulso_tasks', 'pulso_areas'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'consulta_projetos',
        domain: 'projetos',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Listar projetos ativos com status, próximo passo e indicadores de bloqueio.',
        executionPrompt: `Listar projetos ativos (status === 'active') com: nome, área vinculada, nextStep, prazo (se houver) e contagem de tarefas abertas. Indicar quais estão sem nextStep. Priorizar projetos com mais de 3 tarefas abertas sem avanço. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 9. consulta_agentes ──────────────────────
  if (
    text.includes('agente') ||
    text.includes('rotina') ||
    text.includes('trabalhando') ||
    text.includes('caiu') ||
    text.includes('metabolismo') ||
    text.includes('cron')
  ) {
    const statusText =
      brokenRoutines.length > 0 || inactiveAgents.length > 0
        ? `Atenção: identifiquei **${brokenRoutines.length}** rotinas com falha recente e **${inactiveAgents.length}** agentes inativos.`
        : 'Metabolismo regular: todos os agentes operantes e rotinas recorrentes saudáveis.';

    return {
      intent: 'consulta_agentes',
      domain: 'agentes',
      sourcesNeeded: ['pulso_agents', 'pulso_routines', 'pulso_alerts'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply:
        `Status dos sistemas e agentes do PULSO:\n• Agentes ativos: **${agents.length - inactiveAgents.length}/${agents.length}**\n• Rotinas saudáveis: **${routines.length - brokenRoutines.length}/${routines.length}**\n\n${statusText}`,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'consulta_agentes',
        domain: 'agentes',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep:
          brokenRoutines.length > 0
            ? `Investigar causa de falha nas ${brokenRoutines.length} rotinas com status 'broken' ou 'failed'.`
            : 'Nenhuma ação imediata necessária — metabolismo saudável.',
        executionPrompt: `Verificar status de todos os agentes em pulso_agents e rotinas em pulso_routines. Listar: agentes inativos (status !== 'active'), rotinas com falha (status === 'broken' || 'failed') e últimas execuções anômalas nos logs. Indicar se o metabolismo está saudável ou requer intervenção. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 10. consulta_fontes ──────────────────────
  if (
    text.includes('fonte') ||
    text.includes('notion') ||
    text.includes('obsidian') ||
    text.includes('whatsapp') ||
    text.includes('sintoniz')
  ) {
    const listSources = sources.map(s => `🟢 ${s.name}`).join(', ');
    const reply =
      sources.length > 0
        ? `Temos **${sources.length}** fontes de dados sintonizadas e ativas no ecossistema: ${listSources}. Tudo sintonizado corretamente.`
        : 'Nenhuma fonte de dados externa está sintonizada ou ativa no momento.';

    return {
      intent: 'consulta_fontes',
      domain: 'fontes',
      sourcesNeeded: ['pulso_sources'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'consulta_fontes',
        domain: 'fontes',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Verificar fontes inativas e propor reconexão se necessário.',
        executionPrompt: `Verificar status de todas as fontes de dados em pulso_sources. Listar: fontes ativas (status === 'active'), fontes inativas ou com erro, e data da última sincronização bem-sucedida. Indicar quais precisam reconexão ou configuração. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 11. lotus_atividade ──────────────────────
  if (
    text.includes('lotus fez') ||
    text.includes('o que a lotus fez') ||
    text.includes('atividade') ||
    text.includes('logs') ||
    text.includes('feito')
  ) {
    const recentCommands = requests
      .filter((r: any) => r.requestType === 'conversation_command')
      .slice(0, 3)
      .map((r: any) => `• Comando: "${r.summary || r.title}"`);

    const reply =
      recentCommands.length > 0
        ? `Minhas últimas atividades registradas no barramento do PULSO:\n${recentCommands.join('\n')}\n\nTodos os logs técnicos adicionais podem ser visualizados na página de Logs.`
        : 'Nenhuma atividade conversacional recente registrada no feed.';

    return {
      intent: 'lotus_atividade',
      domain: 'geral',
      sourcesNeeded: ['pulso_requests', 'pulso_logs'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'lotus_atividade',
        domain: 'geral',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: entities,
        suggestedNextStep: 'Sintetizar as últimas ações da Lótus em linguagem operacional para o usuário.',
        executionPrompt: `Recuperar os últimos 10 documentos de pulso_requests ordenados por requestedAt descending. Recuperar os últimos 5 eventos de pulso_logs. Sintetizar em uma linha por item: o que foi feito, quando e por qual sistema. Destacar falhas ou itens com status 'failed'. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 12. resumo_dia ───────────────────────────
  if (
    text.includes('resumo do dia') ||
    text.includes('resumo operacional') ||
    text.includes('decis') ||
    text.includes('briefing') ||
    text.includes('meu dia')
  ) {
    const pendingDecisions = requests.filter((r: any) => r.status === 'needs_approval');
    const reply =
      `Fê, aqui está seu resumo operacional consolidado do dia:\n` +
      `• **Decisões urgentes**: você possui **${pendingDecisions.length}** solicitações aguardando sua aprovação manual no Inbox.\n` +
      `• **Tarefas pendentes**: **${openTasks.length}** tarefas abertas no ecossistema, sendo **${feTasks.length}** de sua responsabilidade e **${overdueTasks.length}** atrasadas.\n` +
      `• **Projetos vivos**: **${activeProjects.length}** frentes em andamento, sendo **${steplessProjects.length}** sem próximo passo definido.\n` +
      `• **Metabolismo**: **${agents.filter(a => a.status === 'active').length}** agentes operantes e rotinas com batimento regular.`;

    return {
      intent: 'resumo_dia',
      domain: 'geral',
      sourcesNeeded: ['pulso_tasks', 'pulso_projects', 'pulso_requests', 'pulso_agents'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply,
      handoff: {
        target: 'openclaw',
        mode: 'proposal_only',
        canExecuteNow: false,
        requiresHumanConfirmation: false,
        intent: 'resumo_dia',
        domain: 'geral',
        riskLevel: 'low',
        actionType: 'read',
        entitiesMentioned: ['Felipe', ...entities],
        suggestedNextStep: 'Priorizar decisões urgentes do Inbox e resolver tarefas atrasadas.',
        executionPrompt: `Gerar resumo operacional completo do dia para Felipe. Incluir: (1) contagem e lista de solicitações com status 'needs_approval' em pulso_requests, (2) tarefas abertas totais vs atribuídas ao Felipe vs atrasadas, (3) projetos ativos vs bloqueados, (4) status de agentes e rotinas. Sintetizar em bullet points objetivos. Responder em linguagem operacional curta.`,
      },
    };
  }

  // ── 13. comando_indefinido ───────────────────
  return {
    intent: 'comando_indefinido',
    domain: 'geral',
    sourcesNeeded: [],
    riskLevel: 'low',
    requiresConfirmation: false,
    canExecuteNow: false,
    suggestedReply:
      'Desculpe, não consegui compreender a intenção com clareza. Pode reescrever o comando descrevendo a tarefa ou consulta operacional desejada?',
    handoff: {
      target: 'openclaw',
      mode: 'proposal_only',
      canExecuteNow: false,
      requiresHumanConfirmation: false,
      intent: 'comando_indefinido',
      domain: 'geral',
      riskLevel: 'low',
      actionType: 'undefined',
      entitiesMentioned: entities,
      suggestedNextStep: 'Solicitar reformulação do comando com mais contexto operacional.',
      executionPrompt: `Comando não reconhecido: "${rawText.substring(0, 100)}". Solicitar reformulação com mais contexto: qual domínio (tarefas, projetos, agentes, fontes), qual ação desejada (consultar, criar, atualizar, mensagem) e quais entidades estão envolvidas.`,
    },
  };
};
