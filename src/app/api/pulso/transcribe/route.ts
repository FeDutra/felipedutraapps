import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    
    // Extract mime type, fallback to audio/webm if missing
    let mimeType = file.type || 'audio/webm';
    
    // Gemini strictly accepts standard formats. 
    // Strip codecs from mimeType (e.g. "audio/webm;codecs=opus" -> "audio/webm")
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0];
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[PULSO_TRANSCRIBE] GEMINI_API_KEY missing in environment.');
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Using gemini-1.5-flash for ultra-fast audio transcription
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = "Você é um assistente de transcrição de altíssima precisão. Transcreva o áudio a seguir preservando perfeitamente a pontuação (vírgulas, pontos finais, interrogações e exclamações) e a concordância. Não adicione nenhum comentário, saudação ou aspas na sua resposta. Retorne EXCLUSIVAMENTE o texto que foi falado no áudio.";

    console.log(`[PULSO_TRANSCRIBE] Sending audio to Gemini. Size: ${buffer.length} bytes, Mime: ${mimeType}`);
    const startTime = Date.now();

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType
        }
      },
      prompt
    ]);

    const transcription = result.response.text();
    const duration = Date.now() - startTime;
    console.log(`[PULSO_TRANSCRIBE] Transcribed in ${duration}ms: "${transcription}"`);

    return NextResponse.json({ text: transcription.trim() });
  } catch (error: any) {
    console.error('[PULSO_TRANSCRIBE] Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error during transcription' }, { status: 500 });
  }
}
