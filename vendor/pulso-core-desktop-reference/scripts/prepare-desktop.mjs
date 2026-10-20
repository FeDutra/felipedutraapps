import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const target = path.join(repoRoot, 'src-tauri', 'resources', 'core');

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
mkdirSync(target, { recursive: true });

cpSync(path.join(repoRoot, 'desktop'), path.join(target, 'desktop'), { recursive: true });
cpSync(path.join(repoRoot, 'src'), path.join(target, 'src'), { recursive: true });

const packageJson = {
  type: 'module',
  private: true,
  engines: {
    node: '>=24'
  }
};

writeFileSync(
  path.join(target, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n',
  'utf8'
);

const bridgeExists = existsSync(path.join(target, 'desktop', 'bridge.mjs'));
const indexExists = existsSync(path.join(target, 'src', 'index.mjs'));

if (!bridgeExists || !indexExists) {
  throw new Error('Assertion failed: target desktop/bridge.mjs and src/index.mjs must exist');
}

console.log('Prepared core resources for desktop packaging successfully.');
