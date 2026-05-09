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
  syncJobsService
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
  
  getDataMode: () => process.env.NEXT_PUBLIC_PULSO_DATA_MODE || 'mock'
};
