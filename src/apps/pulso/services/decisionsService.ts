import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Decision } from "../types/pulso.types";

export const decisionsService = {
  getAll: () => pulsoRepository.getDecisions(),
  getByProject: async (projectId: string) => {
    const all = await pulsoRepository.getDecisions();
    return all.filter(d => d.projectRef === projectId);
  },
  getByArea: async (areaId: string) => {
    const all = await pulsoRepository.getDecisions();
    return all.filter(d => d.areaRef === areaId);
  },
  create: (data: Partial<Decision>) => pulsoRepository.saveDecision(data)
};
