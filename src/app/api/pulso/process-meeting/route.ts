import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { contextId, sessionId, chunkUrls } = await req.json();

    if (!chunkUrls || !Array.isArray(chunkUrls)) {
      return NextResponse.json({ error: 'chunkUrls is required and must be an array' }, { status: 400 });
    }

    const rawKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : "";
    if (!apiKey) {
      console.error('[PROCESS_MEETING] GROQ_API_KEY missing in environment.');
      return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
    }

    // 1. Fetch and Transcribe all chunks
    console.log(`[PROCESS_MEETING] Processing ${chunkUrls.length} chunks for session ${sessionId}`);
    
    // We transcribe sequentially or via Promise.all. Promise.all is faster but might hit rate limits.
    // Given the length of chunks (15 min), doing them sequentially is safer for rate limits and ensures order without complex sorting.
    let fullTranscription = '';

    for (let i = 0; i < chunkUrls.length; i++) {
      const url = chunkUrls[i];
      console.log(`[PROCESS_MEETING] Transcribing chunk ${i + 1}/${chunkUrls.length}`);
      
      const audioResponse = await fetch(url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio chunk ${i}: ${audioResponse.statusText}`);
      }
      
      const arrayBuffer = await audioResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const mimeType = audioResponse.headers.get('content-type') || 'audio/webm';
      const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
      
      const blob = new Blob([buffer], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, `chunk_${i}.${extension}`);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'pt');
      formData.append('response_format', 'json');
      formData.append('temperature', '0.2');

      const transcribeUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
      const transcribeRes = await fetch(transcribeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!transcribeRes.ok) {
        const errorText = await transcribeRes.text();
        console.error(`[PROCESS_MEETING] Transcription error for chunk ${i}:`, errorText);
        throw new Error(`Groq API responded with status ${transcribeRes.status}: ${errorText}`);
      }

      const json = await transcribeRes.json();
      const text = json.text || "";
      
      fullTranscription += text.trim() + '\n\n';
    }

    fullTranscription = fullTranscription.trim();

    if (!fullTranscription) {
      return NextResponse.json({ transcription: 'Áudio vazio ou inaudível.', summary: 'Nenhum conteúdo para resumir.' });
    }

    // 2. Generate Summary and Action Plan using Llama 3
    console.log(`[PROCESS_MEETING] Generating summary...`);
    const chatUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    const summaryPrompt = `
Você é um assistente especialista em analisar reuniões. Abaixo está a transcrição completa de uma sessão gravada.
Por favor, analise a transcrição e gere um relatório em Markdown estruturado da seguinte forma:

# Resumo da Sessão
(Um resumo claro e conciso do que foi discutido)

# Principais Decisões
(Lista em bullet points das decisões tomadas)

# Plano de Ação (Action Plan)
(Lista de tarefas ou próximos passos mencionados, com os responsáveis se houver)

Transcrição:
"""
${fullTranscription}
"""
    `;

    const chatRes = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!chatRes.ok) {
      const errorText = await chatRes.text();
      console.error(`[PROCESS_MEETING] Summary error:`, errorText);
      throw new Error(`Groq Chat API responded with status ${chatRes.status}: ${errorText}`);
    }

    const chatJson = await chatRes.json();
    const summary = chatJson.choices[0]?.message?.content || "Erro ao gerar resumo.";

    return NextResponse.json({ 
      transcription: fullTranscription, 
      summary 
    });

  } catch (error: any) {
    console.error('[PROCESS_MEETING] Error processing meeting:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
