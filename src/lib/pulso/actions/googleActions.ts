import { db } from "../../../shared/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

interface GoogleConnection {
  alias: string;
  serviceAccountEmail: string;
  privateKey: string; // chave privada RSA da service account
  cachedToken?: string;
  tokenExpiry?: number;
}

let cachedConnections: GoogleConnection[] = [];

/**
 * Carrega credenciais do Google (Service Account) salvas no Firestore.
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
      const sa = data.serviceAccount || {};
      if (sa.client_email && sa.private_key) {
        connections.push({
          alias: data.alias || 'Google',
          serviceAccountEmail: sa.client_email,
          privateKey: sa.private_key,
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
 * Gera um JWT assinado para a Service Account usando SubtleCrypto (Web Crypto API).
 * Funciona em browser/Tauri sem dependência de node:crypto.
 */
const signJwt = async (email: string, privateKeyPem: string, scope: string): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const toB64 = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${toB64(header)}.${toB64(payload)}`;

  // Importa a chave PEM RSA privada via WebCrypto
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
};

/**
 * Retorna um access_token válido para a Service Account.
 * Renova automaticamente se estiver expirado.
 */
const getValidAccessToken = async (connection: GoogleConnection): Promise<string> => {
  const scope = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
  ].join(" ");

  const isExpired = !connection.cachedToken || !connection.tokenExpiry || Date.now() >= connection.tokenExpiry;
  if (!isExpired && connection.cachedToken) return connection.cachedToken;

  try {
    const jwt = await signJwt(connection.serviceAccountEmail, connection.privateKey, scope);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Falha ao obter token da Service Account: ${errBody}`);
    }

    const data = await res.json();
    connection.cachedToken = data.access_token;
    connection.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
    return data.access_token;
  } catch (err: any) {
    console.error(`[GoogleActions] Erro ao obter token para "${connection.alias}":`, err);
    throw err;
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
