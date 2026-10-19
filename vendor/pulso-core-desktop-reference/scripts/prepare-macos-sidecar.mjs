import { copyFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.platform !== 'darwin' || process.arch !== 'x64') {
  throw new Error(`Unsupported platform/architecture: expected darwin x64, got ${process.platform} ${process.arch}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.join(repoRoot, 'src-tauri', 'binaries');
const targetFile = path.join(targetDir, 'pulso-node-x86_64-apple-darwin');

mkdirSync(targetDir, { recursive: true });
copyFileSync(process.execPath, targetFile);
chmodSync(targetFile, 0o755);

const stats = statSync(targetFile);
if (stats.size <= 1024 * 1024) {
  throw new Error(`Assertion failed: binary size must be greater than 1MB, got ${stats.size} bytes`);
}

console.log(`${targetFile} ${stats.size}`);
