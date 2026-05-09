import { 
  PulsoEvent, 
  EventType, 
  ActorType, 
  EventOrigin,
  InboxType
} from "../types/pulso.types";
import { pulsoRepository } from "./pulsoService";

/**
 * @file eventsService.ts
 * @description Internal service to handle system events and outbox.
 */

export const eventsService = {
  /**
   * Records a new event in the system
   */
  createEvent: async (params: {
    eventType: EventType;
    entityType: InboxType | string;
    entityRef: string;
    areaRef?: string;
    projectRef?: string;
    actorType: ActorType;
    actorRef?: string;
    origin: EventOrigin;
    payloadSummary?: string;
    payloadSnapshot?: any;
  }): Promise<PulsoEvent> => {
    const event: Partial<PulsoEvent> = {
      ...params,
      outboxStatus: 'pending',
      processedByAgents: []
    };
    
    return pulsoRepository.saveEvent(event);
  },

  /**
   * Lists recent events
   */
  getRecent: (limit = 20) => pulsoRepository.getEvents(limit),

  /**
   * Updates outbox status for synchronization
   */
  updateStatus: (id: string, status: any) => pulsoRepository.updateEvent(id, { outboxStatus: status }),

  /**
   * Marks an event as processed by a specific agent
   */
  markAsProcessedByAgent: async (id: string, agentRef: string) => {
    const events = await pulsoRepository.getEvents(50);
    const event = events.find(e => e.id === id);
    if (!event) return null;

    const processedByAgents = [...(event.processedByAgents || []), agentRef];
    return pulsoRepository.updateEvent(id, { 
      processedByAgents,
      outboxStatus: 'processed' 
    });
  }
};
