import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, '..');

export function preparePulsoCoreResources(options = {}) {
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : defaultRepoRoot;
  const sourceDir = options.sourceDir
    ? path.resolve(options.sourceDir)
    : path.join(repoRoot, 'vendor', 'pulso-core');
  const targetDir = options.targetDir
    ? path.resolve(options.targetDir)
    : path.join(repoRoot, 'src-tauri', 'resources', 'core');

  const sourceBridge = path.join(sourceDir, 'desktop', 'bridge.mjs');
  const sourceIndex = path.join(sourceDir, 'src', 'index.mjs');

  if (!existsSync(sourceBridge)) {
    throw new Error(`Missing PULSO Core source bridge at ${sourceBridge}`);
  }
  if (!existsSync(sourceIndex)) {
    throw new Error(`Missing PULSO Core source entry at ${sourceIndex}`);
  }

  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });

  cpSync(path.join(sourceDir, 'desktop'), path.join(targetDir, 'desktop'), { recursive: true });
  cpSync(path.join(sourceDir, 'src'), path.join(targetDir, 'src'), { recursive: true });

  const schemasDir = path.join(sourceDir, 'schemas');
  if (existsSync(schemasDir)) {
    cpSync(schemasDir, path.join(targetDir, 'schemas'), { recursive: true });
  }

  const commitFile = path.join(sourceDir, 'PULSO_CORE_SOURCE_COMMIT');
  if (existsSync(commitFile)) {
    cpSync(commitFile, path.join(targetDir, 'PULSO_CORE_SOURCE_COMMIT'));
  }

  const packageJson = {
    type: 'module',
    private: true,
    engines: {
      node: '>=24',
    },
  };

  writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8'
  );

  const targetBridge = path.join(targetDir, 'desktop', 'bridge.mjs');
  const targetIndex = path.join(targetDir, 'src', 'index.mjs');

  if (!existsSync(targetBridge) || !existsSync(targetIndex)) {
    throw new Error(
      'Assertion failed: target desktop/bridge.mjs and src/index.mjs must exist after preparation'
    );
  }

  return {
    sourceDir,
    targetDir,
    bridgePath: targetBridge,
    indexPath: targetIndex,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const result = preparePulsoCoreResources();
  console.log(`Prepared PULSO Core resources at ${result.targetDir}`);
}
