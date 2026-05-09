import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Alert } from "../types/pulso.types";
import { eventsService } from "./eventsService";

export const healthService = {
  getAlerts: () => pulsoRepository.getAlerts(),
  getAlertsByArea: async (areaId: string) => {
    const all = await pulsoRepository.getAlerts();
    return all.filter(a => a.areaRef === areaId);
  },
  getAlertsByProject: async (projectId: string) => {
    const all = await pulsoRepository.getAlerts();
    return all.filter(a => a.projectRef === projectId);
  },
  getLogs: (limit = 10) => pulsoRepository.getLogs(limit),
  acknowledgeAlert: async (id: string) => {
    const a = await pulsoRepository.updateAlert(id, { status: 'acknowledged' });
    await eventsService.createEvent({
      eventType: 'alert_acknowledged',
      entityType: 'alert',
      entityRef: id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Alerta reconhecido: ${id}`
    });
    return a;
  },
  resolveAlert: async (id: string) => {
    const a = await pulsoRepository.updateAlert(id, { status: 'resolved', resolvedAt: new Date() });
    await eventsService.createEvent({
      eventType: 'alert_resolved',
      entityType: 'alert',
      entityRef: id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Alerta resolvido: ${id}`
    });
    return a;
  },
  ignoreAlert: (id: string) => pulsoRepository.updateAlert(id, { status: 'ignored' }),
};
