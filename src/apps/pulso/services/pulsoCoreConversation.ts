import {
  pulsoCoreClient,
  type PulsoConversationRun,
  type PulsoCoreClient,
  type PulsoCreateAreaParams,
  type PulsoCreateSessionParams,
  type PulsoLiveMessage,
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

const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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

    const messages = await this.listMessages(options.sessionId);
    return { run, messages };
  }
}

export const pulsoCoreConversation = new PulsoCoreConversation();
