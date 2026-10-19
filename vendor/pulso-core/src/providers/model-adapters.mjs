import { ModelProvider, validateProviderBinding, invariant } from "../domain/contracts.mjs";
import { SecretRefResolver } from "../runtime/secret-ref-resolver.mjs";

function isLoopbackUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export async function defaultHttpTransport(request) {
  const {
    url,
    method = "POST",
    headers = {},
    body = null,
    timeoutMs = 15000,
    allowExternalNetwork = false,
    stream = false
  } = request;

  if (!allowExternalNetwork && !isLoopbackUrl(url)) {
    const err = new Error(`external_network_disabled: refusing non-loopback request to ${url}`);
    err.code = "external_network_disabled";
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let ownershipTransferredToStream = false;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== null && body !== undefined
        ? (typeof body === "string" ? body : JSON.stringify(body))
        : undefined,
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const isSseStream = response.ok && (stream === true || contentType.includes("text/event-stream")) && response.body;

    if (isSseStream) {
      ownershipTransferredToStream = true;
      return {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.body,
        frames: iterateSseFramesFromStream(response.body, () => clearTimeout(timer))
      };
    }

    const rawText = await response.text();
    let parsedJson = null;
    if (contentType.includes("application/json") || (rawText.trim().startsWith("{") && !contentType.includes("text/event-stream"))) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        parsedJson = null;
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      text: rawText,
      json: parsedJson
    };
  } finally {
    if (!ownershipTransferredToStream) {
      clearTimeout(timer);
    }
  }
}

function parseSseFrameBlock(block) {
  const lines = String(block || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  let eventName = "message";
  const dataParts = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trim());
    }
  }
  if (dataParts.length === 0) return null;
  const dataStr = dataParts.join("\n");
  if (dataStr === "[DONE]") {
    return { event: eventName, done: true, data: null };
  }
  try {
    return { event: eventName, done: false, data: JSON.parse(dataStr) };
  } catch {
    return { event: eventName, done: false, raw: dataStr, data: null };
  }
}

function parseSseFrames(rawText) {
  const frames = [];
  const blocks = String(rawText || "").split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const parsed = parseSseFrameBlock(block);
    if (parsed) frames.push(parsed);
  }
  return frames;
}

export async function* iterateSseFramesFromStream(streamSource, onCleanup = null) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    for await (const chunk of streamSource) {
      if (chunk && typeof chunk === "object" && !ArrayBuffer.isView(chunk) && !(chunk instanceof ArrayBuffer)) {
        if ("done" in chunk || "data" in chunk || "raw" in chunk) {
          yield chunk;
          continue;
        }
      }
      const strChunk = typeof chunk === "string"
        ? chunk
        : decoder.decode(chunk, { stream: true });
      buffer += strChunk;

      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const parsed = parseSseFrameBlock(block);
        if (parsed) {
          yield parsed;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const blocks = buffer.split(/\r?\n\r?\n/);
      for (const block of blocks) {
        const parsed = parseSseFrameBlock(block);
        if (parsed) {
          yield parsed;
        }
      }
    }
  } finally {
    if (typeof onCleanup === "function") {
      onCleanup();
    }
  }
}

function normalizeMessages(request) {
  if (Array.isArray(request?.messages) && request.messages.length > 0) {
    return request.messages.map(m => ({
      role: m.role ?? "user",
      content: typeof m.content === "string" ? m.content : String(m.text ?? "")
    }));
  }
  const text = request?.input?.text ?? request?.prompt ?? "";
  invariant(typeof text === "string" && text.length > 0, "input_text_or_messages_required");
  const messages = [];
  if (request?.systemPrompt) {
    messages.push({ role: "system", content: String(request.systemPrompt) });
  }
  messages.push({ role: "user", content: text });
  return messages;
}

