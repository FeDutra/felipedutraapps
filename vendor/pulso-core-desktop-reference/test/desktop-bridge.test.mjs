import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { createDesktopBridge, resolveDataDir } from "../desktop/bridge.mjs";

const tempDir = () => mkdtempSync(join(tmpdir(), "pulso-desktop-test-"));
const req = (requestId, method, params = {}) => ({ requestId, method, params });

test("resolveDataDir resolves explicit paths", () => {
  assert.equal(resolveDataDir("/tmp/pulso-explicit"), "/tmp/pulso-explicit");
  assert.equal(resolveDataDir("relative-data"), resolve(process.cwd(), "relative-data"));
});

test("bootstrap exposes eleven control sections and stopped health", async () => {
  const dir = tempDir();
  const bridge = createDesktopBridge({ dataDir: dir });
  const response = await bridge.handleRequest(req("bootstrap-1", "bootstrap"));
  assert.equal(response.ok, true);
  assert.equal(response.result.panel.sectionCount, 11);
  assert.equal(response.result.panel.sections.length, 11);
  assert.equal(response.result.health.status, "stopped");
  assert.equal(response.result.dbPath, join(dir, "pulso-core.sqlite"));
  await bridge.close();
});

test("runtime lifecycle starts and stops deterministically", async () => {
  const bridge = createDesktopBridge({ dataDir: tempDir() });
  assert.equal((await bridge.handleRequest(req("start-1", "runtime.start"))).result.status, "running");
  assert.equal((await bridge.handleRequest(req("health-1", "health"))).result.status, "running");
  assert.equal((await bridge.handleRequest(req("stop-1", "runtime.stop"))).result.status, "stopped");
  assert.equal((await bridge.handleRequest(req("health-2", "health"))).result.status, "stopped");
  await bridge.close();
});

test("provider configuration stores only a Keychain reference and never leaks the raw secret", async () => {
  const bridge = createDesktopBridge({ dataDir: tempDir() });
  const rawSecret = "sk-desktop-contract-only-123456789";

  const injected = await bridge.handleRequest(req("secret-1", "provider.secret.inject", {
    providerId: "openai",
    secret: rawSecret,
  }));
  assert.equal(injected.ok, true);
  assert.equal(injected.result.secretRef, "keychain:openai");
  assert.equal(injected.result.configured, true);

  const configured = await bridge.handleRequest(req("provider-1", "provider.configure", {
    providerId: "openai",
    displayName: "OpenAI",
    kind: "model",
    model: "gpt-5",
    scope: "system",
    secretRef: "keychain:openai",
  }));
  assert.equal(configured.ok, true);
  assert.equal(configured.result.provider.secretRef, "keychain:openai");
  assert.equal(configured.result.binding.primary.providerId, "openai");
  assert.equal(configured.result.binding.primary.model, "gpt-5");
  assert.equal(JSON.stringify({ injected, configured }).includes(rawSecret), false);

  await bridge.close();
});

test("unimplemented frozen method is sanitized", async () => {
  const bridge = createDesktopBridge({ dataDir: tempDir() });
  const response = await bridge.handleRequest(req("audit-1", "audit.list"));
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "NOT_IMPLEMENTED");
  assert.equal("stack" in response.error, false);
  await bridge.close();
});

test("malformed JSON returns contract-shaped error", async () => {
  const bridge = createDesktopBridge({ dataDir: tempDir() });
  const response = await bridge.handleRequest("{bad json");
  assert.equal(response.requestId, "invalid-json");
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "INVALID_REQUEST");
  assert.equal("stack" in response.error, false);
  await bridge.close();
});

test("shutdown and close are idempotent", async () => {
  const bridge = createDesktopBridge({ dataDir: tempDir() });
  assert.equal((await bridge.handleRequest(req("shutdown-1", "shutdown"))).ok, true);
  assert.equal((await bridge.handleRequest(req("shutdown-2", "shutdown"))).ok, true);
  await bridge.close();
  await bridge.close();
});

test("SQLite state reopens from the same data directory", async () => {
  const dir = tempDir();
  const first = createDesktopBridge({ dataDir: dir });
  await first.handleRequest(req("start-persist", "runtime.start"));
  await first.handleRequest(req("stop-persist", "runtime.stop"));
  await first.close();
  const second = createDesktopBridge({ dataDir: dir });
  const response = await second.handleRequest(req("bootstrap-persist", "bootstrap"));
  assert.equal(response.ok, true);
  assert.equal(response.result.panel.sectionCount, 11);
  assert.equal(response.result.health.status, "stopped");
  assert.ok(response.result.health.storeIntegrity.events >= 2);
  await second.close();
});

