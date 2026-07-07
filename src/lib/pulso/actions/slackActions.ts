import { db } from "../../../shared/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

interface SlackConnection {
  alias: string;
  token: string;
  defaultChannel?: string;
}

let cachedConnections: SlackConnection[] = [];

const loadSlackConnections = async (): Promise<SlackConnection[]> => {
  try {
    const q = query(
      collection(db, "workspaces/felipe_dutra/connections"),
      where("type", "==", "slack")
    );
    const snap = await getDocs(q);

    const connections: SlackConnection[] = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        connections.push({
          alias: data.alias || 'Slack',
          token: data.token,
          defaultChannel: data.defaultChannel
        });
      }
    });

    cachedConnections = connections;
    return connections;
  } catch (err) {
    console.error("[SlackActions] Erro ao buscar conexões do Slack no Firestore:", err);
    return cachedConnections;
  }
};

export const slackActions = {
  /**
   * Envia uma mensagem para um canal específico ou DM do Slack.
   */
  sendMessage: async (slackAlias: string, channel: string, message: string): Promise<string> => {
    try {
      let connections = await loadSlackConnections();
      if (connections.length === 0) {
        return "Nenhuma conta do Slack configurada. Adicione nas Conexões.";
      }

      const lowerAlias = slackAlias.toLowerCase();
      const match = connections.find(c => c.alias.toLowerCase().includes(lowerAlias));
      if (!match) {
        return `Não encontrei nenhuma integração com o Slack com o alias "${slackAlias}".`;
      }

      const url = "https://slack.com/api/chat.postMessage";
      const targetChannel = channel || match.defaultChannel || "#general";
      
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;

      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${match.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          channel: targetChannel,
          text: message
        })
      });

      if (!response.ok) {
        throw new Error(`Slack API respondeu com status ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Erro retornado pela API do Slack");
      }

      return `Mensagem enviada com sucesso no canal "${targetChannel}" do Slack "${match.alias}".`;
    } catch (error: any) {
      console.error("[SlackActions] Erro ao enviar mensagem no Slack:", error);
      return `Erro ao enviar mensagem no Slack: ${error.message}`;
    }
  }
};
