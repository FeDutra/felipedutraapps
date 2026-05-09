/**
 * @file firestorePaths.ts
 * @description Centralized Firestore path builders for the PULSO workspace.
 */

const WORKSPACE_ID = process.env.NEXT_PUBLIC_PULSO_WORKSPACE_ID || 'felipe_dutra';
const BASE_PATH = `workspaces/${WORKSPACE_ID}`;

export const firestorePaths = {
  areas: () => `${BASE_PATH}/pulso_areas`,
  area: (id: string) => `${BASE_PATH}/pulso_areas/${id}`,
  
  projects: () => `${BASE_PATH}/pulso_projects`,
  project: (id: string) => `${BASE_PATH}/pulso_projects/${id}`,
  
  inboxItems: () => `${BASE_PATH}/pulso_inbox_items`,
  inboxItem: (id: string) => `${BASE_PATH}/pulso_inbox_items/${id}`,
  
  tasks: () => `${BASE_PATH}/pulso_tasks`,
  task: (id: string) => `${BASE_PATH}/pulso_tasks/${id}`,
  
  decisions: () => `${BASE_PATH}/pulso_decisions`,
  decision: (id: string) => `${BASE_PATH}/pulso_decisions/${id}`,
  
  notes: () => `${BASE_PATH}/pulso_notes`,
  note: (id: string) => `${BASE_PATH}/pulso_notes/${id}`,
  
  meetings: () => `${BASE_PATH}/pulso_meetings`,
  meeting: (id: string) => `${BASE_PATH}/pulso_meetings/${id}`,
  
  alerts: () => `${BASE_PATH}/pulso_alerts`,
  alert: (id: string) => `${BASE_PATH}/pulso_alerts/${id}`,

  logs: () => `${BASE_PATH}/pulso_logs`,
  log: (id: string) => `${BASE_PATH}/pulso_logs/${id}`,

  routines: () => `${BASE_PATH}/pulso_routines`,
  routine: (id: string) => `${BASE_PATH}/pulso_routines/${id}`,

  agents: () => `${BASE_PATH}/pulso_agents`,
  agent: (id: string) => `${BASE_PATH}/pulso_agents/${id}`,

  sources: () => `${BASE_PATH}/pulso_sources`,
  source: (id: string) => `${BASE_PATH}/pulso_sources/${id}`,

  people: () => `${BASE_PATH}/pulso_people`,
  person: (id: string) => `${BASE_PATH}/pulso_people/${id}`,

  syncJobs: () => `${BASE_PATH}/pulso_sync_jobs`,
  syncJob: (id: string) => `${BASE_PATH}/pulso_sync_jobs/${id}`,

  ingestionEvents: () => `${BASE_PATH}/pulso_ingestion_events`,
  ingestionEvent: (id: string) => `${BASE_PATH}/pulso_ingestion_events/${id}`,

  events: () => `${BASE_PATH}/pulso_events`,
  event: (id: string) => `${BASE_PATH}/pulso_events/${id}`,

  meta: () => `${BASE_PATH}/pulso_meta`,
  seedStatus: (version: string) => `${BASE_PATH}/pulso_meta/seed_${version}`
};
