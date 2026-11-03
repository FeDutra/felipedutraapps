import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './pulsoCoreClient') return nextResolve('./pulsoCoreClient.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/pulsoCoreShellAdapter.ts')) {
      return {
        format: 'module',
        source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { activeCoreAreas, activeCoreSessions } = await import('./pulsoCoreShellAdapter.ts');

test('shell mostra somente topologia ativa do Core, preservando nomes e ordem', () => {
  const areas = activeCoreAreas([
    { id: 'area-b', nome: 'B', glifo: '◇', ordem: 2, estado: 'active', createdAt: 'x', updatedAt: 'x' },
    { id: 'area-old', nome: 'Antiga', glifo: '○', ordem: 0, estado: 'archived', createdAt: 'x', updatedAt: 'x' },
    { id: 'area-a', nome: 'A', glifo: '○', ordem: 1, estado: 'active', createdAt: 'x', updatedAt: 'x' },
  ]);
  assert.deepEqual(areas.map(area => [area.id, area.name, area.order]), [
    ['area-a', 'A', 1],
    ['area-b', 'B', 2],
  ]);

  const sessions = activeCoreSessions([
    { id: 's1', areaId: 'area-a', titulo: 'Atual', identityId: 'lotus', estado: 'active', createdAt: 'x', updatedAt: '2026-11-03T00:00:00.000Z' },
    { id: 's2', areaId: 'area-a', titulo: 'Arquivada', identityId: 'lotus', estado: 'archived', createdAt: 'x', updatedAt: '2026-11-03T00:00:00.000Z' },
  ]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].contextId, 's1');
  assert.equal(sessions[0].label, 'Atual');
  assert.equal(sessions[0].openclawSessionKey, 'agent:main:pulso:s1');
});
