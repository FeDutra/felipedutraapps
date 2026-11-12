import { onRequest } from "firebase-functions/v2/https";

export interface PcmWavInspection {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationMs: number;
}

export function inspectPcmWav(buffer: Buffer): PcmWavInspection | null {
  if (buffer.length < 44
    || buffer.toString("ascii", 0, 4) !== "RIFF"
    || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > buffer.length) return null;

    if (chunkId === "fmt " && chunkSize >= 16) {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      byteRate = buffer.readUInt32LE(chunkStart + 8);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataBytes = chunkSize;
    }
    offset = chunkEnd + (chunkSize % 2);
  }

  if (audioFormat !== 1
    || channels !== 1
    || bitsPerSample !== 16
    || sampleRate < 8_000
    || sampleRate > 192_000
    || byteRate !== sampleRate * channels * (bitsPerSample / 8)
    || dataBytes <= 0) {
    return null;
  }
  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes,
    durationMs: Math.round((dataBytes / byteRate) * 1_000),
  };
}

function readHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] || "") : (value || "");
}

export const pulsoTranscribe = onRequest(
  {
    region: "us-central1",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300,
  },
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

      const mimeType = readHeader(req.headers["content-type"]) || "audio/webm";
      const baseMimeType = mimeType.split(";")[0].trim().toLowerCase();
      const userAgent = readHeader(req.headers["user-agent"]).toLowerCase();
      const audioSource = readHeader(req.headers["x-pulso-audio-source"]);
      const recordingId = readHeader(req.headers["x-pulso-recording-id"]);
      const buffer = req.rawBody; // In Cloud Functions, raw body is always rawBody Buffer
      
      if (!buffer || buffer.length === 0) {
        res.status(400).send("No audio data provided");
        return;
      }

      // A PULSO desktop possui PCM/WAV durável. Aceitar novamente um blob do
      // MediaRecorder vindo do WebView reabriria a regressão em que 88 segundos
      // viraram 53 KB e o modelo recebeu um fragmento sem relação com a fala.
      if (userAgent.includes("tauri-plugin-http") && audioSource !== "tauri-durable-wav") {
        res.status(422).json({ error: "durable_wav_required" });
        return;
      }

      const isDurableDesktopWav = audioSource === "tauri-durable-wav";
      const wavInspection = baseMimeType === "audio/wav" || baseMimeType === "audio/x-wav"
        ? inspectPcmWav(buffer)
        : null;
      if (isDurableDesktopWav) {
        if (!/^[A-Za-z0-9_-]{8,120}$/.test(recordingId)
          || !wavInspection) {
          res.status(422).json({ error: "invalid_durable_wav" });
          return;
        }
        const declaredBytes = Number(readHeader(req.headers["x-pulso-audio-bytes"]));
        const declaredDurationMs = Number(readHeader(req.headers["x-pulso-audio-duration-ms"]));
        if (!Number.isFinite(declaredBytes)
          || declaredBytes !== buffer.length
          || !Number.isFinite(declaredDurationMs)
          || Math.abs(declaredDurationMs - wavInspection.durationMs) > 250) {
          res.status(422).json({ error: "durable_wav_manifest_mismatch" });
          return;
        }
      } else if ((baseMimeType === "audio/wav" || baseMimeType === "audio/x-wav") && !wavInspection) {
        res.status(422).json({ error: "invalid_wav" });
        return;
      }

      console.log("[PULSO_TRANSCRIBE] audio accepted", {
        bytes: buffer.length,
        mimeType: baseMimeType,
        source: isDurableDesktopWav ? "tauri-durable-wav" : "web",
        recordingId: recordingId || null,
        durationMs: wavInspection?.durationMs || null,
      });

      const base64Audio = buffer.toString("base64");
      const rawKey = process.env.GEMINI_API_KEY;
      const apiKey = rawKey ? rawKey.trim() : "";
      
      if (!apiKey) {
        res.status(500).send("GEMINI_API_KEY is not defined in Cloud Functions secrets.");
        return;
      }

      const prompt = `Você é o transcritor e redator oficial de áudio do PULSO. Sua tarefa é transcrever o áudio fornecido em português brasileiro com perfeição profissional.

Siga rigorosamente as diretrizes abaixo:
1. **Pontuação Impecável:** Adicione vírgulas, pontos finais, pontos de interrogação, exclamação e travessões de forma gramaticalmente correta e fluida, de acordo com o sentido e entonação da fala.
2. **Correção Gramatical:** Ajuste discretamente desvios gramaciais ou erros de concordância típicos de linguagem falada informal, convertendo-os em um português claro, correto e profissional, mantendo o sentido original.
3. **Remover Disfluências e Hesitações:** Remova gagueiras, vícios de linguagem ("né", "tipo", "hã", "ééé", "então", "tá") e repetições de palavras decorrentes de hesitação.
4. **Formatação Apropriada:** Escreva números, valores monetários (ex: "R$ 50", "cento e cento e cinquenta") e datas de forma limpa e padronizada. Capitalize nomes próprios e siglas.
5. **Fidelidade literal:** Nunca complete, deduza, improvise ou crie uma narrativa quando um trecho estiver inaudível. Não use conhecimento geral para preencher lacunas.
6. **Áudio Sem Fala/Muito Curto:** Se o áudio fornecido não contiver fala humana inteligível em português, estiver truncado ou não permitir transcrição fiel, retorne EXCLUSIVAMENTE uma string vazia "".
7. **Saída Limpa:** Retorne EXCLUSIVAMENTE o texto transcrito. Não adicione introduções, aspas, notas de rodapé, explicações ou qualquer outro caractere adicional.`;

      // Call the Gemini REST API directly, avoiding SDK-auth conflicts
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType.split(";")[0],
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

      console.log(`[PULSO_TRANSCRIBE] Fetching Gemini 2.5 Flash API directly. Key length: ${apiKey.length}`);

      // 429 (rate limit) e 503 (indisponível) do Gemini costumam falhar em
      // menos de 1s, sem processar áudio nenhum — retry curto com backoff
      // resolve a maioria sem custo real de tempo, já que a resposta rápida
      // e barata do lado do Gemini deixa folga de sobra no timeout da função.
      const MAX_ATTEMPTS = 3;
      let response: Response | null = null;
      let lastErrorText = "";
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const startTime = Date.now();
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const duration = Date.now() - startTime;
        console.log(`[PULSO_TRANSCRIBE] Gemini responded in ${duration}ms. Status: ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS})`);

        if (response.ok) break;

        lastErrorText = await response.text();
        const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) break;

        const backoffMs = attempt * 1200;
        console.warn(`[PULSO_TRANSCRIBE] Retryable error (${response.status}), waiting ${backoffMs}ms before retry.`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      if (!response || !response.ok) {
        throw new Error(`Google Gemini API responded with status ${response?.status}: ${lastErrorText}`);
      }

      const json = (await response.json()) as any;
      const transcription = (json.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

      // Fallback: se por algum motivo o modelo ecoar o prompt, consideramos como vazio
      const cleanTranscription = transcription.includes("Você é o transcritor") ? "" : transcription;

      res.status(200).json({ text: cleanTranscription });
    } catch (err: any) {
      console.error("Transcription error:", err);
      res.status(500).send(err.message || "Error transcribing audio");
    }
  }
);
