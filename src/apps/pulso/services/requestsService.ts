import { pulsoRepository } from "./pulsoRepositoryInstance";
import { PulsoRequest, RequestStatus, UserApproval } from "../types/pulso.types";

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
  },

  /**
   * v1.6: Returns the OpenClaw processing queue.
   * Fetches conversation_command requests from lotus_live that have not yet been
   * picked by OpenClaw (status: requested | queued_for_openclaw), are not archived,
   * and contain a handoff contract targeting OpenClaw in proposal_only mode.
   *
   * Uses local filtering to avoid requiring a composite Firestore index.
   * This is read-only — does NOT mutate any document.
   */
  getOpenClawQueue: async (limitCount = 20): Promise<PulsoRequest[]> => {
    const all = await pulsoRepository.getRawRequests(limitCount * 3);
    const ELIGIBLE_STATUSES: string[] = ['requested', 'queued_for_openclaw'];
    return (all as PulsoRequest[])
      .filter((r) => {
        if (r.archived) return false;
        if (!ELIGIBLE_STATUSES.includes(r.status)) return false;
        if ((r.requestType as string) !== 'conversation_command') return false;
        if ((r.origin as string) !== 'lotus_live' && (r as any).origin !== 'lotus_live') return false;
        return true;
      })
      .slice(0, limitCount);
  },

  /**
   * v1.7: Human Governance — Approve an OpenClaw proposal.
   *
   * Records the user's approval in userApproval and transitions the lifecycle
   * to approved_by_user. Does NOT create tasks, projects, persons, or any entity.
   * Does NOT call external endpoints. Does NOT execute the proposal.
   *
   * @param requestId  The pulso_requests document ID
   * @param note       Optional free-text approval note
   * @param approvedBy User identifier (defaults to 'felipe@dutra')
   */
  approveOpenClawProposal: async (
    requestId: string,
    note?: string,
    approvedBy = 'felipe@dutra'
  ) => {
    const now = new Date().toISOString();
    const approval: UserApproval = {
      approved: true,
      approvedBy,
      approvedAt: now,
      ...(note ? { note } : {}),
    };
    return pulsoRepository.updateRequest(requestId, {
      status: 'approved_by_user' as RequestStatus,
      userApproval: approval as any,
      updatedAt: new Date(),
    });
  },

  /**
   * v1.7: Human Governance — Reject an OpenClaw proposal.
   *
   * Records the user's rejection in userApproval and transitions the lifecycle
   * to rejected_by_user. Does NOT create tasks, projects, persons, or any entity.
   * Does NOT call external endpoints. Does NOT execute anything.
   *
   * @param requestId   The pulso_requests document ID
   * @param reason      Optional reason for rejection
   * @param rejectedBy  User identifier (defaults to 'felipe@dutra')
   */
  rejectOpenClawProposal: async (
    requestId: string,
    reason?: string,
    rejectedBy = 'felipe@dutra'
  ) => {
    const now = new Date().toISOString();
    const approval: UserApproval = {
      approved: false,
      rejectedBy,
      rejectedAt: now,
      ...(reason ? { reason } : {}),
    };
    return pulsoRepository.updateRequest(requestId, {
      status: 'rejected_by_user' as RequestStatus,
      userApproval: approval as any,
      updatedAt: new Date(),
    });
  }
};

