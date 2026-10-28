import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

import {
  ModelProvider,
  invariant,
  validateProviderBinding,
} from "../domain/contracts.mjs";
import { SecretRefResolver } from "../runtime/secret-ref-resolver.mjs";
import {
  approvalDecisionResult,
  classifyApproval,
  isOperationalToolItem,
  normalizeToolItem,
  sanitizeApproval,
} from "../runtime/tool-runtime-contracts.mjs";

const DEFAULT_TIMEOUT_MS = 30_000;
const TURN_TIMEOUT_MS = 300_000;
const APPROVAL_TIMEOUT_MS = 300_000;
const DYNAMIC_TOOL_TEXT_LIMIT = 24_000;
const DYNAMIC_TOOL_URL_LIMIT = 8_000;
const DYNAMIC_TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function safeProfileId(value) {
  const profileId = String(value || "personal").trim();
  invariant(/^[A-Za-z0-9._-]{1,64}$/.test(profileId), "invalid_codex_profile_id");
  return profileId;
}

function codexConfigText() {
  return [
    'forced_login_method = "chatgpt"',
    'cli_auth_credentials_store = "keyring"',
    "",
  ].join("\n");
}

function ensureProfileDirectory(codexHome) {
  mkdirSync(codexHome, { recursive: true, mode: 0o700 });
  const configPath = join(codexHome, "config.toml");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, codexConfigText(), { encoding: "utf8", mode: 0o600 });
  }
  chmodSync(configPath, 0o600);
  return configPath;
}

function privateSkillDirectories(root) {
  if (!root || !existsSync(root)) return [];
  const found = [];
  const visit = directory => {
    if (existsSync(join(directory, "SKILL.md"))) {
      found.push(directory);
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(join(directory, entry.name));
    }
  };
  visit(root);
  return found.sort();
}

function hardenSkillTree(root) {
  const entry = statSync(root);
  chmodSync(root, entry.isDirectory() ? 0o700 : 0o600);
  if (!entry.isDirectory()) return;
  for (const name of readdirSync(root)) hardenSkillTree(join(root, name));
}

