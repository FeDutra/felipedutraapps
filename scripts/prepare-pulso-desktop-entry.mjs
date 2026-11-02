import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(repoRoot, 'out', 'index.html');
const desktopWebResource = path.join(repoRoot, 'src-tauri', 'resources', 'web');

const destinationStat = await stat(destination);
if (!destinationStat.isFile() || destinationStat.size === 0) {
  throw new Error(`PULSO desktop root entry is unavailable: ${destination}`);
}

const html = await readFile(destination, 'utf8');
if (!html.includes('data-pulso-desktop-root="true"')) {
  throw new Error(
    'PULSO desktop root was not compiled natively; refusing a redirect-based bootstrap'
  );
}
const liveEntry = path.join(repoRoot, 'out', 'pulso', 'live', 'index.html');
const liveEntryStat = await stat(liveEntry);
if (!liveEntryStat.isFile() || liveEntryStat.size === 0) {
  throw new Error(
    `PULSO canonical live destination is unavailable: ${liveEntry}`
  );
}

// `frontendDist` is embedded in Tauri's protocol handler and therefore is not
// emitted as ordinary files in Contents/Resources. The private loopback server
// needs the exact finalized export as physical files, so mirror it into the
// regular resource tree after the root entry and guard have been verified.
await rm(desktopWebResource, { recursive: true, force: true });
await mkdir(desktopWebResource, { recursive: true });
await cp(path.join(repoRoot, 'out'), desktopWebResource, { recursive: true });

console.log(`Verified native Tauri desktop HOME at root: ${destination}`);
console.log(`Mirrored desktop export for private loopback: ${desktopWebResource}`);