class BaseProtocolModelAdapter extends ModelProvider {
  constructor({
    id,
    label,
    adapterKind,
    protocol,
    endpoint,
    defaultModel,
    models = [],
    secretRef = null,
    authRequired = true,
    local = false,
    allowExternalNetwork = false,
    secretResolver = null,
    transport = defaultHttpTransport,
    timeoutMs = 15000,
    clock = () => new Date().toISOString()
  }) {
    super(id, label ?? id);
    this.adapterKind = adapterKind;
    this.protocol = protocol;
    this.endpoint = String(endpoint || "").replace(/\/+$/, "");
    this.defaultModel = defaultModel;
    this.models = Array.isArray(models) && models.length > 0 ? [...models] : [defaultModel];
    this.secretRef = secretRef;
    this.authRequired = Boolean(authRequired);
    this.local = Boolean(local);
    this.allowExternalNetwork = Boolean(allowExternalNetwork);
    this.secretResolver = secretResolver || new SecretRefResolver({ clock });
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.clock = clock;
  }

  getAuthSource() {
    return this.secretResolver.inspectRef(this.secretRef);
  }

  resolveRuntimeSecret() {
    if (!this.secretRef) {
      if (this.authRequired) {
        const err = new Error(`secret_ref_missing_for_provider:${this.id}`);
        err.code = "secret_ref_missing";
        throw err;
      }
      return null;
    }
    return this.secretResolver.resolve(this.secretRef);
  }

