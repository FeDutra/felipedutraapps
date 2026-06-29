import * as admin from "firebase-admin";

/**
 * Interface do Evento no Action/Event Ledger.
 */
export interface PulsoLedgerEvent {
  source: string;
  intent: string;
  action: string;
  target?: string;
  payload?: any;
  status: "pending" | "running" | "success" | "failed";
  result?: any;
  externalRefs?: any;
  surface: string;
  createdAt?: string;
}

const ALLOWED_ACTIONS = [
  "system.ledger_ping",
  "notion.create_task",
  "daily_summary_cards",
];

const ALLOWED_STATUSES = ["pending", "running", "success", "failed"];

/**
 * Verifica recursivamente se o objeto possui campos sensíveis como chaves privadas, 
 * credenciais cruas ou tokens expostos.
 */
function hasSensitiveData(obj: any): boolean {
  if (!obj) return false;
  if (typeof obj === "string") {
    const lower = obj.toLowerCase();
    // Bloqueia tokens no padrão de API, service accounts JSON strings ou chaves privadas
    if (lower.includes("-----begin private key-----") || lower.includes("bearer ey")) return true;
    return false;
  }
  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("private_key") ||
        lowerKey.includes("token") ||
        lowerKey.includes("credential")
      ) {
        return true;
      }
      if (hasSensitiveData(obj[key])) return true;
    }
  }
  return false;
}

/**
 * Valida o esquema do evento e regras de segurança antes de emitir.
 */
function validateEvent(event: Partial<PulsoLedgerEvent>): event is PulsoLedgerEvent {
  if (event.source !== "lotus_openclaw") {
    console.warn(`[LedgerEmitter] Evento rejeitado: source não é lotus_openclaw. Recebido: ${event.source}`);
    return false;
  }
  if (event.surface !== "openclaw") {
    console.warn(`[LedgerEmitter] Evento rejeitado: surface não é openclaw. Recebido: ${event.surface}`);
    return false;
  }
  if (!event.status || !ALLOWED_STATUSES.includes(event.status)) {
    console.warn(`[LedgerEmitter] Evento rejeitado: status inválido. Recebido: ${event.status}`);
    return false;
  }
  if (!event.action || !ALLOWED_ACTIONS.includes(event.action)) {
    console.warn(`[LedgerEmitter] Evento rejeitado: action fora da allowlist. Recebido: ${event.action}`);
    return false;
  }

  // Verificar se payload é serializável (por não ter funções/cycles, vindo de JSON parse, já deve ser)
  // Verificar dados sensíveis
  if (hasSensitiveData(event.payload)) {
    console.warn(`[LedgerEmitter] Evento rejeitado: payload contém chaves bloqueadas ou dados sensíveis (tokens/secrets).`);
    return false;
  }

  return true;
}

/**
 * Emite os eventos validados no Ledger da PULSO.
 */
export async function emitPulsoLedgerEvents(events: Partial<PulsoLedgerEvent>[], db: admin.firestore.Firestore): Promise<void> {
  if (!events || !Array.isArray(events)) return;

  const WORKSPACE_PATH = "workspaces/felipe_dutra/pulso_events";
  const eventsRef = db.collection(WORKSPACE_PATH);
  
  for (const evt of events) {
    if (validateEvent(evt)) {
      try {
        const payload = {
          ...evt,
          createdAt: evt.createdAt || new Date().toISOString(),
        };
        const docRef = await eventsRef.add(payload);
        console.log(`✅ [LedgerEmitter] Evento '${evt.action}' gravado com sucesso. ID: ${docRef.id}`);
      } catch (err) {
        console.error(`❌ [LedgerEmitter] Falha de Firestore ao gravar evento '${evt.action}':`, err);
      }
    } else {
      console.warn(`⚠️ [LedgerEmitter] Evento '${evt.action || "desconhecido"}' ignorado devido à validação falha.`);
    }
  }
}
