import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
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

test('prepared Core bridge runs as persistent NDJSON sidecar with dedicated data-dir and clean shutdown', async () => {
  const tempRoot = makeTempDir();
  const coreResourcesDir = path.join(tempRoot, 'resources', 'core');
  const dataDir = path.join(tempRoot, 'app-data');

  const { bridgePath } = preparePulsoCoreResources({
    repoRoot,
    targetDir: coreResourcesDir,
  });

  const runSession = (requests) =>
    new Promise((resolveSession, rejectSession) => {
      const child = spawn(process.execPath, [bridgePath, '--data-dir', dataDir], {
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

test('Tauri configuration and Rust sidecar manager preserve existing commands, Kokoro sidecar, and canonical bundle identity', () => {
  const tauriConf = JSON.parse(
    readFileSync(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  assert.equal(tauriConf.productName, 'PULSO');
  assert.equal(tauriConf.identifier, 'com.felipedutraapps.pulso');
  assert.deepEqual(tauriConf.bundle.externalBin, [
    'bin/kokoro_runner',
    'binaries/pulso-node',
  ]);
  assert.deepEqual(tauriConf.bundle.resources, [
    'resources/*',
    'resources/core/**/*',
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
  assert.match(libRs, /sidecar\("kokoro_runner"\)/);

  const pulsoCoreRs = readFileSync(
    path.join(repoRoot, 'src-tauri', 'src', 'pulso_core.rs'),
    'utf8'
  );
  assert.match(pulsoCoreRs, /Bundled Node sidecar not found/);
  assert.match(pulsoCoreRs, /Bundled Core bridge resource not found/);
  assert.match(pulsoCoreRs, /--data-dir/);
  assert.match(pulsoCoreRs, /pub fn bridge_request/);
  assert.match(pulsoCoreRs, /pub fn shutdown_bridge/);
  assert.equal(pulsoCoreRs.includes('store_provider_secret'), false);
  assert.equal(pulsoCoreRs.includes('security_framework'), false);
});
