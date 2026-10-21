/**
 * pulsoCoreClient.ts
 * ------------------
 * Adaptador tipado de frontend para o PULSO Core via bridge Tauri v2.
 *
 * Regras de contrato:
 * - Detecta Tauri v2 pelo wrapper público (`__TAURI__.core.invoke`) ou por `__TAURI_INTERNALS__.invoke`.
 * - Preserva o `this`/contexto do objeto receptor ao invocar comandos nativos.
 * - Expõe `bootstrap`, `status`/`health` e comandos `live.*` com resultado discriminado (`ok: true | false`).
 * - Falha fechado (`ok: false`, `status: 'bridge_unavailable'`, `fallbackRequired: true`) quando a bridge não está presente.
 */

export const BRIDGE_METHODS = Object.freeze([
  'bootstrap',
  'snapshot',
  'health',
  'shutdown',
  'runtime.start',
  'runtime.stop',
  'control.command',
  'provider.configure',
  'provider.select',
  'provider.test',
  'provider.remove',
  'provider.secret.inject',
  'identity.inspect',
  'identity.private.install',
  'legacy.import.plan',
  'legacy.import.apply',
  'outbox.enqueue',
  'outbox.drain',
  'outbox.cancel',
  'agent.create_blueprint',
  'agent.publish_revision',
  'agent.materialize',
  'agent.transition',
  'audit.list',
  'live.bootstrap',
  'live.topology.ensure',
  'live.areas.list',
  'live.area.create',
  'live.sessions.list',
  'live.session.create',
  'live.session.select',
  'live.message.append',
  'live.messages.list',
  'live.turn.start',
  'live.turn.poll',
  'live.turn.cancel',
  'live.turn.resume',
  'live.turn.get',
  'live.turn.list',
] as const);

export type PulsoBridgeMethod = (typeof BRIDGE_METHODS)[number];

const METHOD_SET: ReadonlySet<string> = new Set(BRIDGE_METHODS);

export type PulsoTauriInvokeFn = <T = unknown>(
  command: string,
  args?: Record<string, unknown>
) => Promise<T>;

