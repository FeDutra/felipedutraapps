const DEFAULT_CHARS_PER_TOKEN = 3;

export function estimateMessageTokens(message, charsPerToken = DEFAULT_CHARS_PER_TOKEN) {
  const content = String(message?.content ?? "");
  return Math.max(1, Math.ceil(content.length / charsPerToken) + 6);
}

function compactText(text, maxTokens, charsPerToken = DEFAULT_CHARS_PER_TOKEN) {
  const value = String(text ?? "");
  const maxChars = Math.max(96, Math.floor(maxTokens * charsPerToken));
  if (value.length <= maxChars) return value;
  const marker = "\n\n[… conteúdo compactado para caber no contexto do modelo …]\n\n";
  const remaining = Math.max(32, maxChars - marker.length);
  const head = Math.floor(remaining * 0.7);
  return value.slice(0, head) + marker + value.slice(-(remaining - head));
}

/**
 * Keeps the current turn and the newest complete exchanges inside a bounded
 * model window. Older history is omitted deterministically instead of being
 * sent to a provider that cannot accept it.
 */
export function compactMessagesForContext(messages, {
  contextWindow = 8192,
  reservedOutputTokens = 768,
  systemTokenLimit = 3072,
  inputTokenLimit = null,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
} = {}) {
  const input = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const modelBudget = Math.max(512, contextWindow - reservedOutputTokens - 128);
  const boundedInputLimit = Number.isFinite(Number(inputTokenLimit))
    ? Math.max(512, Number(inputTokenLimit))
    : modelBudget;
  const inputBudget = Math.min(modelBudget, boundedInputLimit);
  const systems = input.filter(message => message.role === "system");
  const dialogue = input.filter(message => message.role !== "system");
  const output = [];
  let used = 0;

  for (const system of systems) {
    const remainingSystem = Math.max(0, Math.min(systemTokenLimit - used, inputBudget - used));
    if (remainingSystem <= 0) break;
    const compacted = { ...system, content: compactText(system.content, remainingSystem, charsPerToken) };
    output.push(compacted);
    used += estimateMessageTokens(compacted, charsPerToken);
  }

  const keptNewestFirst = [];
  let omitted = 0;
  for (let index = dialogue.length - 1; index >= 0; index -= 1) {
    const message = dialogue[index];
    const remaining = inputBudget - used;
    if (remaining <= 12) {
      omitted = index + 1;
      break;
    }
    const tokens = estimateMessageTokens(message, charsPerToken);
    if (tokens <= remaining) {
      keptNewestFirst.push(message);
      used += tokens;
      continue;
    }
    if (keptNewestFirst.length === 0) {
      const compacted = { ...message, content: compactText(message.content, remaining, charsPerToken) };
      keptNewestFirst.push(compacted);
      used += estimateMessageTokens(compacted, charsPerToken);
    }
    omitted = index + 1;
    break;
  }

  if (omitted > 0) {
    output.push({
      role: "system",
      content: `[${omitted} mensagens anteriores foram omitidas para respeitar a janela do modelo selecionado.]`,
    });
  }
  output.push(...keptNewestFirst.reverse());

  return Object.freeze({
    messages: Object.freeze(output.map(message => Object.freeze({ ...message }))),
    omittedMessages: omitted,
    estimatedInputTokens: output.reduce((sum, message) => sum + estimateMessageTokens(message, charsPerToken), 0),
    contextWindow,
    reservedOutputTokens,
    inputTokenLimit: inputBudget,
  });
}

export function isLocalModelAdapter(adapter) {
  return adapter?.local === true || adapter?.adapterKind === "ollama" || adapter?.protocol === "ollama_native";
}

export function localModelContextBudget(_model, { thinkingLevel = "off" } = {}) {
  if (/^(?:qwen3:4b(?:$|:)|qwen3-hermes-)/i.test(String(_model ?? ""))) {
    return Object.freeze({ inputTokenLimit: 512, systemTokenLimit: 256 });
  }
  return thinkingLevel === "on"
    ? Object.freeze({ inputTokenLimit: 3072, systemTokenLimit: 1024 })
    : Object.freeze({ inputTokenLimit: 512, systemTokenLimit: 256 });
}
