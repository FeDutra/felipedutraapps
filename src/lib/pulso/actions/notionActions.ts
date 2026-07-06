import { Client } from "@notionhq/client";
import { db } from "../../../shared/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

interface NotionConnection {
  alias: string;
  client: Client;
}

let cachedClients: NotionConnection[] = [];

const loadNotionClients = async (): Promise<NotionConnection[]> => {
  try {
    const q = query(
      collection(db, "workspaces/felipe_dutra/connections"), 
      where("type", "==", "notion")
    );
    const snap = await getDocs(q);
    
    const clients: NotionConnection[] = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        clients.push({
          alias: data.alias || 'Notion',
          client: new Client({ 
            auth: data.token,
            fetch: tauriFetch as any // Override fetch to bypass CORS
          })
        });
      }
    });
    
    cachedClients = clients;
    return clients;
  } catch (err) {
    console.error("[NotionActions] Falha ao recuperar conexões:", err);
    return cachedClients; // fallback for in-memory if fetch fails
  }
};

export const notionActions = {
  readNotion: async (pageName: string, targetAlias?: string): Promise<string> => {
    try {
      let clients = await loadNotionClients();
      
      if (clients.length === 0) {
        return "Não encontrei nenhuma integração do Notion ativa. Configure na página de Conexões.";
      }

      // Se o usuário pedir um Notion específico, filtramos
      if (targetAlias) {
        const lowerTarget = targetAlias.toLowerCase();
        clients = clients.filter(c => c.alias.toLowerCase().includes(lowerTarget));
        if (clients.length === 0) {
          return `Não encontrei nenhuma conexão do Notion com o nome "${targetAlias}".`;
        }
      }

      // Procuramos a página em todos os Notions filtrados
      for (const connection of clients) {
        const notion = connection.client;
        const searchRes = await notion.search({
          query: pageName,
          filter: { property: 'object', value: 'page' },
          page_size: 1,
        });

        if (searchRes.results.length > 0) {
          const page = searchRes.results[0];
          
          const blocksRes = await notion.blocks.children.list({
            block_id: page.id,
          });

          let textContent = "";
          for (const block of blocksRes.results as any[]) {
            if (block.type === 'paragraph' && block.paragraph.rich_text?.length > 0) {
              textContent += block.paragraph.rich_text.map((t: any) => t.plain_text).join("") + "\n";
            } else if (block.type.includes('heading') && block[block.type].rich_text?.length > 0) {
              textContent += block[block.type].rich_text.map((t: any) => t.plain_text).join("") + "\n";
            } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item.rich_text?.length > 0) {
              textContent += "- " + block.bulleted_list_item.rich_text.map((t: any) => t.plain_text).join("") + "\n";
            }
          }

          if (textContent.trim()) {
            return `Conteúdo encontrado na conta "${connection.alias}" (${pageName}):\n${textContent}`;
          }
        }
      }

      return `Não encontrei a página "${pageName}" em nenhum dos seus Notions conectados.`;
    } catch (error: any) {
      console.error("[NotionActions] Erro ao ler Notion:", error);
      return `Ocorreu um erro ao ler o Notion: ${error.message}`;
    }
  },

  queryDatabase: async (databaseName: string, targetAlias?: string): Promise<string> => {
    try {
      let clients = await loadNotionClients();
      if (targetAlias) {
        clients = clients.filter(c => c.alias.toLowerCase().includes(targetAlias.toLowerCase()));
      }

      for (const connection of clients) {
        const notion = connection.client;
        const searchRes = await notion.search({
          query: databaseName,
          filter: { property: 'object', value: 'database' },
          page_size: 1,
        });

        if (searchRes.results.length > 0) {
          const dbId = searchRes.results[0].id;
          const queryRes = await notion.databases.query({ database_id: dbId });
          
          let resultText = `Resultados da base "${databaseName}" em "${connection.alias}":\n`;
          for (const row of queryRes.results as any[]) {
            // Extract the title property dynamically since we don't know the schema
            const titleProp = Object.values(row.properties).find((p: any) => p.type === 'title') as any;
            if (titleProp && titleProp.title.length > 0) {
              const title = titleProp.title.map((t: any) => t.plain_text).join('');
              resultText += `- ${title} (ID: ${row.id})\n`;
            }
          }
          return resultText || "A base de dados foi encontrada, mas parece estar vazia ou sem títulos.";
        }
      }
      return `Não encontrei a base de dados "${databaseName}".`;
    } catch (error: any) {
      return `Ocorreu um erro ao consultar a base de dados: ${error.message}`;
    }
  },

  createPage: async (parentName: string, pageTitle: string, content?: string, targetAlias?: string): Promise<string> => {
    try {
      let clients = await loadNotionClients();
      if (targetAlias) {
        clients = clients.filter(c => c.alias.toLowerCase().includes(targetAlias.toLowerCase()));
      }

      for (const connection of clients) {
        const notion = connection.client;
        const searchRes = await notion.search({
          query: parentName,
          page_size: 1,
        });

        if (searchRes.results.length > 0) {
          const parent = searchRes.results[0];
          const parentId = parent.id;
          const parentType = parent.object === 'database' ? { database_id: parentId } : { page_id: parentId };
          
          const newPage: any = {
            parent: parentType,
            properties: {}
          };
          
          if (parent.object === 'database') {
             // We just try to set the default 'title' property for DBs. If it fails, Notion API throws.
             newPage.properties = {
               "Name": { title: [{ text: { content: pageTitle } }] }
             };
          } else {
             newPage.properties = {
               title: { title: [{ text: { content: pageTitle } }] }
             };
          }
          
          if (content) {
             newPage.children = [
               {
                 object: 'block',
                 type: 'paragraph',
                 paragraph: { rich_text: [{ type: 'text', text: { content: content } }] }
               }
             ];
          }

          const created = await notion.pages.create(newPage);
          return `Página "${pageTitle}" criada com sucesso sob "${parentName}" em "${connection.alias}". URL: ${(created as any).url}`;
        }
      }
      return `Não encontrei o pai "${parentName}" para criar a página.`;
    } catch (error: any) {
      return `Erro ao criar página no Notion: ${error.message}`;
    }
  },

  createComment: async (pageName: string, commentText: string, targetAlias?: string): Promise<string> => {
    try {
      let clients = await loadNotionClients();
      if (targetAlias) {
        clients = clients.filter(c => c.alias.toLowerCase().includes(targetAlias.toLowerCase()));
      }

      for (const connection of clients) {
        const notion = connection.client;
        const searchRes = await notion.search({
          query: pageName,
          filter: { property: 'object', value: 'page' },
          page_size: 1,
        });

        if (searchRes.results.length > 0) {
          const pageId = searchRes.results[0].id;
          await notion.comments.create({
            parent: { page_id: pageId },
            rich_text: [{ text: { content: commentText } }]
          });
          return `Comentário adicionado com sucesso na página "${pageName}" em "${connection.alias}".`;
        }
      }
      return `Não encontrei a página "${pageName}" para comentar.`;
    } catch (error: any) {
      return `Erro ao comentar no Notion: ${error.message}`;
    }
  }
};
