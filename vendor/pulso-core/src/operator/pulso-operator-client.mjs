import { invariant } from "../domain/contracts.mjs";

const DEFAULT_TIMEOUT_MS = 20_000;
const JID_PATTERN = /^\d{6,18}@(s\.whatsapp\.net|g\.us)$/;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function boundedText(value, limit) {
  const text = String(value ?? "");
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

export function pulsoOperatorDynamicTools() {
  return [
    {
      name: "pulso_operator_whatsapp_read",
      description: "Consulta mensagens recentes de uma conversa WhatsApp já sincronizada. Somente leitura; nunca envia, marca como lida ou altera a conversa.",
      capability: "tool.whatsapp.read",
      source: "pulso_operator_runtime",
      risk: "connector_read",
      inputSchema: {
        type: "object",
        properties: {
          contact: { type: "string", description: "Nome, alias ou JID canônico da conversa." },
          jid: { type: "string", description: "JID canônico já conhecido, quando disponível." },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "pulso_operator_whatsapp_prepare",
      description: "Registra uma minuta de resposta WhatsApp para revisão humana. Não envia mensagem e não altera a conversa.",
      capability: "tool.whatsapp.prepare",
      source: "pulso_core",
      risk: "draft_only",
      inputSchema: {
        type: "object",
        properties: {
          jid: { type: "string", description: "JID canônico do destinatário." },
          draft: { type: "string", description: "Texto integral da minuta." },
          replyToMessageId: { type: "string", description: "ID opcional da mensagem de referência." },
        },
        required: ["jid", "draft"],
        additionalProperties: false,
      },
    },
    {
      name: "pulso_operator_devices_status",
      description: "Consulta o estado operacional dos Macs canônicos sem abrir janelas, tomar foco ou executar comandos neles.",
      capability: "tool.devices.status",
      source: "pulso_operator_runtime",
      risk: "connector_read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "pulso_operator_jobs_list",
      description: "Lista jobs e watchdogs do scheduler oficial, incluindo agenda e último estado. Somente leitura; não executa nem altera rotinas.",
      capability: "tool.jobs.read",
      source: "pulso_operator_runtime",
      risk: "connector_read",
      inputSchema: {
        type: "object",
        properties: {
          includeDisabled: { type: "boolean", default: true },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "pulso_operator_job_create",
      description: "Cria uma rotina persistente no scheduler oficial. Use apenas quando a conversa já definiu objetivo, agenda, modelo e destino.",
      capability: "tool.jobs.write",
      source: "pulso_operator_runtime",
      risk: "reversible_internal_write",
      inputSchema: {
        type: "object",
        properties: { job: { type: "object", description: "Contrato integral aceito por cron.add." } },
        required: ["job"],
        additionalProperties: false,
      },
    },
    {
      name: "pulso_operator_job_update",
      description: "Atualiza, pausa ou retoma uma rotina existente pelo ID canônico no scheduler oficial.",
      capability: "tool.jobs.write",
      source: "pulso_operator_runtime",
      risk: "reversible_internal_write",
      inputSchema: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          patch: { type: "object" },
        },
        required: ["jobId", "patch"],
        additionalProperties: false,
      },
    },
    {
      name: "pulso_operator_job_run",
      description: "Executa agora uma rotina existente pelo ID canônico. A rotina conserva sua própria política de ferramentas e entrega.",
      capability: "tool.jobs.run",
      source: "pulso_operator_runtime",
      risk: "reversible_internal_write",
      inputSchema: {
        type: "object",
        properties: { jobId: { type: "string" } },
        required: ["jobId"],
        additionalProperties: false,
      },
    },
    {
      name: "pulso_operator_whatsapp_send",
      description: "Envia uma mensagem WhatsApp pelo canal oficial. Exige decisão humana contextual imediatamente antes do envio.",
      capability: "tool.whatsapp.send",
      source: "pulso_operator_runtime",
      risk: "external_action",
      requiresHuman: true,
      rationale: "a mensagem será enviada para uma pessoa ou grupo no WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          jid: { type: "string", description: "JID canônico do destinatário." },
          message: { type: "string", description: "Texto integral aprovado para envio." },
          replyToMessageId: { type: "string" },
        },
        required: ["jid", "message"],
        additionalProperties: false,
      },
    },
  ];
}

export class PulsoOperatorClient {
  constructor({ endpoint, token, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    invariant(typeof endpoint === "string" && endpoint.trim(), "operator_endpoint_required");
    invariant(typeof token === "string" && token.length >= 24, "operator_token_required");
    invariant(typeof fetchImpl === "function", "operator_fetch_required");
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  tools() {
    return pulsoOperatorDynamicTools();
  }

  async #remote(tool, args, signal = null) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason || "cancelled");
    if (signal?.aborted) onAbort();
    else signal?.addEventListener?.("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort("operator_timeout"), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.endpoint}/v1/tools/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ tool, arguments: args }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        const error = new Error(payload?.error?.code || `operator_http_${response.status}`);
        error.code = payload?.error?.code || "operator_transport_failed";
        throw error;
      }
      return { success: true, publicResult: payload?.result ?? null };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
    }
  }

  async execute({ tool, arguments: rawArguments = {}, signal = null } = {}) {
    const args = asObject(rawArguments);
    if (tool === "pulso_operator_whatsapp_prepare") {
      const jid = boundedText(args.jid, 96).trim();
      const draft = boundedText(args.draft, 8_000).trim();
      invariant(JID_PATTERN.test(jid), "operator_invalid_whatsapp_jid");
      invariant(draft, "operator_draft_required");
      return {
        success: true,
        publicResult: {
          status: "prepared_not_sent",
          jid,
          replyToMessageId: boundedText(args.replyToMessageId, 160).trim() || null,
          draft,
          sent: false,
        },
      };
    }
    if (tool === "pulso_operator_whatsapp_read") {
      return this.#remote(tool, {
        contact: boundedText(args.contact, 240).trim() || null,
        jid: boundedText(args.jid, 96).trim() || null,
        limit: Math.max(1, Math.min(20, Number(args.limit) || 8)),
      }, signal);
    }
    if (tool === "pulso_operator_devices_status") return this.#remote(tool, {}, signal);
    if (tool === "pulso_operator_jobs_list") {
      return this.#remote(tool, {
        includeDisabled: args.includeDisabled !== false,
        limit: Math.max(1, Math.min(200, Number(args.limit) || 100)),
      }, signal);
    }
    if (tool === "pulso_operator_job_create") {
      invariant(args.job && typeof args.job === "object" && !Array.isArray(args.job), "operator_job_required");
      return this.#remote(tool, { job: args.job }, signal);
    }
    if (tool === "pulso_operator_job_update") {
      const jobId = boundedText(args.jobId, 180).trim();
      invariant(jobId, "operator_job_id_required");
      invariant(args.patch && typeof args.patch === "object" && !Array.isArray(args.patch), "operator_job_patch_required");
      return this.#remote(tool, { jobId, patch: args.patch }, signal);
    }
    if (tool === "pulso_operator_job_run") {
      const jobId = boundedText(args.jobId, 180).trim();
      invariant(jobId, "operator_job_id_required");
      return this.#remote(tool, { jobId }, signal);
    }
    if (tool === "pulso_operator_whatsapp_send") {
      const jid = boundedText(args.jid, 96).trim();
      const message = boundedText(args.message, 8_000).trim();
      invariant(JID_PATTERN.test(jid), "operator_invalid_whatsapp_jid");
      invariant(message, "operator_message_required");
      return this.#remote(tool, {
        jid,
        message,
        replyToMessageId: boundedText(args.replyToMessageId, 180).trim() || null,
      }, signal);
    }
    const error = new Error(`operator_tool_unsupported:${tool}`);
    error.code = "operator_tool_unsupported";
    throw error;
  }
}
