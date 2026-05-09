import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Source } from "../types/pulso.types";
import { eventsService } from "./eventsService";

export const sourcesService = {
  getAll: () => pulsoRepository.getSources(),
  getByArea: async (areaId: string) => {
    const all = await pulsoRepository.getSources();
    return all.filter(s => s.areaRef === areaId);
  },
  getByProject: async (projectId: string) => {
    const all = await pulsoRepository.getSources();
    return all.filter(s => s.projectRef === projectId);
  },
  update: async (id: string, data: Partial<Source>) => {
    const s = await pulsoRepository.saveSource({ ...data, id });
    await eventsService.createEvent({
      eventType: 'source_updated',
      entityType: 'source',
      entityRef: id,
      areaRef: s.areaRef,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Fonte de dados atualizada: ${s.name}`
    });
    return s;
  }
};
