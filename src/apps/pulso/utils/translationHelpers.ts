import { Stage, SourceType, InboxType } from "../types/pulso.types";

/**
 * @file translationHelpers.ts
 * @description Human-readable translations for technical enum values in the PULSO ecosystem.
 */

export const getStageLabel = (stage: Stage): string => {
  const labels: Record<Stage, string> = {
    seed: 'Semente',
    front: 'Front',
    project: 'Projeto',
    operation: 'Operação',
    maintenance: 'Manutenção',
    closed: 'Encerrado'
  };
  return labels[stage] || stage;
};

export const getSourceTypeLabel = (type: SourceType): string => {
  const labels: Record<SourceType, string> = {
    google_sheet: 'Google Sheets',
    google_doc: 'Google Docs',
    google_drive_folder: 'Pasta do Drive',
    google_drive_file: 'Arquivo do Drive',
    gmail: 'Gmail',
    google_calendar: 'Calendário',
    trello_board: 'Quadro Trello',
    notion_database: 'Banco Notion',
    notion_page: 'Página Notion',
    obsidian_vault: 'Vault Obsidian',
    obsidian_note: 'Nota Obsidian',
    whatsapp_chat: 'WhatsApp',
    telegram_chat: 'Telegram',
    vps_service: 'Servidor VPS',
    local_app: 'App Local',
    paperclip_service: 'Paperclip',
    firebase_project: 'Firebase',
    webhook: 'Webhook',
    manual_input: 'Entrada Manual'
  };
  return labels[type] || type;
};

export const getSyncModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    manual: 'Manual',
    semi_auto: 'Semi-Automático',
    auto: 'Automático',
    incerto: 'Incerto'
  };
  return labels[mode] || mode;
};

export const getInboxTypeLabel = (type: InboxType): string => {
  const labels: Record<InboxType, string> = {
    task: 'Tarefa',
    idea: 'Ideia',
    decision: 'Decisão',
    meeting: 'Reunião',
    file: 'Arquivo',
    metric: 'Métrica',
    alert: 'Alerta',
    log: 'Log',
    laterality: 'Lateralidade',
    insight: 'Insight',
    potential_project: 'Projeto Potencial',
    summary: 'Resumo',
    pending_request: 'Solicitação Pendente',
    context_update: 'Atualização de Contexto',
    ingestion: 'Ingestão',
    system_update: 'Atualização do Sistema'
  };
  return labels[type] || type;
};

export const getEntityTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    area: 'Área',
    project: 'Projeto',
    source: 'Fonte',
    person: 'Pessoa',
    agent: 'Agente',
    task: 'Tarefa',
    decision: 'Decisão',
    note: 'Nota',
    meeting: 'Reunião',
    inbox: 'Entrada'
  };
  return labels[type] || type;
};
