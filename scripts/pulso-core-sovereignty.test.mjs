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
  assert.equal(sourceCommit, "aa8ba419cc2fc2953f24a03eb28bd00a9cfb57c8");
  assert.match(readFileSync(join(coreRoot, "desktop", "migration-cli.mjs"), "utf8"), /promoteStagedMigration/);
});