export function installPrivateSkills({ privateContextRoot, codexHome } = {}) {
  const archiveRoot = join(privateContextRoot || "", "archive", "skills");
  if (!privateContextRoot || !existsSync(archiveRoot)) return { installed: 0, skills: [] };
  const destinationRoot = join(codexHome, "skills");
  mkdirSync(destinationRoot, { recursive: true, mode: 0o700 });
  const installed = [];
  for (const source of privateSkillDirectories(archiveRoot)) {
    const relativeSource = source.slice(archiveRoot.length + 1);
    const safeName = `pulso-${relativeSource}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
    const destination = join(destinationRoot, safeName);
    cpSync(source, destination, { recursive: true, force: true });
    hardenSkillTree(destination);
    installed.push({ name: safeName, source: relativeSource });
  }
  const manifestPath = join(destinationRoot, ".pulso-managed.json");
  writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, installed }, null, 2) + "\n", { mode: 0o600 });
  return { installed: installed.length, skills: installed };
}

function integralDeveloperInstructions() {
  return [
    "Você é a Lótus dentro da PULSO e opera em modo integral, conforme a identidade soberana fornecida.",
    "Use as ferramentas locais, web, plugins e apps/conectores disponíveis quando ajudarem a concluir o pedido.",
    "O perfil ChatGPT de Fe possui conectores próprios; prefira o app Notion para conteúdo no Notion e preserve a fonte canônica.",
    "Você pode ler e escrever arquivos e executar comandos no Mac, mas preserve dados, use ações reversíveis e nunca exponha credenciais.",
    "Antes de enviar mensagens, publicar, mover dinheiro, alterar credenciais ou agir em relações humanas, obtenha autorização humana explícita.",
    "Consulte o contexto privado e a memória local com proveniência quando forem relevantes; não invente acesso nem resultado.",
    "Entregue resposta humana limpa. Não despeje chamadas de ferramenta, comandos ou bastidor técnico no chat.",
  ].join("\n");
}

function restrictedDeveloperInstructions() {
  return "Converse como a identidade fornecida pela PULSO. Não execute comandos, não altere arquivos e não use ferramentas. Responda apenas em texto ao pedido humano.";
}

function approvalAnswers(params = {}) {
  const answers = {};
  for (const question of params.questions || []) {
    if (question?.isSecret) return null;
    const options = Array.isArray(question?.options) ? question.options : [];
    const accepted = options.find(option => /^(accept|allow|approve|confirm|aceitar|permitir|aprovar|confirmar)$/i.test(String(option?.label || "").trim()));
    if (!accepted) return null;
    answers[question.id] = { answers: [accepted.label] };
  }
  return { answers };
}

function normalizeMcpAnswerValue(schema = {}, rawValue) {
  const selected = Array.isArray(rawValue?.answers) ? rawValue.answers[0] : rawValue;
  const options = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : [];
  const matched = options.find(option => {
    if (!option || typeof option !== "object") return false;
    return String(option.title ?? option.const ?? "") === String(selected ?? "");
  });
  if (matched && Object.prototype.hasOwnProperty.call(matched, "const")) return matched.const;
  if (schema.type === "boolean") {
    if (/^(sim|true|yes|1)$/i.test(String(selected ?? ""))) return true;
    if (/^(não|nao|false|no|0)$/i.test(String(selected ?? ""))) return false;
  }
  return selected;
}

export function normalizeMcpAnswers(params = {}, answers = null) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  const properties = params.requestedSchema?.properties && typeof params.requestedSchema.properties === "object"
    ? params.requestedSchema.properties
    : {};
  return Object.fromEntries(Object.entries(answers).map(([id, value]) => [
    id,
    normalizeMcpAnswerValue(properties[id] || {}, value),
  ]));
}

function boundedText(value, limit = DYNAMIC_TOOL_TEXT_LIMIT) {
  const normalized = String(value ?? "");
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}\n[resultado truncado pela PULSO]`;
}

export function normalizeDynamicToolDefinitions(definitions = []) {
  invariant(Array.isArray(definitions), "dynamic_tools_must_be_array");
  const names = new Set();
  return definitions.map(definition => {
    invariant(definition && typeof definition === "object", "dynamic_tool_definition_required");
    const name = String(definition.name || "").trim();
    invariant(DYNAMIC_TOOL_NAME_PATTERN.test(name), `invalid_dynamic_tool_name:${name}`);
    invariant(!names.has(name), `duplicate_dynamic_tool_name:${name}`);
    names.add(name);
    const description = boundedText(definition.description, 1_200).trim();
    invariant(description, `dynamic_tool_description_required:${name}`);
    const inputSchema = definition.inputSchema && typeof definition.inputSchema === "object"
      ? structuredClone(definition.inputSchema)
      : { type: "object", properties: {}, additionalProperties: false };
    return Object.freeze({
      name,
      description,
      inputSchema,
      capability: String(definition.capability || `tool.dynamic.${name}`),
      source: String(definition.source || "pulso_operator"),
      risk: String(definition.risk || "technical"),
      requiresHuman: definition.requiresHuman === true,
      rationale: boundedText(definition.rationale || "a ação produzirá efeito externo", 240),
    });
  });
}

export function dynamicToolSpecs(definitions = []) {
  return normalizeDynamicToolDefinitions(definitions).map(({ name, description, inputSchema }) => ({
    type: "function",
    name,
    description,
    inputSchema,
  }));
}

export function normalizeDynamicToolResult(result) {
  if (typeof result === "string") {
    return { success: true, contentItems: [{ type: "inputText", text: boundedText(result) }] };
  }
  const success = result?.success !== false;
  const supplied = Array.isArray(result?.contentItems)
    ? result.contentItems
    : result?.text !== undefined
      ? [{ type: "inputText", text: result.text }]
      : [{ type: "inputText", text: JSON.stringify(result?.publicResult ?? result ?? null) }];
  const contentItems = supplied.slice(0, 12).map(item => {
    if (item?.type === "inputImage") return { type: "inputImage", imageUrl: boundedText(item.imageUrl, DYNAMIC_TOOL_URL_LIMIT) };
    if (item?.type === "inputAudio") return { type: "inputAudio", audioUrl: boundedText(item.audioUrl, DYNAMIC_TOOL_URL_LIMIT) };
    return { type: "inputText", text: boundedText(item?.text ?? "") };
  });
  return { success, contentItems };
}

function asError(error, fallback = "codex_app_server_error") {
  if (error instanceof Error) return error;
  const wrapped = new Error(typeof error === "string" ? error : fallback);
  wrapped.code = fallback;
  return wrapped;
}

function composeTurnInput(request = {}) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const nonSystem = messages.filter(message => message?.role !== "system");
  if (nonSystem.length === 0) {
    const text = String(request?.input?.text ?? request?.prompt ?? "").trim();
    invariant(text, "input_text_or_messages_required");
    return text;
  }

  return nonSystem.map(message => {
    const role = message?.role === "assistant" ? "Lótus" : "Fe";
    return `${role}: ${String(message?.content ?? "")}`;
  }).join("\n\n");
}

