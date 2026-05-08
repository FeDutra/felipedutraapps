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
  Person
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
  getTasks(): Promise<Task[]>;
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
  saveAlert(alert: Partial<Alert>): Promise<Alert>;
  saveLog(log: Partial<Log>): Promise<Log>;
  
  // Metabolism
  getRoutines(): Promise<Routine[]>;
  getAgents(): Promise<Agent[]>;
  saveRoutine(routine: Partial<Routine>): Promise<Routine>;
  saveAgent(agent: Partial<Agent>): Promise<Agent>;
  
  // People & Sources
  getPeople(): Promise<Person[]>;
  getSources(): Promise<Source[]>;
  savePerson(person: Partial<Person>): Promise<Person>;
  saveSource(source: Partial<Source>): Promise<Source>;
  
  // Conversion Utility (Atomic)
  convertInboxItem(id: string, targetType: string, entityData: any): Promise<{ item: InboxItem, entity: any }>;

  // Seed Status
  getSeedStatus(version: string): Promise<boolean>;
  markSeedComplete(version: string): Promise<void>;
}
