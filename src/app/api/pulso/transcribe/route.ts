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
    const transcription = json.text || "";

    return NextResponse.json({ text: transcription.trim() });
  } catch (error: any) {
    console.error('[PULSO_TRANSCRIBE] Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error during transcription' }, { status: 500 });
  }
}
