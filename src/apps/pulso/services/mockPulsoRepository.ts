import { IPulsoRepository } from "./pulsoRepository";
import { 
  seedAreas, seedProjects, seedInboxItems, seedTasks, 
  seedDecisions, seedRoutines, seedAgents, seedSources, 
  seedAlerts, seedLogs, seedPeople 
} from "../mocks/pulsoSeed";
import { 
  Area, Project, InboxItem, Task, Decision, 
  Routine, Agent, Source, Alert, Log, Person, Status, SyncJob,
  PulsoEvent, IngestionEvent
} from "../types/pulso.types";

/**
 * @class MockPulsoRepository
 * @description In-memory repository using static seed data.
 */
export class MockPulsoRepository implements IPulsoRepository {
  private delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  async getAreas() { await this.delay(100); return seedAreas; }
  async getAreaById(id: string) { return seedAreas.find(a => a.id === id); }
  async saveArea(area: Partial<Area>) {
    const newArea = { ...area, id: area.id || `area_${Date.now()}` } as Area;
    seedAreas.unshift(newArea);
    return newArea;
  }

  async getProjects() { await this.delay(100); return seedProjects; }
  async getProjectById(id: string) { return seedProjects.find(p => p.id === id); }
  async saveProject(project: Partial<Project>) {
    const newProject = { ...project, id: project.id || `proj_${Date.now()}` } as Project;
    seedProjects.unshift(newProject);
    return newProject;
  }

