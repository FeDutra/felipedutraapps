import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Agent } from "../types/pulso.types";
import { eventsService } from "./eventsService";

export const agentsService = {
  getAll: () => pulsoRepository.getAgents(),
  update: async (id: string, data: Partial<Agent>) => {
    const a = await pulsoRepository.updateAgent(id, data);
    await eventsService.createEvent({
      eventType: 'agent_updated',
      entityType: 'agent',
      entityRef: id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Agente operacional atualizado: ${a.name}`
    });
    return a;
  },
};
