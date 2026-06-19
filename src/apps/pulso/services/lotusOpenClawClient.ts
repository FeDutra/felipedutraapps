/**
 * lotusOpenClawClient.ts
 * ---------------------
 * Single integration adapter between PULSO and Lótus / OpenClaw.
 * 
 * Prepares the payload and saves the request directly in pulso_requests
 * with status 'queued_for_openclaw' for the local bridge to process.
 */

import { requestsService } from "./requestsService";

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
  queueRequest: async (payload: LotusSendPayload) => {
    const reqPayload = {
      id: payload.requestId,
      requestType: "conversation_command" as any,
      status: "queued_for_openclaw" as any,
      source: payload.source,
      areaRef: payload.areaRef,
      secondaryAreaRefs: payload.secondaryAreaRefs,
      routing: payload.routing,
      origin: "lotus_live",
      mode: payload.mode,
      originMode: payload.originMode || "text",
      input: payload.input,
      rawInput: payload.rawInput || payload.input,
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
      }
    };

    const cleanPayload = cleanUndefined(reqPayload);

    return requestsService.createRequest(cleanPayload);
  }
};
