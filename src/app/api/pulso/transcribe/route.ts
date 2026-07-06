import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let mimeType = req.headers.get('content-type') || 'audio/webm';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0];
    }

    const rawKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : "";
    if (!apiKey) {
      console.error('[PULSO_TRANSCRIBE] GROQ_API_KEY missing in environment.');
      return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
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
    formData.append('temperature', '0.2');

    const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API responded with status ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    const transcription = json.text || "";

    return NextResponse.json({ text: transcription.trim() });
  } catch (error: any) {
    console.error('[PULSO_TRANSCRIBE] Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error during transcription' }, { status: 500 });
  }
}