  #assertNetworkAllowed(url, reqAllowExternal) {
    const effectiveAllowExternal = reqAllowExternal !== undefined
      ? Boolean(reqAllowExternal)
      : this.allowExternalNetwork;
    if (!effectiveAllowExternal && !isLoopbackUrl(url)) {
      const err = new Error(`external_network_disabled: refusing non-loopback request to ${url}`);
      err.code = "external_network_disabled";
      throw err;
    }
    return effectiveAllowExternal;
  }

  async invokeTransport(req) {
    const allowExternalNetwork = this.#assertNetworkAllowed(req.url, req.allowExternalNetwork);
    const enrichedReq = {
      timeoutMs: this.timeoutMs,
      allowExternalNetwork,
      ...req
    };

    let rawRes;
    if (typeof this.transport === "function") {
      rawRes = await this.transport(enrichedReq);
    } else if (this.transport && typeof this.transport.request === "function") {
      rawRes = await this.transport.request(enrichedReq);
    } else {
      throw new Error("invalid_provider_transport");
    }

    const rawText = typeof rawRes.text === "function"
      ? await rawRes.text()
      : String(rawRes.text ?? "");
    let parsedJson = rawRes.json !== undefined && typeof rawRes.json !== "function"
      ? rawRes.json
      : null;
    if (parsedJson === null && typeof rawRes.json === "function") {
      try {
        parsedJson = await rawRes.json();
      } catch {
        parsedJson = null;
      }
    }
    if (parsedJson === null && rawText.trim().startsWith("{")) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        parsedJson = null;
      }
    }

    return {
      ...rawRes,
      status: rawRes.status ?? (rawRes.ok === false ? 500 : 200),
      ok: rawRes.ok !== undefined ? rawRes.ok : (rawRes.status ?? 200) < 400,
      headers: rawRes.headers ?? {},
      text: rawText,
      json: parsedJson
    };
  }

  async invokeStreamTransport(req) {
    const allowExternalNetwork = this.#assertNetworkAllowed(req.url, req.allowExternalNetwork);
    const enrichedReq = {
      timeoutMs: this.timeoutMs,
      allowExternalNetwork,
      stream: true,
      ...req
    };

    let rawRes;
    if (typeof this.transport === "function") {
      rawRes = await this.transport(enrichedReq);
    } else if (this.transport && typeof this.transport.request === "function") {
      rawRes = await this.transport.request(enrichedReq);
    } else {
      throw new Error("invalid_provider_transport");
    }

    const status = rawRes.status ?? (rawRes.ok === false ? 500 : 200);
    const ok = rawRes.ok !== undefined ? rawRes.ok : status < 400;

    if (!ok || status >= 400) {
      const rawText = typeof rawRes.text === "function"
        ? await rawRes.text()
        : String(rawRes.text ?? "");
      let parsedJson = rawRes.json !== undefined && typeof rawRes.json !== "function"
        ? rawRes.json
        : null;
      if (parsedJson === null && rawText.trim().startsWith("{")) {
        try {
          parsedJson = JSON.parse(rawText);
        } catch {
          parsedJson = null;
        }
      }
      return {
        ...rawRes,
        status,
        ok: false,
        headers: rawRes.headers ?? {},
        text: rawText,
        json: parsedJson,
        frames: []
      };
    }

    let framesIterable;
    if (rawRes.frames && (Array.isArray(rawRes.frames) || typeof rawRes.frames[Symbol.asyncIterator] === "function" || typeof rawRes.frames[Symbol.iterator] === "function")) {
      framesIterable = (async function* () {
        for await (const item of rawRes.frames) {
          if (typeof item === "string") {
            const parsed = parseSseFrameBlock(item);
            if (parsed) yield parsed;
          } else if (item && typeof item === "object") {
            yield item;
          }
        }
      })();
    } else if (rawRes.stream && (typeof rawRes.stream[Symbol.asyncIterator] === "function" || typeof rawRes.stream[Symbol.iterator] === "function")) {
      framesIterable = iterateSseFramesFromStream(rawRes.stream);
    } else if (rawRes.body && (typeof rawRes.body[Symbol.asyncIterator] === "function" || typeof rawRes.body[Symbol.iterator] === "function")) {
      framesIterable = iterateSseFramesFromStream(rawRes.body);
    } else {
      const rawText = typeof rawRes.text === "function"
        ? await rawRes.text()
        : String(rawRes.text ?? "");
      framesIterable = parseSseFrames(rawText);
    }

    return {
      ...rawRes,
      status,
      ok: true,
      headers: rawRes.headers ?? {},
      frames: framesIterable
    };
  }

  buildUrl(subpath) {
    const normalizedSub = subpath.startsWith("/") ? subpath : `/${subpath}`;
    if (this.endpoint.endsWith("/v1") && normalizedSub.startsWith("/v1/")) {
      return `${this.endpoint}${normalizedSub.slice(3)}`;
    }
    return `${this.endpoint}${normalizedSub}`;
  }

  sanitizeFailure(error) {
    const safe = this.secretResolver.redactError(error, this.secretRef);
    const wrapped = new Error(safe.message);
    wrapped.code = safe.code;
    wrapped.providerId = this.id;
    wrapped.adapterKind = this.adapterKind;
    wrapped.authSource = safe.authSource;
    wrapped.redacted = true;
    return wrapped;
  }

  async capabilities() {
    const list = [
      "text",
      "text_completion",
      "streaming",
      ...(this.local ? ["local"] : [])
    ];
    const cap = {
      providerId: this.id,
      adapterKind: this.adapterKind,
      protocol: this.protocol,
      modalities: ["text"],
      streaming: true,
      local: this.local,
      allowExternalNetwork: this.allowExternalNetwork,
      authRequired: this.authRequired,
      defaultModel: this.defaultModel,
      models: [...this.models],
      endpoint: this.endpoint,
      authSource: this.getAuthSource(),
      includes: (feature) => list.includes(feature)
    };
    this.secretResolver.assertZeroLeakage(cap);
    return cap;
  }

  buildProviderBinding(model, externalResponseId, rawResponseId = null) {
    return validateProviderBinding({
      providerType: "model",
      providerId: this.id,
      connectionId: `${this.id}-http`,
      externalRunId: externalResponseId ?? null,
      externalResponseId: rawResponseId ?? externalResponseId ?? null,
      externalSessionId: null,
      boundAt: this.clock(),
      metadata: {
        adapterKind: this.adapterKind,
        protocol: this.protocol,
        model,
        external: {
          responseId: rawResponseId ?? externalResponseId ?? null,
          prefixedId: externalResponseId ?? null
        }
      }
    });
  }
}

