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
  
  if (DATA_MODE === 'firestore' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.log('PULSO: Modo Firestore Ativo. API KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const { FirestorePulsoRepository } = require("./firestorePulsoRepository");
    repository = new FirestorePulsoRepository();
  } else {
    console.log('PULSO: Modo Mock Ativo. DATA_MODE:', DATA_MODE, 'API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    repository = new MockPulsoRepository();
  }
  return repository;
};

export const pulsoRepository = getRepository();
