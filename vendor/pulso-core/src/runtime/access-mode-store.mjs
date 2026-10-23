import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { invariant } from "../domain/contracts.mjs";

export const ACCESS_MODES = Object.freeze(["restricted", "integral"]);

function validateMode(mode) {
  invariant(ACCESS_MODES.includes(mode), "invalid_access_mode");
  return mode;
}

export class AccessModeStore {
  constructor({ dataDir, defaultMode = "restricted", clock = () => new Date().toISOString() } = {}) {
    invariant(typeof dataDir === "string" && dataDir.trim(), "access_mode_data_dir_required");
    this.path = join(dataDir, "access", "mode.json");
    this.defaultMode = validateMode(defaultMode);
    this.clock = clock;
  }

  read() {
    if (!existsSync(this.path)) {
      return Object.freeze({
        mode: this.defaultMode,
        configured: false,
        updatedAt: null,
        capabilities: this.#capabilities(this.defaultMode),
      });
    }
    const parsed = JSON.parse(readFileSync(this.path, "utf8"));
    const mode = validateMode(parsed.mode);
    return Object.freeze({
      mode,
      configured: true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      capabilities: this.#capabilities(mode),
    });
  }

  set(mode) {
    const validated = validateMode(mode);
    const updatedAt = this.clock();
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, mode: validated, updatedAt }, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporary, this.path);
    return this.read();
  }

  #capabilities(mode) {
    const integral = mode === "integral";
    return Object.freeze({
      filesystem: integral ? "full" : "read-only-workspace",
      shell: integral,
      network: integral,
      web: integral,
      apps: integral,
      notion: integral,
      plugins: integral,
      privateIdentity: true,
      transversalMemory: true,
    });
  }
}
