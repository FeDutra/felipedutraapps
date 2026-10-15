import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types runner executes the TypeScript source directly.
import { PresenceTurnMachine } from '../PresenceTurnMachine.ts';

function beginTurn(machine: PresenceTurnMachine, turnId: string, requestId?: string) {
  machine.dispatch({ type: 'turn_opened', turnId });
  machine.dispatch({ type: 'turn_closed', turnId });
  machine.dispatch({ type: 'transcription_started', turnId });
  machine.dispatch({ type: 'transcription_ready', turnId });
  machine.dispatch({ type: 'routing_started', turnId });
  if (requestId) machine.dispatch({ type: 'request_bound', turnId, requestId });
}

test('preserva a identidade no ciclo completo do turno', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-1', 'request-1');

  const result = machine.dispatch({ type: 'result_received', requestId: 'request-1' });
  assert.equal(result.decision, 'narrate');
  assert.equal(result.turnId, 'turn-1');

  assert.equal(
    machine.dispatch({ type: 'narration_started', turnId: 'turn-1', kind: 'result' }).decision,
    'accepted',
  );
  assert.equal(machine.getSnapshot().phase, 'narrating');
  machine.dispatch({ type: 'narration_finished', turnId: 'turn-1' });
  assert.equal(machine.getSnapshot().phase, 'listening');
  assert.equal(machine.getSnapshot().turns['turn-1'].status, 'completed');
});

test('resultado tardio permanece no chat e não invade o turno novo', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-old', 'request-old');
  machine.dispatch({ type: 'listening_resumed', turnId: 'turn-old' });

  beginTurn(machine, 'turn-new', 'request-new');

  const late = machine.dispatch({ type: 'result_received', requestId: 'request-old' });
  assert.equal(late.decision, 'chat_only');
  assert.equal(late.turnId, 'turn-old');
  assert.equal(machine.getSnapshot().activeTurnId, 'turn-new');

  const current = machine.dispatch({ type: 'result_received', requestId: 'request-new' });
  assert.equal(current.decision, 'narrate');
  assert.equal(current.turnId, 'turn-new');
});

test('interrupção silencia a narração sem cancelar o trabalho', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-1', 'request-1');
  machine.dispatch({ type: 'checkpoint_received', requestId: 'request-1' });
  machine.dispatch({ type: 'narration_started', turnId: 'turn-1', kind: 'checkpoint' });

  machine.dispatch({ type: 'turn_interrupted', turnId: 'turn-1' });
  assert.equal(machine.getSnapshot().phase, 'interrupted');
  assert.equal(machine.getSnapshot().audibleTurnId, null);
  assert.equal(machine.getSnapshot().turns['turn-1'].status, 'working');

  const result = machine.dispatch({ type: 'result_received', requestId: 'request-1' });
  assert.equal(result.decision, 'chat_only');
  assert.equal(machine.getSnapshot().turns['turn-1'].status, 'completed');
});

test('rejeita checkpoint e resultado com requestId de outro turno', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-1', 'request-1');

  assert.equal(
    machine.dispatch({ type: 'checkpoint_received', turnId: 'turn-1', requestId: 'request-x' }).decision,
    'ignored',
  );
  assert.equal(
    machine.dispatch({ type: 'result_received', turnId: 'turn-1', requestId: 'request-x' }).decision,
    'ignored',
  );
  assert.equal(machine.getSnapshot().turns['turn-1'].status, 'working');
});

test('não permite que um requestId pertença a dois turnos', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-1', 'request-shared');
  machine.dispatch({ type: 'listening_resumed', turnId: 'turn-1' });
  beginTurn(machine, 'turn-2');

  const duplicate = machine.dispatch({
    type: 'request_bound',
    turnId: 'turn-2',
    requestId: 'request-shared',
  });
  assert.equal(duplicate.decision, 'ignored');
  assert.equal(machine.getSnapshot().turns['turn-2'].requestId, undefined);
});

test('sessão encerrada bloqueia qualquer narração tardia', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-1', 'request-1');
  machine.dispatch({ type: 'session_stopped' });

  const late = machine.dispatch({ type: 'result_received', requestId: 'request-1' });
  assert.equal(late.decision, 'ignored');
  assert.equal(machine.getSnapshot().phase, 'idle');
  assert.equal(machine.getSnapshot().sessionActive, false);
});

test('fim de narração de um turno velho não altera o turno corrente', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-old', 'request-old');
  machine.dispatch({ type: 'result_received', requestId: 'request-old' });
  machine.dispatch({ type: 'narration_started', turnId: 'turn-old', kind: 'result' });
  machine.dispatch({ type: 'turn_opened', turnId: 'turn-new' });

  const staleEnd = machine.dispatch({ type: 'narration_finished', turnId: 'turn-old' });
  assert.equal(staleEnd.decision, 'ignored');
  assert.equal(machine.getSnapshot().phase, 'capturing');
  assert.equal(machine.getSnapshot().activeTurnId, 'turn-new');
});

test('resultado já reivindicado pela voz não é narrado duas vezes', () => {
  const machine = new PresenceTurnMachine();
  machine.dispatch({ type: 'session_started' });
  beginTurn(machine, 'turn-1', 'request-1');

  assert.equal(
    machine.dispatch({ type: 'result_received', requestId: 'request-1' }).decision,
    'narrate',
  );
  // O primeiro sintetizador pode recusar antes de iniciar. Enquanto nenhuma
  // voz reivindicou o resultado, um fallback aprovado ainda pode assumi-lo.
  assert.equal(
    machine.dispatch({ type: 'result_received', requestId: 'request-1' }).decision,
    'narrate',
  );
  machine.dispatch({ type: 'narration_started', turnId: 'turn-1', kind: 'result' });

  assert.equal(
    machine.dispatch({ type: 'result_received', requestId: 'request-1' }).decision,
    'chat_only',
  );
});
