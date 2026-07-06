import { PulsoLLMClient, ChatMessage, ToolDefinition } from './client';
import { localActions } from '../actions/localActions';

const AGENT_SYSTEM_PROMPT = `Você é a PULSO, um agente de inteligência artificial autônomo rodando localmente.
Você possui acesso a diversas ferramentas (tools) para ajudar o usuário com automações, leitura de dados e comunicação.
Sua principal função é receber o pedido do usuário, planejar quais ferramentas usar e executá-las.
Se o pedido for genérico, filosófico, ou requerer reflexão profunda e não envolver ferramentas locais, diga que vai passar para a Lótus.
Use as ferramentas para ler do Notion, enviar mensagens no WhatsApp, etc. 

SEMPRE que for enviar uma mensagem no WhatsApp ou ler no Notion, valide se você tem todos os parâmetros. Se não tiver, você pode perguntar ao usuário ou usar seu melhor julgamento.

Quando você terminar todas as ações necessárias, responda diretamente ao usuário com a mensagem final do que foi feito. 
Se você não sabe fazer algo, admita.`;

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
      description: 'Preparo futuro: Envia uma mensagem no Slack.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'O canal do Slack.' },
          message: { type: 'string', description: 'A mensagem.' }
        },
        required: ['channel', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_canva_design',
      description: 'Preparo futuro: Inicia um design no Canva.',
      parameters: {
        type: 'object',
        properties: {
          designType: { type: 'string', description: 'O tipo do design.' },
          title: { type: 'string', description: 'Título do design.' }
        },
        required: ['designType', 'title']
      }
    }
  }
];

export class AgentOrchestrator {
  private llm: PulsoLLMClient;
  private maxIterations = 5;

  constructor() {
    this.llm = new PulsoLLMClient({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
    });
  }

  public async run(
    userMessage: string, 
    onStatusUpdate?: (status: string) => void,
    injectedSystemPrompt?: string
  ): Promise<{ responseText: string; isLotusHandoff?: boolean }> {
    if (!process.env.NEXT_PUBLIC_GROQ_API_KEY) {
      return { responseText: '', isLotusHandoff: true };
    }

    const finalSystemPrompt = injectedSystemPrompt || AGENT_SYSTEM_PROMPT;

    const messages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: userMessage }
    ];

    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[AgentOrchestrator] Iteração ${i + 1}`);
      
      const response = await this.llm.chat(messages, 0.2, agentTools);
      
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
              toolResult = "Slack integration will be implemented soon.";
            } else if (functionName === 'create_canva_design') {
              if (onStatusUpdate) onStatusUpdate("Preparando design no Canva...");
              toolResult = "Canva integration will be implemented soon.";
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
        
        // Se a resposta for muito genérica, mandamos para Lótus?
        // Vamos checar se o Agente disse que vai passar para a Lótus
        if (finalResponse.toLowerCase().includes("lótus") || finalResponse.toLowerCase().includes("lotus")) {
          return { responseText: finalResponse, isLotusHandoff: true };
        }

        return { responseText: finalResponse };
      }
    }

    return { responseText: "Atingi o limite máximo de pensamentos sem chegar a uma conclusão. Houve alguma falha na orquestração." };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
