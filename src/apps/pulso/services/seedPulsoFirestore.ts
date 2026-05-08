import { 
  seedAreas, 
  seedProjects, 
  seedInboxItems, 
  seedTasks, 
  seedDecisions, 
  seedRoutines, 
  seedAgents, 
  seedSources, 
  seedAlerts, 
  seedLogs,
  seedPeople
} from "../mocks/pulsoSeed";
import { pulsoRepository } from "./pulsoService";
import { FirestorePulsoRepository } from "./firestorePulsoRepository";

/**
 * @function seedPulsoFirestore
 * @description Populates Firestore with deterministic seed data if not already seeded.
 */
export async function seedPulsoFirestore(force = false) {
  if (!(pulsoRepository instanceof FirestorePulsoRepository)) {
    console.warn('SEED: O repositório não é Firestore. Abortando.');
    return;
  }

  const version = 'v1_initial';
  const alreadySeeded = await pulsoRepository.getSeedStatus(version);

  if (alreadySeeded && !force) {
    console.log(`SEED: Versão ${version} já aplicada.`);
    return;
  }

  console.log(`SEED: Iniciando aplicação da versão ${version}...`);

  try {
    console.log(`SEED: Aplicando versão ${version}...`);

    // 1. Areas
    for (const area of seedAreas) await pulsoRepository.saveArea(area);
    
    // 2. Projects
    for (const proj of seedProjects) await pulsoRepository.saveProject(proj);
    
    // 3. Inbox Items
    for (const item of seedInboxItems) await pulsoRepository.saveInboxItem(item);
    
    // 4. Tasks
    for (const task of seedTasks) await pulsoRepository.saveTask(task);
    
    // 5. Decisions
    for (const decision of seedDecisions) await pulsoRepository.saveDecision(decision);
    
    // 6. Routines & Agents
    for (const routine of seedRoutines) await pulsoRepository.saveRoutine(routine);
    for (const agent of seedAgents) await pulsoRepository.saveAgent(agent);
    
    // 7. People & Sources
    for (const person of seedPeople) await pulsoRepository.savePerson(person);
    for (const source of seedSources) await pulsoRepository.saveSource(source);
    
    // 8. Alerts & Logs
    for (const alert of seedAlerts) await pulsoRepository.saveAlert(alert);
    for (const log of seedLogs) await pulsoRepository.saveLog(log);

    await pulsoRepository.markSeedComplete(version);
    console.log('SEED: Concluído com sucesso.');
  } catch (error) {
    console.error('SEED: Erro durante a execução:', error);
  }
}
