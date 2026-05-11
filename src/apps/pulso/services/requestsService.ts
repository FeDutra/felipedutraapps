import { pulsoRepository } from "./pulsoRepositoryInstance";
import { PulsoRequest, RequestStatus } from "../types/pulso.types";

/**
 * @file requestsService.ts
 * @description Domain service for managing operational requests.
 */

export const requestsService = {
  /**
   * Creates a new operational request
   */
  createRequest: async (request: Partial<PulsoRequest>) => {
    return pulsoRepository.saveRequest(request);
  },

  /**
   * Fetches the most recent requests
   */
  getRequests: async (limitCount?: number) => {
    return pulsoRepository.getRequests(limitCount);
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
   * Archives a request (soft delete)
   */
  archiveRequest: async (id: string) => {
    return pulsoRepository.updateRequest(id, { archived: true });
  }
};
