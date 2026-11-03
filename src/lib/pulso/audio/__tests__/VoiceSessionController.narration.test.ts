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
  (controller as any).stream = { getTracks: () => [] };
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

test('resultado canônico também é narrado no transporte local em forma oral', async () => {
  const { controller, spoken } = await createController();

  assert.equal(controller.narratePresenceResult(
    '## Fechado\nA correção foi instalada. O relatório integral permanece no chat. `/tmp/build.log`',
    'request-1',
  ), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(spoken, ['Fechado A correção foi instalada. O relatório integral permanece no chat.']);
});

test('relay canônico usa Kokoro mesmo com Gemini conectado e fecha o microfone durante a fala', async () => {
  const { controller, spoken, completions } = await createController();
  (controller as any).stream = null;
  const lifecycle: string[] = [];
  (controller as any).geminiLiveClient = {
    isConnected: () => true,
    beginExternalNarration: () => {
      lifecycle.push('begin');
      return true;
    },
    endExternalNarration: (_turnId: string, kind: string) => {
      lifecycle.push(`end:${kind}`);
      return true;
    },
  };

  assert.equal(controller.notifyPresenceCheckpoint('localizei a candidatura correta', 'request-1'), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(spoken, ['localizei a candidatura correta']);
  assert.deepEqual(lifecycle, ['begin']);

  completions.shift()?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(lifecycle, ['begin', 'end:checkpoint']);
});

test('confirmação vinculada não conclui o turno antes do resultado', async () => {
  const { controller, spoken } = await createController();

  assert.equal(await controller.speakAssistant('Certo, já comecei.', undefined, undefined, {
    turnId: 'turn-1',
    requestId: 'request-1',
    kind: 'acknowledgement',
  }), true);
  assert.equal((controller as any).turnMachine.getSnapshot().turns['turn-1'].status, 'working');
  assert.deepEqual(spoken, ['Certo, já comecei.']);
});

test('o mesmo turno Gemini só pode ser reivindicado uma vez', async () => {
  const { controller } = await createController();
  (controller as any).stopped = false;
  (controller as any).activeGeminiTurnId = 'gemini-turn-1';

  assert.equal((controller as any).claimGeminiTurn('gemini-turn-1'), true);
  assert.equal((controller as any).claimGeminiTurn('gemini-turn-1'), false);
});

test('encerrar Gemini também cancela a voz e os recursos comuns', async () => {
  const { controller } = await createController();
  let geminiStopped = 0;
  let ttsCancelled = 0;
  (controller as any).stopped = false;
  (controller as any).geminiLiveClient = { stop: () => { geminiStopped += 1; } };
  (controller as any).ttsAdapter = { cancel: () => { ttsCancelled += 1; } };

  controller.stop();

  assert.equal(geminiStopped, 1);
  assert.equal(ttsCancelled, 1);
  assert.equal((controller as any).stopped, true);
  assert.equal((controller as any).geminiLiveClient, null);
});
