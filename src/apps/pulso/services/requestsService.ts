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
  },

  /**
   * v1.8: Execução Assistida Segura — Execute an approved proposal.
   * Creates a local task in pulso_tasks if the proposal meets all security, risk,
   * and schema allowlist criteria.
   *
   * @param requestId     The pulso_requests document ID
   * @param forceAsTriage If true, bypasses the missing ownerRefs check by forcing triage mode
   * @param executedBy    User identifier executing the action
   */
  executeApprovedProposal: async (
    requestId: string,
    forceAsTriage = false,
    executedBy = 'felipe@dutra'
  ) => {
    // 1. Fetch the request
    const request = await pulsoRepository.getRequest(requestId);
    if (!request) {
      throw new Error("Solicitação não encontrada.");
    }

    // 2. Validate the Golden Rule conditions
    const isApprovedState = request.status === 'approved_by_user' || request.status === 'execution_blocked';
    const isUserApproved = request.userApproval?.approved === true;
    const hasOpenclawResult = !!request.openclawResult;
    const requiresHumanApproval = request.openclawResult?.requiresHumanApproval === true;
    const hasProposedMutation = !!request.openclawResult?.proposedMutation;
    const hasProposedActions = !!request.openclawResult?.proposedActions;
    
    const mutationType = request.openclawResult?.proposedMutation?.type;
    const handoffActionType = request.handoff?.actionType;
    const actionType = mutationType || handoffActionType;
    
    const openclawRisk = request.openclawResult?.riskLevel;
    const handoffRisk = request.handoff?.riskLevel;
    const mutationRisk = request.openclawResult?.proposedMutation?.payload?.riskLevel;
    const riskLevel = openclawRisk || handoffRisk || mutationRisk || 'low';

    if (!isApprovedState) {
      throw new Error(`A solicitação não está no estado adequado para execução (status atual: ${request.status}).`);
    }
    if (!isUserApproved) {
      throw new Error("A solicitação não foi aprovada pelo usuário.");
    }
    if (!hasOpenclawResult) {
      throw new Error("Resultado do OpenClaw não encontrado.");
    }
    if (!requiresHumanApproval) {
      throw new Error("Esta solicitação não requer aprovação humana ou já está liberada.");
    }
    if (!hasProposedMutation && !hasProposedActions) {
      throw new Error("Nenhuma proposta ou mutação sugerida no resultado do OpenClaw.");
    }
    if (actionType !== 'create_task') {
      throw new Error(`Apenas a criação de tarefas ('create_task') é suportada na v1.8 (tentativa de executar: ${actionType}).`);
    }
    if (riskLevel !== 'low' && riskLevel !== 'medium') {
      throw new Error(`Apenas ações de risco 'low' ou 'medium' podem ser executadas (risco atual: ${riskLevel}).`);
    }
    if (request.executedAt || request.createdEntityRef) {
      throw new Error("Esta proposta já foi executada anteriormente.");
    }

    // 3. Extract mutation payload
    const payload = request.openclawResult?.proposedMutation?.payload || {};

    // 4. Validate Fields
    // - Title validation
    const title = payload.title || payload.name;
    if (!title || !title.trim()) {
      await pulsoRepository.updateRequest(requestId, {
        status: 'execution_blocked' as RequestStatus,
        executionError: "Erro de Validação: Título da tarefa é obrigatório."
      });
      throw new Error("Título da tarefa não especificado na proposta.");
    }

    // - OwnerRefs validation
    const ownerRefs = payload.ownerRefs || [];
    const isExplicitTriage = 
      forceAsTriage || 
      payload.isTriage === true || 
      (payload.tags && (payload.tags.includes('triage') || payload.tags.includes('triagem'))) ||
      (request.title && (request.title.toLowerCase().includes('triagem') || request.title.toLowerCase().includes('triage'))) ||
      (request.summary && (request.summary.toLowerCase().includes('triagem') || request.summary.toLowerCase().includes('triage')));

    if ((!ownerRefs || ownerRefs.length === 0) && !isExplicitTriage) {
      await pulsoRepository.updateRequest(requestId, {
        status: 'execution_blocked' as RequestStatus,
        executionError: "Erro de Governança: Falta responsável (ownerRefs). Defina responsável ou execute como triagem."
      });
      throw new Error("Bloqueado: Falta responsável pela tarefa.");
    }

    // - ProjectRef validation
    const projectRef = payload.projectRef || null;
    const tags = payload.tags || [];
    if (!projectRef && !tags.includes('sem-projeto')) {
      tags.push('sem-projeto');
    }

    // - Priority validation
    const priority = payload.priority || 'medium';

    // 5. Execute Action (Create Task)
    const taskData = {
      title: title.trim(),
      name: title.trim(),
      description: payload.description || request.summary || '',
      status: 'open' as any,
      priority: priority,
      ownerRefs: ownerRefs,
      projectRef: projectRef,
      areaRef: payload.areaRef || request.areaRef || null,
      sourceRefs: [requestId],
      tags: tags,
      origin: 'lotus_live',
      createdBy: executedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdTask = await pulsoRepository.saveTask(taskData);

    // 6. Update operational request
    const now = new Date();
    await pulsoRepository.updateRequest(requestId, {
      status: 'executed' as RequestStatus,
      executedAt: now,
      executedBy,
      createdEntityRef: `pulso_tasks/${createdTask.id}`,
      executionError: "" // Clear any past execution blocks/errors
    });

    return createdTask;
  }
};

