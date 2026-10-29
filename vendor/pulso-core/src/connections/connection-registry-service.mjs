import { eventDraft, invariant, pulsoId } from "../domain/contracts.mjs";
import { assertNoSecrets } from "../control-plane/secrets.mjs";

const ACTOR = Object.freeze({ kind: "system", id: "pulso-connection-registry" });
const SCOPE_TYPES = new Set(["system", "area", "agent", "task"]);
const CONNECTION_STATUSES = new Set(["available", "needs_auth", "transition", "degraded", "disabled", "unknown"]);
const CONNECTOR_SERVICE_PATTERNS = Object.freeze([
  ["notion", /(?:^|[._-])notion(?:$|[._-])/i],
  ["google", /(?:gmail|google(?:[_-](?:drive|calendar|docs|sheets|slides))?|gdrive|gcal)/i],
  ["whatsapp", /(?:whatsapp|wacli)/i],
  ["jobs", /(?:automation|scheduler|cron|jobs?)/i],
  ["devices", /(?:devices?|nodes?|macs?)/i],
  ["telegram", /telegram/i],
  ["matrix", /matrix/i],
  ["open_design", /(?:open[_-]?design|opendesign)/i],
  ["vps", /(?:vps|server[_-]?admin)/i],
  ["github", /github/i],
  ["ollama", /ollama/i],
  ["transcription", /(?:transcri|whisper|speech[_-]?to[_-]?text)/i],
  ["browser", /(?:browser|arc|hermes)/i],
  ["hosting", /(?:hosting|cpanel|turbo[_-]?cloud)/i],
  ["microsoft", /(?:microsoft|outlook|onedrive|sharepoint|teams)/i],
]);

function cleanText(value, limit = 240) {
  const text = String(value ?? "").trim();
  invariant(text.length <= limit, "connection_field_too_long");
  return text;
}

function stringList(value, limit = 100) {
  invariant(value === undefined || Array.isArray(value), "connection_list_required");
  return [...new Set((value || []).map(item => cleanText(item, limit)).filter(Boolean))].sort();
}

function normalizeProfile(input, now, current = null) {
  const connectionId = cleanText(input.connectionId || input.id || current?.connectionId, 160);
  const service = cleanText(input.service || current?.service, 80).toLowerCase();
  invariant(connectionId, "connection_id_required");
  invariant(service, "connection_service_required");
  const status = cleanText(input.status || current?.status || "unknown", 40);
  invariant(CONNECTION_STATUSES.has(status), "connection_status_invalid");
  const profile = {
    connectionId,
    service,
    label: cleanText(input.label || current?.label || connectionId),
    principal: cleanText(input.principal ?? current?.principal ?? "", 320) || null,
    tenant: cleanText(input.tenant ?? current?.tenant ?? "", 320) || null,
    adapter: cleanText(input.adapter || current?.adapter || "unassigned", 120),
    credentialSlot: cleanText(input.credentialSlot ?? current?.credentialSlot ?? "", 180) || null,
    capabilities: stringList(input.capabilities ?? current?.capabilities),
    status,
    source: cleanText(input.source || current?.source || "pulso", 120),
    localOnly: input.localOnly === true || current?.localOnly === true,
    metadata: structuredClone(input.metadata ?? current?.metadata ?? {}),
    createdAt: current?.createdAt || input.createdAt || now,
    updatedAt: now,
  };
  assertNoSecrets(profile);
  return profile;
}

function normalizeBinding(input, now, current = null) {
  const scopeType = cleanText(input.scopeType || current?.scopeType || "system", 40);
  invariant(SCOPE_TYPES.has(scopeType), "connection_binding_scope_invalid");
  const scopeId = cleanText(input.scopeId || current?.scopeId || "global", 180);
  const service = cleanText(input.service || current?.service, 80).toLowerCase();
  const connectionId = cleanText(input.connectionId || current?.connectionId, 160);
  invariant(service, "connection_binding_service_required");
  invariant(connectionId, "connection_binding_connection_required");
  const bindingId = cleanText(
    input.bindingId || current?.bindingId || `${scopeType}:${scopeId}:${service}`,
    520,
  );
  const binding = {
    bindingId,
    scopeType,
    scopeId,
    service,
    connectionId,
    priority: Number.isFinite(Number(input.priority ?? current?.priority))
      ? Number(input.priority ?? current?.priority)
      : 100,
    enabled: input.enabled !== false,
    createdAt: current?.createdAt || input.createdAt || now,
    updatedAt: now,
  };
  assertNoSecrets(binding);
  return binding;
}

function publicProfile(profile) {
  const { credentialSlot, ...safe } = profile;
  return { ...structuredClone(safe), credentialConfigured: Boolean(credentialSlot) };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !["createdAt", "updatedAt"].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function semanticallyEqual(a, b) {
  return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));
}

function toolService(input = {}) {
  const descriptor = [input.capability, input.source, input.tool]
    .filter(Boolean)
    .map(String)
    .join(".");
  for (const [service, pattern] of CONNECTOR_SERVICE_PATTERNS) {
    if (pattern.test(descriptor)) return service;
  }
  return null;
}

