import { 
  Agent, Routine, Alert, Log, SyncJob 
} from "../types/pulso.types";

const NOW = new Date();

export const seedAgentsV2: Partial<Agent>[] = [
  {
    id: 'agent_lotus',
    slug: 'lotus',
    name: 'Lótus',
    role: 'Orquestrador de Contexto',
    status: 'active',
    priority: 'critical',
    description: 'Agente central de curadoria e organização de sementes e lateralidade.',
    systemsUsed: ['PULSO', 'OpenClaw'],
    lastActivityAt: NOW,
  },
  {
    id: 'agent_watchdog',
    slug: 'watchdog',
    name: 'Watchdog',
    role: 'Monitor de Saúde',
    status: 'active',
    priority: 'high',
    description: 'Monitora crons, VPS e integridade do banco de dados.',
    systemsUsed: ['VPS', 'Firebase'],
    lastActivityAt: NOW,
  },
  {
    id: 'agent_pmo_central',
    slug: 'pmo-central',
    name: 'PMO Central',
    role: 'Gestor de Projetos',
    status: 'active',
    priority: 'high',
    description: 'Garante o movimento de tarefas e cronogramas do ecossistema ÉDEN.',
    lastActivityAt: NOW,
  }
];

export const seedRoutinesV2: Partial<Routine>[] = [
  {
    id: 'routine_daily_briefing',
    slug: 'daily-briefing',
    name: 'Daily Briefing',
    description: 'Geração do resumo matinal de estado e prioridades.',
    frequency: 'Diária (07:00)',
    triggerType: 'cron',
    status: 'active',
    priority: 'high',
    tool: 'OpenClaw',
    agentRefs: ['agent_lotus'],
    lastRunAt: NOW,
  },
  {
    id: 'routine_security_audit',
    slug: 'security-audit',
    name: 'Security Audit',
    description: 'Verificação de permissões e logs de acesso.',
    frequency: 'Semanal (Dom 02:00)',
    triggerType: 'cron',
    status: 'active',
    priority: 'medium',
    tool: 'Watchdog',
    agentRefs: ['agent_watchdog'],
    lastRunAt: NOW,
  },
  {
    id: 'routine_broken_test',
    slug: 'broken-test',
    name: 'Rotina de Teste Falha',
    description: 'Exemplo de rotina com erro de execução.',
    frequency: 'Manual',
    triggerType: 'manual',
    status: 'broken',
    priority: 'low',
    tool: 'Manual',
    riskSummary: 'Nenhum risco real, apenas exemplo.',
  }
];

export const seedAlertsV2: Partial<Alert>[] = [
  {
    id: 'alert_vps_high_cpu',
    slug: 'vps-high-cpu',
    name: 'CPU Alta no VPS',
    description: 'Uso de CPU acima de 90% detectado no servidor OpenClaw.',
    severity: 'critical',
    status: 'open',
    priority: 'critical',
    agentRef: 'agent_watchdog',
    createdAt: NOW,
  },
  {
    id: 'alert_sync_failure_sheets',
    slug: 'sync-failure-sheets',
    name: 'Falha de Sincronização: Google Sheets',
    description: 'Token expirado ou permissão negada ao ler Planilha de Finanças.',
    severity: 'high',
    status: 'open',
    priority: 'high',
    createdAt: NOW,
  }
];

export const seedSyncJobsV2: Partial<SyncJob>[] = [
  {
    id: 'sync_sheets_finances',
    slug: 'sync-sheets-finances',
    name: 'Sync Finanças (Sheets)',
    originSystem: 'Google Sheets',
    targetSystem: 'PULSO',
    status: 'failed',
    priority: 'high',
    lastRunAt: NOW,
    errorMessage: '403: Forbidden - Authentication required',
  },
  {
    id: 'sync_notion_projects',
    slug: 'sync-notion-projects',
    name: 'Sync Projetos (Notion)',
    originSystem: 'Notion',
    targetSystem: 'PULSO',
    status: 'success',
    priority: 'medium',
    lastRunAt: NOW,
    recordsProcessed: 12,
  }
];

export const seedLogsV2: Partial<Log>[] = [
  {
    id: 'log_seed_v2',
    type: 'system',
    system: 'PULSO',
    severity: 'info',
    event: 'Stage 5 Health Seed Applied',
    createdAt: NOW,
  },
  {
    id: 'log_auth_login',
    type: 'auth',
    system: 'Firebase',
    severity: 'info',
    event: 'User Login: Felipe Dutra',
    createdAt: NOW,
  }
];
