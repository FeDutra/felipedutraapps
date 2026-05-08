import { 
  Area, 
  Project, 
  Routine, 
  Agent, 
  Source, 
  Person, 
  InboxItem, 
  Task, 
  Decision, 
  Note, 
  Alert, 
  Log 
} from "../types/pulso.types";

/**
 * @file pulsoSeed.ts
 * @description Comprehensive mock data for PULSO ecosystem based on current inventory.
 */

const NOW = new Date('2026-05-08T08:00:00Z');

// --- AREAS ---
export const seedAreas: Area[] = [
  {
    id: 'area_despertar',
    slug: 'despertar',
    name: 'Despertar',
    type: 'business',
    importance: 'critical',
    priority: 'critical',
    status: 'active',
    description: 'Frente empresarial e estratégica ligada a Murilo Gun, Dani de Maria e produtos de desenvolvimento humano.',
    riskSummary: 'Alta simultaneidade e dependência do Felipe como central humana.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_modu',
    slug: 'modu',
    name: 'MODÚ',
    type: 'business',
    importance: 'high',
    priority: 'high',
    status: 'active',
    description: 'Frente em transição para sistemas com IA, agentes e soluções modulares.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_casa',
    slug: 'casa',
    name: 'Casa / Construção',
    type: 'land',
    importance: 'high',
    priority: 'high',
    status: 'active',
    description: 'Construção em São Lourenço e reconciliação financeira do histórico de custos.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_familia',
    slug: 'familia',
    name: 'Família',
    type: 'family',
    importance: 'critical',
    priority: 'critical',
    status: 'active',
    description: 'Vida familiar, Nati, filhas, logística e decisões domésticas.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_guayi',
    slug: 'guayi',
    name: 'Escola Guayi',
    type: 'school',
    importance: 'high',
    priority: 'high',
    status: 'active',
    description: 'Operação escolar e familiar da turma da Flora.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_openclaw',
    slug: 'openclaw',
    name: 'OpenClaw / Agentes',
    type: 'infrastructure',
    importance: 'critical',
    priority: 'critical',
    status: 'active',
    description: 'Camada operacional de agentes, crons, rotinas e inteligência.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_autoral',
    slug: 'autoral',
    name: 'Produção Autoral',
    type: 'creative',
    importance: 'medium',
    priority: 'medium',
    status: 'active',
    description: 'Música (OCRE), escrita (MIL EM MIM) e pensamento autoral.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_saude',
    slug: 'saude',
    name: 'Saúde',
    type: 'health',
    importance: 'medium',
    priority: 'medium',
    status: 'incerto',
    description: 'Cuidado físico e acompanhamento pessoal.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_horta',
    slug: 'horta',
    name: 'Horta / Terra',
    type: 'land',
    importance: 'medium',
    priority: 'medium',
    status: 'active',
    description: 'Terra, plantio e cuidado com o terreno.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'area_infra',
    slug: 'infra',
    name: 'Infraestrutura',
    type: 'infrastructure',
    importance: 'high',
    priority: 'high',
    status: 'active',
    description: 'VPS, Firebase, Antigravity e segurança.',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- PROJECTS ---
export const seedProjects: Project[] = [
  {
    id: 'proj_central_despertar',
    slug: 'central-despertar',
    name: 'Central Despertar / App MVP',
    areaRef: 'area_despertar',
    status: 'active',
    stage: 'front',
    priority: 'high',
    objective: 'Organizar projetos, operação e VPI da Despertar via interface web.',
    nextStep: 'Mapear campos da planilha OPC para o Firestore.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'proj_paperclip_ecossistema',
    slug: 'paperclip-ecossistema',
    name: 'Ecossistema de Agentes Paperclip',
    areaRef: 'area_openclaw',
    status: 'active',
    stage: 'project',
    priority: 'high',
    objective: 'Criar time de agentes orquestrado pelo Paperclip.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'proj_casa_reconciliacao',
    slug: 'casa-reconciliacao',
    name: 'Reconciliação Financeira da Casa',
    areaRef: 'area_casa',
    status: 'active',
    stage: 'operation',
    priority: 'high',
    objective: 'Auditar custos históricos da construção e separar obra de extras.',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'proj_pulso',
    slug: 'pulso',
    name: 'PULSO',
    areaRef: 'area_infra',
    status: 'active',
    stage: 'front',
    priority: 'critical',
    objective: 'Central de estado vivo do ecossistema ÉDEN.',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- SOURCES ---
export const seedSources: Source[] = [
  {
    id: 'src_sheet_despertar',
    slug: 'sheet-despertar',
    name: 'DESPERTAR_360_Central',
    type: 'google_sheet',
    system: 'Google Sheets',
    status: 'active',
    priority: 'medium',
    syncMode: 'semi_auto',
    areaRef: 'area_despertar',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_trello_guayi',
    slug: 'trello-guayi',
    name: 'Trello 2° ANO GUAYI',
    type: 'trello_board',
    system: 'Trello',
    status: 'active',
    priority: 'medium',
    syncMode: 'auto',
    areaRef: 'area_guayi',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- PEOPLE ---
export const seedPeople: Person[] = [
  {
    id: 'person_felipe',
    slug: 'felipe',
    name: 'Felipe Dutra',
    role: 'Owner / Architect',
    importance: 'critical',
    priority: 'critical',
    status: 'active',
    relationshipToFe: 'Self',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'person_nati',
    slug: 'nati',
    name: 'Nati',
    role: 'Partner',
    importance: 'critical',
    priority: 'critical',
    status: 'active',
    relationshipToFe: 'Family',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'person_murilo_gun',
    slug: 'murilo-gun',
    name: 'Murilo Gun',
    role: 'Strategic Partner',
    importance: 'high',
    priority: 'high',
    status: 'active',
    organization: 'Despertar',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- ROUTINES ---
export const seedRoutines: Routine[] = [
  {
    id: 'routine_daily_briefing',
    slug: 'daily-briefing',
    name: 'Daily Briefing 08:15',
    areaRef: 'area_openclaw',
    status: 'active',
    priority: 'high',
    frequency: 'Daily 08:15',
    triggerType: 'cron',
    tool: 'OpenClaw',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'routine_watchdog_crons',
    slug: 'watchdog-crons',
    name: 'Watchdog de Crons Críticos',
    areaRef: 'area_infra',
    status: 'active',
    priority: 'high',
    frequency: 'Weekdays 08:35',
    triggerType: 'cron',
    tool: 'Custom Script',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- AGENTS ---
export const seedAgents: Agent[] = [
  {
    id: 'agent_lotus',
    slug: 'lotus',
    name: 'Lótus',
    role: 'Orchestrator',
    status: 'active',
    priority: 'critical',
    description: 'Hub principal de interface e inteligência operacional.',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- INBOX ITEMS ---
export const seedInboxItems: InboxItem[] = [
  {
    id: 'inbox_001',
    slug: 'task-inbox-001',
    name: 'Levantar dados do OPC',
    type: 'task',
    status: 'new',
    priority: 'medium',
    body: 'Coletar os leads do lançamento atual do OPC na planilha.',
    areaRef: 'area_despertar',
    projectRef: 'proj_central_despertar',
    originChannel: 'Manual',
    confidence: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'inbox_002',
    slug: 'laterality-001',
    name: 'Semente: Aceleradora IA',
    type: 'laterality',
    status: 'new',
    priority: 'high',
    body: 'Uma ideia sobre mentorar infoprodutores a usarem agentes no dia a dia.',
    lateralityState: 'captured',
    originChannel: 'OpenClaw (Audio)',
    confidence: 'medium',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'inbox_003',
    slug: 'decision-inbox-001',
    name: 'Formalizar VPS São Lourenço',
    type: 'decision',
    status: 'new',
    priority: 'high',
    body: 'Precisamos decidir se mantemos a Digital Ocean ou movemos tudo para a Hetzner.',
    areaRef: 'area_infra',
    originChannel: 'Manual',
    confidence: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'inbox_004',
    slug: 'alert-inbox-001',
    name: 'Pendência Guayi: Reunião de Pais',
    type: 'pending_request',
    status: 'new',
    priority: 'medium',
    body: 'Nati enviou no WhatsApp sobre a reunião de quarta-feira.',
    areaRef: 'area_guayi',
    originChannel: 'WhatsApp (Import)',
    confidence: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'inbox_005',
    slug: 'insight-inbox-001',
    name: 'Insight: Modelo de Dados Radial',
    type: 'insight',
    status: 'new',
    priority: 'medium',
    body: 'A visualização radial pode ser aplicada também na cronologia de decisões.',
    areaRef: 'area_infra',
    projectRef: 'proj_pulso',
    originChannel: 'OpenClaw',
    confidence: 'medium',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- TASKS ---
export const seedTasks: Task[] = [
  {
    id: 'task_001',
    slug: 'task-001',
    name: 'Auditoria planilha São Lourenço',
    status: 'in_progress',
    priority: 'high',
    areaRef: 'area_casa',
    projectRef: 'proj_casa_reconciliacao',
    ownerRefs: ['person_felipe'],
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- DECISIONS ---
export const seedDecisions: Decision[] = [
  {
    id: 'decision_001',
    slug: 'decision-001',
    name: 'Antigravity + Firestore',
    decision: 'Usar Firestore como banco de estado principal para os apps no Antigravity.',
    status: 'active',
    priority: 'critical',
    areaRef: 'area_infra',
    projectRef: 'proj_pulso',
    takenByRefs: ['person_felipe'],
    createdAt: NOW,
    updatedAt: NOW,
  }
];

// --- ALERTS & LOGS ---
export const seedAlerts: Alert[] = [
  {
    id: 'alert_001',
    slug: 'alert-001',
    name: 'Watchdog Alert',
    status: 'open',
    severity: 'high',
    priority: 'high',
    description: 'O cron de check-in das 08:00 não disparou log de sucesso.',
    areaRef: 'area_infra',
    routineRef: 'routine_watchdog_crons',
    createdAt: NOW,
    updatedAt: NOW,
  }
];

export const seedLogs: Log[] = [
  {
    id: 'log_001',
    type: 'routine_execution',
    system: 'OpenClaw',
    severity: 'info',
    event: 'Daily briefing sent successfully',
    routineRef: 'routine_daily_briefing',
    createdAt: NOW,
  }
];
