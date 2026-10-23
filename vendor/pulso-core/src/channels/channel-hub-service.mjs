import { eventDraft, invariant, pulsoId } from "../domain/contracts.mjs";

const ACTOR = Object.freeze({ kind: "system", id: "pulso-channel-hub" });

export class LoopbackChannelAdapter {
  constructor(id = "pulso-local") { this.id = id; }
  async send(message) { return { externalId: `loopback:${message.messageId}`, deliveredAt: new Date().toISOString() }; }
}

export class WebhookChannelAdapter {
  constructor({ endpoint, headers = {}, fetchImpl = globalThis.fetch } = {}) {
    invariant(/^https:\/\//.test(String(endpoint || "")) || /^http:\/\/127\.0\.0\.1(?::\d+)?\//.test(String(endpoint || "")), "secure_channel_endpoint_required");
    invariant(typeof fetchImpl === "function", "fetch_unavailable");
    this.endpoint = endpoint; this.headers = headers; this.fetchImpl = fetchImpl;
  }
  async send(message) {
    const response = await this.fetchImpl(this.endpoint, { method: "POST", headers: { "content-type": "application/json", ...this.headers }, body: JSON.stringify({ messageId: message.messageId, target: message.target, text: message.text, attachments: message.attachments }) });
    invariant(response.ok, `channel_delivery_failed:${response.status}`);
    return { externalId: response.headers?.get?.("x-message-id") || null, status: response.status, deliveredAt: new Date().toISOString() };
  }
}

export class WhatsAppLocalChannelAdapter {
  constructor({ endpoint = "http://127.0.0.1:3002/send", fetchImpl = globalThis.fetch } = {}) {
    invariant(/^http:\/\/127\.0\.0\.1(?::\d+)?\/send$/.test(String(endpoint)), "whatsapp_local_endpoint_required");
    invariant(typeof fetchImpl === "function", "fetch_unavailable");
    this.endpoint = endpoint; this.fetchImpl = fetchImpl;
  }
  async send(message) {
    const to = typeof message.target === "string" ? message.target : message.target?.id;
    invariant(typeof to === "string" && to.trim(), "whatsapp_target_required");
    const response = await this.fetchImpl(this.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, message: message.text }) });
    const payload = await response.json().catch(() => ({}));
    invariant(response.ok && payload.success !== false, `whatsapp_delivery_failed:${response.status}`);
    return { externalId: payload.messageId || null, status: response.status, deliveredAt: new Date().toISOString() };
  }
}

export class ChannelHubService {
  constructor({ store, clock = () => new Date().toISOString() } = {}) {
    invariant(store, "event_store_required");
    this.store = store;
    this.clock = clock;
    this.channels = new Map();
    this.messages = new Map();
    this.adapters = new Map();
    this.registerAdapter("pulso-local", new LoopbackChannelAdapter());
    this.restore();
    if (!this.channels.has("pulso-local")) this.register({ channelId: "pulso-local", kind: "local", label: "PULSO local", status: "ready" });
  }

  restore() {
    this.channels.clear(); this.messages.clear();
    for (const event of this.store.all().filter(item => item.type.startsWith("channel."))) {
      if (event.type === "channel.registered" || event.type === "channel.state_changed") this.channels.set(event.payload.channelId, structuredClone(event.payload));
      if (event.type === "channel.message_received" || event.type === "channel.message_sent") this.messages.set(event.payload.messageId, structuredClone(event.payload));
    }
  }

  registerAdapter(channelId, adapter) { invariant(adapter && typeof adapter.send === "function", "channel_adapter_send_required"); this.adapters.set(channelId, adapter); }

  configureWebhook({ channelId, endpoint, headers = {}, fetchImpl = null } = {}) {
    invariant(this.channels.has(channelId), `channel_not_found:${channelId}`);
    this.registerAdapter(channelId, new WebhookChannelAdapter({ endpoint, headers, fetchImpl: fetchImpl || globalThis.fetch }));
    return this.register({ ...this.channels.get(channelId), channelId, status: "ready" });
  }

  configureWhatsAppLocal({ channelId = "whatsapp", endpoint = "http://127.0.0.1:3002/send", fetchImpl = null } = {}) {
    if (!this.channels.has(channelId)) this.register({ channelId, kind: "whatsapp", label: "WhatsApp", status: "needs_auth" });
    this.registerAdapter(channelId, new WhatsAppLocalChannelAdapter({ endpoint, fetchImpl: fetchImpl || globalThis.fetch }));
    return this.register({ ...this.channels.get(channelId), channelId, kind: "whatsapp", status: "ready", capabilities: ["receive", "send"] });
  }

  register(input = {}) {
    const channelId = String(input.channelId || "").trim(); invariant(channelId, "channel_id_required");
    const occurredAt = this.clock();
    const payload = { channelId, kind: input.kind || "custom", label: input.label || channelId, status: input.status || (this.adapters.has(channelId) ? "ready" : "needs_auth"), capabilities: input.capabilities || ["receive", "send"], updatedAt: occurredAt };
    const result = this.store.append([eventDraft({ type: "channel.registered", aggregateType: "channel", aggregateId: channelId, correlationId: pulsoId("chncmd"), actor: ACTOR, occurredAt, payload })]);
    this.channels.set(channelId, structuredClone(payload));
    return { channel: structuredClone(payload), events: result.events };
  }

  list() { return [...this.channels.values()].map(item => structuredClone(item)); }

  history({ channelId = null, limit = 100 } = {}) { return [...this.messages.values()].filter(item => !channelId || item.channelId === channelId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-limit).map(item => structuredClone(item)); }

  receive(input = {}) {
    const channelId = input.channelId || "pulso-local"; invariant(this.channels.has(channelId), `channel_not_found:${channelId}`);
    const messageId = input.messageId || pulsoId("chnmsg"); const createdAt = this.clock();
    const payload = { messageId, channelId, direction: "inbound", sender: input.sender || { id: "fe" }, text: String(input.text || ""), attachments: input.attachments || [], state: "received", createdAt };
    invariant(payload.text || payload.attachments.length, "channel_message_content_required");
    const result = this.store.append([eventDraft({ type: "channel.message_received", aggregateType: "channel_message", aggregateId: messageId, correlationId: pulsoId("chncmd"), actor: input.actor || { kind: "human", id: payload.sender.id || "fe" }, occurredAt: createdAt, payload })]);
    this.messages.set(messageId, structuredClone(payload)); return { message: payload, events: result.events };
  }

  async send(input = {}) {
    const channelId = input.channelId || "pulso-local"; const channel = this.channels.get(channelId); invariant(channel, `channel_not_found:${channelId}`);
    const adapter = this.adapters.get(channelId); invariant(adapter, `channel_adapter_unavailable:${channelId}`);
    const messageId = input.messageId || pulsoId("chnmsg"); const createdAt = this.clock();
    const draft = { messageId, channelId, direction: "outbound", target: input.target || { id: "fe" }, text: String(input.text || ""), attachments: input.attachments || [], state: "sending", createdAt };
    invariant(draft.text || draft.attachments.length, "channel_message_content_required");
    const receipt = await adapter.send(draft);
    const payload = { ...draft, state: "delivered", receipt };
    const result = this.store.append([eventDraft({ type: "channel.message_sent", aggregateType: "channel_message", aggregateId: messageId, correlationId: pulsoId("chncmd"), actor: input.actor || ACTOR, occurredAt: createdAt, payload })]);
    this.messages.set(messageId, structuredClone(payload)); return { message: payload, receipt, events: result.events };
  }
}
