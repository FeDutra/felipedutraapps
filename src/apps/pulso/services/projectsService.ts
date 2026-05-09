import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Project } from "../types/pulso.types";
import { eventsService } from "./eventsService";

export const projectsService = {
  getAll: () => pulsoRepository.getProjects(),
  getById: (id: string) => pulsoRepository.getProjectById(id),
  getByArea: async (areaId: string) => {
    const all = await pulsoRepository.getProjects();
    return all.filter(p => p.areaRef === areaId);
  },
  create: async (data: Partial<Project>) => {
    const p = await pulsoRepository.saveProject(data);
    await eventsService.createEvent({
      eventType: 'project_created',
      entityType: 'project',
      entityRef: p.id,
      areaRef: p.areaRef,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Novo projeto criado: ${p.name}`
    });
    return p;
  },
  update: async (id: string, data: Partial<Project>) => {
    const p = await pulsoRepository.saveProject({ ...data, id });
    await eventsService.createEvent({
      eventType: 'project_updated',
      entityType: 'project',
      entityRef: id,
      areaRef: p.areaRef,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Projeto atualizado: ${p.name}`
    });
    return p;
  }
};
