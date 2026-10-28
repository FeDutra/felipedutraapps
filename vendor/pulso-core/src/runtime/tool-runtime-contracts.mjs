import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";

const SECRET_PATTERN = /(api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|password|passwd|token|secret|private[_ -]?key)/i;
const DESTRUCTIVE_PATTERN = /(^|\s)(rm\s+-[^\n]*r|trash\s+|git\s+(push|reset\s+--hard|clean\s+-)|sudo\s+|kill(all)?\s+|launchctl\s+|systemctl\s+|shutdown\s+|reboot\s+|diskutil\s+erase|dd\s+if=)/i;
const EXTERNAL_MUTATION_PATTERN = /(^|\s)(curl|wget)\b[^\n]*(--request|-X)\s*(POST|PUT|PATCH|DELETE)|\b(gh\s+pr\s+(create|merge)|osascript|open\s+https?:|ssh\s+)/i;
const MONEY_PATTERN = /\b(payment|pagamento|pix|transfer|transferência|invoice|fatura|checkout|stripe)\b/i;
const COMMUNICATION_PATTERN = /\b(send|enviar|post|publish|publicar|reply|responder|message|mensagem|whatsapp|telegram|email|gmail)\b/i;

function text(value, limit = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function fingerprint(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 16);
}

function insideRoot(candidate, root) {
  if (!candidate || !root) return false;
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${sep}`);
}

export function normalizeToolItem(item = {}, phase = "started") {
  const type = text(item.type || item.kind || "unknown", 64);
  const itemId = text(item.id || item.itemId || item.callId || `tool_${fingerprint(JSON.stringify(item))}`, 160);
  const common = {
    itemId,
    type,
    phase,
    status: text(item.status || (phase === "completed" ? "completed" : "inProgress"), 64),
    durationMs: Number.isFinite(item.durationMs) ? item.durationMs : null,
  };
  if (type === "commandExecution") {
    return {
      ...common,
      tool: "shell",
      source: text(item.source || "local", 80),
      target: text(item.cwd || "workspace", 180),
      action: text(item.commandActions?.[0]?.type || "command", 80),
      commandFingerprint: fingerprint(item.command),
      exitCode: Number.isInteger(item.exitCode) ? item.exitCode : null,
      success: phase === "completed" ? item.status === "completed" && (item.exitCode === 0 || item.exitCode === null || item.exitCode === undefined) : null,
    };
  }
  if (type === "fileChange") {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    return {
      ...common,
      tool: "filesystem",
      source: "local",
      target: `${changes.length} arquivo${changes.length === 1 ? "" : "s"}`,
      action: "file_change",
      success: phase === "completed" ? !["failed", "declined"].includes(item.status) : null,
    };
  }
  if (type === "mcpToolCall") {
    return {
      ...common,
      tool: text(item.tool || "mcp_tool", 120),
      source: text(item.server || item.appContext?.connectorId || "mcp", 120),
      target: text(item.appContext?.displayName || item.server || "conector", 160),
      action: "connector_call",
      success: phase === "completed" ? item.status === "completed" && !item.error : null,
      errorCode: item.error ? text(item.error.code || item.error.message || "tool_failed", 120) : null,
    };
  }
  if (type === "dynamicToolCall") {
    return {
      ...common,
      tool: text(item.tool || "dynamic_tool", 120),
      source: text(item.namespace || "dynamic", 120),
      target: text(item.namespace || "ferramenta", 160),
      action: "dynamic_tool_call",
      success: phase === "completed" ? item.success === true : null,
    };
  }
  if (type === "collabAgentToolCall") {
    return {
      ...common,
      tool: text(item.tool || "agent", 120),
      source: "constellation",
      target: `${Array.isArray(item.receiverThreadIds) ? item.receiverThreadIds.length : 0} agente(s)`,
      action: "agent_handoff",
      success: phase === "completed" ? item.status === "completed" : null,
    };
  }
  return { ...common, tool: type || "unknown", source: "provider", target: "execução", action: "tool_call", success: null };
}

export function classifyApproval({ method, params = {}, workspaceDir = null } = {}) {
  const command = String(params.command || "");
  const reason = String(params.reason || "");
  const combined = `${command}\n${reason}`;
  let risk = "technical";
  let requiresHuman = false;
  let rationale = "ação técnica reversível dentro da oficina privada";

  if (method === "item/tool/requestUserInput") {
    return { risk: "human_input", requiresHuman: true, rationale: "a ferramenta pediu uma decisão humana" };
  }
  if (SECRET_PATTERN.test(combined)) {
    risk = "credentials";
    requiresHuman = true;
    rationale = "a ação pode tocar credenciais ou material secreto";
  } else if (MONEY_PATTERN.test(combined)) {
    risk = "money";
    requiresHuman = true;
    rationale = "a ação pode produzir efeito financeiro";
  } else if (DESTRUCTIVE_PATTERN.test(command)) {
    risk = "destructive";
    requiresHuman = true;
    rationale = "a ação pode remover dados ou alterar processos/sistema";
  } else if (EXTERNAL_MUTATION_PATTERN.test(command) || COMMUNICATION_PATTERN.test(reason)) {
    risk = "external_action";
    requiresHuman = true;
    rationale = "a ação pode comunicar, publicar ou modificar um sistema externo";
  } else if (method === "item/fileChange/requestApproval") {
    const root = params.grantRoot || params.cwd || null;
    requiresHuman = !insideRoot(root, workspaceDir);
    risk = requiresHuman ? "filesystem_scope" : "technical";
    rationale = requiresHuman
      ? "a alteração de arquivo não está comprovadamente dentro da oficina privada"
      : "alteração reversível dentro da oficina privada";
  } else if (method === "item/permissions/requestApproval") {
    requiresHuman = true;
    risk = "permission_change";
    rationale = "a ferramenta pediu ampliação de permissões";
  } else if (method === "item/commandExecution/requestApproval") {
    const cwd = params.cwd || workspaceDir;
    if (!insideRoot(cwd, workspaceDir)) {
      requiresHuman = true;
      risk = "filesystem_scope";
      rationale = "o comando está fora da oficina privada";
    }
  }
  return { risk, requiresHuman, rationale };
}

export function sanitizeApproval({ approvalId, method, params = {}, classification, status = "pending", decision = null, requestedAt = null, resolvedAt = null } = {}) {
  const questions = method === "item/tool/requestUserInput"
    ? (Array.isArray(params.questions) ? params.questions : []).map(question => ({
        id: text(question?.id, 120),
        header: text(question?.header, 120),
        question: text(question?.question, 360),
        isSecret: question?.isSecret === true,
        options: question?.isSecret === true
          ? []
          : (Array.isArray(question?.options) ? question.options : []).map(option => ({
              label: text(option?.label, 120),
              description: text(option?.description, 240),
            })),
      })).filter(question => question.id && question.question)
    : [];
  return {
    approvalId: text(approvalId, 180),
    itemId: text(params.itemId || params.approvalId || params.callId || approvalId, 180),
    threadId: text(params.threadId, 180) || null,
    turnId: text(params.turnId, 180) || null,
    method: text(method, 180),
    risk: classification?.risk || "technical",
    rationale: text(classification?.rationale || "decisão necessária", 240),
    status,
    decision,
    questions,
    requestedAt,
    resolvedAt,
  };
}

export function approvalDecisionResult(method, decision, params = {}) {
  const approved = ["approve", "accept", "acceptForSession"].includes(decision);
  if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval") {
    return { decision: approved ? "acceptForSession" : "decline" };
  }
  if (method === "item/permissions/requestApproval") {
    const requestedPermissions = params.permissions && typeof params.permissions === "object"
      ? structuredClone(params.permissions)
      : {};
    return approved
      ? { permissions: requestedPermissions, scope: "turn", strictAutoReview: true }
      : { permissions: {}, scope: "turn", strictAutoReview: true };
  }
  return null;
}
