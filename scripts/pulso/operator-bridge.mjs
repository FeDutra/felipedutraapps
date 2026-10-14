#!/usr/bin/env node

/**
 * PULSO Operator Bridge
 *
 * Mirrors sanitized OpenClaw approvals into Firestore and returns explicit
 * human decisions through the canonical Gateway `approval.resolve` method.
 *
 * This process is intentionally not started by the web app. Run it under a
 * supervised service only after provisioning a dedicated paired identity with
 * `operator.approvals` and read-only operator scopes.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { loadConfig } from '/usr/lib/node_modules/openclaw/dist/index.js';

const OPENCLAW_DIST_DIR = '/usr/lib/node_modules/openclaw/dist';
const WORKSPACE_ID = process.env.PULSO_WORKSPACE_ID || 'felipe_dutra';
const BASE_PATH = `workspaces/${WORKSPACE_ID}`;
const APPROVALS_PATH = `${BASE_PATH}/pulso_operator_approvals`;
const RUNTIME_PATH = `${BASE_PATH}/pulso_operator_runtime/current`;
const HEARTBEAT_MS = Number.parseInt(process.env.PULSO_OPERATOR_HEARTBEAT_MS || '15000', 10);
const BRIDGE_VERSION = '0.1.0';
const OPERATOR_SCOPES = ['operator.read', 'operator.approvals'];

let gatewayRuntimePromise = null;
let stopping = false;

function log(event, payload = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...payload })}\n`);
}

function resolveExport(module, name) {
  if (module?.[name]) return module[name];
  return Object.values(module || {}).find(value => value?.name === name);
}

async function findDistModule(predicate, marker) {
  const files = (await fs.readdir(OPENCLAW_DIST_DIR)).filter(name => name.endsWith('.js')).sort();
  for (const file of files) {
    if (!predicate(file)) continue;
    const fullPath = path.join(OPENCLAW_DIST_DIR, file);
    const source = await fs.readFile(fullPath, 'utf8');
    if (!source.includes(marker)) continue;
    return await import(pathToFileURL(fullPath).href);
  }
  throw new Error(`openclaw_dist_module_not_found:${marker}`);
}

async function getGatewayRuntime() {
  if (!gatewayRuntimePromise) {
    gatewayRuntimePromise = (async () => {
      const [bootstrapModule, clientModule, infoModule] = await Promise.all([
        findDistModule(name => name.startsWith('client-bootstrap-'), 'resolveGatewayClientBootstrap'),
        findDistModule(name => /^client-i.*\.js$/i.test(name), 'GatewayClient'),
        findDistModule(name => name.startsWith('client-info-'), 'GATEWAY_CLIENT_NAMES'),
      ]);
      const resolveGatewayClientBootstrap = resolveExport(bootstrapModule, 'resolveGatewayClientBootstrap');
      const GatewayClient = resolveExport(clientModule, 'GatewayClient');
      const { GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES } = infoModule;
      if (!resolveGatewayClientBootstrap || !GatewayClient || !GATEWAY_CLIENT_NAMES || !GATEWAY_CLIENT_MODES) {
        throw new Error('openclaw_gateway_runtime_incomplete');
      }
      return { resolveGatewayClientBootstrap, GatewayClient, GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES };
    })();
  }
  return await gatewayRuntimePromise;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function normalizeKind(value, fallback = 'exec') {
  if (value === 'plugin' || value === 'system-agent' || value === 'exec') return value;
  return fallback;
}

function sanitizeApproval(raw, fallbackKind) {
  const request = raw?.request && typeof raw.request === 'object' ? raw.request : raw;
  const id = String(raw?.id || request?.id || '').trim();
  if (!id) return null;
  const kind = normalizeKind(raw?.kind || request?.kind, fallbackKind);
  const requestedAtMs = Number(raw?.requestedAtMs || raw?.createdAtMs || request?.requestedAtMs || Date.now());
  const expiresAtMs = Number(raw?.expiresAtMs || request?.expiresAtMs || 0) || null;
  const allowedDecisions = Array.isArray(raw?.allowedDecisions)
    ? raw.allowedDecisions
    : Array.isArray(request?.allowedDecisions)
      ? request.allowedDecisions
      : kind === 'plugin'
        ? ['approve', 'deny']
        : ['allow-once', 'allow-always', 'deny'];

  // Deliberately omit argv, env, credentials, raw metadata and requester tokens.
  return compactObject({
    id,
    kind,
    status: raw?.status === 'resolved' ? 'resolved' : 'pending',
    title: request?.title || null,
    description: request?.description || request?.warningText || null,
    detail: request?.detail || null,
    commandText: raw?.commandText || request?.commandText || request?.command || null,
    commandPreview: raw?.commandPreview || request?.commandPreview || null,
    toolName: request?.toolName || null,
    pluginId: request?.pluginId || null,
    agentId: request?.agentId || null,
    sessionKey: request?.sessionKey || null,
    host: request?.host || null,
    severity: request?.severity || null,
    allowedDecisions: allowedDecisions.filter(value => typeof value === 'string'),
    requestedAtMs,
    expiresAtMs,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function main() {
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const approvalsCollection = db.collection(APPROVALS_PATH);
  const runtimeRef = db.doc(RUNTIME_PATH);
  const cfg = loadConfig();
  const { resolveGatewayClientBootstrap, GatewayClient, GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES } = await getGatewayRuntime();
  const bootstrap = await resolveGatewayClientBootstrap({
    config: cfg,
    gatewayUrl: process.env.PULSO_OPERATOR_GATEWAY_URL || undefined,
    explicitAuth: {
      token: process.env.PULSO_OPERATOR_GATEWAY_TOKEN || undefined,
      password: undefined,
    },
    env: process.env,
  });

  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const upsert = async (payload, fallbackKind) => {
    const approval = sanitizeApproval(payload, fallbackKind);
    if (!approval) return;
    await approvalsCollection.doc(approval.id).set(approval, { merge: true });
  };

  const markResolved = async (payload, fallbackKind) => {
    const approval = sanitizeApproval(payload, fallbackKind);
    if (!approval) return;
    await approvalsCollection.doc(approval.id).set({
      ...approval,
      status: 'resolved',
      resolvedDecision: payload?.decision || payload?.resolution?.decision || null,
      resolvedAtMs: Date.now(),
      decisionRequest: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  };

  const gateway = new GatewayClient({
    url: bootstrap.url,
    token: bootstrap.auth?.token,
    password: bootstrap.auth?.password,
    preauthHandshakeTimeoutMs: bootstrap.preauthHandshakeTimeoutMs,
    clientName: GATEWAY_CLIENT_NAMES.CLI,
    clientDisplayName: 'PULSO Operator Bridge',
    clientVersion: BRIDGE_VERSION,
    mode: GATEWAY_CLIENT_MODES.CLI,
    role: 'operator',
    scopes: OPERATOR_SCOPES,
    onHelloOk: hello => readyResolve(hello),
    onConnectError: error => readyReject(error),
    onClose: async (code, reason) => {
      await runtimeRef.set({ status: 'offline', lastError: `gateway_closed:${code}:${reason}`, lastSeenAtMs: Date.now() }, { merge: true });
      if (!stopping) process.exitCode = 1;
    },
    onEvent: event => {
      const payload = event?.payload || event;
      if (event?.event === 'exec.approval.requested') void upsert(payload, 'exec');
      if (event?.event === 'plugin.approval.requested') void upsert(payload, 'plugin');
      if (event?.event === 'openclaw.approval.requested') void upsert(payload, 'system-agent');
      if (event?.event === 'exec.approval.resolved') void markResolved(payload, 'exec');
      if (event?.event === 'plugin.approval.resolved') void markResolved(payload, 'plugin');
      if (event?.event === 'openclaw.approval.resolved') void markResolved(payload, 'system-agent');
    },
  });

  gateway.start();
  const hello = await ready;
  log('gateway.connected', { protocol: hello?.protocol, version: hello?.server?.version });

  const replayMethods = [
    ['exec.approval.list', 'exec'],
    ['plugin.approval.list', 'plugin'],
    ['openclaw.approval.list', 'system-agent'],
  ];
  for (const [method, kind] of replayMethods) {
    const items = await gateway.request(method, {});
    for (const item of Array.isArray(items) ? items : []) await upsert(item, kind);
  }

  const unsubscribe = approvalsCollection.onSnapshot(snapshot => {
    for (const change of snapshot.docChanges()) {
      const data = change.doc.data();
      const decision = data?.decisionRequest?.decision;
      if (data?.status !== 'resolving' || typeof decision !== 'string') continue;
      void gateway.request('approval.resolve', {
        id: data.id || change.doc.id,
        kind: normalizeKind(data.kind),
        decision,
      }).then(result => markResolved(result?.approval || { ...data, decision }, data.kind)).catch(async error => {
        await change.doc.ref.set({
          status: 'failed',
          failureMessage: error instanceof Error ? error.message : String(error),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    }
  }, error => log('firestore.listener.error', { message: error.message }));

  const heartbeat = async () => {
    const pending = await approvalsCollection.where('status', 'in', ['pending', 'resolving']).get();
    await runtimeRef.set({
      status: 'connected',
      bridgeVersion: BRIDGE_VERSION,
      gatewayVersion: hello?.server?.version || null,
      pendingApprovals: pending.size,
      lastSeenAtMs: Date.now(),
      lastError: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  };
  await heartbeat();
  const heartbeatTimer = setInterval(() => void heartbeat().catch(error => log('heartbeat.error', { message: error.message })), HEARTBEAT_MS);

  const stop = async signal => {
    if (stopping) return;
    stopping = true;
    clearInterval(heartbeatTimer);
    unsubscribe();
    gateway.stop();
    await runtimeRef.set({ status: 'offline', lastSeenAtMs: Date.now(), stoppedBy: signal }, { merge: true });
    process.exit(0);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
}

main().catch(error => {
  log('bridge.fatal', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
