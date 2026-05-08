import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  writeBatch,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/shared/lib/firebase/client";
import { IPulsoRepository } from "./pulsoRepository";
import { firestorePaths } from "./firestorePaths";
import { 
  Area, Project, InboxItem, Task, Decision, 
  Routine, Agent, Source, Alert, Log, Person 
} from "../types/pulso.types";

/**
 * @class FirestorePulsoRepository
 * @description Production repository using Google Firestore.
 */
export class FirestorePulsoRepository implements IPulsoRepository {
  
  private toData<T>(doc: any): T {
    const data = doc.data();
    // Convert Firestore Timestamps back to JS Dates for the app
    Object.keys(data).forEach(key => {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate();
      }
    });
    return { ...data, id: doc.id } as T;
  }

  async getAreas() {
    const snap = await getDocs(collection(db!, firestorePaths.areas()));
    return snap.docs.map(d => this.toData<Area>(d));
  }

  async getAreaById(id: string) {
    const snap = await getDoc(doc(db!, firestorePaths.area(id)));
    return snap.exists() ? this.toData<Area>(snap) : undefined;
  }

  async saveArea(area: Partial<Area>) {
    const id = area.id || `area_${Date.now()}`;
    const data = { 
      ...area, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: area.createdAt || serverTimestamp() 
    };
    await setDoc(doc(db!, firestorePaths.area(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async getProjects() {
    const snap = await getDocs(collection(db!, firestorePaths.projects()));
    return snap.docs.map(d => this.toData<Project>(d));
  }

  async getProjectById(id: string) {
    const snap = await getDoc(doc(db!, firestorePaths.project(id)));
    return snap.exists() ? this.toData<Project>(snap) : undefined;
  }

  async saveProject(project: Partial<Project>) {
    const id = project.id || `proj_${Date.now()}`;
    const data = { 
      ...project, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: project.createdAt || serverTimestamp()
    };
    await setDoc(doc(db!, firestorePaths.project(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async getInboxItems() {
    const q = query(collection(db!, firestorePaths.inboxItems()), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => this.toData<InboxItem>(d));
  }

  async getInboxItemById(id: string) {
    const snap = await getDoc(doc(db!, firestorePaths.inboxItem(id)));
    return snap.exists() ? this.toData<InboxItem>(snap) : undefined;
  }

  async saveInboxItem(item: Partial<InboxItem>) {
    const id = item.id || `inbox_${Date.now()}`;
    const data = { 
      ...item, 
      id, 
      status: item.status || 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp() 
    };
    await setDoc(doc(db!, firestorePaths.inboxItem(id)), data);
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async updateInboxItem(id: string, data: Partial<InboxItem>) {
    const ref = doc(db!, firestorePaths.inboxItem(id));
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    const snap = await getDoc(ref);
    return this.toData<InboxItem>(snap);
  }

  async getTasks() {
    const snap = await getDocs(collection(db!, firestorePaths.tasks()));
    return snap.docs.map(d => this.toData<Task>(d));
  }

  async saveTask(task: Partial<Task>) {
    const id = task.id || `task_${Date.now()}`;
    const data = { 
      ...task, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: task.createdAt || serverTimestamp()
    };
    await setDoc(doc(db!, firestorePaths.task(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async getDecisions() {
    const snap = await getDocs(collection(db!, firestorePaths.decisions()));
    return snap.docs.map(d => this.toData<Decision>(d));
  }

  async saveDecision(decision: Partial<Decision>) {
    const id = decision.id || `decision_${Date.now()}`;
    const data = { 
      ...decision, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: decision.createdAt || serverTimestamp()
    };
    await setDoc(doc(db!, firestorePaths.decision(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async saveNote(note: any) {
    const id = note.id || `note_${Date.now()}`;
    await setDoc(doc(db!, firestorePaths.note(id)), { ...note, id, updatedAt: serverTimestamp() }, { merge: true });
    return { ...note, id };
  }

  async saveMeeting(meeting: any) {
    const id = meeting.id || `meeting_${Date.now()}`;
    await setDoc(doc(db!, firestorePaths.meeting(id)), { ...meeting, id, updatedAt: serverTimestamp() }, { merge: true });
    return { ...meeting, id };
  }

  async getAlerts() {
    const snap = await getDocs(collection(db!, firestorePaths.alerts()));
    return snap.docs.map(d => this.toData<Alert>(d));
  }

  async getLogs(limitCount = 10) {
    const q = query(collection(db!, firestorePaths.logs()), orderBy("createdAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => this.toData<Log>(d));
  }

  async saveAlert(alert: Partial<Alert>) {
    const id = alert.id || `alert_${Date.now()}`;
    const data = { 
      ...alert, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: alert.createdAt || serverTimestamp()
    };
    await setDoc(doc(db!, firestorePaths.alert(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async saveLog(log: Partial<Log>) {
    const id = log.id || `log_${Date.now()}`;
    const data = { ...log, id, createdAt: serverTimestamp() };
    await setDoc(doc(db!, firestorePaths.log(id)), data);
    return { ...data, createdAt: new Date() } as any;
  }

  async getRoutines() {
    const snap = await getDocs(collection(db!, firestorePaths.routines()));
    return snap.docs.map(d => this.toData<Routine>(d));
  }

  async getAgents() {
    const snap = await getDocs(collection(db!, firestorePaths.agents()));
    return snap.docs.map(d => this.toData<Agent>(d));
  }

  async saveRoutine(routine: Partial<Routine>) {
    const id = routine.id || `routine_${Date.now()}`;
    await setDoc(doc(db!, firestorePaths.routine(id)), { ...routine, id, updatedAt: serverTimestamp() }, { merge: true });
    return { ...routine, id } as any;
  }

  async saveAgent(agent: Partial<Agent>) {
    const id = agent.id || `agent_${Date.now()}`;
    await setDoc(doc(db!, firestorePaths.agent(id)), { ...agent, id, updatedAt: serverTimestamp() }, { merge: true });
    return { ...agent, id } as any;
  }

  async getPeople() {
    const snap = await getDocs(collection(db!, firestorePaths.people()));
    return snap.docs.map(d => this.toData<Person>(d));
  }

  async getSources() {
    const snap = await getDocs(collection(db!, firestorePaths.sources()));
    return snap.docs.map(d => this.toData<Source>(d));
  }

  async savePerson(person: Partial<Person>) {
    const id = person.id || `person_${Date.now()}`;
    const data = { 
      ...person, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: person.createdAt || serverTimestamp()
    };
    await setDoc(doc(db!, firestorePaths.person(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async saveSource(source: Partial<Source>) {
    const id = source.id || `source_${Date.now()}`;
    const data = { 
      ...source, 
      id, 
      updatedAt: serverTimestamp(),
      createdAt: source.createdAt || serverTimestamp()
    };
    await setDoc(doc(db!, firestorePaths.source(id)), data, { merge: true });
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as any;
  }

  async convertInboxItem(id: string, targetType: string, entityData: any) {
    const batch = writeBatch(db!);
    
    // 1. Create the new entity
    const entityPath = (firestorePaths as any)[targetType] ? (firestorePaths as any)[targetType + ''] : null;
    // Manual mapping for now to avoid complexity
    let collectionPath = '';
    switch(targetType) {
      case 'task': collectionPath = firestorePaths.tasks(); break;
      case 'decision': collectionPath = firestorePaths.decisions(); break;
      case 'note': collectionPath = firestorePaths.notes(); break;
      case 'meeting': collectionPath = firestorePaths.meetings(); break;
      case 'potential_project': collectionPath = firestorePaths.projects(); break;
    }

    const entityRef = doc(db!, collectionPath, entityData.id);
    batch.set(entityRef, { 
      ...entityData, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    });

    // 2. Update the inbox item
    const inboxRef = doc(db!, firestorePaths.inboxItem(id));
    batch.update(inboxRef, {
      status: 'converted',
      convertedToRef: entityData.id,
      convertedToType: targetType,
      updatedAt: serverTimestamp()
    });

    await batch.commit();
    
    const updatedItemSnap = await getDoc(inboxRef);
    return { item: this.toData<InboxItem>(updatedItemSnap), entity: entityData };
  }

  async getSeedStatus(version: string) {
    const snap = await getDoc(doc(db!, firestorePaths.seedStatus(version)));
    return snap.exists();
  }

  async markSeedComplete(version: string) {
    await setDoc(doc(db!, firestorePaths.seedStatus(version)), { 
      completedAt: serverTimestamp(),
      version 
    });
  }
}