export class OpenAIModelAdapter extends BaseProtocolModelAdapter {
  constructor(options = {}) {
    super({
      id: options.id ?? "openai",
      label: options.label ?? "OpenAI API",
      adapterKind: "openai",
      protocol: "openai_chat_completions",
      endpoint: options.endpoint ?? "https://api.openai.com",
      defaultModel: options.defaultModel ?? "gpt-4o-mini",
      models: options.models ?? ["gpt-4o-mini", "gpt-4o"],
      secretRef: options.secretRef !== undefined ? options.secretRef : "env:OPENAI_API_KEY",
      authRequired: options.authRequired !== undefined ? options.authRequired : true,
      local: false,
      allowExternalNetwork: options.allowExternalNetwork ?? false,
      secretResolver: options.secretResolver,
      transport: options.transport,
      timeoutMs: options.timeoutMs,
      clock: options.clock
    });
  }

  async health() {
    const checkedAt = this.clock();
    const authSource = this.getAuthSource();
    try {
      const secret = this.resolveRuntimeSecret();
      const response = await this.invokeTransport({
        url: this.buildUrl("/v1/models"),
        method: "GET",
        headers: {
          authorization: `Bearer ${secret}`,
          accept: "application/json"
        }
      });

      if (response.status >= 400) {
        const errText = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`openai_health_http_${response.status}:${errText}`), {
          code: `http_${response.status}`
        });
      }

