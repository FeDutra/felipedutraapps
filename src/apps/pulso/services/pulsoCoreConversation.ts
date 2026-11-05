import {
  pulsoCoreClient,
  type PulsoConversationRun,
  type PulsoCoreClient,
  type PulsoCreateAreaParams,
  type PulsoCreateSessionParams,
  type PulsoLiveArea,
  type PulsoLiveMessage,
  type PulsoLiveSession,
} from './pulsoCoreClient';

export class PulsoCoreConversationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PulsoCoreConversationError';
    this.code = code;
  }
}

export interface StreamTurnOptions {
  sessionId: string;
  text: string;
  idempotencyKey: string;
  signal?: AbortSignal;
  onStarted?: (run: PulsoConversationRun) => void;
  onDelta?: (delta: string, accumulatedText: string, runId: string) => void;
  onState?: (run: PulsoConversationRun) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface StreamTurnResult {
  run: PulsoConversationRun;
  messages: readonly PulsoLiveMessage[];
}

export interface PulsoCoreTopology {
  readonly areas: readonly PulsoLiveArea[];
  readonly sessions: readonly PulsoLiveSession[];
}

const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const presentConversationFailure = (code: string, message: string): string => {
  const technical = `${code}:${message}`.toLowerCase();
  if (technical.includes('exceeds the available context') || technical.includes('context size')) {
    return 'O histórico desta conversa excedeu a janela do modelo selecionado. A PULSO preservou a sessão; tente novamente com o histórico compactado.';
  }
  if (technical.includes('request_cancelled') || technical.includes('conversation_cancelled')) {
    return 'A resposta foi interrompida.';
  }
  if (technical.includes('timeout') || technical.includes('turn_timeout')) {
    return 'O modelo selecionado não começou a responder dentro da janela esperada. Você pode tentar novamente ou escolher outro modelo.';
  }
  if (technical.includes('routing_failed') || technical.includes('provider')) {
    return 'O modelo selecionado não conseguiu concluir esta resposta. A PULSO manteve sua escolha e não trocou de provider silenciosamente.';
  }
  return 'O modelo selecionado encontrou uma falha antes de concluir a resposta.';
};

export class PulsoCoreConversation {
  private readonly client: PulsoCoreClient;

  constructor(client: PulsoCoreClient = pulsoCoreClient) {
    this.client = client;
  }

  isAvailable(): boolean {
    return this.client.isAvailable();
  }

  async ensureTopology(
    areas: readonly PulsoCreateAreaParams[],
    sessions: readonly PulsoCreateSessionParams[]
  ): Promise<void> {
    const result = await this.client.ensureTopology({ areas, sessions });
    if (!result.ok) {
      throw new PulsoCoreConversationError(result.error.code, result.error.message);
    }
  }

  async listTopology(): Promise<PulsoCoreTopology> {
    const [areas, sessions] = await Promise.all([
      this.client.listAreas(),
      this.client.listSessions(),
    ]);
    if (!areas.ok) {
      throw new PulsoCoreConversationError(areas.error.code, areas.error.message);
    }
    if (!sessions.ok) {
      throw new PulsoCoreConversationError(sessions.error.code, sessions.error.message);
    }
    return { areas: areas.result, sessions: sessions.result };
  }

  async createArea(params: PulsoCreateAreaParams): Promise<PulsoLiveArea> {
    const result = await this.client.createArea(params);
    if (!result.ok) {
      throw new PulsoCoreConversationError(result.error.code, result.error.message);
    }
    return result.result;
  }

  async createSession(params: PulsoCreateSessionParams): Promise<PulsoLiveSession> {
    const result = await this.client.createSession(params);
    if (!result.ok) {
      throw new PulsoCoreConversationError(result.error.code, result.error.message);
    }
    return result.result;
  }

  async selectSession(areaId: string, sessionId: string): Promise<readonly PulsoLiveMessage[]> {
    const result = await this.client.selectSession({ areaId, sessionId });
    if (!result.ok) {
      throw new PulsoCoreConversationError(result.error.code, result.error.message);
    }
    return result.result.messages;
  }

  async listMessages(sessionId: string): Promise<readonly PulsoLiveMessage[]> {
    const result = await this.client.listMessages({ sessionId });
    if (!result.ok) {
      throw new PulsoCoreConversationError(result.error.code, result.error.message);
    }
    return result.result;
  }

  async streamTurn(options: StreamTurnOptions): Promise<StreamTurnResult> {
    const startedAt = Date.now();
    const started = await this.client.startTurn({
      sessionId: options.sessionId,
      text: options.text,
      idempotencyKey: options.idempotencyKey,
    });
    if (!started.ok) {
      throw new PulsoCoreConversationError(started.error.code, started.error.message);
    }
    const runId = started.result.runId;
    let run = started.result.run;
    if (!run) {
      throw new PulsoCoreConversationError('RUN_NOT_CREATED', 'O Core não criou a execução da conversa.');
    }
    options.onStarted?.(run);
    if (run.status === 'awaiting_provider') {
      throw new PulsoCoreConversationError(
        'PROVIDER_NOT_CONFIGURED',
        'Nenhum provider está configurado para esta sessão no PULSO Core.'
      );
    }

    const interval = Math.max(16, options.pollIntervalMs ?? 32);
    const timeout = Math.max(1_000, options.timeoutMs ?? 300_000);
    let cancelSent = false;

    while (!terminal.has(run.status)) {
      if (options.signal?.aborted && !cancelSent) {
        cancelSent = true;
        const cancelled = await this.client.cancelTurn({ runId, reason: 'interface_cancelled' });
        if (!cancelled.ok) {
          throw new PulsoCoreConversationError(cancelled.error.code, cancelled.error.message);
        }
        run = cancelled.result;
        break;
      }
      if (Date.now() - startedAt > timeout) {
        await this.client.cancelTurn({ runId, reason: 'interface_timeout' });
        throw new PulsoCoreConversationError('TURN_TIMEOUT', 'A conversa excedeu o limite de execução.');
      }

      const polled = await this.client.pollTurn({ runId, maxItems: 200 });
      if (!polled.ok) {
        throw new PulsoCoreConversationError(polled.error.code, polled.error.message);
      }
      run = polled.result.run;
      for (const envelope of polled.result.envelopes) {
        if (envelope.type === 'conversation.delta' && envelope.text) {
          options.onDelta?.(
            envelope.text,
            envelope.accumulatedText ?? run.accumulatedText,
            runId
          );
        }
      }
      options.onState?.(run);
      if (!polled.result.done) await sleep(interval);
    }

    if (run.status === 'failed') {
      const code = run.failure?.code || 'TURN_FAILED';
      const message = run.failure?.message || 'O provider do PULSO Core falhou antes de concluir a resposta.';
      throw new PulsoCoreConversationError(
        code,
        presentConversationFailure(code, message)
      );
    }

    const messages = await this.listMessages(options.sessionId);
    return { run, messages };
  }
}

export const pulsoCoreConversation = new PulsoCoreConversation();
