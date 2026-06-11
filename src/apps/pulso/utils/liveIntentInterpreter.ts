/**
 * @file liveIntentInterpreter.ts
 * @description Local deterministic classifier for Lótus Live that queries real-time Firestore collections
 * and builds natural-language summaries for the user (Read-Only + Proposal mode).
 */

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

export interface LiveInterpretation {
  intent: string;
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

export const interpretLiveIntent = (rawText: string, ctx: LiveContext): LiveInterpretation => {
  const text = normalizeText(rawText);
  const now = Date.now();

  // Helper selectors to sanitize input context safely
  const tasks = (ctx.tasks || []).filter(t => t && t.archived !== true);
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const projects = (ctx.projects || []).filter(p => p && p.archived !== true);
  const activeProjects = projects.filter(p => p.status === 'active');
  const agents = (ctx.agents || []).filter(a => a && a.archived !== true);
  const routines = (ctx.routines || []).filter(r => r && r.archived !== true);
  const requests = (ctx.requests || []).filter(r => r && r.archived !== true);
  const sources = (ctx.sources || []).filter(s => s && s.status === 'active');

  // Filter tasks assigned to Felipe
  const feTasks = openTasks.filter((t: any) => {
    const refs = t.ownerRefs;
    if (!refs || !Array.isArray(refs) || refs.length === 0) return true; // fallback
    return refs.some((ref: string) => ref.toLowerCase() === 'felipe' || ref.toLowerCase() === 'fe');
  });

  // Overdue tasks
  const overdueTasks = openTasks.filter((t: any) => {
    const due = t.dueDate || t.dueAt;
    if (!due) return false;
    const dueTime = safeGetTime(due);
    return dueTime > 0 && dueTime < now;
  });

  // Projects missing next steps
  const steplessProjects = activeProjects.filter((p: any) => !p.nextStep || p.nextStep.trim() === '');

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
    const recipient = text.includes("bruna") ? "Bruna" : text.includes("nati") ? "Nati" : "destinatário";
    return {
      intent: 'comando_mensagem',
      domain: 'mensagens',
      sourcesNeeded: ['pulso_events', 'pulso_people'],
      riskLevel: 'high',
      requiresConfirmation: true,
      canExecuteNow: false,
      suggestedReply: `Entendi. Eu enviaria uma mensagem para ${recipient}, mas nesta versão ainda estou operando em modo de leitura/proposta. A ação de envio está bloqueada por segurança.\n\nSugestão de conteúdo: "Olá, gostaria de alinhar as pendências operacionais hoje."\nDestinatário provável: ${recipient}.`
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
    text.includes("salvar")
  ) {
    let entityType = 'entidade';
    if (text.includes("tarefa")) entityType = 'tarefa';
    else if (text.includes("projeto")) entityType = 'projeto';

    return {
      intent: 'comando_criacao',
      domain: 'criacao',
      sourcesNeeded: [],
      riskLevel: 'medium',
      requiresConfirmation: true,
      canExecuteNow: false,
      suggestedReply: `Entendi. Eu criaria um(a) novo(a) ${entityType} no sistema, mas nesta versão a execução automática está suspensa (modo leitura/proposta). A criação real está bloqueada.\n\nSugestão de proposta:\n• Tipo: ${entityType.toUpperCase()}\n• Título proposto: "${rawText.substring(0, 50)}"\n• Prioridade recomendada: média.`
    };
  }

  // 3. tarefas_sem_responsavel
  if (
    text.includes("sem responsavel") ||
    text.includes("sem dono") ||
    text.includes("sem atribu")
  ) {
    const unassigned = openTasks.filter(t => !t.ownerRefs || !Array.isArray(t.ownerRefs) || t.ownerRefs.length === 0);
    const names = unassigned.slice(0, 3).map(t => `"${t.title || t.name}"`).join(', ');
    const listText = unassigned.length > 0 
      ? `As principais são: ${names}${unassigned.length > 3 ? ` e mais ${unassigned.length - 3} itens` : ''}.`
      : 'Nenhuma tarefa aberta sem responsável foi encontrada.';

    return {
      intent: 'tarefas_sem_responsavel',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Identifiquei ${unassigned.length} tarefas ativas sem responsável claro designado no momento. ${listText} Minha recomendação é atribuir responsáveis para essas frentes para evitar gargalos.`
    };
  }

  // 4. tarefas_sem_projeto
  if (
    text.includes("sem projeto") ||
    text.includes("sem vinculo") ||
    text.includes("soltas")
  ) {
    const projectless = openTasks.filter(t => !t.projectRef && !t.projectId);
    const names = projectless.slice(0, 3).map(t => `"${t.title || t.name}"`).join(', ');
    const listText = projectless.length > 0 
      ? `As mais urgentes parecem ser: ${names}${projectless.length > 3 ? ` e mais ${projectless.length - 3} itens` : ''}.`
      : 'Não encontrei nenhuma tarefa ativamente sem projeto.';

    return {
      intent: 'tarefas_sem_projeto',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Encontrei ${projectless.length} tarefas abertas que estão sem vínculo a qualquer projeto do ecossistema. ${listText} Sugiro associá-las a frentes de trabalho ativas para manter o alinhamento.`
    };
  }

  // 5. consulta_tarefas ("como estao minhas tarefas hoje?", "o que depende de mim?")
  if (
    text.includes("como estao minhas tarefas") ||
    text.includes("o que depende de mim") ||
    text.includes("minhas tarefas") ||
    text.includes("tarefa") ||
    text.includes("meus prazos")
  ) {
    const overdueList = overdueTasks.slice(0, 3).map(t => `"${t.title || t.name}"`).join(', ');
    const reply = `Você possui **${openTasks.length}** tarefas ativas no ecossistema, sendo que **${feTasks.length}** estão atribuídas diretamente a você.
Identifiquei **${overdueTasks.length}** tarefas em atraso${overdueTasks.length > 0 ? ` (como ${overdueList})` : ''}. 
Minha recomendação é focar em resolver primeiro as tarefas atrasadas e aquelas atreladas a você.`;

    return {
      intent: 'consulta_tarefas',
      domain: 'tarefas',
      sourcesNeeded: ['pulso_tasks', 'pulso_projects', 'pulso_people'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply
    };
  }

  // 6. projetos_sem_passo
  if (
    text.includes("sem proximo passo") ||
    text.includes("sem passo") ||
    text.includes("projetos sem passo")
  ) {
    const names = steplessProjects.slice(0, 3).map(p => `"${p.name}"`).join(', ');
    const listText = steplessProjects.length > 0 
      ? `As frentes afetadas incluem: ${names}${steplessProjects.length > 3 ? ` e mais ${steplessProjects.length - 3} projetos` : ''}.`
      : 'Excelente! Todos os projetos ativos possuem próximos passos definidos.';

    return {
      intent: 'projetos_sem_passo',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Existem **${steplessProjects.length}** projetos ativos sem próximo passo configurado. ${listText} Recomendo abrir o Mapa Estratégico e registrar a próxima ação em cada um.`
    };
  }

  // 7. projetos_travados
  if (
    text.includes("travado") ||
    text.includes("estagnado") ||
    text.includes("bloqueado")
  ) {
    const names = steplessProjects.slice(0, 3).map(p => `"${p.name}"`).join(', ');
    const listText = steplessProjects.length > 0 
      ? `Identifiquei frentes estagnadas por falta de marcos: ${names}${steplessProjects.length > 3 ? ` e mais ${steplessProjects.length - 3} projetos` : ''}.`
      : 'Não encontrei projetos ativamente travados ou estagnados no momento.';

    return {
      intent: 'projetos_travados',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects', 'pulso_tasks'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Análise operacional do ecossistema: temos **${activeProjects.length}** projetos ativos. **${steplessProjects.length}** deles estão travados/sem próximo passo. ${listText}`
    };
  }

  // 8. consulta_projetos
  if (
    text.includes("projeto") ||
    text.includes("como estao meus projetos") ||
    text.includes("ecossistema")
  ) {
    const reply = `Atualmente temos **${activeProjects.length}** projetos ativos no ecossistema operando.
Dessas frentes, **${steplessProjects.length}** estão sem próximo passo definido.
Minha sugestão de ação é preencher os próximos passos dos projetos afetados para destravar o andamento das frentes de trabalho.`;

    return {
      intent: 'consulta_projetos',
      domain: 'projetos',
      sourcesNeeded: ['pulso_projects', 'pulso_tasks', 'pulso_areas'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply
    };
  }

  // 9. consulta_agentes
  if (
    text.includes("agente") ||
    text.includes("rotina") ||
    text.includes("trabalhando") ||
    text.includes("caiu") ||
    text.includes("metabolismo") ||
    text.includes("cron")
  ) {
    const brokenRoutines = routines.filter(r => r.status === 'broken' || r.status === 'failed');
    const inactiveAgents = agents.filter(a => a.status !== 'active');
    const statusText = brokenRoutines.length > 0 || inactiveAgents.length > 0 
      ? `Atenção: identifiquei **${brokenRoutines.length}** rotinas com falha recente e **${inactiveAgents.length}** agentes inativos.`
      : 'Metabolismo regular: todos os agentes operantes e rotinas recorrentes saudáveis.';

    return {
      intent: 'consulta_agentes',
      domain: 'agentes',
      sourcesNeeded: ['pulso_agents', 'pulso_routines', 'pulso_alerts'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: `Status dos sistemas e agentes do PULSO:\n• Agentes ativos: **${agents.length - inactiveAgents.length}/${agents.length}**\n• Rotinas saudáveis: **${routines.length - brokenRoutines.length}/${routines.length}**\n\n${statusText}`
    };
  }

  // 10. consulta_fontes
  if (
    text.includes("fonte") ||
    text.includes("notion") ||
    text.includes("obsidian") ||
    text.includes("whatsapp") ||
    text.includes("sintoniz")
  ) {
    const listSources = sources.map(s => `🟢 ${s.name}`).join(', ');
    const reply = sources.length > 0 
      ? `Temos **${sources.length}** fontes de dados sintonizadas e ativas no ecossistema: ${listSources}. Tudo sintonizado corretamente.`
      : 'Nenhuma fonte de dados externa está sintonizada ou ativa no momento.';

    return {
      intent: 'consulta_fontes',
      domain: 'fontes',
      sourcesNeeded: ['pulso_sources'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply
    };
  }

  // 11. lotus_atividade
  if (
    text.includes("lotus fez") ||
    text.includes("o que a lotus fez") ||
    text.includes("atividade") ||
    text.includes("logs") ||
    text.includes("feito")
  ) {
    const recentCommands = requests
      .filter((r: any) => r.requestType === 'conversation_command')
      .slice(0, 3)
      .map((r: any) => `• Comando: "${r.summary || r.title}"`);
    
    const reply = recentCommands.length > 0
      ? `Minhas últimas atividades registradas no barramento do PULSO:\n${recentCommands.join('\n')}\n\nTodos os logs técnicos adicionais podem ser visualizados na página de Logs.`
      : 'Nenhuma atividade conversacional recente registrada no feed.';

    return {
      intent: 'lotus_atividade',
      domain: 'geral',
      sourcesNeeded: ['pulso_requests', 'pulso_logs'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply
    };
  }

  // 12. resumo_dia
  if (
    text.includes("resumo do dia") ||
    text.includes("resumo operacional") ||
    text.includes("decis") ||
    text.includes("briefing") ||
    text.includes("meu dia")
  ) {
    const pendingDecisions = requests.filter((r: any) => r.status === 'needs_approval');
    const reply = `Fê, aqui está seu resumo operacional consolidado do dia:
• **Decisões urgentes**: você possui **${pendingDecisions.length}** solicitações aguardando sua aprovação manual no Inbox.
• **Tarefas pendentes**: **${openTasks.length}** tarefas abertas no ecossistema, sendo **${feTasks.length}** de sua responsabilidade e **${overdueTasks.length}** atrasadas.
• **Projetos vivos**: **${activeProjects.length}** frentes em andamento, sendo **${steplessProjects.length}** sem próximo passo definido.
• **Metabolismo**: **${agents.filter(a => a.status === 'active').length}** agentes operantes e rotinas com batimento regular.`;

    return {
      intent: 'resumo_dia',
      domain: 'geral',
      sourcesNeeded: ['pulso_tasks', 'pulso_projects', 'pulso_requests', 'pulso_agents'],
      riskLevel: 'low',
      requiresConfirmation: false,
      canExecuteNow: false,
      suggestedReply: reply
    };
  }

  // 13. comando_indefinido
  return {
    intent: 'comando_indefinido',
    domain: 'geral',
    sourcesNeeded: [],
    riskLevel: 'low',
    requiresConfirmation: false,
    canExecuteNow: false,
    suggestedReply: 'Desculpe, não consegui compreender a intenção com clareza. Pode reescrever o comando descrevendo a tarefa ou consulta operacional desejada?'
  };
};