function resolveSystemPrompt(request = {}) {
  if (request.systemPrompt) return String(request.systemPrompt);
  const system = Array.isArray(request.messages)
    ? request.messages.find(message => message?.role === "system")
    : null;
  return system ? String(system.content || "") : null;
}

class AsyncNotificationQueue {
  constructor() {
    this.items = [];
    this.waiters = [];
    this.terminal = null;
  }

  push(value) {
    if (this.terminal) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ value, done: false });
    else this.items.push(value);
  }

  close() {
    if (this.terminal) return;
    this.terminal = { done: true };
    while (this.waiters.length) this.waiters.shift().resolve({ value: undefined, done: true });
  }

  fail(error) {
    if (this.terminal) return;
    this.terminal = { error: asError(error) };
    while (this.waiters.length) this.waiters.shift().reject(this.terminal.error);
  }

  async next() {
    if (this.items.length) return { value: this.items.shift(), done: false };
    if (this.terminal?.error) throw this.terminal.error;
    if (this.terminal?.done) return { value: undefined, done: true };
    return new Promise((resolveNext, rejectNext) => {
      this.waiters.push({ resolve: resolveNext, reject: rejectNext });
    });
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}

export class CodexAppServerClient {
  constructor({
    binaryPath,
    profileId = "personal",
    profilesRoot,
    workspaceDir = null,
    privateContextRoot = null,
    processFactory = spawn,
    requestTimeoutMs = DEFAULT_TIMEOUT_MS,
    turnTimeoutMs = TURN_TIMEOUT_MS,
    clientVersion = "0.9.0",
    accessModeStore = null,
    dynamicTools = [],
    dynamicToolExecutor = null,
  } = {}) {
    invariant(typeof binaryPath === "string" && binaryPath.trim(), "codex_binary_path_required");
    invariant(typeof profilesRoot === "string" && profilesRoot.trim(), "codex_profiles_root_required");
    this.binaryPath = resolve(binaryPath);
    this.profileId = safeProfileId(profileId);
    this.codexHome = resolve(profilesRoot, this.profileId);
    this.workspaceDir = resolve(workspaceDir || join(this.codexHome, "workspace"));
    this.privateContextRoot = privateContextRoot ? resolve(privateContextRoot) : null;
    this.processFactory = processFactory;
    this.requestTimeoutMs = requestTimeoutMs;
    this.turnTimeoutMs = turnTimeoutMs;
    this.clientVersion = clientVersion;
    this.accessModeStore = accessModeStore;
    this.dynamicTools = normalizeDynamicToolDefinitions(dynamicTools);
    this.dynamicToolExecutor = dynamicToolExecutor;
    this.child = null;
    this.reader = null;
    this.nextId = 0;
    this.pending = new Map();
    this.events = new EventEmitter();
    this.pendingApprovals = new Map();
    this.sessionApprovalGrants = new Map();
    this.threadPolicies = new Map();
    this.approvalSequence = 0;
    this.initialized = false;
    this.closed = false;
  }

