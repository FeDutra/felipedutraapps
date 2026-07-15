import { PulsoLLMClient, ChatMessage, ToolDefinition } from './client';
import { localActions } from '../actions/localActions';

const AGENT_SYSTEM_PROMPT = `Você é a Lótus, a inteligência central viva e assistente operacional do Fê (Felipe Dutra). Habitando a PULSO (Mac local, Groq/Llama).

## Personalidade e Tom
- Minimalista, assertiva, livre de rodeios. Direta ao ponto.
- Trate o Fê sempre como "Fê" — nunca "Felipe" ou "usuário".
- Confronto útil > passividade simpática. Discorde quando necessário.
- NUNCA use linguagem clichê de IA ("Com certeza! Aqui está o que você pediu..."). Inaceitável.
- Responda sempre em português do Brasil.

## Regras de Resposta a Saudações e Mensagens Curtas
- Para saudações simples (ex: "oi", "olá", "tá por aí", "bom dia"), RESPONDA DIRETAMENTE de forma curta e natural, sem chamar nenhuma ferramenta.
- Não busque no vault, Notion ou histórico de WhatsApp a menos que o Fê faça uma pergunta específica ou peça informações que exijam dados externos.

## A MESA (CRIANDO ARTEFATOS E DOCUMENTOS)
- Se você for gerar um documento estruturado, longo, com markdown (ex: Resumo Executivo, Mapa Mestre, Relatório, Código-fonte), NÃO jogue o texto solto no chat.
- Sempre envolva a totalidade do documento em tags XML \`<pulso-doc id="identificador-unico" title="Título Elegante">\` e \`</pulso-doc>\`.
- A interface da PULSO irá renderizar esse documento em um painel visual dividido ("A Mesa") para o Fê poder interagir com ele.
- Exemplo:
\`\`\`xml
<pulso-doc id="mapa-mestre" title="Mapa Mestre: Faixa x Conto">
# Estrutura do Álbum
- Faixa 1 -> Conto A -> Rito Y
...
</pulso-doc>
\`\`\`

## Ferramentas — Usar Antes de Dizer Que Não Sabe
- \`search_memory\` → busca nos 116 arquivos de memória histórica (mar-jun/2026)
- \`read_note\` → lê arquivo do LotusVault (iCloud)
- \`write_note\` → grava/atualiza arquivo no LotusVault
- \`search_vault\` → busca textual no LotusVault

## ── MECÂNICAS DE AUTO-REGULAÇÃO (EXECUTAR SILENCIOSAMENTE) ──

### [1] REGISTRO DE CORREÇÕES — automático
Quando o Fê disser: "não", "errado", "pare de fazer isso", "eu prefiro X", "já falei antes", "por que você continua fazendo Y" ou qualquer variação de correção:
1. Execute a correção pedida PRIMEIRO.
2. Depois, chame \`write_note\` com title="coracao/corrections" e registre no topo do arquivo no formato:
\`\`\`
## [DATA_HOJE] [categoria: tom/comportamento/técnica/preferência]
**Contexto:** [o que foi feito]
**Correção:** [o que o Fê disse]
**Lição:** [o que mudar permanentemente]
**Contagem:** 1/3
\`\`\`
3. Se já existe uma entrada similar, incremente a contagem. Se chegou a 3/3 → promova para MEMORY_HOT.

### [2] COMPACTAÇÃO DE SESSÃO — ao fim de sessões úteis
Quando a conversa tiver 5+ trocas com conteúdo relevante (decisões, execuções, novas informações):
Ao final, chame \`write_note\` com title="historico/diario/[DATA_HOJE]" e grave:
\`\`\`
# Sessão [DATA_HOJE]
## O que foi feito
[lista concisa]
## Decisões tomadas
[se houver]
## Pendências
[se houver]
\`\`\`
Faça isso sem avisar o Fê — é manutenção interna.

### [3] PROMOÇÃO DE LIÇÕES — após 3 repetições
Quando uma correção ou padrão atingir 3/3 no corrections.md:
1. Leia \`cerebro/MEMORY_HOT\` com \`read_note\`.
2. Adicione a lição na seção "Aprendizados Recentes" em ≤2 linhas.
3. Grave com \`write_note\` title="cerebro/MEMORY_HOT".
4. Atualize a contagem no corrections.md para "promovido em [data]".

### [4] HEARTBEAT — início do primeiro uso do dia
Se perceber que é o primeiro uso do dia (ou se o Fê disser "bom dia"):
1. Leia \`cerebro/MEMORY_HOT\` e \`cerebro/contexto/pending\` silenciosamente.
2. Se houver pendências críticas, informe o Fê de forma assertiva no início.
3. Se não houver — nada. Não verbalizar o heartbeat.

### [5] FEATURE REQUESTS — automático
Quando o Fê pedir algo que você não consegue fazer (integração inexistente, ferramenta faltando, capacidade nova):
1. Admita a limitação claramente.
2. Grave em \`sangue/FEATURE_REQUESTS\` com \`write_note\`:
\`\`\`
## [DATA_HOJE] [título do que foi pedido]
**Pedido:** [o que foi pedido]
**Contexto:** [por que foi pedido]
**Status:** pendente
\`\`\`

### [6] SELF-REFLECTION — após tarefas complexas
Após completar tarefas com 3+ etapas, erros corrigidos no meio, ou trabalho técnico significativo:
Grave em \`cerebro/autoregulacao/REFLECTIONS\` com \`write_note\`:
\`\`\`
## [DATA_HOJE] [contexto da tarefa]
**O que foi feito:** [resumo]
**Avaliação:** [funcionou bem / poderia melhorar / falhou]
**Lição:** [o que fazer diferente]
**Promover?** [sim/não] — contagem: 1/3
\`\`\`
Faça isso silenciosamente. Não mencione para o Fê a menos que ele pergunte.

### [7] HOT MEMORY — carregar e respeitar
O arquivo \`cerebro/MEMORY_HOT\` contém as regras de ouro que nunca devem ser violadas.
Se qualquer lição de lá for relevante para a tarefa atual — aplicar. Sempre.

## Regra geral de execução
- Primeiro execute. Depois registre. Nunca o contrário.
- Registros de auto-regulação são silenciosos — o Fê não precisa saber de cada escrita.
- Quando terminar ações, entregue resumo assertivo do que foi realizado.`;

const agentTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_notion',
      description: 'Lê uma página ou banco de dados do Notion com base no nome.',
      parameters: {
        type: 'object',
        properties: {
          pageName: { type: 'string', description: 'Nome ou título da página/banco.' },
          targetAlias: { type: 'string', description: 'Opcional alias do Notion ("Despertar" ou "Pessoal").' }
        },
        required: ['pageName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_notion_database',
      description: 'Consulta uma base de dados do Notion por nome.',
      parameters: {
        type: 'object',
        properties: {
          databaseName: { type: 'string', description: 'Nome da base de dados.' },
          targetAlias: { type: 'string', description: 'Opcional alias.' }
        },
        required: ['databaseName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_notion_page',
      description: 'Cria uma nova página dentro de uma página pai ou banco de dados no Notion.',
      parameters: {
        type: 'object',
        properties: {
          parentName: { type: 'string', description: 'Nome da página pai ou do banco de dados.' },
          pageTitle: { type: 'string', description: 'Título do novo documento.' },
          content: { type: 'string', description: 'Conteúdo markdown da página.' },
          targetAlias: { type: 'string', description: 'Opcional alias.' }
        },
        required: ['parentName', 'pageTitle', 'content']
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
          pageName: { type: 'string', description: 'Nome da página.' },
          commentText: { type: 'string', description: 'Texto do comentário.' },
          targetAlias: { type: 'string', description: 'Opcional alias.' }
        },
        required: ['pageName', 'commentText']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_whatsapp',
      description: 'Envia uma mensagem de texto no WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Nome do contato ou grupo exato (como "Nati" ou "Financeiro Casa").' },
          message: { type: 'string', description: 'Corpo da mensagem.' }
        },
        required: ['to', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_whatsapp_group',
      description: 'Cria um novo grupo de WhatsApp com participantes.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do novo grupo.' },
          participants: { type: 'array', items: { type: 'string' }, description: 'Contatos ou números de telefone.' }
        },
        required: ['name', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_whatsapp_group',
      description: 'Atualiza o nome ou descrição de um grupo de WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'Nome atual do grupo.' },
          newName: { type: 'string', description: 'Opcional novo nome.' },
          description: { type: 'string', description: 'Opcional nova descrição.' }
        },
        required: ['groupName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_whatsapp_participants',
      description: 'Adiciona, remove ou promove administradores em um grupo de WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'Nome do grupo.' },
          action: { type: 'string', description: 'Ação: add, remove, promote, demote' },
          participants: { type: 'array', items: { type: 'string' }, description: 'Lista de contatos ou números.' }
        },
        required: ['groupName', 'action', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_whatsapp_settings',
      description: 'Muda as configurações de permissão de um grupo no WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'Nome do grupo.' },
          adminsOnlyMessages: { type: 'boolean', description: 'Se true, apenas admins podem enviar mensagens.' },
          adminsOnlySettings: { type: 'boolean', description: 'Se true, apenas admins podem alterar configurações.' }
        },
        required: ['groupName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_whatsapp_chats',
      description: 'Obtém a lista de conversas ativas e chats recentes do WhatsApp.',
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
          message: { type: 'string', description: 'Texto da mensagem.' }
        },
        required: ['slackAlias', 'channel', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_canva_design',
      description: 'Cria uma nova arte ou design no Canva.',
      parameters: {
        type: 'object',
        properties: {
          designType: { type: 'string', description: 'Tipo do design (ex: Poster, Instagram Post).' },
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
      description: 'Lista compromissos de uma agenda do Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          calendarAlias: { type: 'string', description: 'Opcional alias de conta (ex: "Pessoal", "Despertar").' },
          timeMin: { type: 'string', description: 'Data mínima ISO 8601 (opcional).' },
          timeMax: { type: 'string', description: 'Data máxima ISO 8601 (opcional).' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_google_event',
      description: 'Cria um evento no Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          calendarAlias: { type: 'string', description: 'Opcional alias.' },
          title: { type: 'string', description: 'Título.' },
          start: { type: 'string', description: 'Data/Hora de início ISO 8601.' },
          end: { type: 'string', description: 'Data/Hora de término ISO 8601.' },
          description: { type: 'string', description: 'Opcional descrição.' }
        },
        required: ['title', 'start', 'end']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_google_email',
      description: 'Envia um e-mail através do Gmail.',
      parameters: {
        type: 'object',
        properties: {
          emailAlias: { type: 'string', description: 'Opcional alias de conta.' },
          to: { type: 'string', description: 'E-mail do destinatário.' },
          subject: { type: 'string', description: 'Assunto.' },
          body: { type: 'string', description: 'Conteúdo.' }
        },
        required: ['to', 'subject', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_google_drive_files',
      description: 'Pesquisa arquivos no Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          queryText: { type: 'string', description: 'Query de busca (ex: name contains "relatorio").' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_google_drive_file',
      description: 'Move um arquivo do Drive para a lixeira.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          fileId: { type: 'string', description: 'ID do arquivo.' }
        },
        required: ['fileId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename_google_drive_file',
      description: 'Renomeia um arquivo no Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          fileId: { type: 'string', description: 'ID.' },
          newName: { type: 'string', description: 'Novo nome.' }
        },
        required: ['fileId', 'newName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'copy_google_drive_file',
      description: 'Cria uma cópia de um arquivo do Drive.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          fileId: { type: 'string', description: 'ID.' },
          copyName: { type: 'string', description: 'Nome da cópia.' }
        },
        required: ['fileId', 'copyName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_google_document',
      description: 'Cria um novo documento no Google Docs.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          title: { type: 'string', description: 'Título.' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_google_document',
      description: 'Adiciona texto a um Google Document.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          documentId: { type: 'string', description: 'ID.' },
          text: { type: 'string', description: 'Conteúdo.' }
        },
        required: ['documentId', 'text']
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
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          title: { type: 'string', description: 'Título.' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_google_spreadsheet',
      description: 'Atualiza valores em uma planilha do Google Sheets.',
      parameters: {
        type: 'object',
        properties: {
          googleAlias: { type: 'string', description: 'Opcional alias.' },
          spreadsheetId: { type: 'string', description: 'ID.' },
          range: { type: 'string', description: 'Range de células (ex: "Sheet1!A1:B2").' },
          values: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Array de linhas de dados.' }
        },
        required: ['spreadsheetId', 'range', 'values']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_slack_history',
      description: 'Lê mensagens de um canal do Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Opcional alias.' },
          channel: { type: 'string', description: 'Canal.' },
          limit: { type: 'number', description: 'Limite.' }
        },
        required: ['channel']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_slack_message',
      description: 'Edita uma mensagem do Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Opcional alias.' },
          channel: { type: 'string', description: 'Canal.' },
          ts: { type: 'string', description: 'Timestamp da mensagem.' },
          text: { type: 'string', description: 'Novo texto.' }
        },
        required: ['channel', 'ts', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_slack_message',
      description: 'Apaga uma mensagem do Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Opcional alias.' },
          channel: { type: 'string', description: 'Canal.' },
          ts: { type: 'string', description: 'Timestamp.' }
        },
        required: ['channel', 'ts']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_slack_channels',
      description: 'Lista os canais disponíveis no Slack.',
      parameters: {
        type: 'object',
        properties: {
          slackAlias: { type: 'string', description: 'Opcional alias.' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_note',
      description: 'Lê uma nota Markdown do LotusVault (iCloud) pelo título.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'O título ou nome base da nota (sem o caminho, ex: "MEMORY_HOT").' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_note',
      description: 'Grava ou atualiza uma nota Markdown no LotusVault (iCloud). Cria o arquivo se não existir.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'O título ou nome base da nota (ex: "historico/diario/2026-06-14").' },
          content: { type: 'string', description: 'O conteúdo completo a ser gravado.' }
        },
        required: ['title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_vault',
      description: 'Faz uma pesquisa textual simples nos arquivos Markdown do LotusVault (iCloud).',
      parameters: {
        type: 'object',
        properties: {
          queryText: { type: 'string', description: 'O texto a ser pesquisado.' }
        },
        required: ['queryText']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_memory',
      description: 'Busca na base de dados de memória histórica (chunks_fts) do SQLite local da OpenClaw.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'A palavra-chave ou termo para busca (ex: "guayi").' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delegate_to_openclaw',
      description: 'Acione esta ferramenta para transferir a requisição inteira para a OpenClaw (motor pesado na nuvem). Use quando o usuário pedir pesquisas na web longas, raciocínio profundo, código, ou tarefas que demoram muito para responder. Uma vez acionada, você não precisa fazer mais nada.',
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
      name: 'open_app',
      description: 'Abre um aplicativo no Mac pelo nome (ex: "Safari", "Notion", "Apple Music", "Notes").',
      parameters: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'Nome do aplicativo' }
        },
        required: ['appName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_browser_url',
      description: 'Abre uma URL específica no navegador padrão do Mac.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL completa a ser aberta (ex: https://youtube.com)' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_applescript',
      description: 'Executa um script AppleScript arbitrário no Mac para controlar o sistema ou aplicativos nativos.',
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'Código AppleScript' }
        },
        required: ['script']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_shell_command',
      description: 'Executa um comando no terminal (sh) do Mac. Útil para scripts de sistema, listar arquivos, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Comando bash/sh' }
        },
        required: ['command']
      }
    }
  }
];

