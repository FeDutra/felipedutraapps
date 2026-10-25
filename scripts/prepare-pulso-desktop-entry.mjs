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
if (!html.includes('/pulso/live')) {
  throw new Error(
    'PULSO desktop bootstrap does not contain the canonical live destination'
  );
}

console.log(`Verified Tauri desktop bootstrap entry: ${destination}`);
