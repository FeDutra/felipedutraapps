import { pulsoRepository } from "./pulsoRepositoryInstance";
import { PulsoRequest, RequestStatus } from "../types/pulso.types";

/**
 * @file requestsService.ts
 * @description Domain service for managing operational requests and governance barriers.
 */

export const requestsService = {
  /**
   * Creates a new operational request
   */
  createRequest: async (request: Partial<PulsoRequest>) => {
    return pulsoRepository.saveRequest(request);
  },

  /**
   * Fetches un-ordered raw requests directly for diagnostic audit
   */
  getRawRequests: async (limitCount = 20) => {
    return pulsoRepository.getRawRequests(limitCount);
  },

  /**
   * Fetches requests with optional archival visibility
   */
  getRequests: async (limitCount = 50, includeArchived?: boolean) => {
    return pulsoRepository.getRequests(limitCount, includeArchived);
  },

  /**
   * Fetches only pending requests
   */
  getPendingRequests: async () => {
    return pulsoRepository.getPendingRequests();
  },

  /**
   * Updates a request status
   */
  updateRequestStatus: async (id: string, status: RequestStatus) => {
    return pulsoRepository.updateRequest(id, { status });
  },

  /**
   * v1.5: Partial update of any request fields — used for registering OpenClaw responses
   */
  updateRequest: async (id: string, data: Partial<PulsoRequest>) => {
    return pulsoRepository.updateRequest(id, data);
  },

  /**
   * Archives a request (soft delete to hide tests or technical tasks)
   */
  archiveRequest: async (id: string) => {
    return pulsoRepository.updateRequest(id, { archived: true });
  },

  /**
   * Human Governance: Approves a previously blocked request
   */
  approveRequest: async (id: string) => {
    const now = new Date();
    const isoNow = now.toISOString();
    return pulsoRepository.updateRequest(id, { 
      status: "completed",
      processedBy: "human_governance",
      processedAt: now,
      updatedAt: now,
      result: { 
        action: "approved", 
        summary: "Aprovado expressamente pelo usuário via Cockpit Operacional.",
        auditLog: {
          approvedBy: "Felipe Dutra (Owner)",
          approvedAt: isoNow,
          channel: "web_cockpit",
          policyCheck: "explicit_consent"
        },
        matResult: { ok: true, action: "approved", summary: "Aprovado no Cockpit" }
      } as any
    });
  },

  /**
   * Human Governance: Rejects a blocked request
   */
  rejectRequest: async (id: string) => {
    const now = new Date();
    const isoNow = now.toISOString();
    return pulsoRepository.updateRequest(id, { 
      status: "failed",
      processedBy: "human_governance",
      processedAt: now,
      updatedAt: now,
      error: "Rejeitado pela governança humana no Cockpit.",
      result: { 
        action: "rejected", 
        summary: "Rejeição explícita no Cockpit.",
        auditLog: {
          rejectedBy: "Felipe Dutra (Owner)",
          rejectedAt: isoNow,
          channel: "web_cockpit"
        }
      } as any
    });
  },

  /**
   * Clarification Bridge: Answers missing attributes for Lotus
   */
  answerClarification: async (id: string, answers: Record<string, any>) => {
    // Inject answers into payload and resume lifecycle state to requested
    return pulsoRepository.updateRequest(id, {
      status: "requested",
      payload: answers as any, // Simple drop-in merge or payload enrichment
      result: { action: "clarified", summary: "Esclarecido pelo Cockpit. Retomando máquina." } as any
    });
  }
};
