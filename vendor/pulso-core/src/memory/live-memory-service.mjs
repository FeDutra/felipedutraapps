import { eventDraft, invariant, pulsoId } from "../domain/contracts.mjs";

const ACTOR = Object.freeze({ kind: "system", id: "pulso-live-memory" });

function terms(value) {
  return [...new Set(String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) || [])];
}

export class LiveMemoryService {
  constructor({ store, clock = () => new Date().toISOString() } = {}) {
    invariant(store, "event_store_required");
    this.store = store;
    this.clock = clock;
    this.items = new Map();
    this.restore();
  }

  restore() {
    this.items.clear();
    for (const event of this.store.all().filter(item => item.type.startsWith("memory."))) {
      if (event.type === "memory.item_written" || event.type === "memory.item_updated") {
        this.items.set(event.payload.memoryId, structuredClone(event.payload));
      } else if (event.type === "memory.item_forgotten") {
        this.items.delete(event.payload.memoryId);
      }
    }
    return this.list();
  }

  remember(input = {}, options = {}) {
    const content = String(input.content || "").trim();
    invariant(content, "memory_content_required");
    const memoryId = input.memoryId || pulsoId("mem");
    const previous = this.items.get(memoryId) || null;
    const occurredAt = this.clock();
    const payload = {
      memoryId,
      content,
      title: String(input.title || previous?.title || "Memória").trim(),
      scope: input.scope || previous?.scope || { type: "global", scopeId: null },
      tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(String))] : (previous?.tags || []),
      source: input.source || previous?.source || { kind: "conversation", ref: null },
      confidence: Math.max(0, Math.min(1, Number(input.confidence ?? previous?.confidence ?? 1))),
      createdAt: previous?.createdAt || occurredAt,
      updatedAt: occurredAt,
    };
    const type = previous ? "memory.item_updated" : "memory.item_written";
    const result = this.store.append([eventDraft({
      type,
      aggregateType: "memory_item",
      aggregateId: memoryId,
      correlationId: options.correlationId || pulsoId("memcmd"),
      actor: options.actor || ACTOR,
      occurredAt,
      payload,
    })], options.idempotencyKey ? { idempotency: { scope: "memory|remember", key: options.idempotencyKey, entityId: memoryId } } : {});
    if (!result.duplicate) this.items.set(memoryId, structuredClone(payload));
    return { duplicate: result.duplicate, memory: structuredClone(this.items.get(memoryId)), events: result.events };
  }

  forget(memoryId, { reason = "user_requested", actor = ACTOR } = {}) {
    invariant(this.items.has(memoryId), `memory_not_found:${memoryId}`);
    const occurredAt = this.clock();
    const result = this.store.append([eventDraft({
      type: "memory.item_forgotten",
      aggregateType: "memory_item",
      aggregateId: memoryId,
      correlationId: pulsoId("memcmd"),
      actor,
      occurredAt,
      payload: { memoryId, reason, forgottenAt: occurredAt },
    })]);
    this.items.delete(memoryId);
    return { memoryId, forgotten: true, events: result.events };
  }

  list(query = {}) {
    let items = [...this.items.values()];
    if (query.scopeType) items = items.filter(item => item.scope?.type === query.scopeType);
    if (query.scopeId) items = items.filter(item => item.scope?.scopeId === query.scopeId);
    if (query.tag) items = items.filter(item => item.tags.includes(query.tag));
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, query.limit || 500).map(item => structuredClone(item));
  }

  search({ query, scopeType = null, scopeId = null, limit = 8 } = {}) {
    const needle = terms(query);
    if (!needle.length) return { provider: "pulso-live-memory", results: [] };
    const results = this.list({ scopeType, scopeId, limit: 10000 }).map(item => {
      const haystack = terms(`${item.title} ${item.content} ${item.tags.join(" ")}`);
      const overlap = needle.filter(term => haystack.some(value => value.includes(term) || term.includes(value))).length;
      return { ...item, score: overlap / needle.length };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
    return { provider: "pulso-live-memory", results };
  }
}
