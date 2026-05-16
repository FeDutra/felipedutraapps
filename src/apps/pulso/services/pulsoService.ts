import { pulsoRepository, getRepository } from "./pulsoRepositoryInstance";
import { areasService } from "./areasService";
import { projectsService } from "./projectsService";
import { inboxService } from "./inboxService";
import { healthService } from "./healthService";
import { eventsService } from "./eventsService";
import { ingestionService } from "./ingestionService";
import { tasksService } from "./tasksService";
import { decisionsService } from "./decisionsService";
import { sourcesService } from "./sourcesService";
import { peopleService } from "./peopleService";
import { routinesService } from "./routinesService";
import { agentsService } from "./agentsService";
import { syncJobsService } from "./syncJobsService";
import { requestsService } from "./requestsService";

// Re-export all services for backward compatibility
export { 
  pulsoRepository,
  getRepository,
  areasService, 
  projectsService, 
  inboxService, 
  healthService,
  eventsService,
  ingestionService,
  tasksService,
  decisionsService,
  sourcesService,
  peopleService,
  routinesService,
  agentsService,
  syncJobsService,
  requestsService
};

const safeArray = (arr: any) => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Main Pulso Service for Global State
export const pulsoService = {
  getDashboardState: async () => {
    const [areas, projects, tasks, inbox, alerts] = await Promise.all([
      areasService.getAll().catch(e => { console.error(e); return []; }),
      projectsService.getAll().catch(e => { console.error(e); return []; }),
      tasksService.getAll().catch(e => { console.error(e); return []; }),
      inboxService.getAll().catch(e => { console.error(e); return []; }),
      healthService.getAlerts().catch(e => { console.error(e); return []; })
    ]);

    return {
      activeAreas: safeArray(areas).filter(a => a && a.status === 'active'),
      activeProjects: safeArray(projects).filter(p => p && p.status === 'active'),
      openTasks: safeArray(tasks).filter(t => t && t.status !== 'completed'),
      pendingInbox: safeArray(inbox).filter(i => i && i.status === 'new'),
      activeAlerts: safeArray(alerts).filter(a => a && a.status === 'open')
    };
  },
  
  getDataMode: () => process.env.NEXT_PUBLIC_PULSO_DATA_MODE || 'mock'
};
