#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const releaseId = process.argv[2] || new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const tailscaleIp = execFileSync("tailscale", ["ip", "-4"], { encoding: "utf8" }).trim().split(/\s+/)[0];
if (!/^100\./.test(tailscaleIp)) throw new Error("tailscale_ipv4_required");

const stateRoot = "/root/.local/share/pulso-integral-operator";
const configRoot = "/root/.config/pulso";
const systemdRoot = "/root/.config/systemd/user";
const releaseDir = resolve(stateRoot, "releases", releaseId);
const currentLink = resolve(stateRoot, "current");
const envPath = resolve(configRoot, "integral-operator.env");
const pairingPath = resolve(stateRoot, "pairing.json");
const unitPath = resolve(systemdRoot, "pulso-integral-operator.service");
mkdirSync(releaseDir, { recursive: true, mode: 0o700 });
mkdirSync(configRoot, { recursive: true, mode: 0o700 });
mkdirSync(systemdRoot, { recursive: true, mode: 0o700 });

copyFileSync(resolve(scriptDir, "integral-operator-gateway.mjs"), resolve(releaseDir, "integral-operator-gateway.mjs"));
chmodSync(resolve(releaseDir, "integral-operator-gateway.mjs"), 0o700);
copyFileSync(resolve(scriptDir, "pulso-integral-operator.service"), unitPath);
chmodSync(unitPath, 0o600);

let token = null;
if (existsSync(envPath)) {
  const match = readFileSync(envPath, "utf8").match(/^PULSO_OPERATOR_TOKEN=(.+)$/m);
  token = match?.[1]?.trim() || null;
}
if (!token || token.length < 24) token = randomBytes(32).toString("hex");
writeFileSync(envPath, [
  `PULSO_OPERATOR_BIND=${tailscaleIp}`,
  "PULSO_OPERATOR_PORT=8767",
  `PULSO_OPERATOR_TOKEN=${token}`,
  "",
].join("\n"), { mode: 0o600 });
chmodSync(envPath, 0o600);

const pairingTemporary = `${pairingPath}.${process.pid}.tmp`;
writeFileSync(pairingTemporary, JSON.stringify({ endpoint: `http://${tailscaleIp}:8767`, token }) + "\n", { mode: 0o600 });
chmodSync(pairingTemporary, 0o600);
renameSync(pairingTemporary, pairingPath);

if (existsSync(currentLink)) {
  if (!lstatSync(currentLink).isSymbolicLink()) throw new Error("operator_current_link_is_not_symlink");
  unlinkSync(currentLink);
}
symlinkSync(releaseDir, currentLink, "dir");
execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "inherit" });
execFileSync("systemctl", ["--user", "enable", "--now", "pulso-integral-operator.service"], { stdio: "inherit" });

process.stdout.write(`${JSON.stringify({
  success: true,
  releaseId,
  endpoint: `http://${tailscaleIp}:8767`,
  pairingPath,
  tokenExposed: false,
})}\n`);
