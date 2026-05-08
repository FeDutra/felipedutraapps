import { BaseEntity } from "../types/pulso.types";

/**
 * @file relationshipHelpers.ts
 * @description Helpers to manage cross-references in the ecosystem.
 */

export const getRelatedEntities = <T extends BaseEntity>(
  entities: T[], 
  refIds?: string[]
): T[] => {
  if (!refIds || refIds.length === 0) return [];
  return entities.filter(e => refIds.includes(e.id));
};

export const linkToSource = (entity: BaseEntity, sourceId: string): string[] => {
  const current = entity.sourceRefs || [];
  if (current.includes(sourceId)) return current;
  return [...current, sourceId];
};
