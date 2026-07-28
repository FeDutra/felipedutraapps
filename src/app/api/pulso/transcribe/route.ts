import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let mimeType = req.headers.get('content-type') || 'audio/webm';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0];
    }

    const headerKey = req.headers.get('x-groq-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const rawKey = headerKey || process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : "";
    
    if (!apiKey) {
      console.error('[PULSO_TRANSCRIBE] Chave de API indisponível no servidor.');
      return NextResponse.json({ error: 'Chave de API para transcrição não configurada.' }, { status: 500 });
    }

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    
    // Mapeamento dinâmico de extensões de áudio para compatibilidade com o Safari/iOS
    let extension = 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      extension = 'm4a';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    } else if (mimeType.includes('aac')) {
      extension = 'aac';
    } else if (mimeType.includes('ogg')) {
      extension = 'ogg';
    } else if (mimeType.includes('mpeg')) {
      extension = 'mp3';
    }
    
    formData.append('file', blob, `audio.${extension}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');
    formData.append('prompt', 'Gravação de áudio do usuário para o sistema Pulso. Transcrição precisa em português com pontuação correta.');

    const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      // Fallback para whisper-large-v3 se turbo falhar
      const fallbackFormData = new FormData();
      fallbackFormData.append('file', blob, `audio.${extension}`);
      fallbackFormData.append('model', 'whisper-large-v3');
      fallbackFormData.append('language', 'pt');
      fallbackFormData.append('response_format', 'json');

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: fallbackFormData
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const rawTranscription = (json.text || "").trim();

    if (!rawTranscription) {
      return NextResponse.json({ text: "" });
    }

    // 2. Etapa de Refinamento Textual por IA (Redator Oficial do PULSO)
    try {
      const chatUrl = 'https://api.groq.com/openai/v1/chat/completions';
      const systemPrompt = `Você é o redator e revisor de texto oficial do PULSO.
Sua tarefa é receber a transcrição bruta de um áudio e transformá-la em um texto em português brasileiro impecável, profissional e fluido.

Diretrizes obrigatórias:
1. Pontuação e Gramática: Adicione pontuação gramaticalmente adequada (vírgulas, pontos finais, travessões, interrogações) e corrija pequenos deslizes de concordância típicos da linguagem falada.
2. Remoção de Hesitações e Vícios: Remova gagueiras, palavras repetidas por dúvida e vícios de linguagem ("ééé", "tipo", "né", "tá", "então", "hã").
3. Formatação: Padronize números, valores monetários e nomes próprios (ex: PULSO, Lótus, OpenClaw, Fê, Ateliê, Estúdio).
4. Preservação Total do Sentido: Mantenha rigorosamente a ideia, intenção e mensagem do usuário sem inventar informações.
5. Saída Limpa: Retorne EXCLUSIVAMENTE o texto final corrigido. Não inclua aspas, introduções, saudações ou explicações.`;

      const chatRes = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawTranscription }
          ],
          temperature: 0.2,
          max_tokens: 1000
        })
      });

      if (chatRes.ok) {
        const chatJson = await chatRes.json();
        const refinedText = chatJson.choices?.[0]?.message?.content?.trim();
        if (refinedText) {
          console.log(`[PULSO_TRANSCRIBE_AI] Refined: "${rawTranscription}" -> "${refinedText}"`);
          return NextResponse.json({ text: refinedText });
        }
      }
    } catch (refineError) {
      console.warn('[PULSO_TRANSCRIBE_AI] LLM refinement fallback to raw:', refineError);
    }

    return NextResponse.json({ text: rawTranscription });
  } catch (error: any) {
    console.error('[PULSO_TRANSCRIBE] Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error during transcription' }, { status: 500 });
  }
}
