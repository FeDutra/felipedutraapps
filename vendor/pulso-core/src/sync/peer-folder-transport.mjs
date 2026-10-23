import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { invariant } from "../domain/contracts.mjs";

function writeConfig(path, rootDir) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temp, JSON.stringify({ schemaVersion: 1, rootDir }, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, path);
  chmodSync(path, 0o600);
}

export class PeerFolderTransport {
  constructor({ syncService, rootDir = null, configPath = null } = {}) {
    invariant(syncService, "sync_service_required");
    this.sync = syncService;
    this.configPath = configPath;
    this.rootDir = this.#readConfiguredRoot() || rootDir;
    if (this.rootDir) this.#ensureFolders();
  }
  #readConfiguredRoot() {
    if (!this.configPath || !existsSync(this.configPath)) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.configPath, "utf8"));
      return typeof parsed.rootDir === "string" && parsed.rootDir.trim() ? parsed.rootDir : null;
    } catch {
      return null;
    }
  }
  #ensureFolders() { mkdirSync(join(this.rootDir, "outbox"), { recursive: true, mode: 0o700 }); mkdirSync(join(this.rootDir, "inbox"), { recursive: true, mode: 0o700 }); mkdirSync(join(this.rootDir, "processed"), { recursive: true, mode: 0o700 }); }
  configure(rootDir) { invariant(typeof rootDir === "string" && rootDir.trim(), "sync_folder_required"); this.rootDir = rootDir; this.#ensureFolders(); if (this.configPath) writeConfig(this.configPath, rootDir); return this.status(); }
  status() { return { configured: Boolean(this.rootDir), rootDir: this.rootDir, outbox: this.rootDir && existsSync(join(this.rootDir, "outbox")) ? readdirSync(join(this.rootDir, "outbox")).filter(name => name.endsWith(".json")).length : 0, inbox: this.rootDir && existsSync(join(this.rootDir, "inbox")) ? readdirSync(join(this.rootDir, "inbox")).filter(name => name.endsWith(".json")).length : 0 }; }
  push(targetDeviceId) { invariant(this.rootDir, "sync_folder_not_configured"); const bundle = this.sync.exportBundle({ targetDeviceId }); const destination = join(this.rootDir, "outbox", basename(bundle.path)); copyFileSync(bundle.path, destination); return { ...bundle, transportPath: destination }; }
  pull() { invariant(this.rootDir, "sync_folder_not_configured"); const inbox = join(this.rootDir, "inbox"); const processed = join(this.rootDir, "processed"); mkdirSync(inbox, { recursive: true }); mkdirSync(processed, { recursive: true }); const receipts = [];
    for (const name of readdirSync(inbox).filter(item => item.endsWith(".json")).sort()) { const source = join(inbox, name); try { const receipt = this.sync.importBundle({ bundlePath: source }); renameSync(source, join(processed, name)); receipts.push({ file: name, ok: true, receipt }); } catch (error) { receipts.push({ file: name, ok: false, error: { code: error?.code || "SYNC_IMPORT_FAILED", message: error?.message || String(error) } }); } }
    return { processed: receipts.length, receipts };
  }
}
