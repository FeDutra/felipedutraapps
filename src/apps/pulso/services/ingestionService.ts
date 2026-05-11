import { 
  IngestionEvent, 
  InboxType,
  Confidence,
  IngestionStatus
} from "../types/pulso.types";
import { pulsoRepository } from "./pulsoRepositoryInstance";
import { eventsService } from "./eventsService";
import { inboxService } from "./inboxService";
import { healthService } from "./healthService";

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
    type: InboxType | string;
    rawInput: any;
    summary: string;
    originLabel: string;
    originAgentRef?: string;
    areaRef?: string | null;
    projectRef?: string | null;
    confidence?: Confidence;
    payload?: any;
    should_create_inbox_item?: boolean;
    target_entity_type?: string;
  }): Promise<IngestionEvent> => {
    // 1. Optimized Deduplication check
    const isDuplicate = await pulsoRepository.findIngestionEventByKeys(params.event_id, params.dedupe_key);

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
      type: params.type as InboxType,
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

    // 4. Automatic Processing based on type and params
    try {
      if (params.should_create_inbox_item) {
        await ingestionService.convertToInbox(saved.id);
      } else {
        // New Stage 7 routing logic
        await ingestionService.route(saved.id);
      }
    } catch (err) {
      console.error(`Ingestion routing failed for ${saved.id}:`, err);
    }

    return saved;
  },

  /**
   * Routes an ingestion event to its proper entity based on type
   */
  route: async (id: string): Promise<any> => {
    const events = await pulsoRepository.getIngestionEvents();
    const event = events.find(e => e.id === id);
    if (!event) throw new Error('Ingestion event not found');

    const type = event.type;
    let targetRef = '';

    try {
      switch (type) {
        case 'alert': {
          const alert = await healthService.createAlert({
            name: event.name,
            description: event.summary || event.payload?.raw_input,
            severity: event.payload?.severity || 'medium',
            areaRef: event.areaRef,
            projectRef: event.projectRef,
            agentRef: event.originAgentRef
          });
          targetRef = alert.id;
          break;
        }
        case 'agent_update': {
          if (event.originAgentRef) {
            await pulsoRepository.updateAgent(event.originAgentRef, {
              lastActivityAt: new Date(),
              status: event.payload?.status || 'active'
            });
            await healthService.createLog({
              type: 'agent_activity',
              system: 'openclaw',
              severity: 'info',
              event: 'agent_update',
              agentRef: event.originAgentRef,
              payloadSummary: event.summary || 'Atividade do agente registrada'
            });
          }
          break;
        }
        case 'task': {
          // If high confidence, create task directly, otherwise inbox
          if (event.confidence === 'high') {
            const task = await inboxService.convertTo(event.id, 'task');
            targetRef = task.entity.id;
          } else {
            await ingestionService.convertToInbox(id);
          }
          break;
        }
        default:
          // Fallback to inbox for unknown types
          await ingestionService.convertToInbox(id);
      }

      await pulsoRepository.updateIngestionEvent(id, { 
        ingestionStatus: 'converted_to_entity',
        target_entity_ref: targetRef 
      });
    } catch (error) {
      await pulsoRepository.updateIngestionEvent(id, { 
        ingestionStatus: 'failed',
        errorMessage: (error as any).message 
      });
    }
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
