import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  existsSync,
  statSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparePulsoCoreResources } from './prepare-pulso-core.mjs';
import {
  preparePulsoCoreSidecar,
  SIDECAR_BINARY_NAME,
} from './prepare-pulso-core-sidecar.mjs';
import {
  prepareCodexSidecar,
  CODEX_CODE_MODE_HOST_BINARY_NAME,
  CODEX_BINARY_NAME,
} from './prepare-codex-sidecar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const makeTempDir = (prefix = 'pulso-tauri-boundary-') =>
  mkdtempSync(path.join(tmpdir(), prefix));

test('preparePulsoCoreResources copies vendor/pulso-core into target resources/core and fails explicitly if source is missing', () => {
  const tempRoot = makeTempDir();
  const targetDir = path.join(tempRoot, 'resources', 'core');

  const prepared = preparePulsoCoreResources({
    repoRoot,
    targetDir,
  });

  assert.equal(existsSync(prepared.bridgePath), true);
  assert.equal(existsSync(prepared.indexPath), true);
  assert.equal(existsSync(path.join(targetDir, 'package.json')), true);
  assert.equal(existsSync(path.join(targetDir, 'PULSO_CORE_SOURCE_COMMIT')), true);

  const pkg = JSON.parse(readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.private, true);

  assert.throws(
    () =>
      preparePulsoCoreResources({
        sourceDir: path.join(tempRoot, 'non-existent-core'),
        targetDir: path.join(tempRoot, 'out'),
      }),
    /Missing PULSO Core source bridge/
  );

  rmSync(tempRoot, { recursive: true, force: true });
});

test('preparePulsoCoreSidecar validates darwin x86_64 target, binary existence, size > 1MB, and executable permissions', () => {
  const tempRoot = makeTempDir();
  const binariesDir = path.join(tempRoot, 'binaries');

  assert.throws(
    () =>
      preparePulsoCoreSidecar({
        platform: 'linux',
        arch: 'x64',
        targetDir: binariesDir,
      }),
    /Unsupported platform\/architecture: expected darwin x64/
  );

  assert.throws(
    () =>
      preparePulsoCoreSidecar({
        platform: 'darwin',
        arch: 'arm64',
        targetDir: binariesDir,
      }),
    /Unsupported platform\/architecture: expected darwin x64/
  );

  assert.throws(
    () =>
      preparePulsoCoreSidecar({
        sourceBin: path.join(tempRoot, 'missing-node'),
        targetDir: binariesDir,
      }),
    /Bundled Node sidecar source binary not found/
  );

  const tinyBin = path.join(tempRoot, 'tiny-node');
  writeFileSync(tinyBin, 'tiny', 'utf8');
  assert.throws(
    () =>
      preparePulsoCoreSidecar({
        sourceBin: tinyBin,
        targetDir: binariesDir,
      }),
    /binary size must be greater than 1MB/
  );

  const prepared = preparePulsoCoreSidecar({
    sourceBin: process.execPath,
    targetDir: binariesDir,
  });

  assert.equal(prepared.targetFile, path.join(binariesDir, SIDECAR_BINARY_NAME));
  assert.equal(existsSync(prepared.targetFile), true);
  assert.ok(prepared.size > 1024 * 1024);

  const mode = statSync(prepared.targetFile).mode & 0o777;
  assert.equal(mode & 0o111, 0o111);

  rmSync(tempRoot, { recursive: true, force: true });
});

test('prepareCodexSidecar vendors only an explicit Intel binary with executable permissions', () => {
  const tempRoot = makeTempDir();
  const binariesDir = path.join(tempRoot, 'binaries');

  assert.throws(
    () => prepareCodexSidecar({ platform: 'linux', arch: 'x64', repoRoot: tempRoot }),
    /Unsupported platform\/architecture: expected darwin x64/
  );
  assert.throws(
    () => prepareCodexSidecar({ sourceBin: path.join(tempRoot, 'missing-codex'), targetDir: binariesDir }),
    /Official Codex Intel binary not found/
  );

  const tinyBin = path.join(tempRoot, 'tiny-codex');
  const tinyHost = path.join(tempRoot, 'tiny-code-mode-host');
  writeFileSync(tinyBin, 'tiny', 'utf8');
  writeFileSync(tinyHost, 'tiny', 'utf8');
  assert.throws(
    () => prepareCodexSidecar({ sourceBin: tinyBin, codeModeHostSourceBin: tinyHost, targetDir: binariesDir, minSizeBytes: 8, codeModeHostMinSizeBytes: 1 }),
    /Codex binary size must be greater than 8 bytes/
  );

  const prepared = prepareCodexSidecar({
    sourceBin: process.execPath,
    codeModeHostSourceBin: process.execPath,
    targetDir: binariesDir,
    minSizeBytes: 1024 * 1024,
    codeModeHostMinSizeBytes: 1024 * 1024,
  });
  assert.equal(prepared.targetFile, path.join(binariesDir, CODEX_BINARY_NAME));
  assert.ok(prepared.size > 1024 * 1024);
  assert.equal(statSync(prepared.targetFile).mode & 0o111, 0o111);
  assert.equal(prepared.codeModeHostTargetFile, path.join(binariesDir, CODEX_CODE_MODE_HOST_BINARY_NAME));
  assert.equal(statSync(prepared.codeModeHostTargetFile).mode & 0o111, 0o111);

  rmSync(tempRoot, { recursive: true, force: true });
});

