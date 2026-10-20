export function emptyProjection() {
  return {
    sessions: new Map(),
    turns: new Map(),
    runs: new Map(),
    artifacts: new Map(),
    deliveries: new Map()
  };
}

export function project(events, state = emptyProjection()) {
  for (const event of events) applyEvent(state, event);
  return state;
}

export function applyEvent(state, event) {
  const p = event.payload;
  switch (event.type) {
    case "session.created":
      state.sessions.set(event.aggregate.id, { ...p, sessionId: event.aggregate.id, status: "active" });
      break;
    case "turn.accepted":
      state.turns.set(event.aggregate.id, { ...p, turnId: event.aggregate.id, status: "accepted" });
      break;
    case "turn.routed":
      Object.assign(state.turns.get(event.aggregate.id), { route: p.route, status: "active" });
      break;
    case "turn.delivery_started":
      Object.assign(state.turns.get(event.aggregate.id), { status: "delivering" });
      break;
    case "turn.completed":
    case "turn.failed":
    case "turn.cancelled":
      Object.assign(state.turns.get(event.aggregate.id), { status: event.type.split(".")[1], result: p.result ?? null });
      break;
    case "run.created":
      state.runs.set(event.aggregate.id, { ...p, runId: event.aggregate.id, status: "queued", progress: [] });
      break;
    case "run.started":
      Object.assign(state.runs.get(event.aggregate.id), { status: "running", providerBinding: p.providerBinding });
      break;
    case "run.progressed":
      state.runs.get(event.aggregate.id).progress.push(p);
      break;
    case "run.steered":
      state.runs.get(event.aggregate.id).steering = state.runs.get(event.aggregate.id).steering ?? [];
      state.runs.get(event.aggregate.id).steering.push(p);
      break;
    case "run.succeeded":
    case "run.failed":
    case "run.cancelled":
    case "run.timed_out":
      Object.assign(state.runs.get(event.aggregate.id), { status: event.type.split(".")[1], result: p.result ?? null, error: p.error ?? null });
      break;
    case "artifact.created":
      state.artifacts.set(event.aggregate.id, { ...p, artifactId: event.aggregate.id });
      break;
    case "delivery.completed":
      state.deliveries.set(event.aggregate.id, { ...p, deliveryId: event.aggregate.id, status: "completed" });
      break;
  }
  return state;
}
