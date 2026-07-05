"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoTranscribe = void 0;
const https_1 = require("firebase-functions/v2/https");
exports.pulsoTranscribe = (0, https_1.onRequest)({ region: "us-central1", secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
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
        const base64Audio = buffer.toString("base64");
        const rawKey = process.env.GEMINI_API_KEY;
        const apiKey = rawKey ? rawKey.trim() : "";
        if (!apiKey) {
            res.status(500).send("GEMINI_API_KEY is not defined");
            return;
        }
        const prompt = `Você é o transcritor e redator oficial de áudio do PULSO. Sua tarefa é transcrever o áudio fornecido em português brasileiro com perfeição profissional.

Siga rigorosamente as diretrizes abaixo:
1. **Pontuação Impecável:** Adicione vírgulas, pontos finais, pontos de interrogação, exclamação e travessões de forma gramaticalmente correta e fluida, de acordo com o sentido e entonação da fala.
2. **Correção Gramatical:** Ajuste discretamente desvios gramaticais ou erros de concordância típicos de linguagem falada informal, convertendo-os em um português claro, correto e profissional, mantendo o sentido original.
3. **Remover Disfluências e Hesitações:** Remova gagueiras, vícios de linguagem ("né", "tipo", "hã", "ééé", "então", "tá") e repetições de palavras decorrentes de hesitação.
4. **Formatação Apropriada:** Escreva números, valores monetários (ex: "R$ 50", "cento e cento e cinquenta") e datas de forma limpa e padronizada. Capitalize nomes próprios e siglas.
5. **Saída Limpa:** Retorne EXCLUSIVAMENTE o texto transcrito. Não adicione introduções, aspas, notas de rodapé, explicações ou qualquer outro caractere adicional.`;
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
        console.log(`[PULSO_TRANSCRIBE] Fetching Gemini API directly. Key length: ${apiKey.length}`);
        const startTime = Date.now();
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const duration = Date.now() - startTime;
        console.log(`[PULSO_TRANSCRIBE] API responded in ${duration}ms. Status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API responded with status ${response.status}: ${errorText}`);
        }
        const json = (await response.json());
        const transcription = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        res.status(200).json({ text: transcription.trim() });
    }
    catch (err) {
        console.error("Transcription error:", err);
        res.status(500).send(err.message || "Error transcribing audio");
    }
});
//# sourceMappingURL=transcribe.js.map