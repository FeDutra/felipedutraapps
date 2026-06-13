process.env.NEXT_PUBLIC_PULSO_DATA_MODE = 'mock';
import { lotusOpenClawClient } from './src/apps/pulso/services/lotusOpenClawClient';

async function run() {
  const payload = {
    requestId: 'req_test_bruna',
    userId: 'felipe_dutra',
    source: 'pulso_live' as const,
    mode: 'text' as const,
    input: 'quais as tarefas da Bruna para semana que vem',
    rawInput: 'quais as tarefas da Bruna para semana que vem',
    timestamp: new Date().toISOString(),
    clientCreatedAtMs: Date.now(),
    conversationId: 'conv_123',
    messageId: 'msg_123',
    approvalMode: 'allow_read_only' as const,
    context: {
      userName: 'Fê',
      locale: 'pt-BR' as const,
      timezone: 'America/Sao_Paulo',
      interface: 'pulso' as const,
      currentRoute: '/pulso/live'
    },
    contextWindow: []
  };
  const res = await lotusOpenClawClient.queueRequest(payload);
  console.log(JSON.stringify(res, null, 2));
}

run();
