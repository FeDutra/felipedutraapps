/**
 * lotusOpenClawClient.ts
 * ---------------------
 * Single integration adapter between PULSO and Lótus / OpenClaw.
 * 
 * If process.env.NEXT_PUBLIC_OPENCLAW_API_URL is configured, sends commands
 * synchronously via HTTP POST. If not, returns a prepared package notice,
 * allowing the command to be picked up asynchronously from the Firestore queue.
 */

export interface LotusSendPayload {
  requestId: string;
  userId: string;
  source: "pulso_live";
  mode: "text" | "voice";
  input: string;
  timestamp: string;
  context: {
    currentRoute: string;
    timezone: string;
    locale: "pt-BR";
    userName: string;
    interface: "pulso";
  };
}

export interface LotusResponsePayload {
  status: "success" | "needs_approval" | "error";
  responseText: string;
  summary?: string;
  links?: Array<{
    label: string;
    url: string;
  }>;
  actions?: Array<{
    label: string;
    type: string;
    payload?: any;
    requiresConfirmation?: boolean;
  }>;
  sourcesConsulted?: string[];
  proposedMutation?: any;
  error?: string;
}

export const lotusOpenClawClient = {
  sendToLotus: async (payload: LotusSendPayload): Promise<LotusResponsePayload> => {
    const apiUrl = process.env.NEXT_PUBLIC_OPENCLAW_API_URL || "";

    if (!apiUrl) {
      // Offline/Asynchronous fallback when direct HTTP integration is not configured
      return {
        status: "error",
        responseText: "A Lótus ainda não está conectada à OpenClaw real. O pacote de chamada foi preparado."
      };
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`OpenClaw responded with status ${response.status}`);
      }

      const data: LotusResponsePayload = await response.json();
      return data;
    } catch (err: any) {
      console.error("[lotusOpenClawClient] Error communicating with OpenClaw:", err);
      return {
        status: "error",
        responseText: `Erro ao comunicar com a Lótus: ${err.message || err}`,
        error: err.message || String(err)
      };
    }
  }
};
