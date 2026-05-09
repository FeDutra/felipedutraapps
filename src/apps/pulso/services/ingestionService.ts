import { 
  IngestionEvent, 
  InboxType,
  Confidence,
  IngestionStatus
} from "../types/pulso.types";
import { pulsoRepository } from "./pulsoRepositoryInstance";
import { eventsService } from "./eventsService";
import { inboxService } from "./inboxService";

/**
 * @file ingestionService.ts
 * @description Handles external data entry and conversion to internal entities.
 */

export const ingestionService = {
  /**
   * Receives raw input and creates an ingestion event
   */
  receive: async (params: {
    event_id?: string;
    source_run_id?: string;
    dedupe_key?: string;
    type: InboxType;
    rawInput: any;
    summary: string;
    originLabel: string;
    originAgentRef?: string;
    areaRef?: string;
    projectRef?: string;
    confidence?: Confidence;
    payload?: any;
    should_create_inbox_item?: boolean;
    target_entity_type?: string;
  }): Promise<IngestionEvent> => {
    // 1. Deduplication check
    const existing = await pulsoRepository.getIngestionEvents();
    const isDuplicate = existing.find(e => 
      (params.event_id && e.event_id === params.event_id) || 
      (params.dedupe_key && e.dedupe_key === params.dedupe_key)
    );

    if (isDuplicate) {
      console.log(`Ingestion: Duplicate detected for ${params.event_id || params.dedupe_key}`);
      await eventsService.createEvent({
        eventType: 'ingestion_duplicate',
        entityType: 'ingestion',
        entityRef: isDuplicate.id,
        actorType: 'system',
        origin: params.originLabel as any,
        payloadSummary: `Duplicate ingestion ignored: ${params.event_id || params.dedupe_key}`
      });
      return isDuplicate;
    }

    // 2. Create Ingestion Event
    const ingestion: Partial<IngestionEvent> = {
      ...params,
      name: params.summary,
      ingestionStatus: 'received',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const saved = await pulsoRepository.saveIngestionEvent(ingestion);

    // 3. Auto-generate system event
    await eventsService.createEvent({
      eventType: 'ingestion_received',
      entityType: 'ingestion',
      entityRef: saved.id,
      areaRef: params.areaRef,
      projectRef: params.projectRef,
      actorType: 'system',
      origin: params.originLabel as any,
      payloadSummary: `Ingestion received from ${params.originLabel}: ${saved.id}`
    });

    // 4. Automatic Processing if requested
    if (params.should_create_inbox_item) {
      await ingestionService.convertToInbox(saved.id);
    }

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
