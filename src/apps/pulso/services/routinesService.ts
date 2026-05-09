import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Routine } from "../types/pulso.types";
import { eventsService } from "./eventsService";

export const routinesService = {
  getAll: () => pulsoRepository.getRoutines(),
  update: async (id: string, data: Partial<Routine>) => {
    const r = await pulsoRepository.updateRoutine(id, data);
    await eventsService.createEvent({
      eventType: 'routine_reactivated',
      entityType: 'routine',
      entityRef: id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Rotina atualizada: ${r.name}`
    });
    return r;
  },
  pause: async (id: string) => {
    const r = await pulsoRepository.updateRoutine(id, { status: 'paused' });
    await eventsService.createEvent({
      eventType: 'routine_paused',
      entityType: 'routine',
      entityRef: id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Rotina pausada: ${r.name}`
    });
    return r;
  },
  resume: async (id: string) => {
    const r = await pulsoRepository.updateRoutine(id, { status: 'active' });
    await eventsService.createEvent({
      eventType: 'routine_reactivated',
      entityType: 'routine',
      entityRef: id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Rotina reativada: ${r.name}`
    });
    return r;
  },
  markBroken: (id: string) => pulsoRepository.updateRoutine(id, { status: 'broken' }),
};
