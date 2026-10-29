import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const coreRoot = join(root, "vendor", "pulso-core");
const forbidden = [/openclaw/i, /open[ _-]?cloud/i];

function filesUnder(path, result = []) {
  for (const name of readdirSync(path)) {
    const target = join(path, name);
    if (statSync(target).isDirectory()) filesUnder(target, result);
    else result.push(target);
  }
  return result;
}

test("bundle soberano não contém referência, adapter ou fixture do runtime legado", () => {
  const violations = [];
  for (const file of filesUnder(coreRoot)) {
    const rel = relative(coreRoot, file);
    const content = readFileSync(file, "utf8");
    if (forbidden.some(pattern => pattern.test(rel) || pattern.test(content))) violations.push(rel);
  }
  assert.deepEqual(violations, []);
});

test("bundle soberano contém identidade versionada, importador e commit-fonte", () => {
  const index = readFileSync(join(coreRoot, "src", "index.mjs"), "utf8");
  const sourceCommit = readFileSync(join(coreRoot, "PULSO_CORE_SOURCE_COMMIT"), "utf8").trim();
  assert.match(index, /LotusIdentityService/);
  assert.match(index, /LegacyImportService/);
  assert.equal(sourceCommit, "7edb281f86d3d017571de7a9097e05ebcfa13fa2");
  assert.match(readFileSync(join(coreRoot, "desktop", "migration-cli.mjs"), "utf8"), /promoteStagedMigration/);
});

test("modo Presença despacha pela mesma conversa soberana do Core", () => {
  const livePage = readFileSync(join(root, "src", "apps", "pulso", "pages", "LivePage.tsx"), "utf8");
  const start = livePage.indexOf("const handlePresenceCanonicalMessage");
  const end = livePage.indexOf("const handlePresenceUiIntent", start);
  assert.ok(start >= 0 && end > start, "presence_handler_missing");
  const presenceHandler = livePage.slice(start, end);
  assert.match(presenceHandler, /handleSendMessage\(cleanText/);
  assert.match(presenceHandler, /originMode: 'presence'/);
  assert.doesNotMatch(presenceHandler, /createPulsoConversationRequest/);
  assert.doesNotMatch(presenceHandler, /requestsService\.createRequest/);
});
