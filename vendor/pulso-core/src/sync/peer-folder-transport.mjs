import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { invariant } from "../domain/contracts.mjs";

function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, path);
  chmodSync(path, 0o600);
}

function readJson(path, fallback) {
  if (!path || !existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

function listJson(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter(name => name.endsWith(".json")).sort();
}

export class PeerFolderTransport {
  constructor({ syncService, rootDir = null, configPath = null, preferRootDir = false, clock = () => new Date().toISOString() } = {}) {
    invariant(syncService, "sync_service_required");
    this.sync = syncService;
    this.configPath = configPath;
    this.clock = clock;
    this.rootDir = (preferRootDir ? rootDir : null) || this.#readConfiguredRoot() || rootDir;
    this.lastReceipt = null;
    if (this.rootDir) this.#ensureFolders();
    if (preferRootDir && this.rootDir && this.configPath) atomicWriteJson(this.configPath, { schemaVersion: 2, rootDir: this.rootDir });
  }

  #now() { return typeof this.clock === "function" ? this.clock() : this.clock.now(); }
  #statePath() { return this.configPath ? join(dirname(this.configPath), "transport-state.json") : join(this.rootDir, ".pulso-transport-state.json"); }
  #readConfiguredRoot() { return readJson(this.configPath, {})?.rootDir || null; }
  #readState() { return readJson(this.#statePath(), { schemaVersion: 3, pushedCursors: {}, processedFiles: {}, lastSyncAt: null }); }
  #writeState(state) { atomicWriteJson(this.#statePath(), { schemaVersion: 3, ...state }); }
  #localDeviceId() { return this.sync.deviceManifest().deviceId; }
  #bundleRoot() { return join(this.rootDir, "bundles"); }
  #localBundleDir() { return join(this.#bundleRoot(), this.#localDeviceId()); }
  #presenceRoot() { return join(this.rootDir, "presence"); }
  #ensureFolders() {
    mkdirSync(this.#bundleRoot(), { recursive: true, mode: 0o700 });
    mkdirSync(this.#presenceRoot(), { recursive: true, mode: 0o700 });
  }

  publishPresence() {
    invariant(this.rootDir, "sync_folder_not_configured");
    this.#ensureFolders();
    const presence = this.sync.createPresence();
    const path = join(this.#presenceRoot(), `${presence.source.deviceId}.json`);
    atomicWriteJson(path, presence);
    return { path, deviceId: presence.source.deviceId, deviceKey: presence.source.deviceKey, observedAt: presence.observedAt };
  }

  readPresence() {
    invariant(this.rootDir, "sync_folder_not_configured");
    this.#ensureFolders();
    const localDeviceId = this.#localDeviceId();
    return listJson(this.#presenceRoot()).flatMap(name => {
      try {
        const presence = readJson(join(this.#presenceRoot(), name), null);
        if (!presence || presence.source?.deviceId === localDeviceId) return [];
        return [this.sync.acceptPresence(presence)];
      } catch { return []; }
    });
  }

  configure(rootDir) {
    invariant(typeof rootDir === "string" && rootDir.trim(), "sync_folder_required");
    this.rootDir = rootDir;
    this.#ensureFolders();
    if (this.configPath) atomicWriteJson(this.configPath, { schemaVersion: 2, rootDir });
    return this.status();
  }

  status() {
    const state = this.rootDir ? this.#readState() : { pushedCursors: {}, lastSyncAt: null };
    let localDeviceId = null;
    if (this.rootDir) {
      try { localDeviceId = this.#localDeviceId(); } catch {}
    }
    const peerDirectories = this.rootDir && existsSync(this.#bundleRoot())
      ? readdirSync(this.#bundleRoot(), { withFileTypes: true }).filter(item => item.isDirectory() && item.name !== localDeviceId).map(item => item.name)
      : [];
    const localBundles = this.rootDir && localDeviceId ? listJson(join(this.#bundleRoot(), localDeviceId)).length : 0;
    const peerBundles = this.rootDir ? peerDirectories.reduce((count, deviceId) => count + listJson(join(this.#bundleRoot(), deviceId)).length, 0) : 0;
    return {
      configured: Boolean(this.rootDir),
      rootDir: this.rootDir,
      localDeviceId,
      localBundles,
      peerBundles,
      peerDirectories,
      lastSyncAt: state.lastSyncAt || null,
      lastReceipt: this.lastReceipt,
      presence: this.rootDir && localDeviceId ? this.readPresence() : [],
    };
  }

  push(targetDeviceId) {
    invariant(this.rootDir, "sync_folder_not_configured");
    invariant(typeof targetDeviceId === "string" && targetDeviceId, "sync_target_device_required");
    const state = this.#readState();
    const afterByOrigin = state.pushedCursors?.[targetDeviceId] || {};
    const bundle = this.sync.exportBundle({ targetDeviceId, afterByOrigin });
    if (bundle.events === 0) {
      try { unlinkSync(bundle.path); } catch {}
      return { ...bundle, skipped: true, reason: "no_new_events", transportPath: null };
    }
    this.#ensureFolders();
    mkdirSync(this.#localBundleDir(), { recursive: true, mode: 0o700 });
    const destination = join(this.#localBundleDir(), basename(bundle.path));
    const temp = `${destination}.tmp-${process.pid}`;
    copyFileSync(bundle.path, temp);
    renameSync(temp, destination);
    chmodSync(destination, 0o600);
    state.pushedCursors ||= {};
    state.pushedCursors[targetDeviceId] = { ...afterByOrigin, ...bundle.sourceCursors };
    state.lastSyncAt = this.#now();
    this.#writeState(state);
    return { ...bundle, skipped: false, transportPath: destination };
  }

  pull() {
    invariant(this.rootDir, "sync_folder_not_configured");
    this.#ensureFolders();
    const localDeviceId = this.#localDeviceId();
    const peerDirs = readdirSync(this.#bundleRoot(), { withFileTypes: true })
      .filter(item => item.isDirectory() && item.name !== localDeviceId)
      .map(item => join(this.#bundleRoot(), item.name));
    const state = this.#readState();
    state.processedFiles ||= {};
    const receipts = [];
    let skipped = 0;
    for (const peerDir of peerDirs) {
      for (const name of listJson(peerDir)) {
        const source = join(peerDir, name);
        const relativeKey = `${basename(peerDir)}/${name}`;
        try {
          const metadata = statSync(source);
          const fileVersion = `${metadata.size}:${metadata.mtimeMs}`;
          if (state.processedFiles[relativeKey] === fileVersion) {
            skipped += 1;
            continue;
          }
          const receipt = this.sync.importBundle({ bundlePath: source });
          receipts.push({ file: source, ok: true, receipt });
          state.processedFiles[relativeKey] = fileVersion;
        } catch (error) {
          receipts.push({ file: source, ok: false, error: { code: error?.code || "SYNC_IMPORT_FAILED", message: error?.message || String(error) } });
        }
      }
    }
    state.lastSyncAt = this.#now();
    this.#writeState(state);
    const summary = {
      scanned: receipts.length,
      skipped,
      imported: receipts.reduce((sum, item) => sum + Number(item.receipt?.imported || 0), 0),
      duplicates: receipts.reduce((sum, item) => sum + Number(item.receipt?.duplicates || 0), 0),
      conflicts: receipts.reduce((sum, item) => sum + Number(item.receipt?.conflicts || 0), 0),
      failures: receipts.filter(item => !item.ok).length,
      receipts,
      completedAt: state.lastSyncAt,
    };
    this.lastReceipt = summary;
    return summary;
  }

  syncAll() {
    invariant(this.rootDir, "sync_folder_not_configured");
    const presence = this.publishPresence();
    const peersOnline = this.readPresence();
    const pulled = this.pull();
    const peers = this.sync.status().trustedDevices.filter(item => item.trust_state === "trusted");
    const pushed = peers.map(peer => this.push(peer.device_id));
    const receipt = { presence, peersOnline, pulled, pushed, completedAt: this.#now() };
    this.lastReceipt = receipt;
    return receipt;
  }
}
