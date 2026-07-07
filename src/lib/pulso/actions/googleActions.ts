import { db } from "../../../shared/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

interface GoogleConnection {
  alias: string;
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiryDate?: number;
}

let cachedConnections: GoogleConnection[] = [];

/**
 * Carrega credenciais do Google salvas no Firestore.
 */
const loadGoogleConnections = async (): Promise<GoogleConnection[]> => {
  try {
    const q = query(
      collection(db, "workspaces/felipe_dutra/connections"),
      where("type", "==", "google")
    );
    const snap = await getDocs(q);

    const connections: GoogleConnection[] = [];
    snap.forEach(doc => {
      const data = doc.data();
      const auth = data.auth || {};
      if (auth.access_token) {
        connections.push({
          alias: data.alias || 'Google',
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          clientId: auth.client_id,
          clientSecret: auth.client_secret,
          expiryDate: auth.expiry_date
        });
      }
    });

    cachedConnections = connections;
    return connections;
  } catch (err) {
    console.error("[GoogleActions] Erro ao buscar conexões do Firestore:", err);
    return cachedConnections;
  }
};

/**
 * Garante que o access_token esteja ativo. Lida com refresh caso tenha expirado.
 */
const getValidAccessToken = async (connection: GoogleConnection): Promise<string> => {
  const isExpired = connection.expiryDate && Date.now() >= connection.expiryDate;
  if (!isExpired) {
    return connection.accessToken;
  }

  if (!connection.refreshToken || !connection.clientId || !connection.clientSecret) {
    console.warn(`[GoogleActions] Token expirado para "${connection.alias}" e sem credenciais de refresh.`);
    return connection.accessToken;
  }

  try {
    console.log(`[GoogleActions] Renovando access_token expirado para "${connection.alias}"...`);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: connection.clientId,
        client_secret: connection.clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!res.ok) throw new Error("Falha na chamada de refresh token");

    const data = await res.json();
    connection.accessToken = data.access_token;
    if (data.expires_in) {
      connection.expiryDate = Date.now() + data.expires_in * 1000;
    }
    return data.access_token;
  } catch (err) {
    console.error(`[GoogleActions] Erro ao renovar token da conta "${connection.alias}":`, err);
    return connection.accessToken;
  }
};

export const googleActions = {
  /**
   * Lista eventos do Google Calendar.
   */
  listEvents: async (calendarAlias: string, timeMin?: string, timeMax?: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      if (connections.length === 0) {
        return "Nenhuma conta do Google integrada. Configure nas Conexões.";
      }

      const lowerAlias = calendarAlias.toLowerCase();
      const match = connections.find(c => c.alias.toLowerCase().includes(lowerAlias));
      if (!match) {
        return `Não encontrei nenhuma integração com o nome ou alias "${calendarAlias}".`;
      }

      const token = await getValidAccessToken(match);
      const searchParams = new URLSearchParams({
        maxResults: "10",
        orderBy: "startTime",
        singleEvents: "true"
      });
      if (timeMin) searchParams.append("timeMin", timeMin);
      else searchParams.append("timeMin", new Date().toISOString());
      
      if (timeMax) searchParams.append("timeMax", timeMax);

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${searchParams.toString()}`;
      
      // Usamos fetch do Tauri/plugin-http se estiver disponível para evitar CORS, senão fetch padrão
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      
      const response = await fetchFn(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Google API respondeu com status ${response.status}`);
      }

      const data = await response.json();
      const events = data.items || [];
      if (events.length === 0) {
        return `Nenhum evento encontrado na conta "${match.alias}".`;
      }

      let text = `Compromissos encontrados na conta "${match.alias}":\n`;
      for (const event of events) {
        const start = event.start?.dateTime || event.start?.date || '';
        const summary = event.summary || 'Sem título';
        text += `- [${new Date(start).toLocaleString('pt-BR')}] ${summary}\n`;
      }

      return text;
    } catch (error: any) {
      console.error("[GoogleActions] Erro ao listar eventos:", error);
      return `Erro ao acessar o Google Calendar: ${error.message}`;
    }
  },

  /**
   * Cria compromisso no Google Calendar.
   */
  createEvent: async (calendarAlias: string, title: string, start: string, end: string, description?: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const lowerAlias = calendarAlias.toLowerCase();
      const match = connections.find(c => c.alias.toLowerCase().includes(lowerAlias));
      if (!match) {
        return `Não encontrei nenhuma integração com o nome "${calendarAlias}".`;
      }

      const token = await getValidAccessToken(match);
      const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
      
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: title,
          description: description || "Criado pela Lótus na PULSO",
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(end).toISOString() }
        })
      });

      if (!response.ok) {
        throw new Error(`Google API respondeu com status ${response.status}`);
      }

      const data = await response.json();
      return `Evento "${title}" criado com sucesso no calendário "${match.alias}" (${new Date(start).toLocaleString('pt-BR')}). Link: ${data.htmlLink}`;
    } catch (error: any) {
      console.error("[GoogleActions] Erro ao criar evento:", error);
      return `Erro ao criar compromisso no Google Calendar: ${error.message}`;
    }
  },

  /**
   * Envia e-mail via Gmail API.
   */
  sendEmail: async (emailAlias: string, to: string, subject: string, body: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const lowerAlias = emailAlias.toLowerCase();
      const match = connections.find(c => c.alias.toLowerCase().includes(lowerAlias));
      if (!match) {
        return `Não encontrei nenhuma conta com o nome "${emailAlias}".`;
      }

      const token = await getValidAccessToken(match);
      const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

      // Formatar RFC 2822 raw message
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const emailContent = [
        `To: ${to}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
        `Subject: ${utf8Subject}`,
        "",
        body
      ].join("\r\n");

      // Base64url safe encode
      const base64Safe = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: base64Safe })
      });

      if (!response.ok) {
        throw new Error(`Google API respondeu com status ${response.status}`);
      }

      return `E-mail enviado com sucesso para ${to} usando a conta "${match.alias}".`;
    } catch (error: any) {
      console.error("[GoogleActions] Erro ao enviar e-mail:", error);
      return `Erro ao enviar e-mail pelo Gmail: ${error.message}`;
    }
  }
};
