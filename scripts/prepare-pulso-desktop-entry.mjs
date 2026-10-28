import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(repoRoot, 'out', 'index.html');
const desktopWebResource = path.join(repoRoot, 'src-tauri', 'resources', 'web');
const pulsoRuntime =
  process.env.NEXT_PUBLIC_PULSO_RUNTIME ??
  (process.env.NEXT_PUBLIC_PULSO_DESKTOP_BUILD === '1' ? 'tauri_desktop' : 'web');
const isMobileBuild = pulsoRuntime === 'tauri_mobile';

const destinationStat = await stat(destination);
if (!destinationStat.isFile() || destinationStat.size === 0) {
  throw new Error(`PULSO desktop root entry is unavailable: ${destination}`);
}

let html = await readFile(destination, 'utf8');
const expectedRootMarker = isMobileBuild
  ? 'data-pulso-app-root="tauri_mobile"'
  : 'data-pulso-desktop-root="true"';
if (!html.includes(expectedRootMarker)) {
  throw new Error(
    `PULSO ${pulsoRuntime} root was not compiled natively; refusing a redirect-based bootstrap`
  );
}
const liveEntry = path.join(repoRoot, 'out', 'pulso', 'live', 'index.html');
const liveEntryStat = await stat(liveEntry);
if (!liveEntryStat.isFile() || liveEntryStat.size === 0) {
  throw new Error(
    `PULSO canonical live destination is unavailable: ${liveEntry}`
  );
}

// Next's client runtime canonicalizes the initial URL with History API even
// when the application does not navigate. On WKWebView 14, changing the path
// of Tauri's custom `tauri://localhost` document invalidates the top-level
// load and WebKit replaces the application with its native error page.
//
// The desktop shell is a single sovereign surface; routing happens inside
// PULSO, not by changing the container URL. Install the guard before any Next
// script executes and keep the physical document URL immutable.
const immutableHistoryGuard = `<script data-pulso-immutable-history="true">(()=>{if(location.protocol==="http:"&&location.hostname==="127.0.0.1"&&location.port==="14322")return;const h=history,d=Object.getOwnPropertyDescriptor(History.prototype,"state");let s=null;try{s=d?.get?.call(h)??h.state}catch{}const set=v=>{s=v};try{Object.defineProperty(h,"state",{get:()=>s,configurable:false});Object.defineProperty(h,"pushState",{value:set,configurable:false,writable:false});Object.defineProperty(h,"replaceState",{value:set,configurable:false,writable:false})}catch{h.pushState=set;h.replaceState=set}})();</script>`;

if (!isMobileBuild && !html.includes('data-pulso-immutable-history="true"')) {
  if (!html.includes('<head>')) {
    throw new Error('PULSO desktop root has no <head>; refusing a late History API guard');
  }
  html = html.replace('<head>', `<head>${immutableHistoryGuard}`);
  await writeFile(destination, html, 'utf8');
}

if (!isMobileBuild) {
  const guardedHtml = await readFile(destination, 'utf8');
  if (!guardedHtml.includes('data-pulso-immutable-history="true"')) {
    throw new Error('PULSO desktop root History API guard was not installed');
  }

// `frontendDist` is embedded in Tauri's protocol handler and therefore is not
// emitted as ordinary files in Contents/Resources. The private loopback server
// needs the exact finalized export as physical files, so mirror it into the
// regular resource tree after the root entry and guard have been verified.
  await rm(desktopWebResource, { recursive: true, force: true });
  await mkdir(desktopWebResource, { recursive: true });
  await cp(path.join(repoRoot, 'out'), desktopWebResource, { recursive: true });

  console.log(`Verified immutable native Tauri desktop HOME at root: ${destination}`);
  console.log(`Mirrored desktop export for private loopback: ${desktopWebResource}`);
} else {
  console.log(`Verified canonical native Tauri mobile HOME at root: ${destination}`);
}
