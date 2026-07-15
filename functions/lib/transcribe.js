"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoTranscribe = void 0;
const https_1 = require("firebase-functions/v2/https");
exports.pulsoTranscribe = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
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
        const rawKey = process.env.GROQ_API_KEY || "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";
        const apiKey = rawKey ? rawKey.trim() : "";
        if (!apiKey) {
            res.status(500).send("GROQ_API_KEY is not defined");
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
        console.log(`[PULSO_TRANSCRIBE] Fetching Groq API directly. Key length: ${apiKey.length}`);
        const startTime = Date.now();
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            },
            body: formData
        });
        const duration = Date.now() - startTime;
        console.log(`[PULSO_TRANSCRIBE] API responded in ${duration}ms. Status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API responded with status ${response.status}: ${errorText}`);
        }
        const json = (await response.json());
        const transcription = json.text || "";
        res.status(200).json({ text: transcription.trim() });
    }
    catch (err) {
        console.error("Transcription error:", err);
        res.status(500).send(err.message || "Error transcribing audio");
    }
});
//# sourceMappingURL=transcribe.js.map