  async start() {
    if (this.initialized && this.child) return;
    invariant(existsSync(this.binaryPath), "codex_binary_not_found");
    ensureProfileDirectory(this.codexHome);
    installPrivateSkills({ privateContextRoot: this.privateContextRoot, codexHome: this.codexHome });
    mkdirSync(this.workspaceDir, { recursive: true, mode: 0o700 });

    this.child = this.processFactory(this.binaryPath, ["app-server", "--listen", "stdio://"], {
      cwd: this.workspaceDir,
      env: { ...process.env, CODEX_HOME: this.codexHome },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.reader = createInterface({ input: this.child.stdout });
    this.reader.on("line", line => this.#handleLine(line));
    this.child.once("error", error => this.#terminate(error));
    this.child.once("exit", (code, signal) => {
      this.#terminate(new Error(`codex_app_server_exited:${code ?? "null"}:${signal ?? "none"}`));
    });

    await this.request("initialize", {
      clientInfo: {
        name: "pulso_desktop",
        title: "PULSO",
        version: this.clientVersion,
      },
      capabilities: {
        experimentalApi: true,
        mcpServerOpenaiFormElicitation: true,
      },
    });
    this.notify("initialized", {});
    this.initialized = true;
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message && message.id !== undefined && ("result" in message || "error" in message)) {
      const pending = this.pending.get(String(message.id));
      if (!pending) return;
      this.pending.delete(String(message.id));
      clearTimeout(pending.timer);
      if (message.error) {
        const error = new Error(message.error.message || "codex_rpc_error");
        error.code = `codex_rpc_${message.error.code ?? "error"}`;
        pending.reject(error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message && typeof message.method === "string" && message.id === undefined) {
      this.events.emit("notification", message);
      this.events.emit(message.method, message.params ?? {});
      return;
    }

    if (message && typeof message.method === "string" && message.id !== undefined) {
      this.#handleServerRequest(message).catch(error => {
        if (this.child?.stdin?.writable) {
          this.#write({ id: message.id, error: { code: -32603, message: asError(error).message } });
        }
      });
    }
  }

  #access() {
    return this.accessModeStore?.read?.() ?? { mode: "restricted" };
  }

  #approvalGrantKey(method, classification = {}, params = {}) {
    if (method !== "mcpServer/elicitation/request") return null;
    if (classification.risk !== "connector_authorization") return null;
    const source = String(classification.source || params.serverName || "mcp");
    const tool = String(classification.tool || "connector_access");
    const risk = String(classification.risk || "human_input");
    const descriptor = boundedText(`${params.message || ""}|${JSON.stringify(params.requestedSchema || {})}`, 2_000);
    return `${source}:${tool}:${risk}:${descriptor}`;
  }

  #hasSessionApproval(threadId, grantKey) {
    if (!threadId || !grantKey) return false;
    return this.sessionApprovalGrants.get(String(threadId))?.has(grantKey) === true;
  }