function connectionError(code, connection, service) {
  const error = new Error(`${code}:${service}:${connection?.connectionId || "unbound"}`);
  error.code = code;
  error.connectionId = connection?.connectionId || null;
  error.service = service;
  return error;
}

export class ConnectionRegistryService {
  constructor({ store, clock = () => new Date().toISOString() } = {}) {
    invariant(store, "event_store_required");
    this.store = store;
    this.clock = clock;
    this.profiles = new Map();
    this.bindings = new Map();
    this.restore();
  }

  restore() {
    this.profiles.clear();
    this.bindings.clear();
    for (const event of this.store.all().filter(item => item.type.startsWith("connection."))) {
      if (["connection.profile_registered", "connection.profile_updated", "connection.health_recorded"].includes(event.type)) {
        this.profiles.set(event.payload.connectionId, structuredClone(event.payload));
      }
      if (event.type === "connection.binding_set") {
        this.bindings.set(event.payload.bindingId, structuredClone(event.payload));
      }
    }
    return this.status();
  }

  register(input = {}, { idempotencyKey = null } = {}) {
    const occurredAt = this.clock();
    const current = this.profiles.get(String(input.connectionId || input.id || "")) || null;
    const profile = normalizeProfile(input, occurredAt, current);
    const result = this.store.append([eventDraft({
      type: current ? "connection.profile_updated" : "connection.profile_registered",
      aggregateType: "connection_profile",
      aggregateId: profile.connectionId,
      correlationId: pulsoId("conncmd"),
      actor: input.actor || ACTOR,
      occurredAt,
      payload: profile,
    })], idempotencyKey ? {
      idempotency: { scope: "connection.register", key: idempotencyKey, entityId: profile.connectionId, createdAt: occurredAt },
    } : {});
    if (!result.duplicate) this.profiles.set(profile.connectionId, structuredClone(profile));
    return { connection: publicProfile(this.profiles.get(profile.connectionId) || profile), duplicate: result.duplicate, events: result.events };
  }

  recordHealth(connectionId, health = {}) {
    const current = this.profiles.get(connectionId);
    invariant(current, `connection_not_found:${connectionId}`);
    const occurredAt = this.clock();
    const profile = normalizeProfile({
      ...current,
      status: health.status || current.status,
      metadata: {
        ...current.metadata,
        health: {
          ok: health.ok === true,
          checkedAt: occurredAt,
          code: cleanText(health.code || "", 120) || null,
        },
      },
    }, occurredAt, current);
    const result = this.store.append([eventDraft({
      type: "connection.health_recorded",
      aggregateType: "connection_profile",
      aggregateId: connectionId,
      correlationId: pulsoId("conncmd"),
      actor: ACTOR,
      occurredAt,
      payload: profile,
    })]);
    this.profiles.set(connectionId, structuredClone(profile));
    return { connection: publicProfile(profile), events: result.events };
  }

  bind(input = {}, { idempotencyKey = null } = {}) {
    const occurredAt = this.clock();
    const provisionalId = String(input.bindingId || `${input.scopeType || "system"}:${input.scopeId || "global"}:${input.service || ""}`);
    const current = this.bindings.get(provisionalId) || null;
    const binding = normalizeBinding(input, occurredAt, current);
    const profile = this.profiles.get(binding.connectionId);
    invariant(profile, `connection_not_found:${binding.connectionId}`);
    invariant(profile.service === binding.service, "connection_binding_service_mismatch");
    const result = this.store.append([eventDraft({
      type: "connection.binding_set",
      aggregateType: "connection_binding",
      aggregateId: binding.bindingId,
      correlationId: pulsoId("conncmd"),
      actor: input.actor || ACTOR,
      occurredAt,
      payload: binding,
    })], idempotencyKey ? {
      idempotency: { scope: "connection.bind", key: idempotencyKey, entityId: binding.bindingId, createdAt: occurredAt },
    } : {});
    if (!result.duplicate) this.bindings.set(binding.bindingId, structuredClone(binding));
    return { binding: structuredClone(this.bindings.get(binding.bindingId) || binding), duplicate: result.duplicate, events: result.events };
  }