test('prepared Core bridge runs as persistent NDJSON sidecar with dedicated data-dir and clean shutdown', async () => {
  const tempRoot = makeTempDir();
  const coreResourcesDir = path.join(tempRoot, 'resources', 'core');
  const dataDir = path.join(tempRoot, 'app-data');

  const { bridgePath } = preparePulsoCoreResources({
    repoRoot,
    targetDir: coreResourcesDir,
  });

  // On macOS, tmpdir() under /tmp or /var resolves via symlink to /private/...,
  // whereas bridge.mjs CLI entrypoint guard compares fileURLToPath(import.meta.url)
  // (which resolves realpath) against path.resolve(process.argv[1]).
  const canonicalBridgePath = realpathSync(bridgePath);
  assert.equal(canonicalBridgePath, realpathSync(bridgePath));
  assert.equal(path.isAbsolute(canonicalBridgePath), true);
  if (process.platform === 'darwin' && bridgePath.startsWith('/tmp/')) {
    assert.equal(canonicalBridgePath.startsWith('/private/tmp/'), true);
  }

  const runSession = (requests) =>
    new Promise((resolveSession, rejectSession) => {
      const child = spawn(process.execPath, [canonicalBridgePath, '--data-dir', dataDir], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.once('error', rejectSession);
      child.once('close', (code) => {
        resolveSession({
          code,
          stderr,
          lines: stdout
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
        });
      });

      for (const req of requests) {
        child.stdin.write(JSON.stringify(req) + '\n');
      }
      child.stdin.end();
    });

  const firstRun = await runSession([
    { requestId: 'ndjson-1', method: 'bootstrap', params: {} },
    { requestId: 'ndjson-2', method: 'health', params: {} },
    {
      requestId: 'ndjson-3',
      method: 'live.area.create',
      params: { id: 'area_ndjson', nome: 'NDJSON', glifo: '◈', ordem: 1 },
    },
    { requestId: 'ndjson-4', method: 'shutdown', params: {} },
  ]);

  assert.equal(firstRun.code, 0);
  assert.equal(firstRun.stderr, '');
  assert.equal(firstRun.lines.length, 4);
  assert.deepEqual(
    firstRun.lines.map((l) => l.requestId),
    ['ndjson-1', 'ndjson-2', 'ndjson-3', 'ndjson-4']
  );
  assert.ok(firstRun.lines.every((l) => l.ok === true));
  assert.equal(firstRun.lines[0].result.dataDir, dataDir);
  assert.equal(firstRun.lines[0].result.dbPath, path.join(dataDir, 'pulso-core.sqlite'));
  assert.equal(firstRun.lines[1].result.status, 'stopped');

  const secondRun = await runSession([
    { requestId: 'ndjson-5', method: 'live.bootstrap', params: {} },
    { requestId: 'ndjson-6', method: 'shutdown', params: {} },
  ]);

  assert.equal(secondRun.code, 0);
  assert.equal(secondRun.stderr, '');
  assert.equal(secondRun.lines.length, 2);
  assert.equal(secondRun.lines[0].ok, true);
  assert.equal(secondRun.lines[0].result.areas.length, 2);

  rmSync(tempRoot, { recursive: true, force: true });
});

test('Tauri configuration preserves bundled sidecars while Kokoro starts only on explicit voice demand', () => {
  const tauriConf = JSON.parse(
    readFileSync(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  assert.equal(tauriConf.productName, 'PULSO');
  assert.equal(tauriConf.identifier, 'com.felipedutraapps.pulso');
  assert.deepEqual(tauriConf.bundle.externalBin, [
    'bin/kokoro_runner',
    'binaries/pulso-node',
    'binaries/pulso-codex',
    'binaries/codex-code-mode-host',
  ]);
  assert.deepEqual(tauriConf.bundle.resources, [
    'resources/*',
    'resources/core/**/*',
    '../out/**/*',
  ]);

  const libRs = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'lib.rs'),
    'utf8'
  );
  assert.match(libRs, /pub mod pulso_core;/);
  assert.match(libRs, /\.manage\(Mutex::new\(BridgeManager::default\(\)\)\)/);
  assert.match(libRs, /local_open_url/);
  assert.match(libRs, /execute_applescript/);
  assert.match(libRs, /execute_shell_command/);
  assert.match(libRs, /execute_long_command_stream/);
  assert.match(libRs, /bridge_request/);
  assert.match(libRs, /shutdown_bridge/);
  assert.match(libRs, /fn ensure_kokoro_sidecar\(/);
  assert.match(libRs, /sidecar\("kokoro_runner"\)/);
  assert.doesNotMatch(
    libRs.match(/\.setup\(\|app\| \{([\s\S]*?)\n    \}\)/)?.[1] || '',
    /sidecar\("kokoro_runner"\)/
  );
  assert.match(libRs, /ensure_kokoro_sidecar,/);

  const localMachineRs = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'agent', 'local_machine.rs'),
    'utf8'
  );
  assert.match(localMachineRs, /Command::new\("\/usr\/bin\/open"\)/);
  assert.match(localMachineRs, /\.arg\("-a"\)/);
  assert.match(localMachineRs, /\.arg\("Arc"\)/);
  assert.match(localMachineRs, /Apenas URLs HTTP\(S\)/);
  assert.doesNotMatch(localMachineRs, /println!\([^\n]*local_open_url/);

  const pulsoCoreRs = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'pulso_core.rs'),
    'utf8'
  );
  assert.match(pulsoCoreRs, /Bundled Node sidecar not found/);
  assert.match(pulsoCoreRs, /Bundled Codex app-server sidecar not found/);
  assert.match(pulsoCoreRs, /PULSO_CODEX_BIN/);
  assert.match(pulsoCoreRs, /Bundled Core bridge resource not found/);
  assert.match(pulsoCoreRs, /--data-dir/);
  assert.match(pulsoCoreRs, /pub fn bridge_request/);
  assert.match(pulsoCoreRs, /pub fn shutdown_bridge/);
  assert.match(pulsoCoreRs, /pub fn core_canary_rendered/);
  assert.match(pulsoCoreRs, /core-canary-rendered\.json/);
  assert.match(pulsoCoreRs, /rename\(&temporary, &destination\)/);
  assert.match(libRs, /core_canary_rendered/);
  assert.match(pulsoCoreRs, /pub fn store_provider_secret/);
  assert.match(pulsoCoreRs, /pub fn hydrate_provider_secret/);
  assert.match(pulsoCoreRs, /pub fn provider_secret_status/);
  assert.match(pulsoCoreRs, /security_framework::passwords::set_generic_password/);
  assert.match(pulsoCoreRs, /secret_receipt_never_contains_raw_secret_material/);
  assert.match(libRs, /store_provider_secret/);
  assert.match(libRs, /hydrate_provider_secret/);
  // A WKWebView 14 deve receber o ciclo nativo padrão do Tauri. Uma barreira
  // customizada de on_navigation substituía a HOME já carregada pela página
  // nativa de erro no macOS 14.
  assert.doesNotMatch(libRs, /pulso-navigation-guard/);
  assert.doesNotMatch(libRs, /\.on_navigation\(/);

  // Prova de ausência de vazamento de URL em saídas e logs
  assert.doesNotMatch(libRs, /(println!|eprintln!|log::\w+)\([^)]*\burl\b/);
});

