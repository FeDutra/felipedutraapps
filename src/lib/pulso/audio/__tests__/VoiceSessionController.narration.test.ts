import assert from 'node:assert/strict';
import test from 'node:test';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(null, { status: 204 });
test.after(() => {
  globalThis.fetch = originalFetch;
});

async function createController() {
  const { VoiceSessionController } = await import('../VoiceSessionController');
  const controller = new VoiceSessionController({
    onStateChange: () => undefined,
    onTextReceived: () => undefined,
    onError: () => undefined,
    activeContextNode: { contextId: 'ctx', areaId: 'area', chatId: 'chat' },
    handleSendMessage: async () => null,
  });

  const spoken: string[] = [];
  const completions: Array<() => void> = [];
  (controller as any).ttsAdapter = {
    cancel: () => undefined,
    speak: async (
      text: string,
      onStart?: () => void,
      onEnd?: () => void,
    ) => {
      spoken.push(text);
      onStart?.();
      completions.push(() => onEnd?.());
    },
  };
  (controller as any).stream = {};
  (controller as any).turnMachine.dispatch({ type: 'session_started' });
  (controller as any).turnMachine.dispatch({ type: 'turn_opened', turnId: 'turn-1' });
  (controller as any).turnMachine.dispatch({
    type: 'request_bound',
    turnId: 'turn-1',
    requestId: 'request-1',
  });
  (controller as any).activeTurnBasedTurnId = 'turn-1';
  return { controller, spoken, completions };
}

test('resultado final remove checkpoint pendente sem sobrepor a fala ativa', async () => {
  const { controller, spoken, completions } = await createController();

  assert.equal(await controller.speakAssistant('primeiro marco real', undefined, undefined, {
    turnId: 'turn-1',
    requestId: 'request-1',
    kind: 'checkpoint',
  }), true);
  assert.equal(await controller.speakAssistant('segundo marco real', undefined, undefined, {
    turnId: 'turn-1',
    requestId: 'request-1',
    kind: 'checkpoint',
  }), true);
  assert.equal(await controller.speakAssistant('resultado concluído', undefined, undefined, {
    turnId: 'turn-1',
    requestId: 'request-1',
    kind: 'result',
  }), true);

  assert.deepEqual(spoken, ['primeiro marco real']);
  completions.shift()?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(spoken, ['primeiro marco real', 'resultado concluído']);
});

test('checkpoint local usa o turno vinculado ao request canônico', async () => {
  const { controller, spoken } = await createController();

  assert.equal(controller.notifyPresenceCheckpoint('encontrei os compromissos', 'request-1'), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(spoken, ['encontrei os compromissos']);
});
