import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Task } from "../types/pulso.types";

export const tasksService = {
  getAll: () => pulsoRepository.getTasks(),
  getByProject: async (projectId: string) => {
    const all = await pulsoRepository.getTasks();
    return all.filter(t => t.projectRef === projectId);
  },
  getByArea: async (areaId: string) => {
    const all = await pulsoRepository.getTasks();
    return all.filter(t => t.areaRef === areaId);
  },
  create: (data: Partial<Task>) => pulsoRepository.saveTask(data)
};
