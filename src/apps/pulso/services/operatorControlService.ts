import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/client';
import { firestorePaths } from './firestorePaths';

export type OperatorApprovalKind = 'exec' | 'plugin' | 'system-agent';
export type OperatorApprovalStatus = 'pending' | 'resolving' | 'resolved' | 'expired' | 'failed';

export interface OperatorApprovalProjection {
  id: string;
  kind: OperatorApprovalKind;
  status: OperatorApprovalStatus;
  title?: string | null;
  description?: string | null;
  detail?: string | null;
  commandText?: string | null;
  commandPreview?: string | null;
  toolName?: string | null;
  pluginId?: string | null;
  agentId?: string | null;
  sessionKey?: string | null;
  host?: string | null;
  severity?: string | null;
  allowedDecisions: string[];
  requestedAtMs?: number | null;
  expiresAtMs?: number | null;
  resolvedAtMs?: number | null;
  resolvedDecision?: string | null;
  failureMessage?: string | null;
}

export interface OperatorRuntimeProjection {
  id: string;
  status: 'connected' | 'degraded' | 'offline';
  gatewayVersion?: string | null;
  bridgeVersion?: string | null;
  pendingApprovals?: number;
  activeSessions?: number;
  lastSeenAtMs?: number | null;
  lastError?: string | null;
}

function asMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return null;
}

function normalizeApproval(id: string, raw: Record<string, unknown>): OperatorApprovalProjection {
  return {
    id,
    kind: raw.kind === 'plugin' || raw.kind === 'system-agent' ? raw.kind : 'exec',
    status: typeof raw.status === 'string' ? raw.status as OperatorApprovalStatus : 'pending',
    title: typeof raw.title === 'string' ? raw.title : null,
    description: typeof raw.description === 'string' ? raw.description : null,
    detail: typeof raw.detail === 'string' ? raw.detail : null,
    commandText: typeof raw.commandText === 'string' ? raw.commandText : null,
    commandPreview: typeof raw.commandPreview === 'string' ? raw.commandPreview : null,
    toolName: typeof raw.toolName === 'string' ? raw.toolName : null,
    pluginId: typeof raw.pluginId === 'string' ? raw.pluginId : null,
    agentId: typeof raw.agentId === 'string' ? raw.agentId : null,
    sessionKey: typeof raw.sessionKey === 'string' ? raw.sessionKey : null,
    host: typeof raw.host === 'string' ? raw.host : null,
    severity: typeof raw.severity === 'string' ? raw.severity : null,
    allowedDecisions: Array.isArray(raw.allowedDecisions)
      ? raw.allowedDecisions.filter((value): value is string => typeof value === 'string')
      : [],
    requestedAtMs: asMillis(raw.requestedAtMs ?? raw.requestedAt),
    expiresAtMs: asMillis(raw.expiresAtMs ?? raw.expiresAt),
    resolvedAtMs: asMillis(raw.resolvedAtMs ?? raw.resolvedAt),
    resolvedDecision: typeof raw.resolvedDecision === 'string' ? raw.resolvedDecision : null,
    failureMessage: typeof raw.failureMessage === 'string' ? raw.failureMessage : null,
  };
}

export const operatorControlService = {
  subscribeApprovals(
    onValue: (approvals: OperatorApprovalProjection[]) => void,
    onError?: (error: Error) => void,
  ) {
    return onSnapshot(
      collection(db, firestorePaths.operatorApprovals()),
      snapshot => {
        const approvals = snapshot.docs
          .map(item => normalizeApproval(item.id, item.data()))
          .sort((a, b) => (b.requestedAtMs ?? 0) - (a.requestedAtMs ?? 0));
        onValue(approvals);
      },
      error => onError?.(error),
    );
  },

  subscribeRuntime(
    onValue: (runtime: OperatorRuntimeProjection | null) => void,
    onError?: (error: Error) => void,
  ) {
    return onSnapshot(
      doc(db, firestorePaths.operatorRuntimeState()),
      snapshot => {
        if (!snapshot.exists()) {
          onValue(null);
          return;
        }
        const raw = snapshot.data();
        onValue({
          id: snapshot.id,
          status: raw.status === 'connected' || raw.status === 'degraded' ? raw.status : 'offline',
          gatewayVersion: typeof raw.gatewayVersion === 'string' ? raw.gatewayVersion : null,
          bridgeVersion: typeof raw.bridgeVersion === 'string' ? raw.bridgeVersion : null,
          pendingApprovals: typeof raw.pendingApprovals === 'number' ? raw.pendingApprovals : 0,
          activeSessions: typeof raw.activeSessions === 'number' ? raw.activeSessions : 0,
          lastSeenAtMs: asMillis(raw.lastSeenAtMs ?? raw.lastSeenAt),
          lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
        });
      },
      error => onError?.(error),
    );
  },

  async requestDecision(approval: OperatorApprovalProjection, decision: string) {
    if (approval.status !== 'pending') throw new Error('Esta decisão já não está pendente.');
    if (!approval.allowedDecisions.includes(decision)) throw new Error('Decisão indisponível para esta solicitação.');

    await updateDoc(doc(db, firestorePaths.operatorApproval(approval.id)), {
      status: 'resolving',
      decisionRequest: {
        decision,
        kind: approval.kind,
        requestedAt: serverTimestamp(),
        requestedBy: 'pulso',
      },
      updatedAt: serverTimestamp(),
    });
  },
};
