import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import {
  SqliteEventStore,
  PulsoCore,
  SecretRefResolver,
  ControlPlaneService,
  PulsoRuntimeService,
  LiveService,
  LiveConversationService,
  OpenAIModelAdapter,
  AnthropicModelAdapter,
  LocalOpenAICompatibleAdapter,
  pulsoId,
} from "../src/index.mjs";

import {
  validateBridgeRequest,
  validateBridgeResponse,
} from "./bridge-contract.mjs";

export function resolveDataDir(customPath) {
  if (customPath) {
    return resolve(customPath);
  }
  if (process.env.PULSO_DATA_DIR) {
    return resolve(process.env.PULSO_DATA_DIR);
  }
  if (process.platform === "darwin") {
    return resolve(homedir(), "Library/Application Support/PULSO Core Preview");
  }
  if (process.platform === "win32") {
    return resolve(
      process.env.APPDATA || resolve(homedir(), "AppData", "Roaming"),
      "PULSO Core Preview"
    );
  }
  return resolve(
    process.env.XDG_DATA_HOME || resolve(homedir(), ".local", "share"),
    "pulso-core"
  );
}

export function normalizeBridgeError(err) {
  const code =
    (err && typeof err.code === "string" && err.code) || "INTERNAL_ERROR";
  const message =
    (err && typeof err.message === "string" && err.message) ||
    (typeof err === "string" ? err : "Internal error");
  const retryable = Boolean(err && err.retryable);
  return { code, message, retryable };
}

export class PulsoDesktopBridge {
  constructor(options = {}) {
    this.options = options;
    this.dataDir = resolveDataDir(options.dataDir);
    this.dbPath = options.dbPath || join(this.dataDir, "pulso-core.sqlite");

    mkdirSync(this.dataDir, { recursive: true });
    this.secretResolver = options.secretResolver || new SecretRefResolver();
    this.store =
      options.store ||
      new SqliteEventStore(this.dbPath);
    this.core =
      options.core ||
      new PulsoCore({
        store: this.store,
      });
    this.controlPlane =
      options.controlPlane ||
      new ControlPlaneService({
        store: this.store,
        secretResolver: this.secretResolver,
      });
    this.runtime =
      options.runtime ||
      new PulsoRuntimeService({
        store: this.store,
        core: this.core,
        controlPlane: this.controlPlane,
        secretResolver: this.secretResolver,
        router: this.controlPlane.router,
        outbox: this.controlPlane.outbox,
      });
    this.live =
      options.live ||
      new LiveService({
        store: this.store,
      });
    this.conversations =
      options.conversations ||
      new LiveConversationService({
        store: this.store,
        live: this.live,
        router: this.controlPlane.router,
      });
    this.turnQueues = new Map();
    this.turnExecutions = new Map();

    this.initialized = false;
    this.closed = false;
  }

  createModelAdapter(params, secretRef) {
    if (typeof this.options.adapterFactory === "function") {
      return this.options.adapterFactory(params, secretRef, this.secretResolver);
    }
    const adapterKind = params.adapterKind || params.providerType || params.providerId;
    const common = {
      id: params.providerId,
      label: params.displayName || params.providerId,
      endpoint: params.endpoint || undefined,
      defaultModel: params.model || undefined,
      secretRef,
      secretResolver: this.secretResolver,
      allowExternalNetwork: params.allowExternalNetwork === true,
    };
    if (adapterKind === "openai") return new OpenAIModelAdapter(common);
    if (adapterKind === "anthropic") return new AnthropicModelAdapter(common);
    if (["local", "local_openai_compatible", "ollama"].includes(adapterKind)) {
      return new LocalOpenAICompatibleAdapter({ ...common, secretRef: secretRef || null });
    }
    const error = new Error("unsupported_provider_adapter:" + adapterKind);
    error.code = "UNSUPPORTED_PROVIDER_ADAPTER";
    throw error;
  }

  enqueueTurnEnvelope(runId, envelope) {
    if (!this.turnQueues.has(runId)) this.turnQueues.set(runId, []);
    this.turnQueues.get(runId).push(envelope);
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    await this.controlPlane.restore();
    if (!this.controlPlane.get("panel")) {
      await this.controlPlane.initDefaults();
    }
    await this.live.ensureRestored();
    this.initialized = true;
  }

