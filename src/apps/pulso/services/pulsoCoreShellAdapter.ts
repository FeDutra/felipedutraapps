import type { PulsoLiveArea, PulsoLiveSession } from './pulsoCoreClient';
import type { PulsoContextNode } from '../types/pulso.types';

export interface PulsoVisibleArea {
  id: string;
  name: string;
  order: number;
  glyph: string;
}

export const coreAreaToVisibleArea = (area: PulsoLiveArea): PulsoVisibleArea => ({
  id: area.id,
  name: area.nome,
  order: area.ordem,
  glyph: area.glifo || '○',
});

export const coreSessionToContextNode = (session: PulsoLiveSession): PulsoContextNode => ({
  areaId: session.areaId,
  subareaId: '',
  contextId: session.id,
  chatId: session.id,
  openclawSessionKey: `agent:main:pulso:${session.id}`,
  label: session.titulo,
  assistantName: 'Lótus',
  archived: session.estado === 'archived',
  isDefault: false,
  updatedAt: new Date(session.updatedAt),
  order: 0,
});

export const activeCoreAreas = (areas: readonly PulsoLiveArea[]): PulsoVisibleArea[] => (
  areas
    .filter(area => area.estado === 'active')
    .map(coreAreaToVisibleArea)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'pt-BR'))
);

export const activeCoreSessions = (sessions: readonly PulsoLiveSession[]): PulsoContextNode[] => (
  sessions
    .filter(session => session.estado === 'active')
    .map(coreSessionToContextNode)
);
