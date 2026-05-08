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
import { IPulsoRepository } from "./pulsoRepository";
import { MockPulsoRepository } from "./mockPulsoRepository";
/**
 * @file pulsoService.ts
 * @description Main service orchestration for PULSO ecosystem.
 * Toggles between Firestore and Mock data modes.
 */

// 1. Data Mode Configuration
const DATA_MODE = process.env.NEXT_PUBLIC_PULSO_DATA_MODE || 'mock';

// 2. Repository Instance (Singleton-like)
let repository: IPulsoRepository;

const getRepository = (): IPulsoRepository => {
  if (repository) return repository;
  
  if (DATA_MODE === 'firestore' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.log('PULSO: Modo Firestore Ativo');
    // Using require to avoid side-effects from top-level import during build
    const { FirestorePulsoRepository } = require("./firestorePulsoRepository");
    repository = new FirestorePulsoRepository();
  } else {
    console.log('PULSO: Modo Mock Ativo');
    repository = new MockPulsoRepository();
  }
  return repository;
};

// Export repository for advanced usage or seed
export const pulsoRepository = getRepository();

// 3. Service Definitions
export const areasService = {
  getAll: () => getRepository().getAreas(),
  getById: (id: string) => getRepository().getAreaById(id),
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

export const projectsService = {
  getAll: () => getRepository().getProjects(),
  getById: (id: string) => getRepository().getProjectById(id),
  getByArea: async (areaId: string) => {
    const all = await getRepository().getProjects();
    return all.filter(p => p.areaRef === areaId);
  },
  create: (data: Partial<Project>) => getRepository().saveProject(data)
};

export const sourcesService = {
  getAll: () => getRepository().getSources(),
  getByArea: async (areaId: string) => {
    const all = await getRepository().getSources();
    return all.filter(s => s.areaRef === areaId);
  },
  getByProject: async (projectId: string) => {
    const all = await getRepository().getSources();
    return all.filter(s => s.projectRef === projectId);
  }
};

export const inboxService = {
  getAll: () => getRepository().getInboxItems(),
  getById: (id: string) => getRepository().getInboxItemById(id),
  create: (data: Partial<InboxItem>) => getRepository().saveInboxItem(data),
  update: (id: string, data: Partial<InboxItem>) => getRepository().updateInboxItem(id, data),
  triage: (id: string) => inboxService.update(id, { status: 'triaged' }),
  archive: (id: string) => inboxService.update(id, { status: 'archived' }),
  discard: (id: string) => inboxService.update(id, { status: 'discarded' }),
  getByArea: async (areaId: string) => {
    const all = await getRepository().getInboxItems();
    return all.filter(i => i.areaRef === areaId);
  },
  getByProject: async (projectId: string) => {
    const all = await getRepository().getInboxItems();
    return all.filter(i => i.projectRef === projectId);
  },
  convertTo: async (id: string, targetType: string): Promise<{ item: InboxItem, entity: any }> => {
    const item = await inboxService.getById(id);
    if (!item) throw new Error('Item não encontrado');

    const baseEntity = {
      id: `${targetType}_${Date.now()}`,
      slug: `${targetType}-${Date.now()}`,
      name: item.name,
      status: 'active' as Status,
      importance: item.priority,
      areaRef: item.areaRef || null,
      projectRef: item.projectRef || null,
      body: item.body || '',
      originInboxRef: item.id
    };

    let entity: any;
    switch (targetType) {
      case 'task':
        entity = { ...baseEntity, status: 'open', ownerRefs: [] };
        break;
      case 'decision':
        entity = { ...baseEntity, takenByRefs: [], decision: item.name };
        break;
      case 'note':
        entity = { ...baseEntity, type: 'analysis' };
        break;
      case 'meeting':
        entity = { ...baseEntity, date: new Date(), participantsRefs: [] };
        break;
      case 'potential_project':
        entity = { ...baseEntity, status: 'maintenance' };
        break;
      default:
        throw new Error('Tipo de destino inválido');
    }

    return getRepository().convertInboxItem(id, targetType, entity);
  },
  getByStatus: async (status: string) => {
    const all = await getRepository().getInboxItems();
    return all.filter(i => i.status === status);
  }
};

export const tasksService = {
  getAll: () => getRepository().getTasks(),
  getByProject: async (projectId: string) => {
    const all = await getRepository().getTasks();
    return all.filter(t => t.projectRef === projectId);
  },
  getByArea: async (areaId: string) => {
    const all = await getRepository().getTasks();
    return all.filter(t => t.areaRef === areaId);
  },
  create: (data: Partial<Task>) => getRepository().saveTask(data)
};

export const decisionsService = {
  getAll: () => getRepository().getDecisions(),
  getByProject: async (projectId: string) => {
    const all = await getRepository().getDecisions();
    return all.filter(d => d.projectRef === projectId);
  },
  getByArea: async (areaId: string) => {
    const all = await getRepository().getDecisions();
    return all.filter(d => d.areaRef === areaId);
  },
  create: (data: Partial<Decision>) => getRepository().saveDecision(data)
};

export const notesService = {
  create: (data: Partial<any>) => getRepository().saveNote(data),
  getByProject: async (projectId: string) => {
     // Notes/Meetings don't have dedicated list methods in current repository
     // but we can simulate them by filtering all if needed, 
     // or just wait for real implementation. 
     // For now, return empty as they are less frequent.
     return [];
  }
};

export const routinesService = {
  getAll: () => getRepository().getRoutines()
};

export const agentsService = {
  getAll: () => getRepository().getAgents()
};

export const peopleService = {
  getAll: () => getRepository().getPeople()
};

export const meetingsService = {
  create: (data: Partial<any>) => getRepository().saveMeeting(data)
};

export const healthService = {
  getAlerts: () => getRepository().getAlerts(),
  getAlertsByArea: async (areaId: string) => {
    const all = await getRepository().getAlerts();
    return all.filter(a => a.areaRef === areaId);
  },
  getAlertsByProject: async (projectId: string) => {
    const all = await getRepository().getAlerts();
    return all.filter(a => a.projectRef === projectId);
  },
  getLogs: (limit = 10) => getRepository().getLogs(limit)
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
  },
  
  // Data Mode Info
  getDataMode: () => DATA_MODE
};
