import { pulsoRepository } from "./pulsoRepositoryInstance";
import { SyncJob } from "../types/pulso.types";

export const syncJobsService = {
  getAll: () => pulsoRepository.getSyncJobs(),
  update: (id: string, data: Partial<SyncJob>) => pulsoRepository.updateSyncJob(id, data),
};
