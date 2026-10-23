import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { eventDraft, invariant, pulsoId } from "../domain/contracts.mjs";

const ACTOR = Object.freeze({ kind: "system", id: "pulso-skill-registry" });

function discover(root, base = root, result = []) {
  if (!root || !existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const target = join(root, entry.name);
    if (entry.isDirectory()) discover(target, base, result);
    else if (entry.name === "SKILL.md") {
      const body = readFileSync(target, "utf8");
      const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || relative(base, root);
      result.push({ skillId: `skill:${relative(base, root).replaceAll("/", ":")}`, name: title, path: relative(base, target), enabled: true });
    }
  }
  return result;
}

export class SkillRegistryService {
  constructor({ store, rootDir } = {}) {
    invariant(store, "event_store_required");
    this.store = store;
    this.rootDir = rootDir;
    this.overrides = new Map();
    this.restore();
  }

  restore() {
    this.overrides.clear();
    for (const event of this.store.all().filter(item => item.type === "skill.state_changed")) {
      this.overrides.set(event.payload.skillId, event.payload.enabled);
    }
  }

  list({ enabled = null, query = null } = {}) {
    let skills = discover(this.rootDir).map(item => ({ ...item, enabled: this.overrides.get(item.skillId) ?? true }));
    if (enabled !== null) skills = skills.filter(item => item.enabled === enabled);
    if (query) {
      const needle = String(query).toLowerCase();
      skills = skills.filter(item => `${item.name} ${item.skillId} ${item.path}`.toLowerCase().includes(needle));
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  setEnabled(skillId, enabled) {
    invariant(this.list().some(item => item.skillId === skillId), `skill_not_found:${skillId}`);
    const occurredAt = new Date().toISOString();
    const result = this.store.append([eventDraft({
      type: "skill.state_changed",
      aggregateType: "skill",
      aggregateId: skillId,
      correlationId: pulsoId("skillcmd"),
      actor: ACTOR,
      occurredAt,
      payload: { skillId, enabled: Boolean(enabled), updatedAt: occurredAt },
    })]);
    this.overrides.set(skillId, Boolean(enabled));
    return { skillId, enabled: Boolean(enabled), events: result.events };
  }

  status() {
    const skills = this.list();
    return { rootDir: this.rootDir, total: skills.length, enabled: skills.filter(item => item.enabled).length, disabled: skills.filter(item => !item.enabled).length };
  }
}
