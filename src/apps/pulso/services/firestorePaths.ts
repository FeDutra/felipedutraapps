/**
 * @file firestorePaths.ts
 * @description Centralized Firestore path builders for the PULSO workspace.
 */

const WORKSPACE_ID = process.env.NEXT_PUBLIC_PULSO_WORKSPACE_ID || 'felipe_dutra';
const BASE_PATH = `workspaces/${WORKSPACE_ID}/pulso`;

export const firestorePaths = {
  areas: () => `${BASE_PATH}/areas`,
  area: (id: string) => `${BASE_PATH}/areas/${id}`,
  
  projects: () => `${BASE_PATH}/projects`,
  project: (id: string) => `${BASE_PATH}/projects/${id}`,
  
  inboxItems: () => `${BASE_PATH}/inbox_items`,
  inboxItem: (id: string) => `${BASE_PATH}/inbox_items/${id}`,
  
  tasks: () => `${BASE_PATH}/tasks`,
  task: (id: string) => `${BASE_PATH}/tasks/${id}`,
  
  decisions: () => `${BASE_PATH}/decisions`,
  decision: (id: string) => `${BASE_PATH}/decisions/${id}`,
  
  notes: () => `${BASE_PATH}/notes`,
  note: (id: string) => `${BASE_PATH}/notes/${id}`,
  
  meetings: () => `${BASE_PATH}/meetings`,
  meeting: (id: string) => `${BASE_PATH}/meetings/${id}`,
  
  alerts: () => `${BASE_PATH}/alerts`,
  alert: (id: string) => `${BASE_PATH}/alerts/${id}`,

  logs: () => `${BASE_PATH}/logs`,
  log: (id: string) => `${BASE_PATH}/logs/${id}`,

  routines: () => `${BASE_PATH}/routines`,
  routine: (id: string) => `${BASE_PATH}/routines/${id}`,

  agents: () => `${BASE_PATH}/agents`,
  agent: (id: string) => `${BASE_PATH}/agents/${id}`,

  sources: () => `${BASE_PATH}/sources`,
  source: (id: string) => `${BASE_PATH}/sources/${id}`,

  people: () => `${BASE_PATH}/people`,
  person: (id: string) => `${BASE_PATH}/people/${id}`,

  meta: () => `${BASE_PATH}/meta`,
  seedStatus: (version: string) => `${BASE_PATH}/meta/seed_${version}`
};
