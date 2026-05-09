import { pulsoRepository } from "./pulsoRepositoryInstance";

export const peopleService = {
  getAll: () => pulsoRepository.getPeople()
};
