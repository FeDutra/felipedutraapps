import { onRequest } from "firebase-functions/v2/https";

export const pulsoTranscribe = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Max-Age", "3600");
      res.status(204).send("");
      return;
    }

    try {
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const mimeType = req.headers["content-type"] || "audio/webm";
      const buffer = req.rawBody; // In Cloud Functions, raw body is always rawBody Buffer
      
      if (!buffer || buffer.length === 0) {
        res.status(400).send("No audio data provided");
        return;
      }

      const rawKey = process.env.GROQ_API_KEY;
      const apiKey = rawKey ? rawKey.trim() : "";
      
      if (!apiKey) {
        res.status(500).send("GROQ_API_KEY is not defined in Cloud Functions secrets.");
        return;
      }

      // Convert buffer to Blob for standard FormData
      const blob = new Blob([buffer], { type: mimeType });
      const formData = new FormData();
      
      // We must pass a file name. Groq uses it to detect the format
      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      formData.append("file", blob, `audio.${extension}`);
      
      formData.append("model", "whisper-large-v3");
      formData.append("language", "pt");
      formData.append("response_format", "json");
      formData.append("temperature", "0.0");
      formData.append("prompt", "Gravação de áudio do usuário para o sistema Pulso. Transcrição precisa em português com pontuação correta.");

      const url = "https://api.groq.com/openai/v1/audio/transcriptions";

      console.log(`[PULSO_TRANSCRIBE] Fetching Groq Whisper API. Key length: ${apiKey.length}`);
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        },
        body: formData as any
      });

      const duration = Date.now() - startTime;
      console.log(`[PULSO_TRANSCRIBE] Whisper responded in ${duration}ms. Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq Whisper API responded with status ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as any;
      const rawTranscription = (json.text || "").trim();

      if (!rawTranscription) {
        res.status(200).json({ text: "" });
        return;
      }

      // Step 2: Text refinement via Llama-3.3-70b-versatile
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

        console.log(`[PULSO_TRANSCRIBE] Requesting Llama-3.3 refinement...`);
        const chatStartTime = Date.now();
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

        const chatDuration = Date.now() - chatStartTime;
        console.log(`[PULSO_TRANSCRIBE] Llama responded in ${chatDuration}ms. Status: ${chatRes.status}`);

        if (chatRes.ok) {
          const chatJson = await chatRes.json() as any;
          const refinedText = chatJson.choices?.[0]?.message?.content?.trim();
          if (refinedText) {
            console.log(`[PULSO_TRANSCRIBE_AI] Refined text successfully.`);
            res.status(200).json({ text: refinedText });
            return;
          }
        }
      } catch (refineError) {
        console.warn('[PULSO_TRANSCRIBE_AI] LLM refinement fallback to raw:', refineError);
      }

      res.status(200).json({ text: rawTranscription });
    } catch (err: any) {
      console.error("Transcription error:", err);
      res.status(500).send(err.message || "Error transcribing audio");
    }
  }
);
