import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Task } from "../types/pulso.types";

export const tasksService = {
  getAll: (includeArchived?: boolean) => pulsoRepository.getTasks(includeArchived),
  getByProject: async (projectId: string) => {
    const all = await pulsoRepository.getTasks(true);
    return all.filter((t) => t.projectRef === projectId);
  },
  getByArea: async (areaId: string) => {
    const all = await pulsoRepository.getTasks(true);
    return all.filter((t) => t.areaRef === areaId);
  },
  create: (data: Partial<Task>) => pulsoRepository.saveTask(data),
};
