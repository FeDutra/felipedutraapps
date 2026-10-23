export const BRIDGE_METHODS = Object.freeze([
  'bootstrap',
  'snapshot',
  'health',
  'shutdown',
  'runtime.start',
  'runtime.stop',
  'control.command',
  'provider.configure',
  'provider.select',
  'provider.test',
  'provider.remove',
  'provider.secret.inject',
  'provider.subscription.login.start',
  'provider.subscription.login.cancel',
  'provider.subscription.account.read',
  'provider.subscription.logout',
  'provider.subscription.models.list',
  'identity.inspect',
  'identity.private.install',
  'access.mode.read',
  'access.mode.set',
  'legacy.import.plan',
  'legacy.import.apply',
  'outbox.enqueue',
  'outbox.drain',
  'outbox.cancel',
  'agent.create_blueprint',
  'agent.publish_revision',
  'agent.materialize',
  'agent.transition',
  'agent.list',
  'agent.get',
  'agent.run.start',
  'agent.run.cancel',
  'agent.delegate',
  'agent.constellation.plan',
  'agent.constellation.apply',
  'sync.status',
  'sync.device.manifest',
  'sync.device.trust',
  'sync.device.revoke',
  'sync.bundle.export',
  'sync.bundle.import',
  'sync.folder.configure',
  'sync.folder.status',
  'sync.folder.push',
  'sync.folder.pull',
  'memory.remember',
  'memory.search',
  'memory.list',
  'memory.forget',
  'skill.status',
  'skill.list',
  'skill.set_enabled',
  'automation.status',
  'automation.import',
  'automation.create',
  'automation.update',
  'automation.list',
  'automation.runs',
  'automation.run',
  'automation.tick',
  'channel.register',
  'channel.webhook.configure',
  'channel.whatsapp.configure',
  'channel.list',
  'channel.receive',
  'channel.send',
  'channel.history',
  'archive.status',
  'archive.search',
  'audit.list',
  'live.bootstrap',
  'live.topology.ensure',
  'live.areas.list',
  'live.area.create',
  'live.sessions.list',
  'live.session.create',
  'live.session.select',
  'live.message.append',
  'live.messages.list',
  'live.turn.start',
  'live.turn.poll',
  'live.turn.cancel',
  'live.turn.resume',
  'live.turn.get',
  'live.turn.list'
]);

const METHOD_SET = new Set(BRIDGE_METHODS);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return Object.freeze(obj);
}

export function validateBridgeRequest(req) {
  if (req === null || typeof req !== 'object' || Array.isArray(req)) {
    throw new TypeError('Request must be a non-null object');
  }

  if (typeof req.requestId !== 'string' || req.requestId.trim().length === 0) {
    throw new TypeError('Request requestId must be a non-empty string');
  }

  if (typeof req.method !== 'string' || !METHOD_SET.has(req.method)) {
    throw new Error(`Unknown or invalid bridge method: ${req.method}`);
  }

  if (req.params === null || typeof req.params !== 'object' || Array.isArray(req.params)) {
    throw new TypeError('Request params must be a plain object');
  }

  const clonedParams = deepFreeze(structuredClone(req.params));
  return Object.freeze({
    requestId: req.requestId,
    method: req.method,
    params: clonedParams
  });
}

export function validateBridgeResponse(res) {
  if (res === null || typeof res !== 'object' || Array.isArray(res)) {
    throw new TypeError('Response must be a non-null object');
  }

  if (typeof res.requestId !== 'string' || res.requestId.trim().length === 0) {
    throw new TypeError('Response requestId must be a non-empty string');
  }

  if (typeof res.ok !== 'boolean') {
    throw new TypeError('Response ok must be a boolean');
  }

  if (res.ok) {
    if (!('result' in res)) {
      throw new TypeError('Successful response must include a result property');
    }
    const clonedResult = res.result !== null && typeof res.result === 'object'
      ? deepFreeze(structuredClone(res.result))
      : res.result;

    return Object.freeze({
      requestId: res.requestId,
      ok: true,
      result: clonedResult
    });
  } else {
    if (res.error === null || typeof res.error !== 'object' || Array.isArray(res.error)) {
      throw new TypeError('Error response must include an error object');
    }

    if (typeof res.error.code !== 'string' || res.error.code.trim().length === 0) {
      throw new TypeError('Response error.code must be a non-empty string');
    }

    if (typeof res.error.message !== 'string') {
      throw new TypeError('Response error.message must be a string');
    }

    if (typeof res.error.retryable !== 'boolean') {
      throw new TypeError('Response error.retryable must be a boolean');
    }

    const clonedError = Object.freeze({
      code: res.error.code,
      message: res.error.message,
      retryable: res.error.retryable
    });

    return Object.freeze({
      requestId: res.requestId,
      ok: false,
      error: clonedError
    });
  }
}
