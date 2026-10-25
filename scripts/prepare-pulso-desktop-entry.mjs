import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(repoRoot, 'out', 'index.html');

const destinationStat = await stat(destination);
if (!destinationStat.isFile() || destinationStat.size === 0) {
  throw new Error(`PULSO desktop root entry is unavailable: ${destination}`);
}

let html = await readFile(destination, 'utf8');
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

// Next's client runtime canonicalizes the initial URL with History API even
// when the application does not navigate. On WKWebView 14, changing the path
// of Tauri's custom `tauri://localhost` document invalidates the top-level
// load and WebKit replaces the application with its native error page.
//
// The desktop shell is a single sovereign surface; routing happens inside
// PULSO, not by changing the container URL. Install the guard before any Next
// script executes and keep the physical document URL immutable.
const immutableHistoryGuard = `<script data-pulso-immutable-history="true">(()=>{if(location.protocol!=="tauri:")return;const h=history;const noop=()=>undefined;try{Object.defineProperty(h,"pushState",{value:noop,configurable:false,writable:false});Object.defineProperty(h,"replaceState",{value:noop,configurable:false,writable:false})}catch{h.pushState=noop;h.replaceState=noop}})();</script>`;

if (!html.includes('data-pulso-immutable-history="true"')) {
  if (!html.includes('<head>')) {
    throw new Error('PULSO desktop root has no <head>; refusing a late History API guard');
  }
  html = html.replace('<head>', `<head>${immutableHistoryGuard}`);
  await writeFile(destination, html, 'utf8');
}

const guardedHtml = await readFile(destination, 'utf8');
if (!guardedHtml.includes('data-pulso-immutable-history="true"')) {
  throw new Error('PULSO desktop root History API guard was not installed');
}

console.log(`Verified immutable native Tauri desktop HOME at root: ${destination}`);
