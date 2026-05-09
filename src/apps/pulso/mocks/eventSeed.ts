import { 
  PulsoEvent, 
  IngestionEvent 
} from "../types/pulso.types";

const NOW = new Date();

export const seedIngestionEvents: Partial<IngestionEvent>[] = [
  {
    id: 'ingest_v3_001',
    event_id: 'claw_evt_001',
    dedupe_key: 'task_opc_copy',
    name: 'Preparar copy e design do OPC',
    type: 'task',
    rawInput: { text: 'Cria uma tarefa para preparar copy e design do OPC' },
    summary: 'Solicitação de criação de tarefa para design e copy do projeto OPC.',
    originLabel: 'openclaw',
    originAgentRef: 'agent_lotus',
    areaRef: 'area_despertar',
    projectRef: 'proj_opc',
    confidence: 'high',
    ingestionStatus: 'converted_to_inbox',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 2) // 2h ago
  },
  {
    id: 'ingest_v3_002',
    event_id: 'claw_evt_002',
    name: 'Monitorar latência da VPS',
    type: 'alert',
    rawInput: { server: 'vps-01', metric: 'latency', value: '850ms' },
    summary: 'Latência alta detectada na VPS Principal.',
    originLabel: 'openclaw',
    originAgentRef: 'agent_watchdog',
    ingestionStatus: 'received',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 15) // 15m ago
  },
  {
    id: 'ingest_v3_003',
    event_id: 'claw_evt_001', // Intentional duplicate event_id
    name: 'RETRY: Preparar copy e design do OPC',
    type: 'task',
    rawInput: { text: 'Cria uma tarefa para preparar copy e design do OPC' },
    summary: 'Duplicate event ignored by idempotency logic.',
    originLabel: 'openclaw',
    ingestionStatus: 'duplicate',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 5)
  },
  {
    id: 'ingest_v3_004',
    event_id: 'claw_evt_004',
    name: 'Sinal de Saúde: Memória Alta',
    type: 'log',
    rawInput: { usage: '98%' },
    summary: 'Erro ao processar sinal de saúde: Falha na validação do payload.',
    originLabel: 'openclaw',
    ingestionStatus: 'failed',
    errorMessage: 'Payload schema mismatch: missing threshold field.',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 2)
  }
];

export const seedPulsoEvents: Partial<PulsoEvent>[] = [
  {
    id: 'event_v3_001',
    eventType: 'inbox_item_created',
    entityType: 'task',
    entityRef: 'inbox_v3_001',
    actorType: 'agent',
    actorRef: 'agent_lotus',
    origin: 'openclaw',
    payloadSummary: 'Tarefa criada via OpenClaw: Preparar copy e design do OPC',
    outboxStatus: 'processed',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 2)
  },
  {
    id: 'event_v3_002',
    eventType: 'inbox_item_triaged',
    entityType: 'task',
    entityRef: 'inbox_v3_001',
    actorType: 'user',
    actorRef: 'user_felipe',
    origin: 'manual',
    payloadSummary: 'Tarefa triada manualmente pelo usuário.',
    outboxStatus: 'pending',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 30)
  },
  {
    id: 'event_v3_003',
    eventType: 'project_updated',
    entityType: 'project',
    entityRef: 'proj_opc',
    actorType: 'user',
    actorRef: 'user_felipe',
    origin: 'manual',
    payloadSummary: 'Status do projeto OPC alterado para "operation".',
    outboxStatus: 'pending',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 10)
  },
  {
    id: 'event_v3_004',
    eventType: 'ingestion_failed',
    entityType: 'ingestion',
    entityRef: 'ingest_v3_004',
    actorType: 'system',
    origin: 'openclaw',
    payloadSummary: 'Falha crítica na ingestão do sinal de saúde da VPS.',
    outboxStatus: 'failed',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 2)
  }
];
