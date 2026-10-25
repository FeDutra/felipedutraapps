import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(repoRoot, 'out', 'index.html');

const destinationStat = await stat(destination);
if (!destinationStat.isFile() || destinationStat.size === 0) {
  throw new Error(`PULSO desktop root entry is unavailable: ${destination}`);
}

await readFile(destination, 'utf8');
const liveEntry = path.join(repoRoot, 'out', 'pulso', 'live', 'index.html');
const liveEntryStat = await stat(liveEntry);
if (!liveEntryStat.isFile() || liveEntryStat.size === 0) {
  throw new Error(
    `PULSO canonical live destination is unavailable: ${liveEntry}`
  );
}

console.log(`Verified Tauri desktop bootstrap entry: ${destination}`);
