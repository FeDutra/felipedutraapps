export type PresenceTurnPhase =
  | 'idle'
  | 'listening'
  | 'capturing'
  | 'closing'
  | 'transcribing'
  | 'routing'
  | 'working'
  | 'narrating'
  | 'interrupted'
  | 'failed';

export type PresenceTurnStatus =
  | 'capturing'
  | 'processing'
  | 'working'
  | 'completed'
  | 'failed';

export interface PresenceTurnRecord {
  turnId: string;
  requestId?: string;
  status: PresenceTurnStatus;
  narrationAllowed: boolean;
  resultNarrationClaimed: boolean;
}

export interface PresenceTurnState {
  sessionActive: boolean;
  phase: PresenceTurnPhase;
  activeTurnId: string | null;
  audibleTurnId: string | null;
  turns: Record<string, PresenceTurnRecord>;
}

export type PresenceNarrationKind = 'acknowledgement' | 'checkpoint' | 'result';

export type PresenceTurnEvent =
  | { type: 'session_started' }
  | { type: 'session_stopped' }
  | { type: 'turn_opened'; turnId: string }
  | { type: 'turn_closed'; turnId: string }
  | { type: 'transcription_started'; turnId: string }
  | { type: 'transcription_ready'; turnId: string }
  | { type: 'routing_started'; turnId: string }
  | { type: 'request_bound'; turnId: string; requestId: string }
  | { type: 'listening_resumed'; turnId?: string }
  | { type: 'checkpoint_received'; turnId?: string; requestId?: string }
  | { type: 'result_received'; turnId?: string; requestId?: string }
  | { type: 'narration_started'; turnId: string; kind: PresenceNarrationKind }
  | { type: 'narration_finished'; turnId: string }
  | { type: 'turn_interrupted'; turnId?: string }
  | { type: 'turn_failed'; turnId?: string };

export type PresenceTurnDecision = 'accepted' | 'narrate' | 'chat_only' | 'ignored';

export interface PresenceTurnTransition {
  state: PresenceTurnState;
  decision: PresenceTurnDecision;
  turnId?: string;
  reason?: string;
}

const MAX_RETAINED_TURNS = 32;

export function createInitialPresenceTurnState(): PresenceTurnState {
  return {
    sessionActive: false,
    phase: 'idle',
    activeTurnId: null,
    audibleTurnId: null,
    turns: {},
  };
}

function transition(
  state: PresenceTurnState,
  decision: PresenceTurnDecision,
  options: { turnId?: string; reason?: string } = {},
): PresenceTurnTransition {
  return { state, decision, ...options };
}

function ignored(state: PresenceTurnState, reason: string, turnId?: string) {
  return transition(state, 'ignored', { reason, turnId });
}

function updateTurn(
  state: PresenceTurnState,
  turnId: string,
  update: Partial<PresenceTurnRecord>,
): PresenceTurnState {
  const current = state.turns[turnId];
  if (!current) return state;
  return {
    ...state,
    turns: {
      ...state.turns,
      [turnId]: { ...current, ...update },
    },
  };
}

function resolveTurnId(
  state: PresenceTurnState,
  event: { turnId?: string; requestId?: string },
) {
  if (event.turnId) return event.turnId;
  if (event.requestId) {
    return Object.values(state.turns).find((turn) => turn.requestId === event.requestId)?.turnId;
  }
  return state.activeTurnId ?? undefined;
}

function requestMatches(turn: PresenceTurnRecord, requestId?: string) {
  if (!requestId) return true;
  return turn.requestId === requestId;
}

function pruneTurns(turns: Record<string, PresenceTurnRecord>) {
  const entries = Object.entries(turns);
  if (entries.length <= MAX_RETAINED_TURNS) return turns;
  return Object.fromEntries(entries.slice(entries.length - MAX_RETAINED_TURNS));
}

/**
 * Núcleo puro do Modo Presença.
 *
 * Ele não captura áudio, não chama ferramentas e não fala. Sua única função é
 * preservar identidade e propriedade do turno para que eventos tardios nunca
 * sejam anexados à interação mais recente apenas porque ela está ativa.
 */
