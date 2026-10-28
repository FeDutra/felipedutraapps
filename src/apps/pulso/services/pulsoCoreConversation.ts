import {
  pulsoCoreClient,
  type PulsoConversationRun,
  type PulsoToolApproval,
  type PulsoToolReceipt,
  type PulsoCoreClient,
  type PulsoCreateAreaParams,
  type PulsoCreateSessionParams,
  type PulsoLiveArea,
  type PulsoLiveBootstrapSnapshot,
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
  agentIds?: readonly string[];
  signal?: AbortSignal;
  onStarted?: (run: PulsoConversationRun) => void;
  onDelta?: (delta: string, accumulatedText: string, runId: string, agentId?: string | null) => void;
  onProgress?: (progress: { phase: string; label: string; status: string; agentId?: string | null; occurredAt?: string }, runId: string) => void;
  onTool?: (receipt: PulsoToolReceipt, runId: string) => void;
  onToolApproval?: (approval: PulsoToolApproval, runId: string) => void;
  onState?: (run: PulsoConversationRun) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface StreamTurnResult {
  run: PulsoConversationRun;
  messages: readonly PulsoLiveMessage[];
}

export interface PulsoCoreNavigationSnapshot {
  readonly areas: readonly PulsoLiveArea[];
  readonly sessions: readonly PulsoLiveSession[];
  readonly activeAreaId: string | null;
  readonly activeSessionId: string | null;
  readonly selection: PulsoLiveBootstrapSnapshot['selection'];
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

  async loadNavigation(): Promise<PulsoCoreNavigationSnapshot> {
    const [bootstrap, areas, sessions] = await Promise.all([
      this.client.liveBootstrap(),
      this.client.listAreas(),
      this.client.listSessions(),
    ]);
    for (const result of [bootstrap, areas, sessions]) {
      if (!result.ok) {
        throw new PulsoCoreConversationError(result.error.code, result.error.message);
      }
    }
    return Object.freeze({
      areas: areas.result,
      sessions: sessions.result,
      activeAreaId: bootstrap.result.activeAreaId,
      activeSessionId: bootstrap.result.activeSessionId,
      selection: bootstrap.result.selection,
    });
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

  async listRuns(sessionId: string): Promise<readonly PulsoConversationRun[]> {
    const result = await this.client.listTurns({ sessionId });
    if (!result.ok) throw new PulsoCoreConversationError('CORE_RUNS_UNAVAILABLE', result.error.message);
    return result.result;
  }

  async streamTurn(options: StreamTurnOptions): Promise<StreamTurnResult> {
    const startedAt = Date.now();
    const started = await this.client.startTurn({
      sessionId: options.sessionId,
      text: options.text,
      agentIds: options.agentIds,
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
            runId,
            envelope.agentId
          );
        } else if (envelope.type === 'conversation.progress' && envelope.label) {
          options.onProgress?.({
            phase: envelope.phase || 'execution',
            label: envelope.label,
            status: envelope.status || 'running',
            agentId: envelope.agentId,
            occurredAt: envelope.occurredAt,
          }, runId);
        } else if ((envelope.type === 'tool.started' || envelope.type === 'tool.completed') && envelope.receipt) {
          options.onTool?.(envelope.receipt as PulsoToolReceipt, runId);
        } else if ((envelope.type === 'tool.approval.requested' || envelope.type === 'tool.approval.resolved') && envelope.receipt) {
          options.onToolApproval?.(envelope.receipt as PulsoToolApproval, runId);
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
