import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const iosCanaryPath = path.join(repoRoot, 'src-tauri', 'tauri.ios.conf.json');
const packagePath = path.join(repoRoot, 'package.json');

test('macOS bundle carries the exact icon used by the official PULSO app', () => {
  const baseConfig = JSON.parse(readFileSync(basePath, 'utf8'));
  const icns = readFileSync(path.join(repoRoot, 'src-tauri', 'icons', 'icon.icns'));
  const canaryIcns = readFileSync(path.join(repoRoot, 'src-tauri', 'icons', 'pulso-next-official.icns'));

  assert.equal(baseConfig.bundle.icon.includes('icons/icon.icns'), true);
  assert.equal(createHash('sha256').update(icns).digest('hex'), '1535d355994f8ee82da91384d2a29e04d5b4440f3e6051b5c8b06e7a62283693');
  assert.equal(createHash('sha256').update(canaryIcns).digest('hex'), createHash('sha256').update(icns).digest('hex'));
});

test('generated Apple project can invoke the local Tauri CLI through npm', () => {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  assert.equal(packageJson.scripts.tauri, 'tauri');
});

test('desktop HOME applies and persists the black theme without relying on the /pulso layout', () => {
  const livePage = readFileSync(
    path.join(repoRoot, 'src', 'apps', 'pulso', 'pages', 'LivePage.tsx'),
    'utf8'
  );

  assert.match(livePage, /document\.body\.classList\.toggle\('pulso-theme-black'/);
  assert.match(livePage, /document\.documentElement\.classList\.toggle\('pulso-theme-black-preload'/);
  assert.match(livePage, /applyTheme\(requestedTheme \|\| safeStorageGet\('pulso-theme'\)/);
  assert.match(livePage, /updateThemeColor\(\);/);
});

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

test('Merged base + tauri.canary.conf.json isolates canary identity, uses the default root entry, and preserves the Desktop bundle contract', () => {
  const baseConfig = JSON.parse(readFileSync(basePath, 'utf8'));
  const canaryPatch = JSON.parse(readFileSync(canaryPath, 'utf8'));
  const merged = mergeTauriConfig(baseConfig, canaryPatch);

  // 1. Isolated canary identity (does not collide with installed PULSO.app or Application Support)
  assert.equal(merged.productName, 'PULSO Next Preview');
  assert.equal(merged.identifier, 'com.felipedutraapps.pulso.next-preview');
  assert.equal(merged.version, '0.9.0');
  assert.notEqual(merged.productName, baseConfig.productName);
  assert.notEqual(merged.identifier, baseConfig.identifier);
  assert.deepEqual(merged.bundle.icon, ['icons/pulso-next-official.icns']);

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

  // 5. The desktop window starts neutral while the native setup binds the
  // private loopback server and then navigates to its verified HOME origin.
  assert.equal(canaryPatch.app?.windows?.[0]?.url, 'about:blank');
  assert.ok(Array.isArray(merged.app?.windows));
  assert.equal(merged.app.windows.length, 1);
  assert.equal(merged.app.windows[0].title, 'PULSO Next Preview');
  assert.equal(merged.app.windows[0].url, 'about:blank');
  assert.equal(merged.app.windows[0].resizable, true);
  assert.equal(merged.app.windows[0].width, 800);
  assert.equal(merged.app.windows[0].height, 600);
  assert.equal(merged.app.windows[0].fullscreen, false);
});

test('iPhone canary keeps its own identity, opens the canonical live surface, and excludes Desktop sidecars', () => {
  const baseConfig = JSON.parse(readFileSync(basePath, 'utf8'));
  const iosPatch = JSON.parse(readFileSync(iosCanaryPath, 'utf8'));
  const merged = mergeTauriConfig(baseConfig, iosPatch);

  assert.equal(merged.productName, 'PULSO iPhone Preview');
  assert.equal(merged.identifier, 'com.felipedutraapps.pulso.ios.canary');
  assert.equal(merged.version, '0.9.0');
  assert.equal(merged.app.windows[0].url, 'pulso/live/index.html');
  assert.equal(
    merged.build.beforeBuildCommand,
    'NEXT_PUBLIC_PULSO_DESKTOP_BUILD=1 npm run build'
  );
  assert.deepEqual(merged.bundle.externalBin, []);
  assert.deepEqual(merged.bundle.resources, []);
  assert.equal(merged.bundle.icon.includes('icons/icon.icns'), true);
});

test('Production Desktop build compiles the HOME natively at the default Tauri root', () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const prepareScript = readFileSync(
    path.join(repoRoot, 'scripts', 'prepare-pulso-desktop-entry.mjs'),
    'utf8'
  );
  const rootPage = readFileSync(path.join(repoRoot, 'src', 'app', 'page.tsx'), 'utf8');
  const tauriLib = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'lib.rs'),
    'utf8'
  );

  assert.match(packageJson.scripts.build, /prepare-pulso-desktop-entry\.mjs/);
  assert.match(prepareScript, /'out', 'index\.html'/);
  assert.match(prepareScript, /'pulso', 'live', 'index\.html'/);
  assert.match(prepareScript, /'src-tauri', 'resources', 'web'/);
  assert.match(prepareScript, /await cp\(path\.join\(repoRoot, 'out'\), desktopWebResource/);
  assert.match(prepareScript, /data-pulso-desktop-root/);
  assert.match(prepareScript, /data-pulso-immutable-history/);
  assert.match(tauriLib, /append_invoke_initialization_script\(PULSO_DESKTOP_HISTORY_GUARD\)/);
  assert.match(tauriLib, /History\.prototype, "pushState"/);
  assert.match(tauriLib, /History\.prototype, "replaceState"/);
  assert.match(tauriLib, /__PULSO_DESKTOP_HISTORY_GUARD__/);
  assert.match(tauriLib, /let virtualState = null/);
  assert.match(tauriLib, /get: \(\) => virtualState/);
  assert.doesNotMatch(tauriLib, /if \(!isPackagedDesktop\) return/);
  assert.doesNotMatch(tauriLib, /nativeMethod\.call/);
  assert.match(tauriLib, /desktop_boot_probe/);
  assert.match(tauriLib, /unhandled-rejection/);
  assert.match(tauriLib, /TcpListener::bind\(\(Ipv4Addr::LOCALHOST, PULSO_DESKTOP_HTTP_PORT\)\)/);
  assert.match(tauriLib, /http:\/\/127\.0\.0\.1:\{PULSO_DESKTOP_HTTP_PORT\}\//);
  assert.match(tauriLib, /window\.navigate/);
  assert.match(prepareScript, /location\.hostname==="127\.0\.0\.1"/);
  assert.match(prepareScript, /Object\.defineProperty\(h,"pushState"/);
  assert.match(prepareScript, /Object\.defineProperty\(h,"replaceState"/);
  assert.match(prepareScript, /html\.replace\('<head>'/);
  assert.doesNotMatch(rootPage, /useRouter/);
  assert.doesNotMatch(rootPage, /router\.replace/);
  assert.match(rootPage, /<LivePage \/>/);
  assert.match(rootPage, /<PulsoCoreCanary \/>/);
});

test('Alpha CI publishes the isolated app bundle without depending on fragile DMG creation', () => {
  const workflow = readFileSync(path.join(repoRoot, '.github', 'workflows', 'tauri-build.yml'), 'utf8');
  const intelWorkflow = readFileSync(
    path.join(repoRoot, '.github', 'workflows', 'pulso-desktop-alpha-v0.8.yml'),
    'utf8'
  );
  assert.match(workflow, /Build isolated Alpha bundle[\s\S]*--bundles app[\s\S]*tauri\.canary\.conf\.json/);
  assert.match(workflow, /test -s out\/index\.html/);
  assert.match(workflow, /test -s out\/pulso\/live\/index\.html/);
  assert.match(workflow, /Contents\/Resources\/resources\/web\/index\.html/);
  assert.match(workflow, /Contents\/Resources\/resources\/web\/pulso\/live\/index\.html/);
  assert.match(intelWorkflow, /Contents\/Resources\/resources\/web\/index\.html/);
  assert.match(intelWorkflow, /Contents\/Resources\/resources\/web\/pulso\/live\/index\.html/);
});
