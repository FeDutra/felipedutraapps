import { 
  IngestionEvent, 
  InboxType,
  Confidence,
  IngestionStatus
} from "../types/pulso.types";
import { pulsoRepository, inboxService } from "./pulsoService";
import { eventsService } from "./eventsService";

/**
 * @file ingestionService.ts
 * @description Handles external data entry and conversion to internal entities.
 */

export const ingestionService = {
  /**
   * Receives raw input and creates an ingestion event
   */
  receive: async (params: {
    type: InboxType;
    rawInput: any;
    summary: string;
    originLabel: string;
    originAgentRef?: string;
    areaRef?: string;
    projectRef?: string;
    confidence?: Confidence;
  }): Promise<IngestionEvent> => {
    const ingestion: Partial<IngestionEvent> = {
      ...params,
      name: params.summary,
      ingestionStatus: 'received'
    };

    const saved = await pulsoRepository.saveIngestionEvent(ingestion);

    // Auto-generate system event
    await eventsService.createEvent({
      eventType: 'ingestion_received',
      entityType: 'ingestion',
      entityRef: saved.id,
      areaRef: params.areaRef,
      projectRef: params.projectRef,
      actorType: 'system',
      origin: params.originLabel as any,
      payloadSummary: `Ingestion received from ${params.originLabel}`
    });

    return saved;
  },

  /**
   * Converts an ingestion event into a real Inbox Item
   */
  convertToInbox: async (id: string): Promise<any> => {
    const events = await pulsoRepository.getIngestionEvents();
    const event = events.find(e => e.id === id);
    if (!event) throw new Error('Ingestion event not found');

    try {
      // 1. Create Inbox Item
      const inboxItem = await inboxService.create({
        name: event.name,
        body: event.summary || JSON.stringify(event.rawInput),
        type: event.type,
        areaRef: event.areaRef,
        projectRef: event.projectRef,
        originLabel: event.originLabel,
        originAgentRef: event.originAgentRef,
        confidence: event.confidence,
        status: 'new'
      });

      // 2. Update ingestion status
      await pulsoRepository.updateIngestionEvent(id, { 
        ingestionStatus: 'converted_to_inbox' 
      });

      // 3. Log event
      await eventsService.createEvent({
        eventType: 'inbox_item_created',
        entityType: event.type,
        entityRef: inboxItem.id,
        areaRef: event.areaRef,
        projectRef: event.projectRef,
        actorType: 'system',
        origin: event.originLabel as any,
        payloadSummary: `Converted ingestion ${id} to inbox item`
      });

      return inboxItem;
    } catch (error) {
      await pulsoRepository.updateIngestionEvent(id, { 
        ingestionStatus: 'failed',
        errorMessage: (error as any).message 
      });
      throw error;
    }
  },

  getAll: () => pulsoRepository.getIngestionEvents()
};