  #rememberSessionApproval(threadId, grantKey) {
    if (!threadId || !grantKey) return;
    const key = String(threadId);
    const grants = this.sessionApprovalGrants.get(key) || new Set();
    grants.add(grantKey);
    this.sessionApprovalGrants.set(key, grants);
  }

  async #handleServerRequest(message) {
    const access = this.#access();
    if (access.mode !== "integral") {
      this.#write({ id: message.id, error: { code: -32601, message: "PULSO integral access is disabled" } });
      return;
    }
    const method = message.method;
    const params = message.params ?? {};
    if (method === "item/tool/call") {
      const policy = params.threadId ? this.threadPolicies.get(String(params.threadId)) : null;
      const toolName = String(params.tool || "");
      const definition = policy?.dynamicTools?.get(toolName) ?? null;
      if (!definition || typeof policy?.executeDynamicTool !== "function") {
        this.#write({ id: message.id, result: normalizeDynamicToolResult({ success: false, text: "Ferramenta não disponível nesta sessão." }) });
        return;
      }
      if (policy.abortController?.signal.aborted) {
        this.#write({ id: message.id, result: normalizeDynamicToolResult({ success: false, text: "Execução cancelada." }) });
        return;
      }
      const executeDynamicTool = async () => {
        if (typeof policy.authorizeTool === "function") {
          await policy.authorizeTool({
            capability: definition.capability,
            source: definition.source,
            tool: definition.name,
            risk: definition.risk,
            inputFingerprint: null,
          });
        }
        const output = await policy.executeDynamicTool({
          tool: definition.name,
          namespace: params.namespace ?? null,
          arguments: params.arguments ?? {},
          callId: params.callId ?? null,
          threadId: params.threadId ?? null,
          turnId: params.turnId ?? null,
          signal: policy.abortController?.signal ?? null,
          capability: definition.capability,
          source: definition.source,
          risk: definition.risk,
        });
        this.#write({ id: message.id, result: normalizeDynamicToolResult(output) });
      };
      if (definition.requiresHuman === true) {
        const approvalId = String(params.callId || `dynamic_${++this.approvalSequence}`);
        const requestedAt = new Date().toISOString();
        const classification = {
          risk: definition.risk,
          requiresHuman: true,
          rationale: definition.rationale,
          source: definition.source,
          tool: definition.name,
          capability: definition.capability,
        };
        const approvalParams = { ...params, approvalId, itemId: params.callId || approvalId };
        this.events.emit("tool.approval.requested", sanitizeApproval({
          approvalId,
          method: "pulso/dynamicTool/requestApproval",
          params: approvalParams,
          classification,
          requestedAt,
        }));
        const timer = setTimeout(() => {
          const pending = this.pendingApprovals.get(approvalId);
          if (!pending) return;
          this.pendingApprovals.delete(approvalId);
          if (this.child?.stdin?.writable) {
            this.#write({ id: pending.requestId, result: normalizeDynamicToolResult({ success: false, text: "Envio não realizado: decisão expirada." }) });
          }
          this.events.emit("tool.approval.resolved", sanitizeApproval({
            approvalId,
            method: pending.method,
            params: pending.params,
            classification: pending.classification,
            status: "expired",
            decision: "decline",
            requestedAt,
            resolvedAt: new Date().toISOString(),
          }));
        }, APPROVAL_TIMEOUT_MS);
        this.pendingApprovals.set(approvalId, {
          approvalId,
          requestId: message.id,
          method: "pulso/dynamicTool/requestApproval",
          params: approvalParams,
          classification,
          requestedAt,
          timer,
          executeDynamicTool,
        });
        return;
      }
      try {
        await executeDynamicTool();
      } catch (error) {
        const code = boundedText(error?.code || "operator_tool_failed", 120);
        this.#write({ id: message.id, result: normalizeDynamicToolResult({ success: false, text: `Falha controlada: ${code}` }) });
      }
      return;
    }
    const approvalMethods = new Set([
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
      "item/permissions/requestApproval",
      "item/tool/requestUserInput",
      "mcpServer/elicitation/request",
    ]);
    if (approvalMethods.has(method)) {
      const approvalId = String(params.approvalId || params.itemId || params.callId || `approval_${++this.approvalSequence}`);
      const classification = classifyApproval({ method, params, workspaceDir: this.workspaceDir });
      const requestedAt = new Date().toISOString();
      const grantKey = this.#approvalGrantKey(method, classification, params);

      const policy = params.threadId ? this.threadPolicies.get(String(params.threadId)) : null;
      if (method === "mcpServer/elicitation/request" && classification.mcpToolApproval && typeof policy?.authorizeTool === "function") {
        try {
          await policy.authorizeTool({
            capability: classification.capability,
            source: classification.source,
            tool: classification.tool,
            risk: classification.risk,
            inputFingerprint: classification.fingerprint,
          });
        } catch (error) {
          const result = approvalDecisionResult(method, "decline", params);
          this.#write({ id: message.id, result });
          return;
        }
      }

      if (!classification.requiresHuman || this.#hasSessionApproval(params.threadId, grantKey)) {
        const result = approvalDecisionResult(method, "acceptForSession", params);
        this.#write({ id: message.id, result });
        return;
      }

      const receipt = sanitizeApproval({ approvalId, method, params, classification, requestedAt });
      this.events.emit("tool.approval.requested", receipt);

      const timer = setTimeout(() => {
        const pending = this.pendingApprovals.get(approvalId);
        if (!pending) return;
        this.pendingApprovals.delete(approvalId);
        if (this.child?.stdin?.writable) {
          this.#write({ id: pending.requestId, error: { code: -32001, message: "PULSO approval expired" } });
        }
        this.events.emit("tool.approval.resolved", sanitizeApproval({
          approvalId,
          method,
          params,
          classification,
          status: "expired",
          decision: "decline",
          requestedAt,
          resolvedAt: new Date().toISOString(),
        }));
      }, APPROVAL_TIMEOUT_MS);
      this.pendingApprovals.set(approvalId, {
        approvalId,
        requestId: message.id,
        method,
        params,
        classification,
        requestedAt,
        timer,
        grantKey,
      });
      return;
    }
    this.#write({ id: message.id, error: { code: -32601, message: `Unsupported PULSO server request: ${method}` } });
  }

  listPendingApprovals() {
    return [...this.pendingApprovals.values()].map(pending => sanitizeApproval({
      approvalId: pending.approvalId,
      method: pending.method,
      params: pending.params,
      classification: pending.classification,
      requestedAt: pending.requestedAt,
    }));
  }

  async resolveApproval(approvalId, { decision = "decline", answers = null } = {}) {
    const pending = this.pendingApprovals.get(String(approvalId));
    invariant(pending, `tool_approval_not_found:${approvalId}`);
    this.pendingApprovals.delete(String(approvalId));
    clearTimeout(pending.timer);
    let result = null;
    if (pending.method === "pulso/dynamicTool/requestApproval") {
      const approved = ["approve", "accept", "acceptForSession"].includes(decision);
      if (approved) {
        try {
          await pending.executeDynamicTool();
        } catch (error) {
          const code = boundedText(error?.code || "operator_tool_failed", 120);
          this.#write({ id: pending.requestId, result: normalizeDynamicToolResult({ success: false, text: `Falha controlada: ${code}` }) });
          decision = "decline";
        }
      } else {
        this.#write({ id: pending.requestId, result: normalizeDynamicToolResult({ success: false, text: "Envio não realizado: decisão recusada." }) });
      }
    } else if (pending.method === "item/tool/requestUserInput") {
      if (["approve", "accept", "acceptForSession"].includes(decision) && answers && typeof answers === "object") {
        result = { answers };
      } else {
        this.#write({ id: pending.requestId, error: { code: -32002, message: "PULSO operator declined user input" } });
      }
    } else if (pending.method === "mcpServer/elicitation/request") {
      const approved = ["approve", "accept", "acceptForSession"].includes(decision);
      result = {
        action: approved ? "accept" : "decline",
        content: approved ? normalizeMcpAnswers(pending.params, answers) : null,
        _meta: null,
      };
    } else {
      result = approvalDecisionResult(pending.method, decision, pending.params);
    }
    if (result) this.#write({ id: pending.requestId, result });
    const approved = ["approve", "accept", "acceptForSession"].includes(decision);
    if (approved && pending.grantKey) {
      this.#rememberSessionApproval(pending.params?.threadId, pending.grantKey);
    }
    const receipt = sanitizeApproval({
      approvalId: pending.approvalId,
      method: pending.method,
      params: pending.params,
      classification: pending.classification,
      status: approved ? "approved" : "declined",
      decision: approved ? "acceptForSession" : "decline",
      requestedAt: pending.requestedAt,
      resolvedAt: new Date().toISOString(),
    });
    this.events.emit("tool.approval.resolved", receipt);
    return receipt;
  }

  #terminate(error) {
    if (this.closed) return;
    this.closed = true;
    this.initialized = false;
    const safeError = asError(error, "codex_app_server_closed");
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(safeError);
    }
    this.pending.clear();
    for (const pending of this.pendingApprovals.values()) clearTimeout(pending.timer);
    this.pendingApprovals.clear();
    this.threadPolicies.clear();
    this.events.emit("closed", safeError);
  }

  #write(message) {
    invariant(this.child?.stdin?.writable, "codex_app_server_stdin_unavailable");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  async request(method, params = {}, timeoutMs = this.requestTimeoutMs) {
    if (method !== "initialize") await this.start();
    const id = String(++this.nextId);
    const promise = new Promise((resolveRequest, rejectRequest) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error(`codex_rpc_timeout:${method}`);
        error.code = "codex_rpc_timeout";
        rejectRequest(error);
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer, method });
    });
    this.#write({ method, id, params });
    return promise;
  }

  async loginStart() {
    await this.start();
    return this.request("account/login/start", {
      type: "chatgpt",
      appBrand: "codex",
      useHostedLoginSuccessPage: true,
    });
  }

  async loginCancel(loginId) {
    await this.start();
    return this.request("account/login/cancel", { loginId });
  }

  async accountRead({ refreshToken = false } = {}) {
    await this.start();
    return this.request("account/read", { refreshToken });
  }

  async logout() {
    await this.start();
    return this.request("account/logout", {});
  }

  async listModels() {
    await this.start();
    return this.request("model/list", { includeHidden: false });
  }

  async *streamCompletion({
    model,
    systemPrompt = null,
    input,
    signal = null,
    authorizeTool = null,
    dynamicTools = null,
    executeDynamicTool = null,
  } = {}) {
    await this.start();
    const account = await this.accountRead({ refreshToken: true });
    invariant(account?.account?.type === "chatgpt", "codex_chatgpt_login_required");

    const queue = new AsyncNotificationQueue();
    let threadId = null;
    let turnId = null;
    const activeDynamicTools = normalizeDynamicToolDefinitions(dynamicTools ?? this.dynamicTools);
    const dynamicCapabilities = new Map(activeDynamicTools.map(definition => [definition.name, definition.capability]));
    const dynamicToolExecutor = executeDynamicTool ?? this.dynamicToolExecutor;
    const dynamicAbortController = new AbortController();
    const onNotification = message => {
      const params = message.params ?? {};
      if (threadId && params.threadId && params.threadId !== threadId) return;
      if (turnId && params.turnId && params.turnId !== turnId) return;
      if (message.method === "item/agentMessage/delta") {
        queue.push({ type: "delta", delta: String(params.delta || ""), params });
      } else if (message.method === "item/started") {
        if (isOperationalToolItem(params.item)) {
          queue.push({ type: "tool.started", receipt: normalizeToolItem(params.item || {}, "started", { dynamicCapabilities }), params });
        }
      } else if (message.method === "item/completed") {
        if (isOperationalToolItem(params.item)) {
          queue.push({ type: "tool.completed", receipt: normalizeToolItem(params.item || {}, "completed", { dynamicCapabilities }), params });
        }
      } else if (message.method === "turn/completed") {
        queue.push({ type: "completed", params });
        queue.close();
      } else if (message.method === "error") {
        queue.fail(new Error(params.message || "codex_turn_error"));
      }
    };
    const onApprovalRequested = receipt => {
      if (threadId && receipt.threadId && receipt.threadId !== threadId) return;
      if (turnId && receipt.turnId && receipt.turnId !== turnId) return;
      queue.push({ type: "tool.approval.requested", receipt });
    };
    const onApprovalResolved = receipt => {
      if (threadId && receipt.threadId && receipt.threadId !== threadId) return;
      if (turnId && receipt.turnId && receipt.turnId !== turnId) return;
      queue.push({ type: "tool.approval.resolved", receipt });
    };
    const onClosed = error => queue.fail(error);
    this.events.on("notification", onNotification);
    this.events.on("tool.approval.requested", onApprovalRequested);
    this.events.on("tool.approval.resolved", onApprovalResolved);
    this.events.once("closed", onClosed);

    let abortHandler = null;
    try {
      const access = this.#access();
      const integral = access.mode === "integral";
      const threadResult = await this.request("thread/start", {
        model: model || null,
        cwd: this.workspaceDir,
        sandbox: integral ? "danger-full-access" : "read-only",
        approvalPolicy: integral ? "on-request" : "never",
        config: integral ? {
          "apps._default.approvals_reviewer": "user",
          "apps._default.default_tools_approval_mode": "prompt",
        } : null,
        ephemeral: true,
        baseInstructions: systemPrompt || null,
        developerInstructions: integral ? integralDeveloperInstructions() : restrictedDeveloperInstructions(),
        dynamicTools: integral && activeDynamicTools.length ? dynamicToolSpecs(activeDynamicTools) : undefined,
      });
      threadId = threadResult?.thread?.id;
      invariant(threadId, "codex_thread_id_missing");
      this.threadPolicies.set(String(threadId), {
        authorizeTool: typeof authorizeTool === "function" ? authorizeTool : null,
        dynamicTools: new Map(activeDynamicTools.map(definition => [definition.name, definition])),
        executeDynamicTool: typeof dynamicToolExecutor === "function" ? dynamicToolExecutor : null,
        abortController: dynamicAbortController,
      });

      const turnResult = await this.request("turn/start", {
        threadId,
        input: [{ type: "text", text: input }],
        model: model || null,
        approvalPolicy: integral ? "on-request" : "never",
      }, this.turnTimeoutMs);
      turnId = turnResult?.turn?.id;
      invariant(turnId, "codex_turn_id_missing");

      if (signal) {
        abortHandler = () => {
          dynamicAbortController.abort();
          this.request("turn/interrupt", { threadId, turnId }).catch(() => {});
          queue.fail(Object.assign(new Error("provider_stream_cancelled"), { code: "request_cancelled" }));
        };
        if (signal.aborted) abortHandler();
        else signal.addEventListener("abort", abortHandler, { once: true });
      }

      for await (const event of queue) {
        if (event.type === "delta" && event.delta) {
          yield { type: "delta", delta: event.delta, threadId, turnId };
        } else if (event.type.startsWith("tool.")) {
          yield { type: event.type, receipt: event.receipt, threadId, turnId };
        } else if (event.type === "completed") {
          const status = event.params?.turn?.status;
          if (status !== "completed") {
            const error = new Error(event.params?.turn?.error?.message || `codex_turn_${status || "failed"}`);
            error.code = status === "interrupted" ? "request_cancelled" : "codex_turn_failed";
            throw error;
          }
          yield { type: "completed", threadId, turnId, status };
        }
      }
    } finally {
      dynamicAbortController.abort();
      if (threadId) this.threadPolicies.delete(String(threadId));
      this.events.off("notification", onNotification);
      this.events.off("tool.approval.requested", onApprovalRequested);
      this.events.off("tool.approval.resolved", onApprovalResolved);
      this.events.off("closed", onClosed);
      if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
    }
  }

  async close() {
    if (!this.child) return;
    this.closed = true;
    this.reader?.close();
    this.child.kill();
    this.child = null;
    this.initialized = false;
  }
}

