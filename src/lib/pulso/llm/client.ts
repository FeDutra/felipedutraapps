/**
 * PULSO Agnostic LLM Client
 * 
 * Supports:
 * - Groq (Cloud, Llama 3)
 * - Ollama (Local, Llama 3 / Phi-3)
 * - OpenAI (Cloud, GPT-4)
 */

export type LLMProvider = 'groq' | 'ollama' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;      // Optional for Ollama
  baseUrl?: string;     // Overrides default base URL
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

const DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1', // Ollama's OpenAI compatible endpoint
};

export class PulsoLLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || DEFAULT_BASE_URLS[this.config.provider];
  }

  public async chat(messages: ChatMessage[], temperature = 0.7, tools?: ToolDefinition[]): Promise<{ content: string; tool_calls?: any[] }> {
    const url = `${this.getBaseUrl()}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const payload: any = {
      model: this.config.model,
      messages,
      temperature,
    };
    
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;
      return {
        content: choice?.content || '',
        tool_calls: choice?.tool_calls
      };
    } catch (error) {
      console.error('[PulsoLLMClient] Erro na comunicação com LLM:', error);
      throw error;
    }
  }

  // Stream support can be added here in the future
}