export function reducePresenceTurn(
  state: PresenceTurnState,
  event: PresenceTurnEvent,
): PresenceTurnTransition {
  if (event.type === 'session_started') {
    return transition({
      ...createInitialPresenceTurnState(),
      sessionActive: true,
      phase: 'listening',
    }, 'accepted');
  }

  if (event.type === 'session_stopped') {
    const turns = Object.fromEntries(Object.entries(state.turns).map(([turnId, turn]) => [
      turnId,
      { ...turn, narrationAllowed: false },
    ]));
    return transition({
      ...state,
      sessionActive: false,
      phase: 'idle',
      activeTurnId: null,
      audibleTurnId: null,
      turns,
    }, 'accepted');
  }

  if (!state.sessionActive) {
    return ignored(state, 'session_inactive');
  }

  if (event.type === 'turn_opened') {
    if (state.activeTurnId === event.turnId && state.turns[event.turnId]) {
      return ignored(state, 'turn_already_open', event.turnId);
    }

    let turns = state.turns;
    if (state.activeTurnId && state.turns[state.activeTurnId]) {
      const previous = state.turns[state.activeTurnId];
      turns = {
        ...turns,
        [previous.turnId]: { ...previous, narrationAllowed: false },
      };
    }

    turns = pruneTurns({
      ...turns,
      [event.turnId]: {
        turnId: event.turnId,
        status: 'capturing',
        narrationAllowed: true,
        resultNarrationClaimed: false,
      },
    });

    return transition({
      ...state,
      phase: 'capturing',
      activeTurnId: event.turnId,
      audibleTurnId: null,
      turns,
    }, 'accepted', { turnId: event.turnId });
  }

  const eventTurnId = 'turnId' in event ? event.turnId : undefined;

  if (event.type === 'turn_closed') {
    if (eventTurnId !== state.activeTurnId || !state.turns[event.turnId]) {
      return ignored(state, 'stale_turn_close', event.turnId);
    }
    const next = updateTurn(state, event.turnId, { status: 'processing' });
    return transition({ ...next, phase: 'closing' }, 'accepted', { turnId: event.turnId });
  }

  if (event.type === 'transcription_started') {
    if (eventTurnId !== state.activeTurnId || !state.turns[event.turnId]) {
      return ignored(state, 'stale_transcription_start', event.turnId);
    }
    const next = updateTurn(state, event.turnId, { status: 'processing' });
    return transition({ ...next, phase: 'transcribing' }, 'accepted', { turnId: event.turnId });
  }

  if (event.type === 'transcription_ready' || event.type === 'routing_started') {
    if (eventTurnId !== state.activeTurnId || !state.turns[event.turnId]) {
      return ignored(state, 'stale_routing_event', event.turnId);
    }
    const next = updateTurn(state, event.turnId, { status: 'processing' });
    return transition({ ...next, phase: 'routing' }, 'accepted', { turnId: event.turnId });
  }

  if (event.type === 'request_bound') {
    if (event.turnId !== state.activeTurnId || !state.turns[event.turnId]) {
      return ignored(state, 'stale_request_binding', event.turnId);
    }
    const duplicateOwner = Object.values(state.turns).find(
      (turn) => turn.requestId === event.requestId && turn.turnId !== event.turnId,
    );
    if (duplicateOwner) {
      return ignored(state, 'request_already_bound', event.turnId);
    }
    const next = updateTurn(state, event.turnId, {
      requestId: event.requestId,
      status: 'working',
    });
    return transition({ ...next, phase: 'working' }, 'accepted', { turnId: event.turnId });
  }

  if (event.type === 'listening_resumed') {
    if (event.turnId && event.turnId !== state.activeTurnId) {
      return ignored(state, 'stale_listening_resume', event.turnId);
    }
    return transition({ ...state, phase: 'listening', audibleTurnId: null }, 'accepted', {
      turnId: event.turnId ?? state.activeTurnId ?? undefined,
    });
  }

  if (event.type === 'checkpoint_received' || event.type === 'result_received') {
    const turnId = resolveTurnId(state, event);
    if (!turnId) return ignored(state, 'turn_not_found');
    const turn = state.turns[turnId];
    if (!turn) return ignored(state, 'turn_not_found', turnId);
    if (!requestMatches(turn, event.requestId)) {
      return ignored(state, 'request_mismatch', turnId);
    }

    let next = state;
    if (event.type === 'result_received') {
      next = updateTurn(state, turnId, { status: 'completed' });
    }

    const canNarrate = turn.narrationAllowed
      && state.activeTurnId === turnId
      && (event.type !== 'result_received' || !turn.resultNarrationClaimed);
    return transition(next, canNarrate ? 'narrate' : 'chat_only', { turnId });
  }

  if (event.type === 'narration_started') {
    const turn = state.turns[event.turnId];
    if (!turn || !turn.narrationAllowed || state.activeTurnId !== event.turnId) {
      return ignored(state, 'narration_not_owned', event.turnId);
    }
    const next = event.kind === 'result'
      ? updateTurn(state, event.turnId, { resultNarrationClaimed: true })
      : state;
    return transition({
      ...next,
      phase: 'narrating',
      audibleTurnId: event.turnId,
    }, 'accepted', { turnId: event.turnId });
  }

  if (event.type === 'narration_finished') {
    if (state.audibleTurnId !== event.turnId) {
      return ignored(state, 'stale_narration_finish', event.turnId);
    }
    const turn = state.turns[event.turnId];
    const phase: PresenceTurnPhase = turn?.status === 'working' ? 'working' : 'listening';
    return transition({ ...state, phase, audibleTurnId: null }, 'accepted', {
      turnId: event.turnId,
    });
  }

  if (event.type === 'turn_interrupted') {
    const turnId = resolveTurnId(state, event);
    if (!turnId || !state.turns[turnId]) return ignored(state, 'turn_not_found', turnId);
    const next = updateTurn(state, turnId, { narrationAllowed: false });
    return transition({
      ...next,
      phase: state.activeTurnId === turnId ? 'interrupted' : state.phase,
      audibleTurnId: state.audibleTurnId === turnId ? null : state.audibleTurnId,
    }, 'accepted', { turnId });
  }

  if (event.type === 'turn_failed') {
    const turnId = resolveTurnId(state, event);
    if (!turnId || !state.turns[turnId]) return ignored(state, 'turn_not_found', turnId);
    const next = updateTurn(state, turnId, { status: 'failed' });
    return transition({
      ...next,
      phase: state.activeTurnId === turnId ? 'failed' : state.phase,
    }, 'accepted', { turnId });
  }

  return ignored(state, 'unsupported_event');
}

export class PresenceTurnMachine {
  private state = createInitialPresenceTurnState();

  public dispatch(event: PresenceTurnEvent) {
    const result = reducePresenceTurn(this.state, event);
    this.state = result.state;
    return result;
  }

  public getSnapshot() {
    return this.state;
  }

  public findTurnIdByRequestId(requestId: string) {
    return Object.values(this.state.turns).find((turn) => turn.requestId === requestId)?.turnId;
  }
}
