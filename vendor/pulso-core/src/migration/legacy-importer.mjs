import { createHash } from "node:crypto";
import { invariant } from "../domain/contracts.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

export function contentHash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function required(value, code) {
  invariant(typeof value === "string" && value.trim(), code);
  return value.trim();
}

function timestamp(value, fallback) {
  const result = value || fallback;
  invariant(typeof result === "string" && !Number.isNaN(Date.parse(result)), "legacy_timestamp_invalid");
  return new Date(result).toISOString();
}

function provenance(source, collection, record) {
  const sourceId = required(record.sourceId ?? record.id, "legacy_record_id_required");
  return {
    sourceSystem: source.system,
    sourceCollection: collection,
    sourceId,
    exportedAt: source.exportedAt,
    contentHash: contentHash(record),
    projectId: source.projectId ?? null,
    workspaceId: source.workspaceId ?? null
  };
}

function normalizeRole(role) {
  if (["human", "user"].includes(role)) return "human";
  if (["assistant", "model", "lotus"].includes(role)) return "assistant";
  if (role === "system") return "system";
  invariant(false, "legacy_message_role_invalid:" + role);
}

export function normalizeLegacySnapshot(snapshot) {
  invariant(snapshot?.schemaVersion === 1, "legacy_snapshot_schema_version_invalid");
  const source = snapshot.source || {};
  invariant(source.system === "firebase", "legacy_source_must_be_firebase");
  required(source.projectId, "legacy_project_id_required");
  required(source.workspaceId, "legacy_workspace_id_required");
  source.exportedAt = timestamp(source.exportedAt, null);
  const areaIds = new Set();
  const areas = (snapshot.areas || []).map((record, index) => {
    const id = required(record.id, "legacy_area_id_required");
    invariant(!areaIds.has(id), "legacy_area_duplicate:" + id);
    areaIds.add(id);
    return {
      id,
      nome: required(record.nome ?? record.name ?? record.label, "legacy_area_name_required"),
      glifo: required(record.glifo ?? record.glyph ?? "○", "legacy_area_glyph_required"),
      ordem: Number.isFinite(record.ordem ?? record.order) ? Number(record.ordem ?? record.order) : index,
      estado: record.archived === true ? "archived" : "active",
      createdAt: timestamp(record.createdAt, source.exportedAt),
      updatedAt: timestamp(record.updatedAt, record.createdAt || source.exportedAt),
      provenance: provenance(source, "pulso_areas", record)
    };
  });
  const sessionIds = new Set();
  const sessions = (snapshot.sessions || []).map(record => {
    const id = required(record.id, "legacy_session_id_required");
    const areaId = required(record.areaId, "legacy_session_area_required");
    invariant(areaIds.has(areaId), "legacy_session_area_missing:" + areaId);
    invariant(!sessionIds.has(id), "legacy_session_duplicate:" + id);
    sessionIds.add(id);
    return {
      id,
      areaId,
      titulo: required(record.titulo ?? record.title ?? record.label, "legacy_session_title_required"),
      identityId: "lotus",
      estado: record.archived === true ? "archived" : "active",
      createdAt: timestamp(record.createdAt, source.exportedAt),
      updatedAt: timestamp(record.updatedAt, record.createdAt || source.exportedAt),
      provenance: provenance(source, "pulso_sessions", record)
    };
  });
  const messageIds = new Set();
  const messages = (snapshot.messages || []).map(record => {
    const id = required(record.id, "legacy_message_id_required");
    const sessionId = required(record.sessionId ?? record.contextId, "legacy_message_session_required");
    invariant(sessionIds.has(sessionId), "legacy_message_session_missing:" + sessionId);
    invariant(!messageIds.has(id), "legacy_message_duplicate:" + id);
    messageIds.add(id);
    return {
      id,
      sessionId,
      role: normalizeRole(record.role),
      texto: required(record.texto ?? record.text ?? record.content, "legacy_message_text_required"),
      estado: "persisted",
      createdAt: timestamp(record.createdAt, source.exportedAt),
      provenance: provenance(source, "pulso_messages", record)
    };
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { schemaVersion: 1, source: structuredClone(source), areas, sessions, messages };
}

export class LegacyImportService {
  constructor({ live, store } = {}) {
    invariant(live, "legacy_import_live_required");
    invariant(store, "legacy_import_store_required");
    this.live = live;
    this.store = store;
  }

  plan(snapshot) {
    const normalized = normalizeLegacySnapshot(snapshot);
    return {
      snapshotHash: contentHash(normalized),
      source: normalized.source,
      counts: { areas: normalized.areas.length, sessions: normalized.sessions.length, messages: normalized.messages.length },
      normalized
    };
  }

  async apply(snapshot, { backupPath = null } = {}) {
    const plan = this.plan(snapshot);
    if (backupPath) this.store.backup(backupPath);
    await this.live.ensureRestored();
    for (const area of plan.normalized.areas) {
      await this.live.createArea(area, { idempotencyKey: `legacy:firebase:area:${area.id}` });
    }
    for (const session of plan.normalized.sessions) {
      await this.live.createSession(session, { idempotencyKey: `legacy:firebase:session:${session.id}` });
    }
    for (const message of plan.normalized.messages) {
      await this.live.appendMessage(message, { idempotencyKey: `legacy:firebase:message:${message.id}` });
    }
    return {
      status: "completed",
      snapshotHash: plan.snapshotHash,
      counts: plan.counts,
      backupPath,
      integrity: this.store.verifyIntegrity()
    };
  }
}
