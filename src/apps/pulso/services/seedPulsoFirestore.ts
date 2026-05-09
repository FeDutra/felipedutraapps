import { 
  seedAreas, seedProjects, seedInboxItems, seedTasks, 
  seedDecisions, seedRoutines, seedAgents, seedSources, 
  seedAlerts, seedLogs, seedPeople
} from "../mocks/pulsoSeed";
import { 
  seedAgentsV2, seedRoutinesV2, seedAlertsV2, 
  seedSyncJobsV2, seedLogsV2 
} from "../mocks/healthSeed";
import { seedIngestionEvents, seedPulsoEvents } from "../mocks/eventSeed";
import { pulsoRepository } from "./pulsoService";
import { FirestorePulsoRepository } from "./firestorePulsoRepository";

/**
 * @function seedPulsoFirestore
 * @description Populates Firestore with deterministic seed data version by version.
 */
export async function seedPulsoFirestore(force = false) {
  if (!(pulsoRepository instanceof FirestorePulsoRepository)) {
    console.warn('SEED: O repositório não é Firestore. Abortando.');
    return;
  }

  // --- VERSION 1: INITIAL ---
  await applySeed('v1_initial', async () => {
    for (const area of seedAreas) await pulsoRepository.saveArea(area);
    for (const proj of seedProjects) await pulsoRepository.saveProject(proj);
    for (const item of seedInboxItems) await pulsoRepository.saveInboxItem(item);
    for (const task of seedTasks) await pulsoRepository.saveTask(task);
    for (const decision of seedDecisions) await pulsoRepository.saveDecision(decision);
    for (const routine of seedRoutines) await pulsoRepository.saveRoutine(routine);
    for (const agent of seedAgents) await pulsoRepository.saveAgent(agent);
    for (const person of seedPeople) await pulsoRepository.savePerson(person);
    for (const source of seedSources) await pulsoRepository.saveSource(source);
    for (const alert of seedAlerts) await pulsoRepository.saveAlert(alert);
    for (const log of seedLogs) await pulsoRepository.saveLog(log);
  }, force);

  // --- VERSION 2: HEALTH & METABOLISM ---
  await applySeed('v2_health_metabolism', async () => {
    for (const agent of seedAgentsV2) await pulsoRepository.saveAgent(agent);
    for (const routine of seedRoutinesV2) await pulsoRepository.saveRoutine(routine);
    for (const alert of seedAlertsV2) await pulsoRepository.saveAlert(alert);
    for (const job of seedSyncJobsV2) await pulsoRepository.saveSyncJob(job);
    for (const log of seedLogsV2) await pulsoRepository.saveLog(log);
  }, force);

  // --- VERSION 3: INGESTION & OUTBOX ---
  await applySeed('v3_ingestion_outbox', async () => {
    for (const ingest of seedIngestionEvents) await pulsoRepository.saveIngestionEvent(ingest);
    for (const event of seedPulsoEvents) await pulsoRepository.saveEvent(event);
  }, force);
}

/**
 * Helper to check and apply a seed version
 */
async function applySeed(version: string, task: () => Promise<void>, force: boolean) {
  const alreadySeeded = await pulsoRepository.getSeedStatus(version);

  if (alreadySeeded && !force) {
    console.log(`SEED: Versão ${version} já aplicada.`);
    return;
  }

  console.log(`SEED: Aplicando versão ${version}...`);
  try {
    await task();
    await pulsoRepository.markSeedComplete(version);
    console.log(`SEED: Versão ${version} concluída.`);
  } catch (error) {
    console.error(`SEED: Erro na versão ${version}:`, error);
  }
}