export class CodexSubscriptionAdapter extends ModelProvider {
  constructor({
    id = "codex-subscription",
    label = "ChatGPT · assinatura",
    defaultModel = null,
    models = [],
    client,
    clock = () => new Date().toISOString(),
    secretResolver = null,
  } = {}) {
    super(id, label);
    invariant(client && typeof client.streamCompletion === "function", "codex_app_server_client_required");
    this.adapterKind = "codex_subscription";
    this.protocol = "codex_app_server_stdio";
    this.defaultModel = defaultModel;
    this.models = [...models];
    this.client = client;
    this.clock = clock;
    this.secretRef = null;
    this.secretResolver = secretResolver || new SecretRefResolver({ clock });
  }

  async capabilities() {
    return Object.freeze({
      providerId: this.id,
      adapterKind: this.adapterKind,
      protocol: this.protocol,
      modalities: ["text"],
      streaming: true,
      local: false,
      allowExternalNetwork: true,
      authRequired: true,
      authMethod: "chatgpt_subscription",
      credentialsStore: "keyring",
      defaultModel: this.defaultModel,
      models: [...this.models],
      includes: feature => ["text", "text_completion", "streaming", "subscription_login"].includes(feature),
    });
  }

  async health() {
    const checkedAt = this.clock();
    try {
      const result = await this.client.accountRead({ refreshToken: true });
      const account = result?.account ?? null;
      return {
        status: account?.type === "chatgpt" ? "healthy" : "unhealthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        checkedAt,
        detail: account?.type === "chatgpt" ? "chatgpt_subscription_authenticated" : "chatgpt_login_required",
        account: account ? {
          type: account.type,
          email: account.email ?? null,
          planType: account.planType ?? "unknown",
        } : null,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        checkedAt,
        detail: asError(error).message,
      };
    }
  }

