import { copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repoRoot, 'out', 'pulso', 'live', 'index.html');
const destination = path.join(repoRoot, 'out', 'pulso-desktop.html');

const sourceStat = await stat(source);
if (!sourceStat.isFile() || sourceStat.size === 0) {
  throw new Error(`PULSO desktop source entry is unavailable: ${source}`);
}

await copyFile(source, destination);

const destinationStat = await stat(destination);
if (destinationStat.size !== sourceStat.size) {
  throw new Error('PULSO desktop root entry did not preserve the exported live document');
}

console.log(`Prepared macOS-compatible desktop entry: ${destination}`);
