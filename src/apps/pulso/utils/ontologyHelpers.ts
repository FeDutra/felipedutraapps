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
 * @description Helper functions for navigating the PULSO ecosystem relationships.
 */

export const ontologyHelpers = {
  // --- Area Helpers ---
  getCriticalAreas: (areas: Area[]): Area[] => {
    return areas.filter(a => a.importance === 'critical' && a.status === 'active');
  },

  // --- Project Helpers ---
  getProjectsByArea: (projects: Project[], areaId: string): Project[] => {
    return projects.filter(p => p.areaRef === areaId || p.secondaryAreaRefs?.includes(areaId));
  },

  getProjectHealth: (project: Project, tasks: Task[], alerts: Alert[]): 'healthy' | 'warning' | 'critical' => {
    const projectAlerts = alerts.filter(a => a.projectRef === project.id && a.status === 'open');
    if (projectAlerts.some(a => a.severity === 'critical')) return 'critical';
    if (projectAlerts.length > 0) return 'warning';
    
    const blockedTasks = tasks.filter(t => t.projectRef === project.id && t.status === 'blocked');
    if (blockedTasks.length > 0) return 'warning';
    
    return 'healthy';
  },

  // --- Task & Decision Helpers ---
  getTasksByProject: (tasks: Task[], projectId: string): Task[] => {
    return tasks.filter(t => t.projectRef === projectId);
  },

  getDecisionsByProject: (decisions: Decision[], projectId: string): Decision[] => {
    return decisions.filter(d => d.projectRef === projectId);
  },

  // --- Source Helpers ---
  getSourcesByProject: (sources: Source[], project: Project): Source[] => {
    return sources.filter(s => 
      s.projectRef === project.id || 
      project.sourceRefs?.includes(s.id)
    );
  },

  // --- Inbox & Laterality Helpers ---
  getRecurringLateralities: (inbox: InboxItem[]): InboxItem[] => {
    return inbox.filter(i => 
      i.type === 'laterality' && 
      i.lateralityState !== 'captured'
    );
  },

  getInboxCountByType: (inbox: InboxItem[]): Record<string, number> => {
    return inbox.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  },

  // --- Health Helpers ---
  getAlertsByArea: (alerts: Alert[], areaId: string): Alert[] => {
    return alerts.filter(a => a.areaRef === areaId);
  },

  getBrokenRoutines: (routines: Routine[]): Routine[] => {
    return routines.filter(r => r.status === 'broken');
  },

  getOpenAlertsBySeverity: (alerts: Alert[]): Record<string, Alert[]> => {
    const open = alerts.filter(a => a.status === 'open');
    return {
      critical: open.filter(a => a.severity === 'critical'),
      high: open.filter(a => a.severity === 'high'),
      medium: open.filter(a => a.severity === 'medium'),
      info: open.filter(a => a.severity === 'info')
    };
  }
};
