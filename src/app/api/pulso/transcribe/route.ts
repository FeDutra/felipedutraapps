import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    
    let mimeType = req.headers.get('content-type') || 'audio/webm';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0];
    }

    const rawKey = process.env.GEMINI_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : "";
    if (!apiKey) {
      console.error('[PULSO_TRANSCRIBE] GEMINI_API_KEY missing in environment.');
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    const prompt = `Você é o transcritor e redator oficial de áudio do PULSO. Sua tarefa é transcrever o áudio fornecido em português brasileiro com perfeição profissional.

Siga rigorosamente as diretrizes abaixo:
1. **Pontuação Impecável:** Adicione vírgulas, pontos finais, pontos de interrogação, exclamação e travessões de forma gramaticalmente correta e fluida, de acordo com o sentido e entonação da fala.
2. **Correção Gramatical:** Ajuste discretamente desvios gramaticais ou erros de concordância típicos de linguagem falada informal, convertendo-os em um português claro, correto e profissional, mantendo o sentido original.
3. **Remover Disfluências e Hesitações:** Remova gagueiras, vícios de linguagem ("né", "tipo", "hã", "ééé", "então", "tá") e repetições de palavras decorrentes de hesitação.
4. **Formatação Apropriada:** Escreva números, valores monetários (ex: "R$ 50", "cento e cento e cinquenta") e datas de forma limpa e padronizada. Capitalize nomes próprios e siglas.
5. **Saída Limpa:** Retorne EXCLUSIVAMENTE o texto transcrito. Não adicione introduções, aspas, notas de rodapé, explicações ou qualquer outro caractere adicional.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio
              }
            },
            {
              text: prompt
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API responded with status ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    const transcription = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ text: transcription.trim() });
  } catch (error: any) {
    console.error('[PULSO_TRANSCRIBE] Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error during transcription' }, { status: 500 });
  }
}
