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
   * Archives a request (soft delete to hide tests or technical tasks)
   */
  archiveRequest: async (id: string) => {
    return pulsoRepository.updateRequest(id, { archived: true });
  },

  /**
   * Human Governance: Approves a previously blocked request
   */
  approveRequest: async (id: string) => {
    return pulsoRepository.updateRequest(id, { 
      status: "completed",
      result: { 
        action: "approved", 
        summary: "Aprovado expressamente pelo usuário via Cockpit Operacional.",
        matResult: { ok: true, action: "approved", summary: "Aprovado no Cockpit" }
      } as any
    });
  },

  /**
   * Human Governance: Rejects a blocked request
   */
  rejectRequest: async (id: string) => {
    return pulsoRepository.updateRequest(id, { 
      status: "failed",
      error: "Rejeitado pela governança humana no Cockpit.",
      result: { action: "rejected", summary: "Rejeição explícita." } as any
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
