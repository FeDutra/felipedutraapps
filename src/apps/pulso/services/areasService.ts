import { pulsoRepository } from "./pulsoRepositoryInstance";
import { projectsService } from "./projectsService";
import { inboxService } from "./inboxService";
import { healthService } from "./healthService";

export const areasService = {
  getAll: () => pulsoRepository.getAreas(),
  getById: (id: string) => pulsoRepository.getAreaById(id),
  saveArea: (area: any) => pulsoRepository.saveArea(area),
  getStats: async (id: string) => {
    const [projects, inbox, alerts] = await Promise.all([
      projectsService.getByArea(id),
      inboxService.getByArea(id),
      healthService.getAlertsByArea(id)
    ]);
    return {
      projectsCount: projects.length,
      pendingInboxCount: inbox.filter(i => i.status === 'new').length,
      alertsCount: alerts.length
    };
  }
};
