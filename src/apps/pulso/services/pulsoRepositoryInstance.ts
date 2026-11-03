import { IPulsoRepository } from "./pulsoRepository";
import { MockPulsoRepository } from "./mockPulsoRepository";

/**
 * @file pulsoRepositoryInstance.ts
 * @description Singleton instance of the repository to avoid circular dependencies.
 */

const DATA_MODE = process.env.NEXT_PUBLIC_PULSO_DATA_MODE || 'mock';

let repository: IPulsoRepository;

export const getRepository = (): IPulsoRepository => {
  if (repository) return repository;
  
  if (DATA_MODE === 'firestore') {
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      console.info('PULSO: Modo Firestore ativo.');
      const { FirestorePulsoRepository } = require("./firestorePulsoRepository");
      repository = new FirestorePulsoRepository();
    } else {
      console.error('CRITICAL WARNING: Firestore mode is configured but NEXT_PUBLIC_FIREBASE_API_KEY is missing! Falling back to Mock mode.');
      repository = new MockPulsoRepository();
    }
  } else {
    console.info('PULSO: Modo Mock ativo.', { dataMode: DATA_MODE });
    repository = new MockPulsoRepository();
  }
  return repository;
};

export const pulsoRepository = getRepository();
