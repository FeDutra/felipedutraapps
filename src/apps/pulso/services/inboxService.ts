import { pulsoRepository } from "./pulsoRepositoryInstance";
import { InboxItem } from "../types/pulso.types";
import { eventsService } from "./eventsService";

export const inboxService = {
  getAll: () => pulsoRepository.getInboxItems(),
  getById: (id: string) => pulsoRepository.getInboxItemById(id),
  create: async (data: Partial<InboxItem>) => {
    const item = await pulsoRepository.saveInboxItem(data);
    await eventsService.createEvent({
      eventType: 'inbox_item_created',
      entityType: item.type || 'note',
      entityRef: item.id,
      areaRef: item.areaRef,
      projectRef: item.projectRef,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Novo item no Inbox: ${item.name}`
    });
    return item;
  },
  update: async (id: string, data: Partial<InboxItem>) => {
    const item = await pulsoRepository.updateInboxItem(id, data);
    await eventsService.createEvent({
      eventType: 'inbox_item_updated',
      entityType: item.type || 'note',
      entityRef: id,
      areaRef: item.areaRef,
      projectRef: item.projectRef,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Item do Inbox atualizado: ${item.name}`
    });
    return item;
  },
  convertTo: async (id: string, targetType: string) => {
    const { item, entity } = await pulsoRepository.convertInboxItem(id, targetType, { 
      id: `ent_${Date.now()}`,
      name: 'Item Convertido' 
    });
    
    await eventsService.createEvent({
      eventType: 'inbox_item_converted',
      entityType: targetType as any,
      entityRef: entity.id,
      actorType: 'user',
      origin: 'manual',
      payloadSummary: `Item convertido em ${targetType}`
    });

    return { item, entity };
  },
  getByArea: async (areaId: string) => {
    const all = await pulsoRepository.getInboxItems();
    return all.filter(i => i.areaRef === areaId);
  },
  getByProject: async (projectId: string) => {
    const all = await pulsoRepository.getInboxItems();
    return all.filter(i => i.projectRef === projectId);
  }
};
