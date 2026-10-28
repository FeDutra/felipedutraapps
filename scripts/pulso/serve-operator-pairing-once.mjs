#!/usr/bin/env node

import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const pairingPath = process.env.PULSO_PAIRING_PATH || "/root/.local/share/pulso-integral-operator/pairing.json";
const bind = process.env.PULSO_PAIRING_BIND;
const allowedIp = process.env.PULSO_PAIRING_ALLOWED_IP;
const port = Number(process.env.PULSO_PAIRING_PORT || 18768);
if (!bind || !allowedIp || !/^100\./.test(bind) || !/^100\./.test(allowedIp)) throw new Error("pairing_tailnet_boundary_required");
const payload = readFileSync(pairingPath);
let delivered = false;
const server = createServer((request, response) => {
  const remote = String(request.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (delivered || request.method !== "GET" || request.url !== "/pair" || remote !== allowedIp) {
    response.writeHead(404, { "cache-control": "no-store", "content-length": "0" });
    response.end();
    return;
  }
  delivered = true;
  response.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": String(payload.length),
  });
  response.end(payload, () => server.close(() => process.exit(0)));
});
server.listen(port, bind, () => process.stdout.write(`${JSON.stringify({ event: "pairing.ready", bind, port, allowedIp })}\n`));
setTimeout(() => server.close(() => process.exit(delivered ? 0 : 2)), 120_000).unref();
