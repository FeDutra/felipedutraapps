import { PulsoLLMClient } from './client';

export type IntentType = 'local_action' | 'lotus_handoff';

export interface IntentDecision {
  intent: IntentType;
  action?: string;
  target?: string;
  target_account?: string;
  message?: string;
  reasoning?: string;
}

const SYSTEM_PROMPT = `Você é o Roteador de Intenções da PULSO, o "sistema nervoso" rápido de um assistente de desktop.
Sua única função é ler a mensagem do usuário e decidir se ela deve ser executada localmente pela PULSO ou enviada para a mente profunda (Lótus).

REGRAS DE ROTEAMENTO:
1. 'local_action': Escolha isso APENAS se o usuário pedir para interagir com o sistema operacional ou integrações locais:
   - "Abre o Arc" -> action: 'open_app', target: 'Arc'
   - "Toca música" -> action: 'play_music'
   - "Busca no Notion sobre X" -> action: 'read_notion', target: 'X'
   - "Manda um zap pro João dizendo oi" -> action: 'send_whatsapp', target: 'João', message: 'oi'
2. 'lotus_handoff': Escolha isso para TUDO o resto. Conversas gerais, perguntas complexas, análise de texto, pedidos de ajuda, estratégia, ideias, dúvidas. Se não for uma automação óbvia de desktop, mande para a Lótus.

FORMATO DE RESPOSTA OBRIGATÓRIO (Apenas JSON válido, sem markdown):
{
  "intent": "local_action" | "lotus_handoff",
  "action": "open_app" | "play_music" | "read_notion" | "send_whatsapp" | null,
  "target": "nome_do_app" | "nome_da_musica" | "termo_de_busca_notion" | "nome_ou_numero_do_contato" | null,
  "target_account": "nome_da_conta" | null,
  "message": "mensagem a ser enviada no whatsapp" | null,
  "reasoning": "Breve justificativa"
}
`;

export class IntentRouter {
  private llm: PulsoLLMClient;

  constructor() {
    // Usamos Groq pela latência ultrabaixa (< 0.5s) necessária para o roteamento em tempo real
    this.llm = new PulsoLLMClient({
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || '', // A ser configurado pelo usuário
    });
  }

  public async routeMessage(userMessage: string): Promise<IntentDecision> {
    try {
      if (!process.env.NEXT_PUBLIC_GROQ_API_KEY) {
        // Fallback: se não houver chave do Groq configurada, roteia tudo para a Lótus (seguro)
        console.warn('Groq API Key ausente. Roteando por padrão para Lótus.');
        return { intent: 'lotus_handoff', reasoning: 'No API Key' };
      }

      const responseText = await this.llm.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ], 0.1); // Temperatura quase zero para maior previsibilidade

      // Tenta parsear a resposta como JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as IntentDecision;
      }
      
      throw new Error("Resposta do Roteador não é um JSON válido.");
    } catch (error) {
      console.error('[IntentRouter] Erro ao rotear intenção:', error);
      // Em caso de falha (ex: LLM alucinou ou erro de rede), o mais seguro é mandar pra Lótus
      return { intent: 'lotus_handoff', reasoning: 'Fallback due to error' };
    }
  }
}

export const intentRouter = new IntentRouter();
