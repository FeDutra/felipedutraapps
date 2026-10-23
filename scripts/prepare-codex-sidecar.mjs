import { copyFileSync, mkdirSync, chmodSync, statSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, '..');

export const TARGET_TRIPLE = 'x86_64-apple-darwin';
export const CODEX_BINARY_NAME = `pulso-codex-${TARGET_TRIPLE}`;
export const CODEX_CODE_MODE_HOST_BINARY_NAME = `codex-code-mode-host-${TARGET_TRIPLE}`;
export const CODEX_PACKAGE_NAME = '@openai/codex';
export const CODEX_PACKAGE_VERSION = '0.163.0';
export const MIN_CODEX_BINARY_SIZE_BYTES = 100 * 1024 * 1024;

function defaultCodexPackageRoot(repoRoot) {
  return path.join(repoRoot, 'node_modules', '@openai', 'codex-darwin-x64');
}

export function prepareCodexSidecar(options = {}) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const explicitSourceBin = options.sourceBin ?? process.env.PULSO_CODEX_SIDECAR_SOURCE ?? null;
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : defaultRepoRoot;

  if (!explicitSourceBin && (platform !== 'darwin' || arch !== 'x64')) {
    throw new Error(
      `Unsupported platform/architecture: expected darwin x64 for ${TARGET_TRIPLE}, got ${platform} ${arch}`
    );
  }

  const packageRoot = options.packageRoot
    ? path.resolve(options.packageRoot)
    : defaultCodexPackageRoot(repoRoot);
  const sourceBin = path.resolve(
    explicitSourceBin || path.join(packageRoot, 'vendor', TARGET_TRIPLE, 'bin', 'codex')
  );
  const explicitCodeModeHost = options.codeModeHostSourceBin ?? process.env.PULSO_CODE_MODE_HOST_SOURCE ?? null;
  const codeModeHostSourceBin = path.resolve(
    explicitCodeModeHost || path.join(packageRoot, 'vendor', TARGET_TRIPLE, 'bin', 'codex-code-mode-host')
  );
  if (!existsSync(sourceBin)) {
    throw new Error(`Official Codex Intel binary not found at ${sourceBin}`);
  }
  if (!existsSync(codeModeHostSourceBin)) {
    throw new Error(`Official Codex Code Mode host not found at ${codeModeHostSourceBin}`);
  }

  if (!explicitSourceBin) {
    const packageJsonPath = path.join(packageRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error(`Official Codex package metadata not found at ${packageJsonPath}`);
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const expectedVersion = `${CODEX_PACKAGE_VERSION}-darwin-x64`;
    if (packageJson.name !== CODEX_PACKAGE_NAME || packageJson.version !== expectedVersion) {
      throw new Error(
        `Unexpected Codex package: expected ${CODEX_PACKAGE_NAME}@${expectedVersion}, got ${packageJson.name}@${packageJson.version}`
      );
    }
  }

  const targetDir = options.targetDir
    ? path.resolve(options.targetDir)
    : path.join(repoRoot, 'src-tauri', 'binaries');
  const targetFile = path.join(targetDir, CODEX_BINARY_NAME);
  const codeModeHostTargetFile = path.join(targetDir, CODEX_CODE_MODE_HOST_BINARY_NAME);

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourceBin, targetFile);
  copyFileSync(codeModeHostSourceBin, codeModeHostTargetFile);
  chmodSync(targetFile, 0o755);
  chmodSync(codeModeHostTargetFile, 0o755);

  const stats = statSync(targetFile);
  const codeModeHostStats = statSync(codeModeHostTargetFile);
  const minSize = options.minSizeBytes ?? MIN_CODEX_BINARY_SIZE_BYTES;
  if (stats.size <= minSize) {
    throw new Error(
      `Assertion failed: Codex binary size must be greater than ${minSize} bytes, got ${stats.size} bytes`
    );
  }
  const codeModeHostMinSize = options.codeModeHostMinSizeBytes ?? 1024 * 1024;
  if (codeModeHostStats.size <= codeModeHostMinSize) {
    throw new Error(
      `Assertion failed: Codex Code Mode host size must be greater than ${codeModeHostMinSize} bytes, got ${codeModeHostStats.size} bytes`
    );
  }

  return {
    sourceBin,
    targetFile,
    codeModeHostSourceBin,
    codeModeHostTargetFile,
    codeModeHostSize: codeModeHostStats.size,
    size: stats.size,
    targetTriple: TARGET_TRIPLE,
    packageVersion: CODEX_PACKAGE_VERSION,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const result = prepareCodexSidecar();
  console.log(`${result.targetFile} ${result.size} code_mode_host=${result.codeModeHostTargetFile} ${result.codeModeHostSize} codex=${result.packageVersion}`);
}