  importInventory({ connections = [], bindings = [], inventoryId = "inventory" } = {}) {
    invariant(Array.isArray(connections), "connection_inventory_connections_required");
    invariant(Array.isArray(bindings), "connection_inventory_bindings_required");
    const receipts = [];
    for (const connection of connections) {
      const current = this.profiles.get(String(connection.connectionId || connection.id || "")) || null;
      const normalized = normalizeProfile(connection, current?.updatedAt || this.clock(), current);
      if (current && semanticallyEqual(current, normalized)) {
        receipts.push({ unchanged: true, duplicate: false, connection: publicProfile(current), events: [] });
        continue;
      }
      receipts.push(this.register(connection, {
        idempotencyKey: `${inventoryId}:connection:${connection.connectionId}`,
      }));
    }
    for (const binding of bindings) {
      const bindingId = String(binding.bindingId || `${binding.scopeType || "system"}:${binding.scopeId || "global"}:${binding.service || ""}`);
      const current = this.bindings.get(bindingId) || null;
      const normalized = normalizeBinding(binding, current?.updatedAt || this.clock(), current);
      if (current && semanticallyEqual(current, normalized)) {
        receipts.push({ unchanged: true, duplicate: false, binding: structuredClone(current), events: [] });
        continue;
      }
      receipts.push(this.bind(binding, {
        idempotencyKey: `${inventoryId}:binding:${binding.bindingId || `${binding.scopeType}:${binding.scopeId}:${binding.service}`}`,
      }));
    }
    return {
      inventoryId,
      connections: connections.length,
      bindings: bindings.length,
      created: receipts.filter(item => item.duplicate !== true && item.unchanged !== true).length,
      duplicates: receipts.filter(item => item.duplicate === true).length,
      unchanged: receipts.filter(item => item.unchanged === true).length,
      status: this.status(),
    };
  }

  list({ service = null, status = null } = {}) {
    let profiles = [...this.profiles.values()];
    if (service) profiles = profiles.filter(item => item.service === String(service).toLowerCase());
    if (status) profiles = profiles.filter(item => item.status === status);
    return profiles.sort((a, b) => a.label.localeCompare(b.label)).map(publicProfile);
  }

  listBindings({ service = null, scopeType = null, scopeId = null } = {}) {
    let bindings = [...this.bindings.values()];
    if (service) bindings = bindings.filter(item => item.service === String(service).toLowerCase());
    if (scopeType) bindings = bindings.filter(item => item.scopeType === scopeType);
    if (scopeId) bindings = bindings.filter(item => item.scopeId === scopeId);
    return bindings.sort((a, b) => a.priority - b.priority || a.bindingId.localeCompare(b.bindingId)).map(item => structuredClone(item));
  }

  resolve({ service, taskId = null, agentId = null, areaId = null } = {}) {
    const normalizedService = cleanText(service, 80).toLowerCase();
    invariant(normalizedService, "connection_service_required");
    const scopes = [
      taskId ? ["task", taskId] : null,
      agentId ? ["agent", agentId] : null,
      areaId ? ["area", areaId] : null,
      ["system", "global"],
    ].filter(Boolean);
    for (const [scopeType, scopeId] of scopes) {
      const candidates = this.listBindings({ service: normalizedService, scopeType, scopeId })
        .filter(item => item.enabled)
        .map(binding => ({ binding, profile: this.profiles.get(binding.connectionId) }))
        .filter(item => item.profile && item.profile.status !== "disabled");
      if (candidates.length) {
        const selected = candidates[0];
        return { binding: selected.binding, connection: publicProfile(selected.profile), matchedScope: { type: scopeType, id: scopeId } };
      }
    }
    return { binding: null, connection: null, matchedScope: null };
  }

  context({ taskId = null, agentId = null, areaId = null } = {}) {
    const services = [...new Set([...this.bindings.values()].map(item => item.service))].sort();
    return services.map(service => ({
      service,
      ...this.resolve({ service, taskId, agentId, areaId }),
    }));
  }

  promptContext(scope = {}) {
    const selected = this.context(scope);
    if (!selected.length) return "";
    const lines = selected.map(item => {
      if (!item.connection) return `- ${item.service}: sem conexão vinculada`;
      const identity = [item.connection.label, item.connection.principal, item.connection.tenant]
        .filter(Boolean)
        .join(" · ");
      return `- ${item.service}: ${identity} [${item.connection.connectionId}; ${item.connection.status}; adaptador=${item.connection.adapter}]`;
    });
    return [
      "Conexões nomeadas selecionadas para este turno:",
      ...lines,
      "Use somente a conexão selecionada para cada serviço.",
      "Se o estado não for available, não use um conector genérico como substituto e não troque de conta silenciosamente; declare a indisponibilidade com o connectionId.",
      "Leituras e operações internas disponíveis não pedem nova aprovação. Efeitos humanos externos continuam sujeitos à política da ferramenta.",
    ].join("\n");
  }

  authorizeTool(input = {}, scope = {}) {
    const service = toolService(input);
    if (!service) return { governed: false, service: null, connection: null };
    const resolved = this.resolve({ service, ...scope });
    if (!resolved.connection) throw connectionError("connection_binding_missing", null, service);
    if (resolved.connection.status !== "available") {
      throw connectionError("connection_unavailable", resolved.connection, service);
    }
    return { governed: true, service, ...resolved };
  }

  status() {
    const profiles = [...this.profiles.values()];
    return {
      total: profiles.length,
      available: profiles.filter(item => item.status === "available").length,
      needsAuth: profiles.filter(item => item.status === "needs_auth").length,
      degraded: profiles.filter(item => item.status === "degraded").length,
      bindings: this.bindings.size,
    };
  }
}
