import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, join } from "node:path";
import { invariant } from "../domain/contracts.mjs";

export class PeerFolderTransport {
  constructor({ syncService, rootDir = null } = {}) { invariant(syncService, "sync_service_required"); this.sync = syncService; this.rootDir = rootDir; }
  configure(rootDir) { invariant(typeof rootDir === "string" && rootDir.trim(), "sync_folder_required"); this.rootDir = rootDir; mkdirSync(join(rootDir, "outbox"), { recursive: true }); mkdirSync(join(rootDir, "inbox"), { recursive: true }); mkdirSync(join(rootDir, "processed"), { recursive: true }); return this.status(); }
  status() { return { configured: Boolean(this.rootDir), rootDir: this.rootDir, outbox: this.rootDir && existsSync(join(this.rootDir, "outbox")) ? readdirSync(join(this.rootDir, "outbox")).filter(name => name.endsWith(".json")).length : 0, inbox: this.rootDir && existsSync(join(this.rootDir, "inbox")) ? readdirSync(join(this.rootDir, "inbox")).filter(name => name.endsWith(".json")).length : 0 }; }
  push(targetDeviceId) { invariant(this.rootDir, "sync_folder_not_configured"); const bundle = this.sync.exportBundle({ targetDeviceId }); const destination = join(this.rootDir, "outbox", basename(bundle.path)); copyFileSync(bundle.path, destination); return { ...bundle, transportPath: destination }; }
  pull() { invariant(this.rootDir, "sync_folder_not_configured"); const inbox = join(this.rootDir, "inbox"); const processed = join(this.rootDir, "processed"); mkdirSync(inbox, { recursive: true }); mkdirSync(processed, { recursive: true }); const receipts = [];
    for (const name of readdirSync(inbox).filter(item => item.endsWith(".json")).sort()) { const source = join(inbox, name); try { const receipt = this.sync.importBundle({ bundlePath: source }); renameSync(source, join(processed, name)); receipts.push({ file: name, ok: true, receipt }); } catch (error) { receipts.push({ file: name, ok: false, error: { code: error?.code || "SYNC_IMPORT_FAILED", message: error?.message || String(error) } }); } }
    return { processed: receipts.length, receipts };
  }
}