      const report = {
        status: "healthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        checkedAt,
        authSource,
        detail: "openai_models_endpoint_ok"
      };
      this.secretResolver.assertZeroLeakage(report);
      return report;
    } catch (error) {
      const safeErr = this.secretResolver.redactError(error, this.secretRef);
      const report = {
        status: "unhealthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        checkedAt,
        authSource,
        detail: safeErr.message,
        error: safeErr
      };
      this.secretResolver.assertZeroLeakage(report);
      return report;
    }
  }

  async complete(request) {
    if (request?.stream === true) {
      const chunks = [];
      let finalEvent = null;
      for await (const event of this.stream(request)) {
        if (event.type === "delta" || event.type === "model.delta") chunks.push(event);
        if (event.type === "completed" || event.type === "model.completed") finalEvent = event;
      }
      invariant(finalEvent, "openai_stream_missing_completion");
      return {
        ...finalEvent,
        streamed: true,
        chunksCount: chunks.length
      };
    }

    try {
      const secret = this.resolveRuntimeSecret();
      const model = request?.model ?? this.defaultModel;
      const messages = normalizeMessages(request);

      const response = await this.invokeTransport({
        url: this.buildUrl("/v1/chat/completions"),
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`
        },
        body: {
          model,
          messages,
          temperature: request?.temperature ?? 0,
          max_tokens: request?.maxTokens ?? 512,
          stream: false
        }
      });

      if (response.status >= 400) {
        const errMsg = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`openai_http_${response.status}:${errMsg}`), {
          code: `http_${response.status}`
        });
      }

      const body = response.json ?? JSON.parse(response.text);
      const choice = body.choices?.[0];
      const text = choice?.message?.content ?? "";
      const finishReason = choice?.finish_reason ?? "stop";
      const inputTokens = body.usage?.prompt_tokens ?? messages.reduce((acc, m) => acc + m.content.length, 0);
      const outputTokens = body.usage?.completion_tokens ?? text.length;
      const externalId = body.id ? `ext_openai_${body.id}` : null;

      const result = {
        providerId: this.id,
        adapterKind: this.adapterKind,
        model: body.model ?? model,
        text,
        outputText: text,
        finishReason,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputUnits: inputTokens,
          outputUnits: outputTokens
        },
        providerBinding: this.buildProviderBinding(body.model ?? model, externalId, body.id ?? null)
      };

      this.secretResolver.assertZeroLeakage(result);
      return result;
    } catch (error) {
      throw this.sanitizeFailure(error);
    }
  }

  async *stream(request) {
    try {
      const secret = this.resolveRuntimeSecret();
      const model = request?.model ?? this.defaultModel;
      const messages = normalizeMessages(request);

      const response = await this.invokeStreamTransport({
        url: this.buildUrl("/v1/chat/completions"),
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          authorization: `Bearer ${secret}`
        },
        body: {
          model,
          messages,
          temperature: request?.temperature ?? 0,
          max_tokens: request?.maxTokens ?? 512,
          stream: true
        }
      });

      if (response.status >= 400) {
        const errMsg = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`openai_stream_http_${response.status}:${errMsg}`), {
          code: `http_${response.status}`
        });
      }

      let fullText = "";
      let index = 0;
      let externalId = null;
      let rawId = null;
      let resolvedModel = model;
      let usage = null;

      for await (const frame of response.frames) {
        if (frame.done) break;
        const payload = frame.data;
        if (!payload) continue;
        if (payload.id) {
          rawId = payload.id;
          externalId = `ext_openai_${payload.id}`;
        }
        if (payload.model) resolvedModel = payload.model;
        if (payload.usage) {
          usage = {
            inputTokens: payload.usage.prompt_tokens ?? 0,
            outputTokens: payload.usage.completion_tokens ?? 0
          };
        }
        const delta = payload.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          fullText += delta;
          const deltaEvent = {
            type: "model.delta",
            kind: "delta",
            providerId: this.id,
            adapterKind: this.adapterKind,
            model: resolvedModel,
            text: delta,
            delta,
            index: index++
          };
          this.secretResolver.assertZeroLeakage(deltaEvent);
          yield deltaEvent;
        }
      }

      const inputTokens = usage?.inputTokens ?? messages.reduce((acc, m) => acc + m.content.length, 0);
      const outputTokens = usage?.outputTokens ?? fullText.length;

      const completedEvent = {
        type: "model.completed",
        kind: "completed",
        providerId: this.id,
        adapterKind: this.adapterKind,
        model: resolvedModel,
        text: fullText,
        outputText: fullText,
        finishReason: "stop",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputUnits: inputTokens,
          outputUnits: outputTokens
        },
        providerBinding: this.buildProviderBinding(resolvedModel, externalId, rawId)
      };
      this.secretResolver.assertZeroLeakage(completedEvent);
      yield completedEvent;
    } catch (error) {
      throw this.sanitizeFailure(error);
    }
  }
}

export class AnthropicModelAdapter extends BaseProtocolModelAdapter {
  constructor(options = {}) {
    super({
      id: options.id ?? "anthropic",
      label: options.label ?? "Anthropic API",
      adapterKind: "anthropic",
      protocol: "anthropic_messages",
      endpoint: options.endpoint ?? "https://api.anthropic.com",
      defaultModel: options.defaultModel ?? "claude-3-5-sonnet-latest",
      models: options.models ?? ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
      secretRef: options.secretRef !== undefined ? options.secretRef : "env:ANTHROPIC_API_KEY",
      authRequired: options.authRequired !== undefined ? options.authRequired : true,
      local: false,
      allowExternalNetwork: options.allowExternalNetwork ?? false,
      secretResolver: options.secretResolver,
      transport: options.transport,
      timeoutMs: options.timeoutMs,
      clock: options.clock
    });
    this.anthropicVersion = options.anthropicVersion ?? "2023-06-01";
  }

  async health() {
    const checkedAt = this.clock();
    const authSource = this.getAuthSource();
    try {
      const secret = this.resolveRuntimeSecret();
      const response = await this.invokeTransport({
        url: this.buildUrl("/v1/models"),
        method: "GET",
        headers: {
          "x-api-key": secret,
          "anthropic-version": this.anthropicVersion,
          accept: "application/json"
        }
      });

      if (response.status >= 400) {
        const errText = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`anthropic_health_http_${response.status}:${errText}`), {
          code: `http_${response.status}`
        });
      }

      const report = {
        status: "healthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        checkedAt,
        authSource,
        detail: "anthropic_endpoint_ok"
      };
      this.secretResolver.assertZeroLeakage(report);
      return report;
    } catch (error) {
      const safeErr = this.secretResolver.redactError(error, this.secretRef);
      const report = {
        status: "unhealthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        checkedAt,
        authSource,
        detail: safeErr.message,
        error: safeErr
      };
      this.secretResolver.assertZeroLeakage(report);
      return report;
    }
  }

  async complete(request) {
    if (request?.stream === true) {
      const chunks = [];
      let finalEvent = null;
      for await (const event of this.stream(request)) {
        if (event.type === "delta" || event.type === "model.delta") chunks.push(event);
        if (event.type === "completed" || event.type === "model.completed") finalEvent = event;
      }
      invariant(finalEvent, "anthropic_stream_missing_completion");
      return {
        ...finalEvent,
        streamed: true,
        chunksCount: chunks.length
      };
    }

    try {
      const secret = this.resolveRuntimeSecret();
      const model = request?.model ?? this.defaultModel;
      const allMessages = normalizeMessages(request);
      const systemMessages = allMessages.filter(m => m.role === "system").map(m => m.content);
      const userAssistantMessages = allMessages.filter(m => m.role !== "system");

      const bodyPayload = {
        model,
        max_tokens: request?.maxTokens ?? 512,
        messages: userAssistantMessages,
        stream: false
      };
      if (systemMessages.length > 0) {
        bodyPayload.system = systemMessages.join("\n");
      }

      const response = await this.invokeTransport({
        url: this.buildUrl("/v1/messages"),
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": secret,
          "anthropic-version": this.anthropicVersion
        },
        body: bodyPayload
      });

      if (response.status >= 400) {
        const errMsg = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`anthropic_http_${response.status}:${errMsg}`), {
          code: `http_${response.status}`
        });
      }

      const body = response.json ?? JSON.parse(response.text);
      const textBlocks = Array.isArray(body.content)
        ? body.content.filter(b => b.type === "text" || typeof b.text === "string").map(b => b.text)
        : [];
      const text = textBlocks.join("");
      const finishReason = body.stop_reason ?? "end_turn";
      const inputTokens = body.usage?.input_tokens ?? userAssistantMessages.reduce((acc, m) => acc + m.content.length, 0);
      const outputTokens = body.usage?.output_tokens ?? text.length;
      const externalId = body.id ? `ext_anthropic_${body.id}` : null;

      const result = {
        providerId: this.id,
        adapterKind: this.adapterKind,
        model: body.model ?? model,
        text,
        outputText: text,
        finishReason,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputUnits: inputTokens,
          outputUnits: outputTokens
        },
        providerBinding: this.buildProviderBinding(body.model ?? model, externalId, body.id ?? null)
      };

      this.secretResolver.assertZeroLeakage(result);
      return result;
    } catch (error) {
      throw this.sanitizeFailure(error);
    }
  }

  async *stream(request) {
    try {
      const secret = this.resolveRuntimeSecret();
      const model = request?.model ?? this.defaultModel;
      const allMessages = normalizeMessages(request);
      const systemMessages = allMessages.filter(m => m.role === "system").map(m => m.content);
      const userAssistantMessages = allMessages.filter(m => m.role !== "system");

      const bodyPayload = {
        model,
        max_tokens: request?.maxTokens ?? 512,
        messages: userAssistantMessages,
        stream: true
      };
      if (systemMessages.length > 0) {
        bodyPayload.system = systemMessages.join("\n");
      }

      const response = await this.invokeStreamTransport({
        url: this.buildUrl("/v1/messages"),
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "x-api-key": secret,
          "anthropic-version": this.anthropicVersion
        },
        body: bodyPayload
      });

      if (response.status >= 400) {
        const errMsg = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`anthropic_stream_http_${response.status}:${errMsg}`), {
          code: `http_${response.status}`
        });
      }

      let fullText = "";
      let index = 0;
      let externalId = null;
      let rawId = null;
      let resolvedModel = model;
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const frame of response.frames) {
        if (frame.done) break;
        const payload = frame.data;
        if (!payload) continue;
        if (payload.message?.id) {
          rawId = payload.message.id;
          externalId = `ext_anthropic_${payload.message.id}`;
        }
        if (payload.message?.model) resolvedModel = payload.message.model;
        if (payload.message?.usage?.input_tokens) inputTokens = payload.message.usage.input_tokens;
        if (payload.usage?.output_tokens) outputTokens = payload.usage.output_tokens;

        const deltaText = payload.delta?.text ?? (payload.type === "content_block_delta" ? payload.delta?.text : null);
        if (typeof deltaText === "string" && deltaText.length > 0) {
          fullText += deltaText;
          const deltaEvent = {
            type: "model.delta",
            kind: "delta",
            providerId: this.id,
            adapterKind: this.adapterKind,
            model: resolvedModel,
            text: deltaText,
            delta: deltaText,
            index: index++
          };
          this.secretResolver.assertZeroLeakage(deltaEvent);
          yield deltaEvent;
        }
      }

      if (!inputTokens) inputTokens = userAssistantMessages.reduce((acc, m) => acc + m.content.length, 0);
      if (!outputTokens) outputTokens = fullText.length;

      const completedEvent = {
        type: "model.completed",
        kind: "completed",
        providerId: this.id,
        adapterKind: this.adapterKind,
        model: resolvedModel,
        text: fullText,
        outputText: fullText,
        finishReason: "end_turn",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputUnits: inputTokens,
          outputUnits: outputTokens
        },
        providerBinding: this.buildProviderBinding(resolvedModel, externalId, rawId)
      };
      this.secretResolver.assertZeroLeakage(completedEvent);
      yield completedEvent;
    } catch (error) {
      throw this.sanitizeFailure(error);
    }
  }
}

export class LocalOpenAICompatibleAdapter extends BaseProtocolModelAdapter {
  constructor(options = {}) {
    super({
      id: options.id ?? "local-openai",
      label: options.label ?? "Local OpenAI-Compatible Engine",
      adapterKind: "local_openai_compatible",
      protocol: "openai_compatible_local",
      endpoint: options.endpoint ?? "http://127.0.0.1:11434",
      defaultModel: options.defaultModel ?? "qwen2.5-coder:7b",
      models: options.models ?? ["qwen2.5-coder:7b", "llama3.2:3b"],
      secretRef: options.secretRef ?? null,
      authRequired: Boolean(options.authRequired ?? Boolean(options.secretRef)),
      local: true,
      allowExternalNetwork: options.allowExternalNetwork ?? false,
      secretResolver: options.secretResolver,
      transport: options.transport,
      timeoutMs: options.timeoutMs,
      clock: options.clock
    });
    this.architecture = options.architecture ?? "x86_64-neutral";
  }

  async capabilities() {
    const base = await super.capabilities();
    return {
      ...base,
      architecture: this.architecture
    };
  }

  async health() {
    const checkedAt = this.clock();
    const authSource = this.getAuthSource();
    try {
      const secret = this.resolveRuntimeSecret();
      const headers = { accept: "application/json" };
      if (secret) {
        headers.authorization = `Bearer ${secret}`;
      }

      const response = await this.invokeTransport({
        url: this.buildUrl("/v1/models"),
        method: "GET",
        headers
      });

      if (response.status >= 400) {
        const errText = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`local_openai_health_http_${response.status}:${errText}`), {
          code: `http_${response.status}`
        });
      }

      const report = {
        status: "healthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        local: true,
        architecture: this.architecture,
        checkedAt,
        authSource,
        detail: "local_openai_compatible_endpoint_ok"
      };
      this.secretResolver.assertZeroLeakage(report);
      return report;
    } catch (error) {
      const safeErr = this.secretResolver.redactError(error, this.secretRef);
      const report = {
        status: "unhealthy",
        providerId: this.id,
        adapterKind: this.adapterKind,
        local: true,
        architecture: this.architecture,
        checkedAt,
        authSource,
        detail: safeErr.message,
        error: safeErr
      };
      this.secretResolver.assertZeroLeakage(report);
      return report;
    }
  }

  async complete(request) {
    if (request?.stream === true) {
      const chunks = [];
      let finalEvent = null;
      for await (const event of this.stream(request)) {
        if (event.type === "delta" || event.type === "model.delta") chunks.push(event);
        if (event.type === "completed" || event.type === "model.completed") finalEvent = event;
      }
      invariant(finalEvent, "local_openai_stream_missing_completion");
      return {
        ...finalEvent,
        streamed: true,
        chunksCount: chunks.length
      };
    }

    try {
      const secret = this.resolveRuntimeSecret();
      const model = request?.model ?? this.defaultModel;
      const messages = normalizeMessages(request);
      const headers = { "content-type": "application/json" };
      if (secret) {
        headers.authorization = `Bearer ${secret}`;
      }

      const response = await this.invokeTransport({
        url: this.buildUrl("/v1/chat/completions"),
        method: "POST",
        headers,
        body: {
          model,
          messages,
          temperature: request?.temperature ?? 0,
          max_tokens: request?.maxTokens ?? 512,
          stream: false
        }
      });

      if (response.status >= 400) {
        const errMsg = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`local_openai_http_${response.status}:${errMsg}`), {
          code: `http_${response.status}`
        });
      }

      const body = response.json ?? JSON.parse(response.text);
      const choice = body.choices?.[0];
      const text = choice?.message?.content ?? "";
      const finishReason = choice?.finish_reason ?? "stop";
      const inputTokens = body.usage?.prompt_tokens ?? messages.reduce((acc, m) => acc + m.content.length, 0);
      const outputTokens = body.usage?.completion_tokens ?? text.length;
      const externalId = body.id ? `ext_local_${body.id}` : null;

      const result = {
        providerId: this.id,
        adapterKind: this.adapterKind,
        local: true,
        model: body.model ?? model,
        text,
        outputText: text,
        finishReason,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputUnits: inputTokens,
          outputUnits: outputTokens
        },
        providerBinding: this.buildProviderBinding(body.model ?? model, externalId, body.id ?? null)
      };

      this.secretResolver.assertZeroLeakage(result);
      return result;
    } catch (error) {
      throw this.sanitizeFailure(error);
    }
  }

  async *stream(request) {
    try {
      const secret = this.resolveRuntimeSecret();
      const model = request?.model ?? this.defaultModel;
      const messages = normalizeMessages(request);
      const headers = {
        "content-type": "application/json",
        accept: "text/event-stream"
      };
      if (secret) {
        headers.authorization = `Bearer ${secret}`;
      }

      const response = await this.invokeStreamTransport({
        url: this.buildUrl("/v1/chat/completions"),
        method: "POST",
        headers,
        body: {
          model,
          messages,
          temperature: request?.temperature ?? 0,
          max_tokens: request?.maxTokens ?? 512,
          stream: true
        }
      });

      if (response.status >= 400) {
        const errMsg = response.json?.error?.message ?? response.text ?? `HTTP ${response.status}`;
        throw Object.assign(new Error(`local_openai_stream_http_${response.status}:${errMsg}`), {
          code: `http_${response.status}`
        });
      }

      let fullText = "";
      let index = 0;
      let externalId = null;
      let rawId = null;
      let resolvedModel = model;

      for await (const frame of response.frames) {
        if (frame.done) break;
        const payload = frame.data;
        if (!payload) continue;
        if (payload.id) {
          rawId = payload.id;
          externalId = `ext_local_${payload.id}`;
        }
        if (payload.model) resolvedModel = payload.model;
        const delta = payload.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          fullText += delta;
          const deltaEvent = {
            type: "model.delta",
            kind: "delta",
            providerId: this.id,
            adapterKind: this.adapterKind,
            local: true,
            model: resolvedModel,
            text: delta,
            delta,
            index: index++
          };
          this.secretResolver.assertZeroLeakage(deltaEvent);
          yield deltaEvent;
        }
      }

      const inputTokens = messages.reduce((acc, m) => acc + m.content.length, 0);
      const outputTokens = fullText.length;

      const completedEvent = {
        type: "model.completed",
        kind: "completed",
        providerId: this.id,
        adapterKind: this.adapterKind,
        local: true,
        model: resolvedModel,
        text: fullText,
        outputText: fullText,
        finishReason: "stop",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputUnits: inputTokens,
          outputUnits: outputTokens
        },
        providerBinding: this.buildProviderBinding(resolvedModel, externalId, rawId)
      };
      this.secretResolver.assertZeroLeakage(completedEvent);
      yield completedEvent;
    } catch (error) {
      throw this.sanitizeFailure(error);
    }
  }
}

export {
  OpenAIModelAdapter as OpenAIProviderAdapter,
  AnthropicModelAdapter as AnthropicProviderAdapter,
  LocalOpenAICompatibleAdapter as LocalModelAdapter
};