  async getInboxItems() { 
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pulso_mock_inbox');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Sync seeds with stored (avoiding duplicates)
        return [...parsed];
      }
    }
    return seedInboxItems; 
  }

  async getInboxItemById(id: string) { 
    const all = await this.getInboxItems();
    return all.find(i => i.id === id); 
  }

  async saveInboxItem(item: Partial<InboxItem>) {
    const newItem = {
      id: `inbox_${Date.now()}`,
      slug: `inbox-${Date.now()}`,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...item
    } as InboxItem;
    
    const all = await this.getInboxItems();
    const updated = [newItem, ...all];
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('pulso_mock_inbox', JSON.stringify(updated));
    }
    
    return newItem;
  }

  async updateInboxItem(id: string, data: Partial<InboxItem>) {
    const all = await this.getInboxItems();
    const index = all.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item não encontrado');
    
    all[index] = { ...all[index], ...data, updatedAt: new Date() };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('pulso_mock_inbox', JSON.stringify(all));
    }
    
    return all[index];
  }

  async getTasks() { return seedTasks; }
  async saveTask(task: Partial<Task>) {
    const newTask = { ...task, id: task.id || `task_${Date.now()}` } as Task;
    seedTasks.unshift(newTask);
    return newTask;
  }

  async getDecisions() { return seedDecisions; }
  async saveDecision(decision: Partial<Decision>) {
    const newDecision = { ...decision, id: decision.id || `decision_${Date.now()}` } as Decision;
    seedDecisions.unshift(newDecision);
    return newDecision;
  }

  async saveNote(note: any) { return { ...note, id: note.id || `note_${Date.now()}` }; }
  async saveMeeting(meeting: any) { return { ...meeting, id: meeting.id || `meeting_${Date.now()}` }; }

  async getAlerts() { return seedAlerts; }
  async getLogs(limitCount = 10) { return seedLogs.slice(0, limitCount); }
  async getSyncJobs() { return []; } // No mock sync jobs for now
  async saveAlert(alert: Partial<Alert>) {
    const newAlert = { ...alert, id: alert.id || `alert_${Date.now()}` } as Alert;
    seedAlerts.unshift(newAlert);
    return newAlert;
  }
  async updateAlert(id: string, data: Partial<Alert>) {
    const index = seedAlerts.findIndex(a => a.id === id);
    if (index !== -1) seedAlerts[index] = { ...seedAlerts[index], ...data, updatedAt: new Date() };
    return seedAlerts[index];
  }
  async saveLog(log: Partial<Log>) {
    const newLog = { ...log, id: log.id || `log_${Date.now()}` } as Log;
    seedLogs.unshift(newLog);
    return newLog;
  }
  async saveSyncJob(job: Partial<SyncJob>) { return job as SyncJob; }
  async updateSyncJob(id: string, data: Partial<SyncJob>) { return data as SyncJob; }

  async getRoutines() { return seedRoutines; }
  async getAgents() { return seedAgents; }
  async saveRoutine(routine: Partial<Routine>) {
    const newRoutine = { ...routine, id: routine.id || `routine_${Date.now()}` } as Routine;
    seedRoutines.unshift(newRoutine);
    return newRoutine;
  }
  async updateRoutine(id: string, data: Partial<Routine>) {
    const index = seedRoutines.findIndex(r => r.id === id);
    if (index !== -1) seedRoutines[index] = { ...seedRoutines[index], ...data, updatedAt: new Date() };
    return seedRoutines[index];
  }
  async saveAgent(agent: Partial<Agent>) {
    const newAgent = { ...agent, id: agent.id || `agent_${Date.now()}` } as Agent;
    seedAgents.unshift(newAgent);
    return newAgent;
  }
  async updateAgent(id: string, data: Partial<Agent>) {
    const index = seedAgents.findIndex(a => a.id === id);
    if (index !== -1) seedAgents[index] = { ...seedAgents[index], ...data, updatedAt: new Date() };
    return seedAgents[index];
  }

  async getPeople() { return seedPeople; }
  async getSources() { return seedSources; }
  async savePerson(person: Partial<Person>) {
    const newPerson = { ...person, id: person.id || `person_${Date.now()}` } as Person;
    seedPeople.unshift(newPerson);
    return newPerson;
  }
  async saveSource(source: Partial<Source>) {
    const newSource = { ...source, id: source.id || `source_${Date.now()}` } as Source;
    seedSources.unshift(newSource);
    return newSource;
  }

  async convertInboxItem(id: string, targetType: string, entityData: any) {
    const item = await this.getInboxItemById(id);
    if (!item) throw new Error('Item não encontrado');
    
    // In mock mode, we just simulate the link
    const updatedItem = await this.updateInboxItem(id, {
      status: 'converted',
      convertedToRef: entityData.id,
      convertedToType: targetType
    });
    return { item: updatedItem, entity: entityData };
  }

  async getSeedStatus(version: string) { return true; } // Mock is always "seeded"
  async markSeedComplete(version: string) { }

  async getEvents(limitCount = 20): Promise<PulsoEvent[]> { 
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pulso_mock_events');
      if (stored) return (JSON.parse(stored) as PulsoEvent[]).slice(0, limitCount);
    }
    return []; 
  }

  async saveEvent(event: Partial<PulsoEvent>) { 
    const newEvent = { ...event, id: event.id || `event_${Date.now()}`, createdAt: new Date() } as PulsoEvent;
    if (typeof window !== 'undefined') {
      const all = await this.getEvents(100);
      localStorage.setItem('pulso_mock_events', JSON.stringify([newEvent, ...all]));
    }
    return newEvent;
  }

  async updateEvent(id: string, data: Partial<PulsoEvent>) { 
    if (typeof window !== 'undefined') {
      const all = await this.getEvents(100);
      const index = all.findIndex((e: PulsoEvent) => e.id === id);
      if (index !== -1) {
        all[index] = { ...all[index], ...data };
        localStorage.setItem('pulso_mock_events', JSON.stringify(all));
        return all[index];
      }
    }
    return data as any; 
  }

  async getIngestionEvents(): Promise<IngestionEvent[]> { 
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pulso_mock_ingestion');
      if (stored) return JSON.parse(stored) as IngestionEvent[];
    }
    return []; 
  }

  async saveIngestionEvent(event: Partial<IngestionEvent>) { 
    const newIngest = { ...event, id: event.id || `ingest_${Date.now()}`, createdAt: new Date() } as IngestionEvent;
    if (typeof window !== 'undefined') {
      const all = await this.getIngestionEvents();
      localStorage.setItem('pulso_mock_ingestion', JSON.stringify([newIngest, ...all]));
    }
    return newIngest;
  }

  async updateIngestionEvent(id: string, data: Partial<IngestionEvent>) { 
    if (typeof window !== 'undefined') {
      const all = await this.getIngestionEvents();
      const index = all.findIndex((i: IngestionEvent) => i.id === id);
      if (index !== -1) {
        all[index] = { ...all[index], ...data, updatedAt: new Date() };
        localStorage.setItem('pulso_mock_ingestion', JSON.stringify(all));
        return all[index];
      }
    }
    return data as any; 
  }
}
