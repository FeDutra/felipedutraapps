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
}

export const lotusOpenClawClient = {
  queueRequest: async (payload: LotusSendPayload) => {
    const reqPayload = {
      id: payload.requestId,
      requestType: "conversation_command" as any,
      status: "queued_for_openclaw" as any,
      source: payload.source,
      origin: "lotus_live",
      mode: payload.mode,
      input: payload.input,
      rawInput: payload.rawInput || payload.input,
      requestedBy: payload.userId,
      requestedAt: new Date(payload.timestamp),
      clientCreatedAtMs: payload.clientCreatedAtMs || Date.now(),
      updatedAt: new Date(),
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      approvalMode: payload.approvalMode,
      context: payload.context,
      contextWindow: payload.contextWindow,
      archived: false,
      priority: "medium" as any
    };

    return requestsService.createRequest(reqPayload);
  }
};