test("CLI is pure JSONL and shuts down cleanly", async () => {
  const child = spawn(process.execPath, [resolve("desktop/bridge.mjs"), "--data-dir", tempDir()], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const closed = new Promise((resolveClose, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveClose(code));
  });
  for (const request of [req("cli-1", "bootstrap"), req("cli-2", "health"), req("cli-3", "shutdown")]) {
    child.stdin.write(JSON.stringify(request) + "\n");
  }
  child.stdin.end();
  assert.equal(await closed, 0);
  assert.equal(stderr, "");
  const lines = stdout.trim().split("\n").map(JSON.parse);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((line) => line.requestId), ["cli-1", "cli-2", "cli-3"]);
  assert.ok(lines.every((line) => line.ok === true));
});

test("bridge executes all live methods and persists state", async () => {
  const dir = tempDir();
  const bridge1 = createDesktopBridge({ dataDir: dir });

  // 1. live.bootstrap initializes default seed (area_pulso, session_geral)
  const bsRes = await bridge1.handleRequest(req("live-bs-1", "live.bootstrap"));
  assert.equal(bsRes.ok, true);
  assert.equal(bsRes.result.areas.length, 1);
  assert.equal(bsRes.result.areas[0].id, "area_pulso");
  assert.equal(bsRes.result.activeAreaId, "area_pulso");
  assert.equal(bsRes.result.activeSessionId, "session_geral");

  // 2. live.area.create creates new area
  const areaRes = await bridge1.handleRequest(req("live-area-1", "live.area.create", {
    id: "area_alpha",
    nome: "ALPHA",
    glifo: "▲",
    ordem: 1,
  }));
  assert.equal(areaRes.ok, true);
  assert.equal(areaRes.result.id, "area_alpha");
  assert.equal(areaRes.result.nome, "ALPHA");

  // 3. live.session.create creates new session in new area
  const sessionRes = await bridge1.handleRequest(req("live-session-1", "live.session.create", {
    id: "session_alpha_1",
    areaId: "area_alpha",
    titulo: "debates táticos",
  }));
  assert.equal(sessionRes.ok, true);
  assert.equal(sessionRes.result.id, "session_alpha_1");
  assert.equal(sessionRes.result.identityId, "lotus");

  // 4. live.session.select updates active selection
  const selectRes = await bridge1.handleRequest(req("live-select-1", "live.session.select", {
    areaId: "area_alpha",
    sessionId: "session_alpha_1",
  }));
  assert.equal(selectRes.ok, true);
  assert.equal(selectRes.result.areaId, "area_alpha");
  assert.equal(selectRes.result.sessionId, "session_alpha_1");

  // 5. live.message.append appends message and returns status awaiting_provider
  const msgRes = await bridge1.handleRequest(req("live-msg-1", "live.message.append", {
    sessionId: "session_alpha_1",
    role: "human",
    texto: "Executar checagem de soberania",
  }));
  assert.equal(msgRes.ok, true);
  assert.equal(msgRes.result.message.role, "human");
  assert.equal(msgRes.result.receipt.status, "awaiting_provider");

  // 6. live.messages.list lists messages in session
  const listRes = await bridge1.handleRequest(req("live-list-1", "live.messages.list", {
    sessionId: "session_alpha_1",
  }));
  assert.equal(listRes.ok, true);
  assert.equal(listRes.result.length, 1);
  assert.equal(listRes.result[0].texto, "Executar checagem de soberania");

  await bridge1.close();

  // 7. Reopening bridge from same dataDir restores persisted selection and messages
  const bridge2 = createDesktopBridge({ dataDir: dir });
  const bs2 = await bridge2.handleRequest(req("live-bs-2", "live.bootstrap"));
  assert.equal(bs2.ok, true);
  assert.equal(bs2.result.areas.length, 2);
  assert.equal(bs2.result.activeAreaId, "area_alpha");
  assert.equal(bs2.result.activeSessionId, "session_alpha_1");
  assert.equal(bs2.result.messages.length, 1);
  assert.equal(bs2.result.messages[0].texto, "Executar checagem de soberania");

  await bridge2.close();
});