  formatSuccessResponse(requestId, result) {
    const raw = {
      requestId,
      ok: true,
      result: result !== undefined ? result : null,
    };
    try {
      return validateBridgeResponse(raw);
    } catch (err) {
      return this.formatErrorResponse(requestId, {
        code: "INTERNAL_ERROR",
        message:
          "Response validation failed: " + (err && err.message ? err.message : "unknown"),
        retryable: false,
      });
    }
  }

  formatErrorResponse(requestId, err) {
    const safeId =
      typeof requestId === "string" && requestId.trim()
        ? requestId
        : "invalid-request";
    const errorObj = normalizeBridgeError(err);
    const raw = {
      requestId: safeId,
      ok: false,
      error: errorObj,
    };
    try {
      return validateBridgeResponse(raw);
    } catch {
      return Object.freeze({
        requestId: safeId,
        ok: false,
        error: Object.freeze({
          code: errorObj.code,
          message: errorObj.message,
          retryable: errorObj.retryable,
        }),
      });
    }
  }

  async execute(method, params) {
    switch (method) {
      case "bootstrap": {
        await this.initialize();
        const liveData = await this.live.bootstrap();
        const result = {
          dataDir: this.dataDir,
          dbPath: this.dbPath,
          controlPlane: await this.controlPlane.snapshot({ version: "v0.6" }),
          core: this.core.snapshot(),
          panel: this.controlPlane.get("panel"),
          health: await this.runtime.health(),
          live: liveData,
        };
        if (
          this.secretResolver &&
          typeof this.secretResolver.assertZeroLeakage === "function"
        ) {
          this.secretResolver.assertZeroLeakage(result);
        }
        return result;
      }
      case "snapshot": {
        await this.initialize();
        const version = (params && params.version) || "v0.6";
        const result = await this.controlPlane.snapshot({ version });
        if (
          this.secretResolver &&
          typeof this.secretResolver.assertZeroLeakage === "function"
        ) {
          this.secretResolver.assertZeroLeakage(result);
        }
        return result;
      }
      case "health": {
        await this.initialize();
        return await this.runtime.health();
      }
      case "runtime.start": {
        await this.initialize();
        const res = await this.runtime.start(params);
        return res !== undefined ? res : { started: true };
      }
      case "runtime.stop": {
        await this.initialize();
        const res = await this.runtime.stop(params);
        return res !== undefined ? res : { stopped: true };
      }
      case "provider.secret.inject": {
        if (
          typeof params.providerId !== "string" || !params.providerId.trim() ||
          typeof params.secret !== "string" || !params.secret
        ) {
          const error = new Error("providerId and secret are required");
          error.code = "INVALID_PARAMS";
          throw error;
        }
        const secretRef = "keychain:" + params.providerId;
        this.secretResolver.setSecret(secretRef, params.secret);
        return this.secretResolver.inspectRef(secretRef);
      }
      case "provider.configure": {
        await this.initialize();
        if (typeof params.providerId !== "string" || !params.providerId.trim()) {
          const error = new Error("providerId is required");
          error.code = "INVALID_PARAMS";
          throw error;
        }
        const providerId = params.providerId;
        const secretRef = params.secretRef ?? (params.kind === "local" ? null : "keychain:" + providerId);
        const adapter = this.createModelAdapter(params, secretRef);
        const profile = {
          providerId,
          displayName: params.displayName || providerId,
          kind: params.kind || "model",
          endpoint: params.endpoint ?? null,
          capabilities: params.capabilities || ["chat", "stream"],
          enabled: params.enabled !== false,
          metadata: params.metadata || {},
          secretRef,
        };
        const command = this.controlPlane.get("provider", providerId)
          ? "update_provider"
          : "register_provider";
        await this.controlPlane.command(command, profile, {
          confirmed: true,
          idempotencyKey: params.idempotencyKey || null,
        });
        this.controlPlane.router.attachAdapter(providerId, adapter);
        if (params.model) {
          this.controlPlane.router.setBinding({
            scope: params.scope || { type: "system", scopeId: null },
            primary: { providerId, model: params.model },
            fallbackChain: params.fallbackChain || [],
          }, { idempotencyKey: params.bindingIdempotencyKey || null });
        }
        const result = {
          provider: this.controlPlane.get("provider", providerId),
          binding: this.controlPlane.get("binding", params.scope || "system"),
        };
        this.secretResolver.assertZeroLeakage(result);
        return result;
      }
      case "provider.test": {
        await this.initialize();
        if (typeof params.providerId !== "string" || !params.providerId.trim()) {
          const error = new Error("providerId is required");
          error.code = "INVALID_PARAMS";
          throw error;
        }
        const adapter = this.controlPlane.router.getAdapter(params.providerId);
        if (!adapter || typeof adapter.health !== "function") {
          const error = new Error("provider_adapter_not_configured:" + params.providerId);
          error.code = "PROVIDER_NOT_CONFIGURED";
          throw error;
        }
        const report = await adapter.health();
        this.secretResolver.assertZeroLeakage(report);
        return report;
      }
      case "live.bootstrap": {
        await this.initialize();
        return await this.live.bootstrap();
      }
      case "live.topology.ensure": {
        await this.initialize();
        const areas = Array.isArray(params.areas) ? params.areas : [];
        const sessions = Array.isArray(params.sessions) ? params.sessions : [];
        for (const area of areas) {
          await this.live.createArea(area, { idempotencyKey: `topology:area:${area.id}` });
        }
        for (const session of sessions) {
          await this.live.createSession(session, { idempotencyKey: `topology:session:${session.id}` });
        }
        return {
          areas: this.live.listAreas(),
          sessions: this.live.listSessions(),
        };
      }
      case "live.areas.list": {
        await this.initialize();
        return this.live.listAreas();
      }
      case "live.area.create": {
        await this.initialize();
        return await this.live.createArea(params, { idempotencyKey: params && params.idempotencyKey });
      }
      case "live.session.create": {
        await this.initialize();
        return await this.live.createSession(params, { idempotencyKey: params && params.idempotencyKey });
      }
      case "live.sessions.list": {
        await this.initialize();
        return this.live.listSessions(params.areaId || null);
      }
      case "live.session.select": {
        await this.initialize();
        return await this.live.selectSession(params);
      }
      case "live.message.append": {
        await this.initialize();
        return await this.live.appendMessage(params, { idempotencyKey: params && params.idempotencyKey });
      }
      case "live.messages.list": {
        await this.initialize();
        const sessionId = (params && params.sessionId) || this.live.state.selection.sessionId;
        return this.live.listMessages(sessionId);
      }
      case "live.turn.start": {
        await this.initialize();
        const runId = params.runId || pulsoId("live_run");
        let markReady;
        const ready = new Promise(resolveReady => { markReady = resolveReady; });
        let readyMarked = false;
        const onEnvelope = async envelope => {
          this.enqueueTurnEnvelope(runId, envelope);
          if (!readyMarked) {
            readyMarked = true;
            markReady();
          }
        };
        const execution = this.conversations.startTurn(
          { ...params, runId },
          { idempotencyKey: params.idempotencyKey || null, onEnvelope }
        );
        this.turnExecutions.set(runId, execution);
        execution.finally(() => this.turnExecutions.delete(runId)).catch(() => {});
        await Promise.race([ready, execution.then(() => undefined)]);
        return { runId, run: this.conversations.getRun(runId) };
      }
      case "live.turn.poll": {
        await this.initialize();
        const runId = params.runId;
        const run = this.conversations.getRun(runId);
        if (!run) {
          const error = new Error("conversation_run_not_found:" + runId);
          error.code = "CONVERSATION_RUN_NOT_FOUND";
          throw error;
        }
        const queue = this.turnQueues.get(runId) || [];
        const maxItems = Math.max(1, Math.min(Number(params.maxItems) || 100, 500));
        const envelopes = queue.splice(0, maxItems);
        const done = ["completed", "failed", "cancelled", "interrupted"].includes(run.status);
        if (done && queue.length === 0) this.turnQueues.delete(runId);
        return { run, envelopes, done };
      }
      case "live.turn.cancel": {
        await this.initialize();
        return await this.conversations.cancelRun(params.runId, { reason: params.reason });
      }
      case "live.turn.resume": {
        await this.initialize();
        const newRunId = params.newRunId || pulsoId("live_run");
        let markReady;
        const ready = new Promise(resolveReady => { markReady = resolveReady; });
        let readyMarked = false;
        const onEnvelope = async envelope => {
          this.enqueueTurnEnvelope(newRunId, envelope);
          if (!readyMarked) {
            readyMarked = true;
            markReady();
          }
        };
        const execution = this.conversations.resumeRun(params.runId, {
          runId: newRunId,
          idempotencyKey: params.idempotencyKey || null,
          onEnvelope,
        });
        this.turnExecutions.set(newRunId, execution);
        execution.finally(() => this.turnExecutions.delete(newRunId)).catch(() => {});
        await Promise.race([ready, execution.then(() => undefined)]);
        return { runId: newRunId, run: this.conversations.getRun(newRunId) };
      }
      case "live.turn.get": {
        await this.initialize();
        return this.conversations.getRun(params.runId);
      }
      case "live.turn.list": {
        await this.initialize();
        return this.conversations.listRuns(params.sessionId || null);
      }
      case "shutdown": {
        await this.close();
        return { shutdown: true };
      }
      default: {
        const error = new Error(`Method '${method}' is not implemented`);
        error.code = "NOT_IMPLEMENTED";
        error.retryable = false;
        throw error;
      }
    }
  }

