import { 
  seedAreas, 
  seedProjects, 
  seedInboxItems, 
  seedTasks, 
  seedDecisions, 
  seedRoutines, 
  seedAgents, 
  seedSources, 
  seedAlerts, 
  seedLogs,
  seedPeople
} from "../mocks/pulsoSeed";
import { 
  Area, 
  Project, 
  InboxItem, 
  Task, 
  Decision, 
  Routine, 
  Agent, 
  Source, 
  Alert, 
  Log,
  Person,
  Status
} from "../types/pulso.types";

/**
 * @file pulsoService.ts
 * @description Main service orchestration for PULSO ecosystem.
 * Currently uses mock data, prepared for Firestore integration.
 */

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const areasService = {
  getAll: async (): Promise<Area[]> => {
    await delay(300); // Simulate network
    return seedAreas;
  },
  getById: async (id: string): Promise<Area | undefined> => {
    return seedAreas.find(a => a.id === id);
  }
};

export const projectsService = {
  getAll: async (): Promise<Project[]> => {
    await delay(300);
    return seedProjects;
  },
  getById: async (id: string): Promise<Project | undefined> => {
    return seedProjects.find(p => p.id === id);
  },
  getByArea: async (areaId: string): Promise<Project[]> => {
    return seedProjects.filter(p => p.areaRef === areaId);
  },
  create: async (data: Partial<Project>): Promise<Project> => {
    const newProject = { ...data, id: data.id || `proj_${Date.now()}` } as Project;
    seedProjects.unshift(newProject);
    return newProject;
  }
};

export const inboxService = {
  getAll: async (): Promise<InboxItem[]> => {
    return seedInboxItems;
  },
  getById: async (id: string): Promise<InboxItem | undefined> => {
    return seedInboxItems.find(i => i.id === id);
  },
  create: async (data: Partial<InboxItem>): Promise<InboxItem> => {
    const newItem: InboxItem = {
      id: `inbox_${Date.now()}`,
      slug: `inbox-${Date.now()}`,
      name: data.name || 'Sem título',
      type: data.type || 'task',
      status: 'new',
      priority: data.priority || 'medium',
      body: data.body || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    } as InboxItem;
    seedInboxItems.unshift(newItem);
    return newItem;
  },
  update: async (id: string, data: Partial<InboxItem>): Promise<InboxItem> => {
    const index = seedInboxItems.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item não encontrado');
    seedInboxItems[index] = { ...seedInboxItems[index], ...data, updatedAt: new Date() };
    return seedInboxItems[index];
  },
  triage: async (id: string): Promise<InboxItem> => {
    return inboxService.update(id, { status: 'triaged' });
  },
  archive: async (id: string): Promise<InboxItem> => {
    return inboxService.update(id, { status: 'archived' });
  },
  discard: async (id: string): Promise<InboxItem> => {
    return inboxService.update(id, { status: 'discarded' });
  },
  convertTo: async (id: string, targetType: string): Promise<{ item: InboxItem, entity: any }> => {
    const item = await inboxService.getById(id);
    if (!item) throw new Error('Item não encontrado');

    let entity: any;
    const baseEntity = {
      id: `${targetType}_${Date.now()}`,
      slug: `${targetType}-${Date.now()}`,
      name: item.name,
      status: 'active' as Status,
      importance: item.priority,
      areaRef: item.areaRef,
      projectRef: item.projectRef,
      body: item.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      originInboxRef: item.id
    };

    switch (targetType) {
      case 'task':
        entity = await tasksService.create({ ...baseEntity, status: 'open', ownerRefs: [] });
        break;
      case 'decision':
        entity = await decisionsService.create({ ...baseEntity, takenByRefs: [], decision: item.name });
        break;
      case 'note':
        entity = await notesService.create({ ...baseEntity, type: 'analysis' });
        break;
      case 'meeting':
        entity = await meetingsService.create({ ...baseEntity, date: new Date(), participantsRefs: [] });
        break;
      case 'potential_project':
        entity = await projectsService.create({ ...baseEntity, status: 'maintenance' });
        break;
      default:
        throw new Error('Tipo de destino inválido');
    }

    const updatedItem = await inboxService.update(id, { 
      status: 'converted', 
      convertedToRef: entity.id, 
      convertedToType: targetType 
    });

    return { item: updatedItem, entity };
  },
  getByStatus: async (status: string): Promise<InboxItem[]> => {
    return seedInboxItems.filter(i => i.status === status);
  }
};

export const tasksService = {
  getAll: async (): Promise<Task[]> => {
    await delay(300);
    return seedTasks;
  },
  getByProject: async (projectId: string): Promise<Task[]> => {
    return seedTasks.filter(t => t.projectRef === projectId);
  },
  create: async (data: Partial<Task>): Promise<Task> => {
    const newTask = { ...data, id: data.id || `task_${Date.now()}` } as Task;
    seedTasks.unshift(newTask);
    return newTask;
  }
};

export const decisionsService = {
  getAll: async (): Promise<Decision[]> => {
    await delay(300);
    return seedDecisions;
  },
  getByProject: async (projectId: string): Promise<Decision[]> => {
    return seedDecisions.filter(d => d.projectRef === projectId);
  },
  create: async (data: Partial<Decision>): Promise<Decision> => {
    const newDecision = { ...data, id: data.id || `decision_${Date.now()}` } as Decision;
    seedDecisions.unshift(newDecision);
    return newDecision;
  }
};

export const notesService = {
  create: async (data: Partial<any>): Promise<any> => {
    return { ...data, id: data.id || `note_${Date.now()}` };
  }
};

export const meetingsService = {
  create: async (data: Partial<any>): Promise<any> => {
    return { ...data, id: data.id || `meeting_${Date.now()}` };
  }
};

export const routinesService = {
  getAll: async (): Promise<Routine[]> => {
    await delay(300);
    return seedRoutines;
  }
};

export const agentsService = {
  getAll: async (): Promise<Agent[]> => {
    await delay(300);
    return seedAgents;
  }
};

export const sourcesService = {
  getAll: async (): Promise<Source[]> => {
    await delay(300);
    return seedSources;
  }
};

export const healthService = {
  getAlerts: async (): Promise<Alert[]> => {
    await delay(300);
    return seedAlerts;
  },
  getLogs: async (limit = 10): Promise<Log[]> => {
    return seedLogs.slice(0, limit);
  }
};

export const peopleService = {
  getAll: async (): Promise<Person[]> => {
    await delay(300);
    return seedPeople;
  }
};

// Main Pulso Service for Global State
export const pulsoService = {
  getDashboardState: async () => {
    const [areas, projects, tasks, inbox, alerts] = await Promise.all([
      areasService.getAll(),
      projectsService.getAll(),
      tasksService.getAll(),
      inboxService.getAll(),
      healthService.getAlerts()
    ]);

    return {
      activeAreas: areas.filter(a => a.status === 'active'),
      activeProjects: projects.filter(p => p.status === 'active'),
      openTasks: tasks.filter(t => t.status !== 'completed'),
      pendingInbox: inbox.filter(i => i.status === 'new'),
      activeAlerts: alerts.filter(a => a.status === 'open')
    };
  }
};
