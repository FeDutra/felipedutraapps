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
  },

  /**
   * Lista arquivos do Google Drive
   */
  listDriveFiles: async (googleAlias: string, queryText?: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const q = queryText ? `name contains '${queryText}' and trashed = false` : "trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=15&fields=files(id,name,mimeType)`;
      
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Drive API: ${res.status}`);
      
      const data = await res.json();
      const files = data.files || [];
      if (files.length === 0) return `Nenhum arquivo encontrado no Drive de "${match.alias}".`;
      
      return `Arquivos no Drive (${match.alias}):\n` + files.map((f: any) => `- [${f.name}] (ID: ${f.id}, Tipo: ${f.mimeType})`).join("\n");
    } catch (e: any) {
      return `Erro no Drive: ${e.message}`;
    }
  },

  /**
   * Deleta arquivo no Google Drive
   */
  deleteDriveFile: async (googleAlias: string, fileId: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Drive API: ${res.status}`);
      return `Arquivo com ID ${fileId} deletado com sucesso do Drive de "${match.alias}".`;
    } catch (e: any) {
      return `Erro ao deletar arquivo: ${e.message}`;
    }
  },

  /**
   * Renomeia arquivo no Google Drive
   */
  renameDriveFile: async (googleAlias: string, fileId: string, newName: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) throw new Error(`Drive API: ${res.status}`);
      return `Arquivo renomeado com sucesso para "${newName}" no Drive de "${match.alias}".`;
    } catch (e: any) {
      return `Erro ao renomear arquivo: ${e.message}`;
    }
  },

  /**
   * Copia (Duplica) arquivo no Google Drive
   */
  copyDriveFile: async (googleAlias: string, fileId: string, copyName: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}/copy`;
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: copyName })
      });
      if (!res.ok) throw new Error(`Drive API: ${res.status}`);
      const data = await res.json();
      return `Arquivo duplicado com sucesso com o nome "${copyName}". Novo ID: ${data.id}.`;
    } catch (e: any) {
      return `Erro ao duplicar arquivo: ${e.message}`;
    }
  },

  /**
   * Cria Documento no Google Docs
   */
  createGoogleDocument: async (googleAlias: string, title: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = "https://docs.googleapis.com/v1/documents";
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error(`Docs API: ${res.status}`);
      const data = await res.json();
      return `Documento "${title}" criado com sucesso no Google Docs! ID: ${data.documentId}`;
    } catch (e: any) {
      return `Erro ao criar documento: ${e.message}`;
    }
  },

  /**
   * Escreve/Anexa texto a um Google Document
   */
  updateGoogleDocument: async (googleAlias: string, documentId: string, text: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                text: text,
                endOfSegmentLocation: {}
              }
            }
          ]
        })
      });
      if (!res.ok) throw new Error(`Docs API: ${res.status}`);
      return `Conteúdo anexado com sucesso ao documento (ID: ${documentId}).`;
    } catch (e: any) {
      return `Erro ao atualizar documento: ${e.message}`;
    }
  },

  /**
   * Cria Planilha no Google Sheets
   */
  createGoogleSpreadsheet: async (googleAlias: string, title: string): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = "https://sheets.googleapis.com/v4/spreadsheets";
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { title } })
      });
      if (!res.ok) throw new Error(`Sheets API: ${res.status}`);
      const data = await res.json();
      return `Planilha "${title}" criada com sucesso no Google Sheets! ID: ${data.spreadsheetId}`;
    } catch (e: any) {
      return `Erro ao criar planilha: ${e.message}`;
    }
  },

  /**
   * Adiciona/Atualiza valores de linha em uma Planilha
   */
  updateGoogleSpreadsheet: async (googleAlias: string, spreadsheetId: string, range: string, values: any[][]): Promise<string> => {
    try {
      let connections = await loadGoogleConnections();
      const match = connections.find(c => c.alias.toLowerCase().includes(googleAlias.toLowerCase()));
      if (!match) return `Conta "${googleAlias}" não encontrada.`;
      
      const token = await getValidAccessToken(match);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const fetchFn = typeof tauriFetch !== 'undefined' ? tauriFetch : fetch;
      const res = await fetchFn(url, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values })
      });
      if (!res.ok) throw new Error(`Sheets API: ${res.status}`);
      return `Planilha (ID: ${spreadsheetId}) atualizada com sucesso no intervalo "${range}".`;
    } catch (e: any) {
      return `Erro ao atualizar planilha: ${e.message}`;
    }
  }
};
