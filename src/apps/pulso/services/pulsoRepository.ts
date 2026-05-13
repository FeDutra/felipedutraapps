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
  SyncJob,
  PulsoEvent,
  IngestionEvent,
  PulsoRequest
} from "../types/pulso.types";

/**
 * @interface IPulsoRepository
 * @description Standard contract for all PULSO data operations.
 */
export interface IPulsoRepository {
  // Areas
  getAreas(): Promise<Area[]>;
  getAreaById(id: string): Promise<Area | undefined>;
  saveArea(area: Partial<Area>): Promise<Area>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | undefined>;
  saveProject(project: Partial<Project>): Promise<Project>;
  
  // Inbox
  getInboxItems(): Promise<InboxItem[]>;
  getInboxItemById(id: string): Promise<InboxItem | undefined>;
  saveInboxItem(item: Partial<InboxItem>): Promise<InboxItem>;
  updateInboxItem(id: string, data: Partial<InboxItem>): Promise<InboxItem>;
  
  // Tasks
  getTasks(includeArchived?: boolean): Promise<Task[]>;
  saveTask(task: Partial<Task>): Promise<Task>;
  
  // Decisions
  getDecisions(): Promise<Decision[]>;
  saveDecision(decision: Partial<Decision>): Promise<Decision>;
  
  // Notes & Meetings (simple persistence for now)
  saveNote(note: any): Promise<any>;
  saveMeeting(meeting: any): Promise<any>;
  
  // Health & Monitoring
  getAlerts(): Promise<Alert[]>;
  getLogs(limitCount?: number): Promise<Log[]>;
  getSyncJobs(): Promise<SyncJob[]>;
  saveAlert(alert: Partial<Alert>): Promise<Alert>;
  updateAlert(id: string, data: Partial<Alert>): Promise<Alert>;
  saveLog(log: Partial<Log>): Promise<Log>;
  saveSyncJob(job: Partial<SyncJob>): Promise<SyncJob>;
  updateSyncJob(id: string, data: Partial<SyncJob>): Promise<SyncJob>;
  
  // Metabolism
  getRoutines(): Promise<Routine[]>;
  getAgents(): Promise<Agent[]>;
  saveRoutine(routine: Partial<Routine>): Promise<Routine>;
  updateRoutine(id: string, data: Partial<Routine>): Promise<Routine>;
  saveAgent(agent: Partial<Agent>): Promise<Agent>;
  updateAgent(id: string, data: Partial<Agent>): Promise<Agent>;
  
  // People & Sources
  getPeople(): Promise<Person[]>;
  getSources(): Promise<Source[]>;
  savePerson(person: Partial<Person>): Promise<Person>;
  saveSource(source: Partial<Source>): Promise<Source>;
  
  // Conversion Utility (Atomic)
  convertInboxItem(id: string, targetType: string, entityData: any): Promise<{ item: InboxItem, entity: any }>;

  // Protocol & Events
  getEvents(limitCount?: number): Promise<PulsoEvent[]>;
  saveEvent(event: Partial<PulsoEvent>): Promise<PulsoEvent>;
  updateEvent(id: string, data: Partial<PulsoEvent>): Promise<PulsoEvent>;
  
  getIngestionEvents(): Promise<IngestionEvent[]>;
  getEventsByArea(areaId: string, limitCount?: number): Promise<PulsoEvent[]>;
  getEventsByProject(projectId: string, limitCount?: number): Promise<PulsoEvent[]>;
  saveIngestionEvent(event: Partial<IngestionEvent>): Promise<IngestionEvent>;
  updateIngestionEvent(id: string, data: Partial<IngestionEvent>): Promise<IngestionEvent>;
  findIngestionEventByKeys(eventId?: string, dedupeKey?: string): Promise<IngestionEvent | undefined>;

  // Seed Status
  getSeedStatus(version: string): Promise<boolean>;
  markSeedComplete(version: string): Promise<void>;

  // Requests
  getRequests(limitCount?: number, includeArchived?: boolean): Promise<PulsoRequest[]>;
  getPendingRequests(): Promise<PulsoRequest[]>;
  saveRequest(request: Partial<PulsoRequest>): Promise<PulsoRequest>;
  updateRequest(id: string, data: Partial<PulsoRequest>): Promise<PulsoRequest>;
}
