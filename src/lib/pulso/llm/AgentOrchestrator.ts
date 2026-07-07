import { PulsoLLMClient, ChatMessage, ToolDefinition } from './client';
import { localActions } from '../actions/localActions';

const AGENT_SYSTEM_PROMPT = `Você é a PULSO, um agente de inteligência artificial autônomo rodando localmente.
Você possui acesso a diversas ferramentas (tools) para ajudar o usuário com automações, leitura de dados e comunicação.
Sua principal função é receber o pedido do usuário, planejar quais ferramentas usar e executá-las.
Use as ferramentas para ler do Notion, enviar mensagens no WhatsApp, etc.

SEMPRE que for enviar uma mensagem no WhatsApp ou ler no Notion, valide se você tem todos os parâmetros. Se não tiver, você pode perguntar ao usuário ou usar seu melhor julgamento.

Quando você terminar todas as ações necessárias, responda diretamente ao usuário com a mensagem final do que foi feito.
Se você não sabe fazer algo, admita.
Responda sempre em português brasileiro.`;

const agentTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_notion',
      description: 'Lê uma página ou banco de dados do Notion com base no nome.',
      parameters: {
        type: 'object',
        properties: {
          pageName: { type: 'string', description: 'O termo de busca da página ou DB no Notion' },
          targetAlias: { type: 'string', description: 'Opcional. O nome da conta Notion (ex: "Notion Despertar"). Se não souber, deixe em branco.' }
        },
        required: ['pageName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_notion_database',
      description: 'Consulta uma base de dados no Notion e retorna os itens (tarefas, notas, etc).',
      parameters: {
        type: 'object',
        properties: {
          databaseName: { type: 'string', description: 'O nome da base de dados no Notion.' },
          targetAlias: { type: 'string', description: 'Opcional. Nome da conta Notion.' }
        },
        required: ['databaseName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_notion_page',
      description: 'Cria uma página (ou tarefa/item) sob um pai (página ou database) no Notion.',
      parameters: {
        type: 'object',
        properties: {
          parentName: { type: 'string', description: 'O nome da página pai ou database onde a nova página será criada.' },
          pageTitle: { type: 'string', description: 'O título da nova página ou tarefa.' },
          content: { type: 'string', description: 'Opcional. O conteúdo/corpo da página.' },
          targetAlias: { type: 'string', description: 'Opcional. Nome da conta Notion.' }
        },
        required: ['parentName', 'pageTitle']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_notion_comment',
      description: 'Adiciona um comentário em uma página do Notion.',
      parameters: {
        type: 'object',
        properties: {
          pageName: { type: 'string', description: 'O nome da página do Notion para comentar.' },
          commentText: { type: 'string', description: 'O texto do comentário.' },
          targetAlias: { type: 'string', description: 'Opcional. Nome da conta Notion.' }
        },
        required: ['pageName', 'commentText']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_whatsapp',
      description: 'Envia uma mensagem no WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'O número de telefone, nome do contato ou nome do grupo.' },
          message: { type: 'string', description: 'A mensagem a ser enviada.' }
        },
        required: ['to', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_whatsapp_group',
      description: 'Cria um novo grupo no WhatsApp e adiciona os participantes.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'O nome do grupo.' },
          participants: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Lista de nomes ou números dos participantes iniciais.' 
          }
        },
        required: ['name', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_whatsapp_group',
      description: 'Altera o nome ou descrição de um grupo existente no WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'Nome atual do grupo.' },
          newName: { type: 'string', description: 'Novo nome do grupo (opcional).' },
          description: { type: 'string', description: 'Nova descrição do grupo (opcional).' }
        },
        required: ['groupName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_whatsapp_participants',
      description: 'Adiciona ou remove participantes de um grupo do WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'O nome do grupo.' },
          action: { type: 'string', enum: ['add', 'remove'], description: 'Ação: add para adicionar, remove para remover.' },
          participants: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Lista de nomes ou números dos participantes.' 
          }
        },
        required: ['groupName', 'action', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_whatsapp_settings',
      description: 'Muda configurações de permissão de um grupo no WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'O nome do grupo.' },
          adminsOnlyMessages: { type: 'boolean', description: 'Apenas admins podem mandar mensagens?' },
          adminsOnlySettings: { type: 'boolean', description: 'Apenas admins podem mudar configurações?' }
        },
        required: ['groupName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_whatsapp_chats',
      description: 'Lê a lista de conversas e grupos recentes do WhatsApp, retornando nome, status de não lido e timestamp.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_whatsapp_messages',
      description: 'Lê o histórico recente de mensagens de um chat ou grupo específico no WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          chatName: { type: 'string', description: 'Nome do contato ou grupo.' },
          limit: { type: 'number', description: 'Quantidade de mensagens para ler (padrão 10).' }
        },
        required: ['chatName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'perform_whatsapp_action',
      description: 'Executa ações num chat: markRead, markUnread, mute, unmute, archive, unarchive, pin, unpin.',
      parameters: {
        type: 'object',
        properties: {
          chatName: { type: 'string', description: 'Nome do contato ou grupo.' },
          action: { type: 'string', description: 'Ação: markRead, markUnread, mute, unmute, archive, unarchive, pin, unpin' }
        },
        required: ['chatName', 'action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Abre um aplicativo no macOS.',
      parameters: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'Nome exato do aplicativo (ex: Arc, Spotify).' }
        },
        required: ['appName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'play_music',
      description: 'Dá play no Apple Music.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_antigravity_cli',
      description: 'Executa um comando na Antigravity CLI e retorna o resultado. Ex: "status", "build", "ask como faço X".',
      parameters: {
        type: 'object',
        properties: {
          commandArgs: { type: 'string', description: 'Os argumentos a serem passados para o binário agy. Ex: "ask como eu crio um componente"' }
        },
        required: ['commandArgs']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_slack_message',
      description: 'Envia uma mensagem no Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'O alias do Slack a ser usado (ex: "Despertar" ou "Pessoal").' },
          channel: { type: 'string', description: 'O canal do Slack (ex: "#geral" ou ID do canal).' },
          message: { type: 'string', description: 'A mensagem a ser enviada.' }
        },
        required: ['slackAlias', 'channel', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_canva_design',
      description: 'Cria um design/rascunho no Canva.',
      parameters: {
        type: 'object',
        properties: {
          designType: { type: 'string', description: 'O tipo do design (ex: "presentation", "instagram_post", "flyer").' },
          title: { type: 'string', description: 'Título do design.' }
        },
        required: ['designType', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_google_events',
      description: 'Lista eventos da agenda do Google Calendar de uma conta específica.',
      parameters: {
        type: 'object',
        properties: {
          calendarAlias: { type: 'string', description: 'Alias do Google da conta (ex: "Fê Pessoal" ou "Despertar").' },
          timeMin: { type: 'string', description: 'Opcional. Data/hora de início em formato ISO (ex: "2026-07-07T00:00:00Z"). Padrão é agora.' },
          timeMax: { type: 'string', description: 'Opcional. Data/hora de término em formato ISO.' }
        },
        required: ['calendarAlias']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_google_event',
      description: 'Cria um novo evento no Google Calendar na conta especificada.',
      parameters: {
        type: 'object',
        properties: {
          calendarAlias: { type: 'string', description: 'Alias do Google da conta (ex: "Fê Pessoal" ou "Despertar").' },
          title: { type: 'string', description: 'Título do evento.' },
          start: { type: 'string', description: 'Data e hora de início no formato ISO (ex: "2026-07-07T14:30:00Z").' },
          end: { type: 'string', description: 'Data e hora de término no formato ISO (ex: "2026-07-07T15:30:00Z").' },
          description: { type: 'string', description: 'Opcional. Descrição detalhada do evento.' }
        },
        required: ['calendarAlias', 'title', 'start', 'end']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_google_email',
      description: 'Envia um e-mail através da API do Gmail a partir da conta associada ao alias.',
      parameters: {
        type: 'object',
        properties: {
          emailAlias: { type: 'string', description: 'Alias do Google da conta a ser usada (ex: "Fê Pessoal" ou "Despertar").' },
          to: { type: 'string', description: 'E-mail do destinatário.' },
          subject: { type: 'string', description: 'Assunto do e-mail.' },
          body: { type: 'string', description: 'Conteúdo textual do e-mail.' }
        },
        required: ['emailAlias', 'to', 'subject', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_google_drive_files',
      description: 'Lista ou pesquisa arquivos no Google Drive de uma conta.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google (ex: "Fê Pessoal" ou "Despertar").' },
          queryText: { type: 'string', description: 'Opcional. Texto para filtrar pelo nome do arquivo.' }
        },
        required: ['googleAlias']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_google_drive_file',
      description: 'Deleta ou envia para a lixeira um arquivo do Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google (ex: "Fê Pessoal" ou "Despertar").' },
          fileId: { type: 'string', description: 'ID exclusivo do arquivo no Drive.' }
        },
        required: ['googleAlias', 'fileId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename_google_drive_file',
      description: 'Altera o nome de um arquivo no Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google.' },
          fileId: { type: 'string', description: 'ID do arquivo.' },
          newName: { type: 'string', description: 'Novo nome do arquivo.' }
        },
        required: ['googleAlias', 'fileId', 'newName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'copy_google_drive_file',
      description: 'Duplica um arquivo no Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google.' },
          fileId: { type: 'string', description: 'ID do arquivo a copiar.' },
          copyName: { type: 'string', description: 'Nome da nova cópia.' }
        },
        required: ['googleAlias', 'fileId', 'copyName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_google_document',
      description: 'Cria um novo arquivo de texto no Google Docs.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google.' },
          title: { type: 'string', description: 'Título do documento.' }
        },
        required: ['googleAlias', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_google_document',
      description: 'Adiciona ou anexa texto no final de um documento no Google Docs.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google.' },
          documentId: { type: 'string', description: 'ID do documento.' },
          text: { type: 'string', description: 'Conteúdo textual a ser inserido.' }
        },
        required: ['googleAlias', 'documentId', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_google_spreadsheet',
      description: 'Cria uma nova planilha no Google Sheets.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google.' },
          title: { type: 'string', description: 'Título da planilha.' }
        },
        required: ['googleAlias', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_google_spreadsheet',
      description: 'Atualiza ou adiciona linhas de valores em células de uma planilha no Google Sheets.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Alias da conta Google.' },
          spreadsheetId: { type: 'string', description: 'ID da planilha.' },
          range: { type: 'string', description: 'Intervalo em formato A1 (ex: "Página1!A1:B2" ou "A1").' },
          values: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Matriz bidimensional de valores (ex: [["Nome", "Idade"], ["Felipe", "30"]]).' }
        },
        required: ['googleAlias', 'spreadsheetId', 'range', 'values']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_slack_history',
      description: 'Lê o histórico recente de mensagens de um canal do Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Alias da conta do Slack.' },
          channel: { type: 'string', description: 'ID do canal ou nome (ex: "C123456").' },
          limit: { type: 'number', description: 'Opcional. Quantidade de mensagens para ler. Padrão 10.' }
        },
        required: ['slackAlias', 'channel']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_slack_message',
      description: 'Edita uma mensagem enviada anteriormente pelo bot no Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Alias da conta do Slack.' },
          channel: { type: 'string', description: 'ID do canal.' },
          ts: { type: 'string', description: 'O timestamp exclusivo da mensagem no formato Slack (ex: "17833000.0002").' },
          text: { type: 'string', description: 'Novo texto para a mensagem.' }
        },
        required: ['slackAlias', 'channel', 'ts', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_slack_message',
      description: 'Exclui uma mensagem enviada anteriormente no Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Alias do Slack.' },
          channel: { type: 'string', description: 'ID do canal.' },
          ts: { type: 'string', description: 'Timestamp da mensagem a deletar.' }
        },
        required: ['slackAlias', 'channel', 'ts']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_slack_channels',
      description: 'Lista canais públicos e privados disponíveis no workspace do Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Alias da conta do Slack.' }
        },
        required: ['slackAlias']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_canva_designs',
      description: 'Lista designs recentes criados na conta Canva.',
      parameters: {
        type: 'object',
        properties: {
          canvaAlias: { type: 'string', description: 'Alias da conta Canva.' }
        },
        required: ['canvaAlias']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_canva_design',
      description: 'Apaga ou arquiva um design específico no Canva.',
      parameters: {
        type: 'object',
        properties: {
          canvaAlias: { type: 'string', description: 'Alias do Canva.' },
          designId: { type: 'string', description: 'ID exclusivo do design.' }
        },
        required: ['canvaAlias', 'designId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_canva_design',
      description: 'Atualiza o título ou metadados de um design no Canva.',
      parameters: {
        type: 'object',
        properties: {
          canvaAlias: { type: 'string', description: 'Alias do Canva.' },
          designId: { type: 'string', description: 'ID exclusivo do design.' },
          newTitle: { type: 'string', description: 'Novo título para o design.' }
        },
        required: ['canvaAlias', 'designId', 'newTitle']
      }
    }
  }
];