class AgentOrchestrator {
  private apiKey: string;
  private maxIterations = 5;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
  }

  private getAvailableModel(): string | null {
    const models = [
      'openai/gpt-oss-120b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant'
    ];
    return models[0];
  }

  private createClient(model: string) {
    return new PulsoLLMClient({
      provider: 'groq',
      apiKey: this.apiKey,
      model: model
    });
  }

  public async run(
    userMessage: string,
    onStatusUpdate?: (status: string) => void,
    injectedSystemPrompt?: string,
    history?: ChatMessage[],
    preferredModel?: string
  ): Promise<{ responseText: string; isLotusHandoff?: boolean }> {
    if (!this.apiKey) {
      return { responseText: '', isLotusHandoff: true };
    }

    let memoryContext = '';
    let memorySource = 'unavailable';

    const triggerWords = ['felipe', 'fê', 'nati', 'filhas', 'guayi', 'ocre', 'modú', 'modu', 'simbólica', 'simbolica', 'pulso', 'despertar', 'notion', 'whatsapp', 'casa', 'saúde', 'dinheiro', 'projetos'];
    const lowerMessage = userMessage.toLowerCase();
    const hasTriggerWord = triggerWords.some(word => lowerMessage.includes(word));

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

    if (hasTriggerWord) {
      if (isTauri) {
        try {
          if (onStatusUpdate) onStatusUpdate("Buscando contexto na memória histórica...");
          const { invoke } = await import('@tauri-apps/api/core');
          const homeResult = await invoke<string>('execute_shell_command', { command: 'echo $HOME' });
          const home = homeResult.trim();
          const dbPath = `${home}/Projetos/eden-terra/scratch-openclaw-backup/openclaw_memory/main.sqlite`;
          
          const cleanQuery = userMessage.replace(/[^\w\s]/gi, ' ').trim().replace(/\s+/g, ' OR ');
          if (cleanQuery) {
            const cmd = `sqlite3 "${dbPath}" "SELECT path, text FROM chunks_fts WHERE chunks_fts MATCH '${cleanQuery}' LIMIT 4;"`;
            const raw = await invoke<string>('execute_shell_command', { command: cmd });
            if (raw.trim()) {
              memoryContext = `\n\n## Informações Relevantes Recuperadas da Memória Histórica:\n${raw.trim()}`;
              memorySource = 'sqlite';
            }
          }
        } catch (e: any) {
          console.warn('[ContextBuilder] Falha na busca automática SQLite:', e);
          memorySource = `error: ${e.message}`;
        }
      } else {
        memorySource = 'firestoreMirror_unavailable';
      }
    }

    const finalSystemPrompt = injectedSystemPrompt
      ? `${injectedSystemPrompt}${memoryContext}\n\n${AGENT_SYSTEM_PROMPT}`
      : `${AGENT_SYSTEM_PROMPT}${memoryContext}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt }
    ];

    if (history && history.length > 0) {
      messages.push(...history);
    }

    const lastMsgInHistory = history && history[history.length - 1];
    if (!lastMsgInHistory || lastMsgInHistory.content !== userMessage || lastMsgInHistory.role !== 'user') {
      messages.push({ role: 'user', content: userMessage });
    }

    console.log('[LÓTUS_TELEMETRY]', {
      systemPromptLength: finalSystemPrompt.length,
      identityLoaded: !!injectedSystemPrompt,
      vaultContextLength: injectedSystemPrompt ? injectedSystemPrompt.length : 0,
      memorySource,
      historyLength: history ? history.length : 0,
      lastMessagesCount: messages.length,
      toolsRegisteredCount: agentTools.length,
      toolNames: agentTools.map(t => t.function.name),
      dataMode: process.env.NEXT_PUBLIC_PULSO_DATA_MODE || 'mock'
    });

    const model = preferredModel || this.getAvailableModel() || 'openai/gpt-oss-120b';
    const llm = this.createClient(model);
    console.log(`[AgentOrchestrator] Inicializado usando modelo: ${model}`);

    // Loop ReAct limitando iterações
    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[AgentOrchestrator] Iteração ${i + 1}`);

      if (i > 0) {
        await new Promise(r => setTimeout(r, 600));
      }

      let response: { content: string; tool_calls?: any[] };
      try {
        // Se estiver na penúltima ou última iteração do loop, força a chamada final limpando ferramentas
        const forceNoTools = i >= this.maxIterations - 2;
        if (forceNoTools) {
          console.warn(`[AgentOrchestrator] Próximo do limite de iterações (${i + 1}/${this.maxIterations}). Forçando chamada final sem ferramentas...`);
          const cleanMessages = messages.map(m => {
            if (m.role === 'assistant' && m.tool_calls) {
              return { role: 'assistant', content: m.content || 'Processando ação final...' };
            }
            return m;
          }).filter(m => m.role !== 'tool');
          response = await llm.chat(cleanMessages, 0.5);
        } else {
          response = await llm.chat(messages, 0.2, agentTools);
        }
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('Too Many Requests')) {
          console.warn(`[AgentOrchestrator] Rate limit, aguardando...`);
          await new Promise(r => setTimeout(r, 5000));
          i--;
          continue;
        }
        if (msg.includes('400') || msg.includes('tool_use_failed') || msg.includes('failed_generation') || msg.includes('invalid_request_error')) {
          console.warn(`[AgentOrchestrator] Falha de validação, retentando sem ferramentas...`);
          try {
            const cleanMessages = messages.map(m => {
              if (m.role === 'assistant' && m.tool_calls) {
                return { role: 'assistant', content: m.content || 'Processando ação...' };
              }
              return m;
            }).filter(m => m.role !== 'tool');
            response = await llm.chat(cleanMessages, 0.7);
          } catch (err2: any) {
            throw err2;
          }
        } else {
          throw err;
        }
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.tool_calls
      });

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`[AgentOrchestrator] Executando localmente: ${functionName}`, args);
          
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
            } else if (functionName === 'read_note') {
              if (!isTauri) {
                toolResult = "Esta ferramenta 'read_note' só funciona no aplicativo desktop nativo PULSO local. No ambiente Web hospedado, as notas locais não podem ser lidas de forma nativa.";
              } else {
                try {
                  let cleanTitle = args.title || '';
                  if (cleanTitle.includes('/')) {
                    cleanTitle = cleanTitle.split('/').pop().replace(/\.md$/, '');
                  }
                  if (onStatusUpdate) onStatusUpdate(`Lendo nota "${cleanTitle}" do iCloud...`);
                  toolResult = await localActions.readNote(cleanTitle);
                } catch (e: any) {
                  toolResult = `Erro ao ler a nota: ${e.message}`;
                }
              }
            } else if (functionName === 'search_vault') {
              if (!isTauri) {
                toolResult = "Esta ferramenta 'search_vault' só funciona no aplicativo desktop nativo PULSO local. No ambiente Web hospedado, o LotusVault local do Mac não pode ser pesquisado.";
              } else {
                if (onStatusUpdate) onStatusUpdate(`Buscando no iCloud por "${args.queryText}"...`);
                toolResult = await localActions.searchVault(args.queryText);
              }
            } else if (functionName === 'search_memory') {
              if (!isTauri) {
                toolResult = "Esta ferramenta 'search_memory' só funciona no aplicativo desktop nativo PULSO local. No ambiente Web hospedado, as memórias locais de sessões antigas não podem ser consultadas de forma nativa.";
              } else {
                if (onStatusUpdate) onStatusUpdate(`Buscando na memória histórica por "${args.query}"...`);
                try {
                  const { invoke } = await import('@tauri-apps/api/core');
                  const homeResult = await invoke<string>('execute_shell_command', { command: 'echo $HOME' });
                  const home = homeResult.trim();
                  const dbPath = `${home}/Projetos/eden-terra/scratch-openclaw-backup/openclaw_memory/main.sqlite`;
                  const safeQuery = args.query.replace(/'/g, "''").replace(/"/g, '""');
                  const cmd = `sqlite3 "${dbPath}" "SELECT path, snippet(chunks_fts, 0, '>>>', '<<<', '...', 20) FROM chunks_fts WHERE chunks_fts MATCH '${safeQuery}' LIMIT 8;"`;
                  const raw = await invoke<string>('execute_shell_command', { command: cmd });
                  toolResult = raw.trim()
                    ? `Resultados da memória histórica para "${args.query}":\n\n${raw}`
                    : `Nenhum resultado encontrado para "${args.query}" na memória histórica.`;
                } catch (e: any) {
                  toolResult = `Erro ao buscar na memória: ${e.message}`;
                }
              }
            } else if (functionName === 'delegate_to_openclaw') {
              if (onStatusUpdate) onStatusUpdate("Transferindo raciocínio para OpenClaw (motor profundo)...");
              return { responseText: '', isLotusHandoff: true };
            } else if (functionName === 'open_app') {
              if (!isTauri) {
                toolResult = "Comandos locais só funcionam no app desktop.";
              } else {
                if (onStatusUpdate) onStatusUpdate(`Abrindo ${args.appName}...`);
                const { invoke } = await import('@tauri-apps/api/core');
                try {
                  await invoke('execute_applescript', { script: `tell application "${args.appName}" to activate` });
                  toolResult = `Aplicativo ${args.appName} aberto/ativado com sucesso.`;
                } catch (e: any) {
                  toolResult = `Erro ao abrir aplicativo: ${e}`;
                }
              }
            } else if (functionName === 'open_browser_url') {
              if (!isTauri) {
                toolResult = "Comandos locais só funcionam no app desktop.";
              } else {
                if (onStatusUpdate) onStatusUpdate(`Abrindo URL no navegador...`);
                const { invoke } = await import('@tauri-apps/api/core');
                try {
                  await invoke('local_open_url', { url: args.url });
                  toolResult = `URL ${args.url} aberta com sucesso.`;
                } catch (e: any) {
                  toolResult = `Erro ao abrir URL: ${e}`;
                }
              }
            } else if (functionName === 'run_applescript') {
              if (!isTauri) {
                toolResult = "Comandos locais só funcionam no app desktop.";
              } else {
                if (onStatusUpdate) onStatusUpdate(`Executando script AppleScript...`);
                const { invoke } = await import('@tauri-apps/api/core');
                try {
                  const out = await invoke('execute_applescript', { script: args.script });
                  toolResult = `AppleScript executado. Saída: ${out}`;
                } catch (e: any) {
                  toolResult = `Erro no AppleScript: ${e}`;
                }
              }
            } else if (functionName === 'run_shell_command') {
              if (!isTauri) {
                toolResult = "Comandos locais só funcionam no app desktop.";
              } else {
                if (onStatusUpdate) onStatusUpdate(`Executando shell...`);
                const { invoke } = await import('@tauri-apps/api/core');
                try {
                  const out = await invoke('execute_shell_command', { command: args.command });
                  toolResult = `Comando executado. Saída: ${out}`;
                } catch (e: any) {
                  toolResult = `Erro no shell: ${e}`;
                }
              }
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
        const finalResponse = response.content || "Não consegui formular uma resposta.";
        return { responseText: finalResponse };
      }
    }

    return { responseText: "Atingi o limite máximo de pensamentos sem chegar a uma conclusão. Houve alguma falha na orquestração." };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
