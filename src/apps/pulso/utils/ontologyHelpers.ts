import { 
  Project, 
  Task, 
  Decision, 
  Source, 
  Alert, 
  InboxItem, 
  Routine,
  Area
} from "../types/pulso.types";

/**
 * @file ontologyHelpers.ts
 * @description Safe helper functions for navigating the PULSO ecosystem relationships.
 */

function safeArray<T>(arr: any): T[] {
  return Array.isArray(arr) ? (arr.filter(Boolean) as T[]) : [];
}

export const ontologyHelpers = {
  // --- Area Helpers ---
  getCriticalAreas: (areas: any): Area[] => {
    return safeArray<Area>(areas).filter(a => a && a.importance === 'critical' && a.status === 'active');
  },

  // --- Project Helpers ---
  getProjectsByArea: (projects: any, areaId: string): Project[] => {
    return safeArray<Project>(projects).filter(p => 
      p && (p.areaRef === areaId || (Array.isArray(p.secondaryAreaRefs) && p.secondaryAreaRefs.includes(areaId)))
    );
  },

  getProjectHealth: (project: any, tasks: any, alerts: any): 'healthy' | 'warning' | 'critical' => {
    if (!project) return 'healthy';
    const projectAlerts = safeArray<Alert>(alerts).filter(a => a && a.projectRef === project.id && a.status === 'open');
    if (projectAlerts.some(a => a && a.severity === 'critical')) return 'critical';
    if (projectAlerts.length > 0) return 'warning';
    
    const blockedTasks = safeArray<Task>(tasks).filter(t => t && t.projectRef === project.id && t.status === 'blocked');
    if (blockedTasks.length > 0) return 'warning';
    
    return 'healthy';
  },

  // --- Task & Decision Helpers ---
  getTasksByProject: (tasks: any, projectId: string): Task[] => {
    return safeArray<Task>(tasks).filter(t => t && t.projectRef === projectId);
  },

  getDecisionsByProject: (decisions: any, projectId: string): Decision[] => {
    return safeArray<Decision>(decisions).filter(d => d && d.projectRef === projectId);
  },

  // --- Source Helpers ---
  getSourcesByProject: (sources: any, project: any): Source[] => {
    if (!project) return [];
    return safeArray<Source>(sources).filter(s => 
      s && (s.projectRef === project.id || (Array.isArray(project.sourceRefs) && project.sourceRefs.includes(s.id)))
    );
  },

  // --- Inbox & Laterality Helpers ---
  getRecurringLateralities: (inbox: any): InboxItem[] => {
    return safeArray<InboxItem>(inbox).filter(i => 
      i && i.type === 'laterality' && i.lateralityState !== 'captured'
    );
  },

  getInboxCountByType: (inbox: any): Record<string, number> => {
    return safeArray<InboxItem>(inbox).reduce((acc, item) => {
      if (item && item.type) {
        acc[item.type] = (acc[item.type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  },

  // --- Health Helpers ---
  getAlertsByArea: (alerts: any, areaId: string): Alert[] => {
    return safeArray<Alert>(alerts).filter(a => a && a.areaRef === areaId);
  },

  getBrokenRoutines: (routines: any): Routine[] => {
    return safeArray<Routine>(routines).filter(r => r && r.status === 'broken');
  },

  getOpenAlertsBySeverity: (alerts: any): Record<string, Alert[]> => {
    const open = safeArray<Alert>(alerts).filter(a => a && a.status === 'open');
    return {
      critical: open.filter(a => a && a.severity === 'critical'),
      high: open.filter(a => a && a.severity === 'high'),
      medium: open.filter(a => a && a.severity === 'medium'),
      info: open.filter(a => a && a.severity === 'info')
    };
  }
};