export interface TauriInvokeReceiver {
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export interface TauriGlobalScope {
  __TAURI__?: {
    core?: TauriInvokeReceiver | null;
  } | null;
  __TAURI_INTERNALS__?: TauriInvokeReceiver | null;
}

export interface WaitForTauriInvokeOptions {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

export interface PulsoBridgeRequest<TParams extends Record<string, unknown> = Record<string, unknown>> {
  readonly requestId: string;
  readonly method: PulsoBridgeMethod;
  readonly params: Readonly<TParams>;
}

export interface PulsoBridgeError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface PulsoBridgeSuccessEnvelope<TResult = unknown> {
  readonly requestId: string;
  readonly ok: true;
  readonly result: TResult;
}

export interface PulsoBridgeErrorEnvelope {
  readonly requestId: string;
  readonly ok: false;
  readonly error: PulsoBridgeError;
}

export type PulsoBridgeResponse<TResult = unknown> =
  | PulsoBridgeSuccessEnvelope<TResult>
  | PulsoBridgeErrorEnvelope;

export type PulsoCoreFailureStatus =
  | 'bridge_unavailable'
  | 'invalid_request'
  | 'bridge_error';

export interface PulsoCoreSuccess<TResult = unknown> {
  readonly ok: true;
  readonly status: 'ok';
  readonly requestId: string;
  readonly result: TResult;
  readonly fallbackRequired: false;
}

export interface PulsoCoreFailure {
  readonly ok: false;
  readonly status: PulsoCoreFailureStatus;
  readonly requestId: string;
  readonly error: PulsoBridgeError;
  readonly fallbackRequired: true;
}

export type PulsoCoreResult<TResult = unknown> =
  | PulsoCoreSuccess<TResult>
  | PulsoCoreFailure;

export type PulsoLiveEntityState = 'active' | 'archived';
export type PulsoLiveMessageRole = 'human' | 'assistant' | 'system';
export type PulsoLiveMessageState = 'persisted' | 'awaiting_provider';

export interface PulsoLiveArea {
  readonly id: string;
  readonly nome: string;
  readonly glifo: string;
  readonly ordem: number;
  readonly estado: PulsoLiveEntityState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PulsoLiveSession {
  readonly id: string;
  readonly areaId: string;
  readonly titulo: string;
  readonly identityId: 'lotus';
  readonly estado: PulsoLiveEntityState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PulsoLiveMessage {
  readonly id: string;
  readonly sessionId: string;
  readonly role: PulsoLiveMessageRole;
  readonly texto: string;
  readonly estado: PulsoLiveMessageState;
  readonly createdAt: string;
}

export interface PulsoLiveSelection {
  readonly areaId: string | null;
  readonly sessionId: string | null;
  readonly selectedAt: string;
}

export interface PulsoLiveBootstrapSnapshot {
  readonly areas: readonly PulsoLiveArea[];
  readonly sessions: readonly PulsoLiveSession[];
  readonly activeAreaId: string | null;
  readonly activeSessionId: string | null;
  readonly messages: readonly PulsoLiveMessage[];
  readonly selection: PulsoLiveSelection;
}

export interface PulsoRuntimeHealth {
  readonly status: 'running' | 'stopped' | 'degraded' | string;
  readonly storeIntegrity?: Readonly<{
    readonly ok?: boolean;
    readonly events?: number;
    readonly [key: string]: unknown;
  }>;
  readonly [key: string]: unknown;
}

export interface PulsoCoreBootstrapSnapshot {
  readonly dataDir: string;
  readonly dbPath: string;
  readonly controlPlane: Readonly<Record<string, unknown>>;
  readonly core: Readonly<Record<string, unknown>>;
  readonly panel: Readonly<{
    readonly sectionCount: number;
    readonly sections: readonly Readonly<Record<string, unknown>>[];
    readonly [key: string]: unknown;
  }> | null;
  readonly health: PulsoRuntimeHealth;
  readonly live: PulsoLiveBootstrapSnapshot;
}

export interface PulsoCreateAreaParams {
  id?: string;
  nome: string;
  glifo: string;
  ordem: number;
  estado?: PulsoLiveEntityState;
  idempotencyKey?: string;
}

export interface PulsoCreateSessionParams {
  id?: string;
  areaId: string;
  titulo: string;
  estado?: PulsoLiveEntityState;
  idempotencyKey?: string;
}

export interface PulsoSelectSessionParams {
  areaId?: string | null;
  sessionId: string | null;
}

export interface PulsoSelectSessionResult {
  readonly areaId: string | null;
  readonly sessionId: string | null;
  readonly messages: readonly PulsoLiveMessage[];
}

export interface PulsoAppendMessageParams {
  id?: string;
  sessionId: string;
  role: PulsoLiveMessageRole;
  texto: string;
  estado?: PulsoLiveMessageState;
  idempotencyKey?: string;
}

export interface PulsoAppendMessageReceipt {
  readonly status: PulsoLiveMessageState;
  readonly messageId: string;
  readonly sessionId: string;
}

export interface PulsoAppendMessageResult {
  readonly message: PulsoLiveMessage;
  readonly receipt: PulsoAppendMessageReceipt;
}

export type PulsoConversationRunStatus =
  | 'awaiting_provider'
  | 'queued'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface PulsoConversationRun {
  readonly id: string;
  readonly sessionId: string;
  readonly humanMessageId: string;
  readonly assistantMessageId: string | null;
  readonly identityId: 'lotus';
  readonly status: PulsoConversationRunStatus;
  readonly accumulatedText: string;
  readonly deltasCount: number;
  readonly resumedFromRunId: string | null;
  readonly providerId: string | null;
  readonly model: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface PulsoConversationEnvelope {
  readonly type: string;
  readonly runId?: string;
  readonly index?: number;
  readonly text?: string;
  readonly accumulatedText?: string;
  readonly run?: PulsoConversationRun;
  readonly error?: { readonly code?: string; readonly message?: string };
}

export interface PulsoTurnStartResult {
  readonly runId: string;
  readonly run: PulsoConversationRun | null;
}

export interface PulsoTurnPollResult {
  readonly run: PulsoConversationRun;
  readonly envelopes: readonly PulsoConversationEnvelope[];
  readonly done: boolean;
}

export type PulsoProviderAdapterKind = 'openai' | 'anthropic' | 'local';

export interface PulsoProviderConfig {
  readonly providerId: string;
  readonly adapterKind: PulsoProviderAdapterKind;
  readonly displayName: string;
  readonly model: string;
  readonly endpoint?: string | null;
  readonly allowExternalNetwork: boolean;
}

export interface PulsoProviderHealth {
  readonly status: 'healthy' | 'unhealthy' | string;
  readonly providerId: string;
  readonly adapterKind: string;
  readonly checkedAt: string;
  readonly detail: string;
  readonly authSource?: Readonly<Record<string, unknown>>;
  readonly error?: Readonly<{ readonly code?: string; readonly message?: string }>;
}

export interface PulsoCoreClientOptions {
  scope?: unknown;
  waitTimeoutMs?: number;
  waitIntervalMs?: number;
  requestIdFactory?: (method: PulsoBridgeMethod) => string;
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return Object.freeze(obj);
}

/**
 * Detecta a função `invoke` do Tauri v2 priorizando a API pública (`__TAURI__.core.invoke`)
 * e usando `__TAURI_INTERNALS__.invoke` como fallback, preservando o receptor (`this`).
 */
export function resolveTauriInvoke(
  scope: unknown = typeof globalThis !== 'undefined' ? globalThis : null
): PulsoTauriInvokeFn | null {
  if (!scope || typeof scope !== 'object') {
    return null;
  }

  const target = scope as TauriGlobalScope;
  const publicCore = target.__TAURI__?.core;
  if (publicCore && typeof publicCore.invoke === 'function') {
    return <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> =>
      publicCore.invoke<T>(command, args);
  }

  const internals = target.__TAURI_INTERNALS__;
  if (internals && typeof internals.invoke === 'function') {
    return <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> =>
      internals.invoke<T>(command, args);
  }

  return null;
}

export function isTauriBridgeAvailable(
  scope: unknown = typeof globalThis !== 'undefined' ? globalThis : null
): boolean {
  return resolveTauriInvoke(scope) !== null;
}

/**
 * Aguarda até um limite de tempo (`timeoutMs`) pela injeção da bridge Tauri no escopo.
 */
export async function waitForTauriInvoke(
  scope: unknown = typeof globalThis !== 'undefined' ? globalThis : null,
  options: WaitForTauriInvokeOptions = {}
): Promise<PulsoTauriInvokeFn | null> {
  const immediate = resolveTauriInvoke(scope);
  if (immediate) {
    return immediate;
  }

  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs >= 0 ? options.timeoutMs : 0;
  const intervalMs = typeof options.intervalMs === 'number' && options.intervalMs > 0 ? options.intervalMs : 25;
  const now = options.now ?? (() => Date.now());
  const sleep =
    options.sleep ??
    ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  const start = now();
  while (now() - start < timeoutMs) {
    const remaining = timeoutMs - (now() - start);
    if (remaining <= 0) {
      break;
    }
    const step = Math.min(intervalMs, remaining);
    await sleep(step);
    const resolved = resolveTauriInvoke(scope);
    if (resolved) {
      return resolved;
    }
  }

  return resolveTauriInvoke(scope);
}

/**
 * Valida e congela um envelope de requisição para a bridge do PULSO Core.
 */
export function validateBridgeRequest<TParams extends Record<string, unknown> = Record<string, unknown>>(
  req: unknown
): PulsoBridgeRequest<TParams> {
  if (req === null || typeof req !== 'object' || Array.isArray(req)) {
    throw new TypeError('Request must be a non-null object');
  }

  const candidate = req as Record<string, unknown>;

  if (typeof candidate.requestId !== 'string' || candidate.requestId.trim().length === 0) {
    throw new TypeError('Request requestId must be a non-empty string');
  }

  if (typeof candidate.method !== 'string' || !METHOD_SET.has(candidate.method)) {
    throw new Error(`Unknown or invalid bridge method: ${String(candidate.method)}`);
  }

  if (
    candidate.params === null ||
    typeof candidate.params !== 'object' ||
    Array.isArray(candidate.params)
  ) {
    throw new TypeError('Request params must be a plain object');
  }

  const clonedParams = deepFreeze(structuredClone(candidate.params) as TParams);
  return Object.freeze({
    requestId: candidate.requestId,
    method: candidate.method as PulsoBridgeMethod,
    params: clonedParams,
  });
}

/**
 * Valida e congela um envelope de resposta vindo da bridge do PULSO Core.
 */
export function validateBridgeResponse<TResult = unknown>(
  res: unknown
): PulsoBridgeResponse<TResult> {
  if (res === null || typeof res !== 'object' || Array.isArray(res)) {
    throw new TypeError('Response must be a non-null object');
  }

  const candidate = res as Record<string, unknown>;

  if (typeof candidate.requestId !== 'string' || candidate.requestId.trim().length === 0) {
    throw new TypeError('Response requestId must be a non-empty string');
  }

  if (typeof candidate.ok !== 'boolean') {
    throw new TypeError('Response ok must be a boolean');
  }

  if (candidate.ok) {
    if (!('result' in candidate)) {
      throw new TypeError('Successful response must include a result property');
    }
    const rawResult = candidate.result as TResult;
    const clonedResult =
      rawResult !== null && typeof rawResult === 'object'
        ? deepFreeze(structuredClone(rawResult))
        : rawResult;

    return Object.freeze({
      requestId: candidate.requestId,
      ok: true,
      result: clonedResult,
    });
  }

  const rawError = candidate.error;
  if (rawError === null || typeof rawError !== 'object' || Array.isArray(rawError)) {
    throw new TypeError('Error response must include an error object');
  }

  const errRecord = rawError as Record<string, unknown>;

  if (typeof errRecord.code !== 'string' || errRecord.code.trim().length === 0) {
    throw new TypeError('Response error.code must be a non-empty string');
  }

  if (typeof errRecord.message !== 'string') {
    throw new TypeError('Response error.message must be a string');
  }

  if (typeof errRecord.retryable !== 'boolean') {
    throw new TypeError('Response error.retryable must be a boolean');
  }

  const clonedError: PulsoBridgeError = Object.freeze({
    code: errRecord.code,
    message: errRecord.message,
    retryable: errRecord.retryable,
  });

  return Object.freeze({
    requestId: candidate.requestId,
    ok: false,
    error: clonedError,
  });
}

let requestCounter = 0;

function defaultRequestId(method: PulsoBridgeMethod): string {
  requestCounter += 1;
  return `pulso-ui-${method}-${Date.now()}-${requestCounter}`;
}

function createClosedFailure(
  requestId: string,
  status: PulsoCoreFailureStatus,
  code: string,
  message: string,
  retryable = false
): PulsoCoreFailure {
  return Object.freeze({
    ok: false,
    status,
    requestId,
    error: Object.freeze({
      code,
      message,
      retryable,
    }),
    fallbackRequired: true,
  });
}

export function createPulsoCoreClient(options: PulsoCoreClientOptions = {}) {
  const getScope = () =>
    'scope' in options
      ? options.scope
      : typeof globalThis !== 'undefined'
      ? globalThis
      : null;

  const makeRequestId = options.requestIdFactory ?? defaultRequestId;

  async function resolveInvoke(): Promise<PulsoTauriInvokeFn | null> {
    const scope = getScope();
    const immediate = resolveTauriInvoke(scope);
    if (immediate) {
      return immediate;
    }
    if (options.waitTimeoutMs && options.waitTimeoutMs > 0) {
      return waitForTauriInvoke(scope, {
        timeoutMs: options.waitTimeoutMs,
        intervalMs: options.waitIntervalMs,
      });
    }
    return null;
  }

  async function request<TResult = unknown>(
    method: PulsoBridgeMethod,
    params: Record<string, unknown> = {},
    customRequestId?: string
  ): Promise<PulsoCoreResult<TResult>> {
    const safeRequestId =
      typeof customRequestId === 'string' && customRequestId.trim().length > 0
        ? customRequestId.trim()
        : makeRequestId(method);

    let validatedRequest: PulsoBridgeRequest;
    try {
      validatedRequest = validateBridgeRequest({
        requestId: safeRequestId,
        method,
        params,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid bridge request';
      return createClosedFailure(
        safeRequestId,
        'invalid_request',
        'INVALID_REQUEST',
        message,
        false
      );
    }

    const invoke = await resolveInvoke();
    if (!invoke) {
      return createClosedFailure(
        validatedRequest.requestId,
        'bridge_unavailable',
        'BRIDGE_UNAVAILABLE',
        'Tauri v2 bridge is not available; failing closed',
        false
      );
    }

    let rawResponse: unknown;
    try {
      rawResponse = await invoke('bridge_request', { request: validatedRequest });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Native bridge_request invocation failed';
      return createClosedFailure(
        validatedRequest.requestId,
        'bridge_error',
        'BRIDGE_INVOKE_FAILED',
        message,
        false
      );
    }

    let validatedResponse: PulsoBridgeResponse<TResult>;
    try {
      validatedResponse = validateBridgeResponse<TResult>(rawResponse);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Malformed response from PULSO Core bridge';
      return createClosedFailure(
        validatedRequest.requestId,
        'bridge_error',
        'INVALID_BRIDGE_RESPONSE',
        message,
        false
      );
    }

    if (!validatedResponse.ok) {
      return Object.freeze({
        ok: false,
        status: 'bridge_error',
        requestId: validatedResponse.requestId,
        error: validatedResponse.error,
        fallbackRequired: true,
      });
    }

    return Object.freeze({
      ok: true,
      status: 'ok',
      requestId: validatedResponse.requestId,
      result: validatedResponse.result,
      fallbackRequired: false,
    });
  }

  return Object.freeze({
    isAvailable(): boolean {
      return isTauriBridgeAvailable(getScope());
    },

    request,

    bootstrap(requestId?: string): Promise<PulsoCoreResult<PulsoCoreBootstrapSnapshot>> {
      return request<PulsoCoreBootstrapSnapshot>('bootstrap', {}, requestId);
    },

    status(requestId?: string): Promise<PulsoCoreResult<PulsoRuntimeHealth>> {
      return request<PulsoRuntimeHealth>('health', {}, requestId);
    },

    getStatus(requestId?: string): Promise<PulsoCoreResult<PulsoRuntimeHealth>> {
      return request<PulsoRuntimeHealth>('health', {}, requestId);
    },

    health(requestId?: string): Promise<PulsoCoreResult<PulsoRuntimeHealth>> {
      return request<PulsoRuntimeHealth>('health', {}, requestId);
    },

    configureProvider(
      params: PulsoProviderConfig,
      requestId?: string
    ): Promise<PulsoCoreResult<Readonly<Record<string, unknown>>>> {
      return request<Readonly<Record<string, unknown>>>('provider.configure', {
        ...params,
        kind: params.adapterKind === 'local' ? 'local' : 'model',
        scope: { type: 'system', scopeId: null },
        capabilities: ['chat', 'stream'],
        enabled: true,
      }, requestId);
    },

    testProvider(
      providerId: string,
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoProviderHealth>> {
      return request<PulsoProviderHealth>('provider.test', { providerId }, requestId);
    },

    liveBootstrap(requestId?: string): Promise<PulsoCoreResult<PulsoLiveBootstrapSnapshot>> {
      return request<PulsoLiveBootstrapSnapshot>('live.bootstrap', {}, requestId);
    },

    ensureTopology(
      params: {
        areas: readonly PulsoCreateAreaParams[];
        sessions: readonly PulsoCreateSessionParams[];
      },
      requestId?: string
    ): Promise<PulsoCoreResult<{ readonly areas: readonly PulsoLiveArea[]; readonly sessions: readonly PulsoLiveSession[] }>> {
      return request('live.topology.ensure', {
        areas: params.areas.map(area => ({ ...area })),
        sessions: params.sessions.map(session => ({ ...session })),
      }, requestId);
    },

    listAreas(requestId?: string): Promise<PulsoCoreResult<readonly PulsoLiveArea[]>> {
      return request<readonly PulsoLiveArea[]>('live.areas.list', {}, requestId);
    },

    createArea(
      params: PulsoCreateAreaParams,
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoLiveArea>> {
      return request<PulsoLiveArea>(
        'live.area.create',
        { ...params },
        requestId
      );
    },

    createSession(
      params: PulsoCreateSessionParams,
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoLiveSession>> {
      return request<PulsoLiveSession>(
        'live.session.create',
        { ...params },
        requestId
      );
    },

    listSessions(
      params: { areaId?: string } = {},
      requestId?: string
    ): Promise<PulsoCoreResult<readonly PulsoLiveSession[]>> {
      return request<readonly PulsoLiveSession[]>('live.sessions.list', { ...params }, requestId);
    },

    selectSession(
      params: PulsoSelectSessionParams,
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoSelectSessionResult>> {
      return request<PulsoSelectSessionResult>(
        'live.session.select',
        { ...params },
        requestId
      );
    },

    appendMessage(
      params: PulsoAppendMessageParams,
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoAppendMessageResult>> {
      return request<PulsoAppendMessageResult>(
        'live.message.append',
        { ...params },
        requestId
      );
    },

    listMessages(
      params: { sessionId?: string } = {},
      requestId?: string
    ): Promise<PulsoCoreResult<readonly PulsoLiveMessage[]>> {
      return request<readonly PulsoLiveMessage[]>(
        'live.messages.list',
        { ...params },
        requestId
      );
    },

    startTurn(
      params: { sessionId: string; text: string; idempotencyKey?: string },
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoTurnStartResult>> {
      return request<PulsoTurnStartResult>('live.turn.start', { ...params }, requestId);
    },

    pollTurn(
      params: { runId: string; maxItems?: number },
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoTurnPollResult>> {
      return request<PulsoTurnPollResult>('live.turn.poll', { ...params }, requestId);
    },

    cancelTurn(
      params: { runId: string; reason?: string },
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoConversationRun>> {
      return request<PulsoConversationRun>('live.turn.cancel', { ...params }, requestId);
    },

    resumeTurn(
      params: { runId: string; idempotencyKey?: string },
      requestId?: string
    ): Promise<PulsoCoreResult<PulsoTurnStartResult>> {
      return request<PulsoTurnStartResult>('live.turn.resume', { ...params }, requestId);
    },

    shutdown(
      requestId?: string
    ): Promise<PulsoCoreResult<{ readonly shutdown?: boolean; readonly status?: string }>> {
      return request<{ readonly shutdown?: boolean; readonly status?: string }>(
        'shutdown',
        {},
        requestId
      );
    },
  });
}

export type PulsoCoreClient = ReturnType<typeof createPulsoCoreClient>;

export const pulsoCoreClient: PulsoCoreClient = createPulsoCoreClient();