  async handleRequest(input) {
    let parsed = input;
    if (typeof input === "string") {
      try {
        parsed = JSON.parse(input);
      } catch {
        return this.formatErrorResponse("invalid-json", {
          code: "INVALID_REQUEST",
          message: "Malformed JSON",
          retryable: false,
        });
      }
    }

    let requestId = "invalid-request";
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.requestId === "string" &&
      parsed.requestId.trim()
    ) {
      requestId = parsed.requestId;
    }

    let validatedReq;
    try {
      validatedReq = validateBridgeRequest(parsed);
    } catch (err) {
      return this.formatErrorResponse(requestId, {
        code: (err && err.code) || "INVALID_REQUEST",
        message: (err && err.message) || "Invalid request",
        retryable: false,
      });
    }

    try {
      const result = await this.execute(validatedReq.method, validatedReq.params);
      return this.formatSuccessResponse(validatedReq.requestId, result);
    } catch (err) {
      return this.formatErrorResponse(validatedReq.requestId, err);
    }
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const run of this.conversations.listRuns()) {
      if (!["completed", "failed", "cancelled", "interrupted"].includes(run.status)) {
        try { await this.conversations.cancelRun(run.id, { reason: "bridge_shutdown" }); } catch {}
      }
    }
    try {
      if (this.runtime && typeof this.runtime.stop === "function") {
        await this.runtime.stop();
      }
    } catch {
      // Ignore errors when stopping runtime on close
    }
    try {
      if (this.store && typeof this.store.close === "function") {
        await this.store.close();
      }
    } catch {
      // Ignore errors when closing store on close
    }
  }
}

export function createDesktopBridge(options = {}) {
  return new PulsoDesktopBridge(options);
}

export async function runBridgeCli(argv = process.argv.slice(2)) {
  let customDataDir;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data-dir") {
      customDataDir = argv[i + 1];
      i++;
    } else if (arg.startsWith("--data-dir=")) {
      customDataDir = arg.slice("--data-dir=".length);
    }
  }

  const bridge = createDesktopBridge({ dataDir: customDataDir });
  const rl = createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const errResponse = bridge.formatErrorResponse("invalid-json", {
        code: "INVALID_REQUEST",
        message: "Malformed JSON",
        retryable: false,
      });
      process.stdout.write(JSON.stringify(errResponse) + "\n");
      continue;
    }

    const isShutdown =
      parsed && typeof parsed === "object" && parsed.method === "shutdown";
    const response = await bridge.handleRequest(parsed);
    process.stdout.write(JSON.stringify(response) + "\n");

    if (isShutdown) {
      break;
    }
  }
  await bridge.close();
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  runBridgeCli().catch((err) => {
    process.stderr.write(String((err && err.message) || err) + "\n");
    process.exit(1);
  });
}
