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

    this.initialized = false;
    this.closed = false;
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
        if (params.model) {
          await this.controlPlane.command("set_model_binding", {
            scope: params.scope || "system",
            providerId,
            model: params.model,
            fallbackChain: params.fallbackChain || [],
          }, { confirmed: true });
        }
        const result = {
          provider: this.controlPlane.get("provider", providerId),
          binding: this.controlPlane.get("binding", params.scope || "system"),
        };
        this.secretResolver.assertZeroLeakage(result);
        return result;
      }
      case "live.bootstrap": {
        await this.initialize();
        return await this.live.bootstrap();
      }
      case "live.area.create": {
        await this.initialize();
        return await this.live.createArea(params, { idempotencyKey: params && params.idempotencyKey });
      }
      case "live.session.create": {
        await this.initialize();
        return await this.live.createSession(params, { idempotencyKey: params && params.idempotencyKey });
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
