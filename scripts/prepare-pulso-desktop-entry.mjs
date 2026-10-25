import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(repoRoot, 'out', 'index.html');

const destinationStat = await stat(destination);
if (!destinationStat.isFile() || destinationStat.size === 0) {
  throw new Error(`PULSO desktop root entry is unavailable: ${destination}`);
}

const html = await readFile(destination, 'utf8');
if (!html.includes('data-pulso-desktop-root="true"')) {
  throw new Error(
    'PULSO desktop root was not compiled natively; refusing to copy an anointed nested route'
  );
}

console.log(`Verified native Tauri desktop root entry: ${destination}`);