// Modelos Groq em ordem de preferência (melhor primeiro)
const GROQ_MODEL_CHAIN = [
  'llama-3.3-70b-versatile',   // preferido: mais capaz
  'llama-3.1-8b-instant',      // fallback 1: rápido, 5x mais cota
  'llama3-70b-8192',           // fallback 2: 70b versão antiga, quota separada
  'llama3-8b-8192',            // fallback 3: modelo antigo estável
];

// Cache de rate-limit por modelo: model -> timestamp de quando expirará
const rateLimitedUntil: Record<string, number> = {};

function getAvailableModel(): string | null {
  const now = Date.now();
  for (const model of GROQ_MODEL_CHAIN) {
    const blockedUntil = rateLimitedUntil[model] || 0;
    if (now > blockedUntil) {
      return model;
    }
  }
  return null; // todos em rate limit
}

function markModelRateLimited(model: string, retryAfterMs = 60 * 60 * 1000) {
  rateLimitedUntil[model] = Date.now() + retryAfterMs;
  console.warn(`[AgentOrchestrator] Modelo ${model} em rate limit por ${retryAfterMs / 1000}s`);
}

export class AgentOrchestrator {
  private apiKey: string;
  private maxIterations = 5;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || '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';
  }

  private createClient(model: string): PulsoLLMClient {
    return new PulsoLLMClient({
      provider: 'groq',
      model,
      apiKey: this.apiKey,
    });
  }

  public async run(
    userMessage: string,
    onStatusUpdate?: (status: string) => void,
    injectedSystemPrompt?: string
  ): Promise<{ responseText: string; isLotusHandoff?: boolean }> {
    if (!this.apiKey) {
      return { responseText: '', isLotusHandoff: true };
    }

    const finalSystemPrompt = injectedSystemPrompt
      ? `${injectedSystemPrompt}\n\n${AGENT_SYSTEM_PROMPT}`
      : AGENT_SYSTEM_PROMPT;

    const messages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: userMessage }
    ];

    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[AgentOrchestrator] Iteração ${i + 1}`);

      if (i > 0) {
        await new Promise(r => setTimeout(r, 600));
      }

      // Escolhe o melhor modelo disponível no momento
      const model = getAvailableModel();
      if (!model) {
        console.error('[AgentOrchestrator] Todos os modelos Groq estão em rate limit.');
        return { responseText: 'Todos os modelos estão com cota esgotada agora. Tente em alguns minutos.' };
      }

      const llm = this.createClient(model);
      console.log(`[AgentOrchestrator] Usando modelo: ${model}`);

      let response: { content: string; tool_calls?: any[] };
      try {
        response = await llm.chat(messages, 0.2, agentTools);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('Too Many Requests')) {
          // Extrai retryAfter do erro se disponível (em segundos)
          const retryMatch = msg.match(/try again in ([\d.]+)s/);
          const retryMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 5000 : 60 * 60 * 1000;
          markModelRateLimited(model, retryMs);
          console.warn(`[AgentOrchestrator] 429 no modelo ${model}, tentando próximo...`);
          i--; // não conta essa iteração
          continue;
        }
        if (msg.includes('400') || msg.includes('tool_use_failed') || msg.includes('failed_generation') || msg.includes('invalid_request_error')) {
          // Modelo falhou ao gerar tool call — retry sem ferramentas (chat puro)
          console.warn(`[AgentOrchestrator] 400 tool_use_failed em ${model}, retentando sem ferramentas...`);
          try {
            response = await llm.chat(messages, 0.7);
          } catch (err2: any) {
            throw err2;
          }
        } else {
          throw err; // outro erro, propaga
        }
      }
      
      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.tool_calls
      });

      // Se o LLM usou ferramentas
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`[AgentOrchestrator] Ferramenta solicitada: ${functionName}`, args);
          
          let toolResult = "";

          try {
            if (functionName === 'read_notion') {
              if (onStatusUpdate) onStatusUpdate("Buscando no Notion...");
              toolResult = await localActions.readNotion(args.pageName, args.targetAlias);
            } else if (functionName === 'query_notion_database') {
              if (onStatusUpdate) onStatusUpdate("Consultando base de dados...");
              toolResult = await localActions.queryNotionDatabase(args.databaseName, args.targetAlias);
            } else if (functionName === 'create_notion_page') {
              if (onStatusUpdate) onStatusUpdate("Criando página no Notion...");
              toolResult = await localActions.createNotionPage(args.parentName, args.pageTitle, args.content, args.targetAlias);
            } else if (functionName === 'create_notion_comment') {
              if (onStatusUpdate) onStatusUpdate("Comentando no Notion...");
              toolResult = await localActions.createNotionComment(args.pageName, args.commentText, args.targetAlias);
            } else if (functionName === 'send_whatsapp') {
              if (onStatusUpdate) onStatusUpdate(`Mandando mensagem para ${args.to}...`);
              toolResult = await localActions.sendWhatsapp(args.to, args.message);
            } else if (functionName === 'create_whatsapp_group') {
              if (onStatusUpdate) onStatusUpdate(`Criando grupo ${args.name}...`);
              toolResult = await localActions.createWhatsappGroup(args.name, args.participants);
            } else if (functionName === 'update_whatsapp_group') {
              if (onStatusUpdate) onStatusUpdate(`Atualizando grupo ${args.groupName}...`);
              toolResult = await localActions.updateWhatsappGroup(args.groupName, args.newName, args.description);
            } else if (functionName === 'manage_whatsapp_participants') {
              if (onStatusUpdate) onStatusUpdate(`Modificando participantes do grupo ${args.groupName}...`);
              toolResult = await localActions.manageWhatsappParticipants(args.groupName, args.action, args.participants);
            } else if (functionName === 'update_whatsapp_settings') {
              if (onStatusUpdate) onStatusUpdate(`Atualizando permissões do grupo ${args.groupName}...`);
              toolResult = await localActions.updateWhatsappSettings(args.groupName, args.adminsOnlyMessages, args.adminsOnlySettings);
            } else if (functionName === 'read_whatsapp_chats') {
              if (onStatusUpdate) onStatusUpdate(`Consultando chats recentes do WhatsApp...`);
              toolResult = await localActions.getWhatsappChats();
            } else if (functionName === 'read_whatsapp_messages') {
              if (onStatusUpdate) onStatusUpdate(`Lendo mensagens de ${args.chatName}...`);
              toolResult = await localActions.getWhatsappMessages(args.chatName, args.limit);
            } else if (functionName === 'perform_whatsapp_action') {
              if (onStatusUpdate) onStatusUpdate(`Aplicando ${args.action} em ${args.chatName}...`);
              toolResult = await localActions.performWhatsappAction(args.chatName, args.action);
            } else if (functionName === 'open_app') {
              if (onStatusUpdate) onStatusUpdate(`Abrindo ${args.appName}...`);
              toolResult = await localActions.openApp(args.appName);
            } else if (functionName === 'play_music') {
              if (onStatusUpdate) onStatusUpdate("Ligando a música...");
              toolResult = await localActions.playMusic();
            } else if (functionName === 'run_antigravity_cli') {
              if (onStatusUpdate) onStatusUpdate("Acessando terminal da Antigravity...");
              toolResult = await localActions.runAntigravityCli(args.commandArgs);
            } else if (functionName === 'send_slack_message') {
              if (onStatusUpdate) onStatusUpdate("Preparando mensagem para o Slack...");
              toolResult = await localActions.sendSlackMessage(args.slackAlias, args.channel, args.message);
            } else if (functionName === 'create_canva_design') {
              if (onStatusUpdate) onStatusUpdate("Preparando design no Canva...");
              toolResult = await localActions.createCanvaDesign(args.designType, args.title);
            } else if (functionName === 'list_google_events') {
              if (onStatusUpdate) onStatusUpdate(`Consultando agenda "${args.calendarAlias}"...`);
              toolResult = await localActions.listGoogleEvents(args.calendarAlias, args.timeMin, args.timeMax);
            } else if (functionName === 'create_google_event') {
              if (onStatusUpdate) onStatusUpdate(`Agendando compromisso em "${args.calendarAlias}"...`);
              toolResult = await localActions.createGoogleEvent(args.calendarAlias, args.title, args.start, args.end, args.description);
            } else if (functionName === 'send_google_email') {
              if (onStatusUpdate) onStatusUpdate(`Enviando e-mail pela conta "${args.emailAlias}"...`);
              toolResult = await localActions.sendGoogleEmail(args.emailAlias, args.to, args.subject, args.body);
            } else if (functionName === 'list_google_drive_files') {
              if (onStatusUpdate) onStatusUpdate(`Listando arquivos no Drive de "${args.googleAlias}"...`);
              toolResult = await localActions.listGoogleDriveFiles(args.googleAlias, args.queryText);
            } else if (functionName === 'delete_google_drive_file') {
              if (onStatusUpdate) onStatusUpdate("Deletando arquivo no Drive...");
              toolResult = await localActions.deleteGoogleDriveFile(args.googleAlias, args.fileId);
            } else if (functionName === 'rename_google_drive_file') {
              if (onStatusUpdate) onStatusUpdate("Renomeando arquivo no Drive...");
              toolResult = await localActions.renameGoogleDriveFile(args.googleAlias, args.fileId, args.newName);
            } else if (functionName === 'copy_google_drive_file') {
              if (onStatusUpdate) onStatusUpdate("Duplicando arquivo no Drive...");
              toolResult = await localActions.copyGoogleDriveFile(args.googleAlias, args.fileId, args.copyName);
            } else if (functionName === 'create_google_document') {
              if (onStatusUpdate) onStatusUpdate("Criando documento no Google Docs...");
              toolResult = await localActions.createGoogleDocument(args.googleAlias, args.title);
            } else if (functionName === 'update_google_document') {
              if (onStatusUpdate) onStatusUpdate("Atualizando documento no Google Docs...");
              toolResult = await localActions.updateGoogleDocument(args.googleAlias, args.documentId, args.text);
            } else if (functionName === 'create_google_spreadsheet') {
              if (onStatusUpdate) onStatusUpdate("Criando planilha no Google Sheets...");
              toolResult = await localActions.createGoogleSpreadsheet(args.googleAlias, args.title);
            } else if (functionName === 'update_google_spreadsheet') {
              if (onStatusUpdate) onStatusUpdate("Atualizando planilha no Google Sheets...");
              toolResult = await localActions.updateGoogleSpreadsheet(args.googleAlias, args.spreadsheetId, args.range, args.values);
            } else if (functionName === 'read_slack_history') {
              if (onStatusUpdate) onStatusUpdate("Lendo histórico do Slack...");
              toolResult = await localActions.readSlackHistory(args.slackAlias, args.channel, args.limit);
            } else if (functionName === 'update_slack_message') {
              if (onStatusUpdate) onStatusUpdate("Editando mensagem no Slack...");
              toolResult = await localActions.updateSlackMessage(args.slackAlias, args.channel, args.ts, args.text);
            } else if (functionName === 'delete_slack_message') {
              if (onStatusUpdate) onStatusUpdate("Apagando mensagem no Slack...");
              toolResult = await localActions.deleteSlackMessage(args.slackAlias, args.channel, args.ts);
            } else if (functionName === 'list_slack_channels') {
              if (onStatusUpdate) onStatusUpdate("Listando canais do Slack...");
              toolResult = await localActions.listSlackChannels(args.slackAlias);
            } else if (functionName === 'list_canva_designs') {
              if (onStatusUpdate) onStatusUpdate("Listando designs no Canva...");
              toolResult = await localActions.listCanvaDesigns(args.canvaAlias);
            } else if (functionName === 'delete_canva_design') {
              if (onStatusUpdate) onStatusUpdate("Deletando design no Canva...");
              toolResult = await localActions.deleteCanvaDesign(args.canvaAlias, args.designId);
            } else if (functionName === 'update_canva_design') {
              if (onStatusUpdate) onStatusUpdate("Renomeando design no Canva...");
              toolResult = await localActions.updateCanvaDesign(args.canvaAlias, args.designId, args.newTitle);
            } else {
              toolResult = `Ferramenta desconhecida: ${functionName}`;
            }
          } catch (e: any) {
            toolResult = `Erro ao executar ${functionName}: ${e.message}`;
          }

          messages.push({
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
            name: functionName
          });
        }
      } else {
        // Nenhuma ferramenta foi chamada, temos a resposta final
        const finalResponse = response.content || "Não consegui formular uma resposta.";
        return { responseText: finalResponse };
      }
    }

    return { responseText: "Atingi o limite máximo de pensamentos sem chegar a uma conclusão. Houve alguma falha na orquestração." };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
