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
  },

  /**
   * Lê histórico de conversas do Slack
   */
  readHistory: async (slackAlias: string, channel: string, limit: number = 10): Promise<string> => {
    try {
      let connections = await loadSlackConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(slackAlias.toLowerCase()));
      if (!match) return `Conta "${slackAlias}" não encontrada.`;

      const token = match.token;
      const url = `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=${limit}`;
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      
      const res = await fetchFn(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Slack API: ${res.status}`);

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const messages = data.messages || [];
      if (messages.length === 0) return `Nenhuma mensagem recente no canal ${channel}.`;

      return `Histórico recente em ${channel} (${match.alias}):\n` + 
        messages.map((m: any) => `- [${m.user || 'User'}]: ${m.text}`).reverse().join("\n");
    } catch (e: any) {
      return `Erro ao ler histórico do Slack: ${e.message}`;
    }
  },

  /**
   * Edita uma mensagem enviada no Slack
   */
  updateMessage: async (slackAlias: string, channel: string, ts: string, text: string): Promise<string> => {
    try {
      let connections = await loadSlackConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(slackAlias.toLowerCase()));
      if (!match) return `Conta "${slackAlias}" não encontrada.`;

      const token = match.token;
      const url = "https://slack.com/api/chat.update";
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;

      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel, ts, text })
      });
      if (!res.ok) throw new Error(`Slack API: ${res.status}`);

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      return `Mensagem editada com sucesso no Slack "${match.alias}" (ts: ${ts}).`;
    } catch (e: any) {
      return `Erro ao editar mensagem no Slack: ${e.message}`;
    }
  },

  /**
   * Exclui uma mensagem no Slack
   */
  deleteMessage: async (slackAlias: string, channel: string, ts: string): Promise<string> => {
    try {
      let connections = await loadSlackConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(slackAlias.toLowerCase()));
      if (!match) return `Conta "${slackAlias}" não encontrada.`;

      const token = match.token;
      const url = "https://slack.com/api/chat.delete";
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;

      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel, ts })
      });
      if (!res.ok) throw new Error(`Slack API: ${res.status}`);

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      return `Mensagem com ts: ${ts} deletada com sucesso do Slack "${match.alias}".`;
    } catch (e: any) {
      return `Erro ao excluir mensagem no Slack: ${e.message}`;
    }
  },

  /**
   * Lista canais disponíveis no workspace do Slack
   */
  listChannels: async (slackAlias: string): Promise<string> => {
    try {
      let connections = await loadSlackConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(slackAlias.toLowerCase()));
      if (!match) return `Conta "${slackAlias}" não encontrada.`;

      const token = match.token;
      const url = "https://slack.com/api/conversations.list?types=public_channel,private_channel";
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;

      const res = await fetchFn(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Slack API: ${res.status}`);

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const channels = data.channels || [];
      if (channels.length === 0) return `Nenhum canal encontrado no workspace do Slack "${match.alias}".`;

      return `Canais disponíveis (${match.alias}):\n` + 
        channels.map((c: any) => `- #${c.name} (ID: ${c.id})`).join("\n");
    } catch (e: any) {
      return `Erro ao listar canais do Slack: ${e.message}`;
    }
  }
};
