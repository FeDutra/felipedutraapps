/**
 * lotusOpenClawClient.ts
 * ---------------------
 * Single integration adapter between PULSO and Lótus / OpenClaw.
 * 
 * Prepares the payload and saves the request directly in pulso_requests
 * with status 'queued_for_openclaw' for the local bridge to process.
 */

import { requestsService } from "./requestsService";
import type { PulsoExecutionTargetEnvelope } from '../lib/deviceExecutionTarget';

export interface LotusSendPayload {
  requestId: string;
  userId: string;
  source: "pulso_live";
  mode: "text" | "voice";
  input: string;
  rawInput?: string;
  timestamp: string;
  clientCreatedAtMs?: number;
  conversationId: string;
  messageId: string;
  approvalMode: "proposal_only" | "allow_read_only";
  context: {
    userName: string;
    locale: "pt-BR";
    timezone: string;
    interface: "pulso";
    currentRoute: string;
    reusableContext?: any;
  };
  contextWindow: any[];
  areaRef?: string;
  secondaryAreaRefs?: string[];
  routing?: any;
  originMode?: string;
  areaId?: string;
  contextId?: string;
  chatId?: string;
  openclawSessionKey?: string;
  attachments?: any[];
  mediaPath?: string;
  mediaType?: string;
  mediaFileName?: string;
  modelSelection?: {
    provider: string;
    modelId: string;
    thinkingLevel: string;
    authProfileId?: string;
  };
  executionTarget?: PulsoExecutionTargetEnvelope;
}

export interface SessionModelSwitchPayload {
  contextId: string;
  areaId?: string;
  chatId?: string;
  openclawSessionKey: string;
  selection: {
    provider: string;
    modelId: string;
    modelName: string;
    thinkingLevel: string;
    contextWindow: number;
    authProfileId?: string;
  };
}

const cleanUndefined = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(cleanUndefined).filter(v => v !== undefined);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanUndefined(v)])
    );
  }
  return obj;
};

export const lotusOpenClawClient = {
  switchSessionModel: async (payload: SessionModelSwitchPayload) => {
    const requestId = `model_switch_${payload.contextId}_${Date.now()}`;
    const request = await requestsService.createRequest(cleanUndefined({
      id: requestId,
      requestType: 'session_model_switch',
      operation: 'session_model_switch',
      status: 'queued_for_openclaw',
      source: 'pulso_live',
      origin: 'lotus_live',
      mode: 'text',
      input: '',
      rawInput: '',
      requestedBy: 'fe',
      createdAt: new Date(),
      requestedAt: new Date(),
      updatedAt: new Date(),
      conversationId: `conv_${payload.contextId}`,
      messageId: requestId,
      approvalMode: 'allow_read_only',
      context: {
        userName: 'Fê',
        locale: 'pt-BR',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        interface: 'pulso',
        currentRoute: typeof window !== 'undefined' ? window.location.pathname : '/pulso/live',
      },
      contextWindow: [],
      archived: false,
      priority: 'high',
      areaId: payload.areaId || null,
      contextId: payload.contextId,
      chatId: payload.chatId || 'default',
      openclawSessionKey: payload.openclawSessionKey,
      runtimeSessionKey: payload.openclawSessionKey,
      modelSelection: payload.selection,
    }));

    const persistedId = request?.id || requestId;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const current = await requestsService.getRequest(persistedId, { server: true }).catch(() => undefined);
      const status = String(current?.status || '');
      if (status === 'success' || status === 'completed') return current;
      if (status === 'failed' || status === 'error') {
        const result = current?.openclawResult as { error?: string; errors?: string[] } | undefined;
        const reason = result?.error || result?.errors?.[0] || (current as { error?: string } | null)?.error || 'model_switch_failed';
        throw new Error(String(reason));
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('model_switch_confirmation_timeout');
  },

  queueRequest: async (payload: LotusSendPayload) => {
    const hasAttachments = payload.attachments && payload.attachments.length > 0;

    const reqPayload = {
      id: payload.requestId,
      requestType: "conversation_command" as any,
      // Se houver anexos: começa em processing_extraction para que o bot Python
      // só consuma o request DEPOIS que a Cloud Function terminar a extração via Gemini.
      // Sem anexos: vai direto para queued_for_openclaw.
      status: (hasAttachments ? "processing_extraction" : "queued_for_openclaw") as any,
      source: payload.source,
      areaRef: payload.areaRef,
      secondaryAreaRefs: payload.secondaryAreaRefs,
      routing: payload.routing,
      origin: "lotus_live",
      mode: payload.mode,
      originMode: payload.originMode || "text",
      input: payload.input,
      rawInput: payload.rawInput || payload.input,
      // enrichedInput: campo derivado que a Cloud Function preencherá após extração.
      // O bot Python deve preferir este campo a `input` quando disponível.
      enrichedInput: null as string | null,
      requestedBy: payload.userId,
      createdAt: new Date(),
      requestedAt: new Date(payload.timestamp),
      clientCreatedAtMs: payload.clientCreatedAtMs || Date.now(),
      updatedAt: new Date(),
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      approvalMode: payload.approvalMode,
      context: payload.context,
      contextWindow: payload.contextWindow,
      archived: false,
      priority: "medium" as any,
      areaId: payload.areaId || null,
      contextId: payload.contextId || null,
      chatId: payload.chatId || "default",
      openclawSessionKey: payload.openclawSessionKey || null,
      handoff: {
        target: "openclaw",
        mode: "proposal_only"
      },
      attachments: payload.attachments || null,
      mediaPath: payload.mediaPath || null,
      mediaType: payload.mediaType || null,
      mediaFileName: payload.mediaFileName || null,
      modelSelection: payload.modelSelection || null,
      executionTarget: payload.executionTarget || { mode: 'auto' },
    };

    const cleanPayload = cleanUndefined(reqPayload);

    return requestsService.createRequest(cleanPayload);
  }
};
