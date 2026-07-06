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
      
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "pt");
      formData.append("response_format", "json");
      formData.append("temperature", "0.2");

      const url = "https://api.groq.com/openai/v1/audio/transcriptions";

      console.log(`[PULSO_TRANSCRIBE] Fetching Groq API directly. Key length: ${apiKey.length}`);
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        },
        body: formData as any
      });

      const duration = Date.now() - startTime;
      console.log(`[PULSO_TRANSCRIBE] API responded in ${duration}ms. Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API responded with status ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as any;
      const transcription = json.text || "";

      res.status(200).json({ text: transcription.trim() });
    } catch (err: any) {
      console.error("Transcription error:", err);
      res.status(500).send(err.message || "Error transcribing audio");
    }
  }
);