  async complete(request = {}) {
    let final = null;
    let text = "";
    for await (const event of this.stream(request)) {
      if (event.type === "model.delta") text += event.text;
      if (event.type === "model.completed") final = event;
    }
    invariant(final, "codex_stream_missing_completion");
    return { ...final, text, outputText: text };
  }

  async *stream(request = {}) {
    const model = request.model ?? this.defaultModel;
    const input = composeTurnInput(request);
    const systemPrompt = resolveSystemPrompt(request);
    let text = "";
    let index = 0;
    let threadId = null;
    let turnId = null;

    for await (const event of this.client.streamCompletion({
      model,
      systemPrompt,
      input,
      signal: request.signal ?? null,
      authorizeTool: request.authorizeTool ?? null,
      dynamicTools: request.dynamicTools ?? null,
      executeDynamicTool: request.executeDynamicTool ?? null,
    })) {
      if (event.type === "delta") {
        threadId = event.threadId ?? threadId;
        turnId = event.turnId ?? turnId;
        text += event.delta;
        yield {
          type: "model.delta",
          kind: "delta",
          providerId: this.id,
          adapterKind: this.adapterKind,
          model,
          text: event.delta,
          delta: event.delta,
          index: index++,
        };
      } else if (event.type.startsWith("tool.")) {
        threadId = event.threadId ?? threadId;
        turnId = event.turnId ?? turnId;
        yield {
          type: event.type,
          kind: event.type,
          providerId: this.id,
          adapterKind: this.adapterKind,
          model,
          receipt: { ...(event.receipt || {}), providerId: this.id },
        };
      } else if (event.type === "completed") {
        threadId = event.threadId ?? threadId;
        turnId = event.turnId ?? turnId;
      }
    }

    invariant(text.trim(), "assistant_message_empty");
    const providerBinding = validateProviderBinding({
      providerType: "model",
      providerId: this.id,
      connectionId: `${this.id}-stdio`,
      externalRunId: turnId ? `ext_codex_${turnId}` : null,
      externalResponseId: turnId,
      externalSessionId: threadId,
      boundAt: this.clock(),
      metadata: {
        adapterKind: this.adapterKind,
        protocol: this.protocol,
        model,
        ephemeralThread: true,
      },
    });
    const completed = {
      type: "model.completed",
      kind: "completed",
      providerId: this.id,
      adapterKind: this.adapterKind,
      model,
      text,
      outputText: text,
      finishReason: "stop",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputUnits: input.length,
        outputUnits: text.length,
      },
      providerBinding,
    };
    this.secretResolver.assertZeroLeakage(completed);
    yield completed;
  }
}

export { composeTurnInput, ensureProfileDirectory, safeProfileId };
