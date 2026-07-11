import { pulsoRepository } from "./pulsoRepositoryInstance";
import { Session } from "../types/pulso.types";

/**
 * @file sessionsService.ts
 * @description Domain service for managing Pulso sessions (v2).
 * Sessions are the primary unit of context separation in the Lótus Live chat.
 * Each session holds an independent conversation with its own OpenClaw session key.
 */

export const sessionsService = {
  /**
   * Returns all non-archived sessions, ordered by createdAt ascending.
   */
  getAll: async (): Promise<Session[]> => {
    return pulsoRepository.getSessions();
  },

  /**
   * Creates a new session.
   * The openclawSessionKey is auto-generated from the id if not provided.
   */
  createSession: async (data: {
    label: string;
    areaId?: string | null;
    subareaId?: string;
    id?: string;
    isDefault?: boolean;
    runtimeStatus?: 'pending' | 'bootstrapping' | 'ready' | 'error' | 'disabled' | 'migrating';
  }): Promise<Session> => {
    const id = data.id || `sess_${Date.now()}`;
    const openclawSessionKey = `agent:main:pulso:${id}`;
    return pulsoRepository.saveSession({
      id,
      label: data.label,
      areaId: data.areaId ?? null,
      subareaId: data.subareaId,
      openclawSessionKey,
      isDefault: data.isDefault ?? false,
      runtimeStatus: data.runtimeStatus ?? 'pending',
      errorMessage: null,
      fallbackAllowed: false,
      bootstrapVersion: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Renames a session.
   */
  renameSession: async (id: string, label: string): Promise<Session> => {
    return pulsoRepository.updateSession(id, { label, updatedAt: new Date() });
  },

  /**
   * Soft-archives a session (removes from active list).
   */
  archiveSession: async (id: string): Promise<Session> => {
    return pulsoRepository.archiveSession(id);
  },

  /**
   * Updates lastMessageAt timestamp on the session — called whenever a message is sent.
   */
  touchSession: async (id: string): Promise<void> => {
    await pulsoRepository.updateSession(id, {
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    }).catch(err => console.warn('[sessionsService] touchSession failed:', err));
  },
};
