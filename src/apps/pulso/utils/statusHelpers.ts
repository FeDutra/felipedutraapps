import { Status, Priority, Severity } from "../types/pulso.types";

/**
 * @file statusHelpers.ts
 * @description Visual and semantic mapping for PULSO statuses.
 */

export const getStatusLabel = (status: Status): string => {
  const labels: Record<Status, string> = {
    active: 'Ativo',
    in_progress: 'Em Andamento',
    maintenance: 'Manutenção',
    paused: 'Pausado',
    archived: 'Arquivado',
    completed: 'Concluído',
    blocked: 'Bloqueado',
    broken: 'Falha',
    incerto: 'Incerto',
    open: 'Aberto',
    acknowledged: 'Reconhecido',
    resolved: 'Resolvido',
    ignored: 'Ignorado',
    new: 'Novo',
    triaged: 'Triado',
    converted: 'Convertido',
    discarded: 'Descartado',
    pending: 'Pendente',
    running: 'Executando',
    success: 'Sucesso',
    failed: 'Falhou',
    received: 'Recebido',
    validated: 'Validado',
    rejected: 'Rejeitado',
    converted_to_inbox: 'Convertido',
    processing: 'Processando',
    processed: 'Processado'
  };
  return labels[status] || status;
};

export const getStatusColor = (status: Status): string => {
  if (['active', 'in_progress', 'completed', 'resolved', 'converted'].includes(status)) return 'emerald';
  if (['blocked', 'broken', 'critical', 'open'].includes(status)) return 'red';
  if (['paused', 'maintenance', 'waiting', 'triaged'].includes(status)) return 'amber';
  if (['new', 'acknowledged'].includes(status)) return 'blue';
  return 'slate';
};

export const getPriorityLabel = (priority: Priority): string => {
  const labels: Record<Priority, string> = {
    critical: 'Crítica',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
    incerto: 'Incerta'
  };
  return labels[priority] || priority;
};

export const getSeverityColor = (severity: Severity): string => {
  const colors: Record<Severity, string> = {
    critical: 'red',
    high: 'orange',
    medium: 'amber',
    low: 'blue',
    info: 'slate'
  };
  return colors[severity] || 'slate';
};
