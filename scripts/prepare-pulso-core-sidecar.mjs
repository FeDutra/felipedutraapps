import { copyFileSync, mkdirSync, chmodSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, '..');

export const TARGET_TRIPLE = 'x86_64-apple-darwin';
export const SIDECAR_BINARY_NAME = `pulso-node-${TARGET_TRIPLE}`;
export const MIN_BINARY_SIZE_BYTES = 1024 * 1024;

export function preparePulsoCoreSidecar(options = {}) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const explicitSourceBin =
    options.sourceBin ?? process.env.PULSO_NODE_SIDECAR_SOURCE ?? null;

  if (!explicitSourceBin && (platform !== 'darwin' || arch !== 'x64')) {
    throw new Error(
      `Unsupported platform/architecture: expected darwin x64 for ${TARGET_TRIPLE}, got ${platform} ${arch}`
    );
  }

  const sourceBin = path.resolve(explicitSourceBin || process.execPath);
  if (!existsSync(sourceBin)) {
    throw new Error(`Bundled Node sidecar source binary not found at ${sourceBin}`);
  }

  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : defaultRepoRoot;
  const targetDir = options.targetDir
    ? path.resolve(options.targetDir)
    : path.join(repoRoot, 'src-tauri', 'binaries');
  const targetFile = path.join(targetDir, SIDECAR_BINARY_NAME);

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourceBin, targetFile);
  chmodSync(targetFile, 0o755);

  const stats = statSync(targetFile);
  if (stats.size <= MIN_BINARY_SIZE_BYTES) {
    throw new Error(
      `Assertion failed: binary size must be greater than 1MB, got ${stats.size} bytes`
    );
  }

  return {
    sourceBin,
    targetFile,
    size: stats.size,
    targetTriple: TARGET_TRIPLE,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const result = preparePulsoCoreSidecar();
  console.log(`${result.targetFile} ${result.size}`);
}
