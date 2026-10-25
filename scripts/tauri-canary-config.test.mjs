import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Implements RFC 7396 JSON Merge Patch used by Tauri CLI (`tauri build --config <patch>`).
 */
function mergeTauriConfig(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return structuredClone(patch);
  }
  const result =
    base !== null && typeof base === 'object' && !Array.isArray(base)
      ? structuredClone(base)
      : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = mergeTauriConfig(result[key], value);
    }
  }
  return result;
}

const basePath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
const canaryPath = path.join(repoRoot, 'src-tauri', 'tauri.canary.conf.json');

test('Base tauri.conf.json preserves canonical PULSO identity', () => {
  const baseConfig = JSON.parse(readFileSync(basePath, 'utf8'));

  assert.equal(baseConfig.productName, 'PULSO');
  assert.equal(baseConfig.identifier, 'com.felipedutraapps.pulso');
  assert.equal(baseConfig.version, '0.1.1');
  assert.equal(baseConfig.app.windows[0].title, 'PULSO | Lótus Live');
  assert.equal(baseConfig.app.windows[0].resizable, true);
  assert.equal(baseConfig.app.windows[0].url, undefined);
  assert.equal(
    baseConfig.build.beforeBuildCommand,
    'NEXT_PUBLIC_PULSO_DESKTOP_BUILD=1 npm run build'
  );
});

test('Merged base + tauri.canary.conf.json isolates canary identity, starts from the packaged live asset, and preserves the Desktop bundle contract', () => {
  const baseConfig = JSON.parse(readFileSync(basePath, 'utf8'));
  const canaryPatch = JSON.parse(readFileSync(canaryPath, 'utf8'));
  const merged = mergeTauriConfig(baseConfig, canaryPatch);

  // 1. Isolated canary identity (does not collide with installed PULSO.app or Application Support)
  assert.equal(merged.productName, 'PULSO Next Preview');
  assert.equal(merged.identifier, 'com.felipedutraapps.pulso.next-preview');
  assert.equal(merged.version, '0.9.0');
  assert.notEqual(merged.productName, baseConfig.productName);
  assert.notEqual(merged.identifier, baseConfig.identifier);

  // 2. All externalBin entries (Kokoro + pulso-node + official Codex) preserved
  assert.ok(Array.isArray(merged.bundle?.externalBin));
  assert.equal(merged.bundle.externalBin.includes('bin/kokoro_runner'), true);
  assert.equal(merged.bundle.externalBin.includes('binaries/pulso-node'), true);
  assert.equal(merged.bundle.externalBin.includes('binaries/pulso-codex'), true);
  assert.equal(merged.bundle.externalBin.includes('binaries/codex-code-mode-host'), true);

  // 3. Current resources + Core resources preserved
  assert.ok(Array.isArray(merged.bundle?.resources));
  assert.equal(merged.bundle.resources.includes('resources/*'), true);
  assert.equal(merged.bundle.resources.includes('resources/core/**/*'), true);

  // 4. frontendDist and /pulso/live devUrl preserved
  assert.equal(merged.build?.frontendDist, '../out');
  assert.equal(
    merged.build?.devUrl,
    'http://localhost:3001/pulso/live?pulso_tauri_dev=1'
  );
  const parsedDevUrl = new URL(merged.build.devUrl);
  assert.equal(parsedDevUrl.pathname, '/pulso/live');

  // 5. Window starts from Tauri's default packaged entry and remains resizable.
  assert.equal(canaryPatch.app?.windows?.[0]?.url, 'index.html');
  assert.ok(Array.isArray(merged.app?.windows));
  assert.equal(merged.app.windows.length, 1);
  assert.equal(merged.app.windows[0].title, 'PULSO Next Preview');
  assert.equal(merged.app.windows[0].url, 'index.html');
  assert.equal(merged.app.windows[0].resizable, true);
  assert.equal(merged.app.windows[0].width, 800);
  assert.equal(merged.app.windows[0].height, 600);
  assert.equal(merged.app.windows[0].fullscreen, false);
});

test('Production Desktop build compiles the PULSO HOME natively at Tauri default entry', () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const prepareScript = readFileSync(
    path.join(repoRoot, 'scripts', 'prepare-pulso-desktop-entry.mjs'),
    'utf8'
  );
  const rootPage = readFileSync(path.join(repoRoot, 'src', 'app', 'page.tsx'), 'utf8');

  assert.match(packageJson.scripts.build, /prepare-pulso-desktop-entry\.mjs/);
  assert.match(prepareScript, /'out', 'index\.html'/);
  assert.match(prepareScript, /data-pulso-desktop-root/);
  assert.doesNotMatch(prepareScript, /copyFile/);
  assert.match(rootPage, /NEXT_PUBLIC_PULSO_DESKTOP_BUILD/);
  assert.match(rootPage, /data-pulso-desktop-root="true"/);
  assert.match(rootPage, /<LivePage \/>/);
});

test('Alpha CI publishes the isolated app bundle without depending on fragile DMG creation', () => {
  const workflow = readFileSync(path.join(repoRoot, '.github', 'workflows', 'tauri-build.yml'), 'utf8');
  assert.match(workflow, /Build isolated Alpha bundle[\s\S]*--bundles app[\s\S]*tauri\.canary\.conf\.json/);
});