test('desktop UI startup does not depend on Kokoro becoming ready before the WebView', () => {
  const ttsAdapter = readFileSync(
    path.join(repoRoot, 'src', 'lib', 'pulso', 'TTSAdapter.ts'),
    'utf8'
  );
  const constructorBody = ttsAdapter.match(
    /constructor\(\) \{([\s\S]*?)\n  \}\n\n  private loadPreferences/
  )?.[1];

  assert.ok(constructorBody, 'TTSAdapter constructor must remain inspectable');
  assert.doesNotMatch(constructorBody, /this\.warmup\(\)/);
  assert.match(ttsAdapter, /invoke<string>\('ensure_kokoro_sidecar'\)/);
  assert.match(ttsAdapter, /await ensureDesktopKokoroSidecar\(\);\s*const response = await fetch\('http:\/\/127\.0\.0\.1:14321'/);
  assert.match(ttsAdapter, /if \(isKokoro && \(!wasKokoro \|\| oldVoice !== this\.preferences\.voiceName\)\) \{\s*this\.warmup\(\)/);
});

test('desktop WebView uses Tauri default navigation while external URLs stay behind the validated Arc command', () => {
  const libRs = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'lib.rs'),
    'utf8'
  );

  assert.doesNotMatch(libRs, /pulso-navigation-guard/);
  assert.doesNotMatch(libRs, /\.on_navigation\(/);

  const localMachineRs = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'agent', 'local_machine.rs'),
    'utf8'
  );
  assert.match(localMachineRs, /fn validate_external_url\(/);
  assert.match(localMachineRs, /Apenas URLs HTTP\(S\)/);
  assert.match(localMachineRs, /Command::new\("\/usr\/bin\/open"\)/);
  assert.match(localMachineRs, /\.arg\("-a"\)/);
  assert.match(localMachineRs, /\.arg\("Arc"\)/);

  // Strict check on logging: no URL leaking
  assert.doesNotMatch(libRs, /(println!|eprintln!|log::\w+)\([^)]*\burl\b/);

  // Provider panel buttons explicitly set type="button" to prevent implicit form submit
  const providerPanelSource = readFileSync(
    path.join(repoRoot, 'src', 'apps', 'pulso', 'components', 'PulsoCoreProviderPanel.tsx'),
    'utf8'
  );
  const buttonMatches = providerPanelSource.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttonMatches.length >= 5);
  for (const buttonTag of buttonMatches) {
    assert.match(buttonTag, /type="button"/);
  }
});
