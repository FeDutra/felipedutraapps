"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoProcessMeeting = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function isAllowedRecordingUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return url.protocol === "https:"
            && url.hostname === "firebasestorage.googleapis.com"
            && decodeURIComponent(url.pathname).includes("/pulso/chats/");
    }
    catch {
        return false;
    }
}
exports.pulsoProcessMeeting = (0, https_1.onRequest)({
    region: "us-central1",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async (req, res) => {
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
        const bearer = req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null;
        if (!bearer) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        try {
            await (0, auth_1.getAuth)().verifyIdToken(bearer);
        }
        catch {
            res.status(401).json({ error: "Invalid authentication token" });
            return;
        }
        const { contextId, sessionId, chunkUrls } = req.body;
        if (!sessionId || !chunkUrls?.length || !Array.isArray(chunkUrls)) {
            res.status(400).json({ error: "sessionId and non-empty chunkUrls are required" });
            return;
        }
        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
            return;
        }
        const orderedChunks = chunkUrls
            .map((chunk, position) => typeof chunk === "string"
            ? { url: chunk, index: position }
            : { ...chunk, index: chunk.index ?? position })
            .sort((a, b) => a.index - b.index);
        if (orderedChunks.some(chunk => !isAllowedRecordingUrl(chunk.url))) {
            res.status(400).json({ error: "Invalid recording URL" });
            return;
        }
        console.log(`[PROCESS_MEETING] Processing ${orderedChunks.length} chunks for ${sessionId} (${contextId || "no-context"})`);
        const transcriptions = [];
        const failures = [];
        const transcribeChunk = async (chunk) => {
            try {
                const audioResponse = await fetch(chunk.url);
                if (!audioResponse.ok)
                    throw new Error(`audio download returned ${audioResponse.status}`);
                const buffer = Buffer.from(await audioResponse.arrayBuffer());
                if (buffer.length === 0)
                    throw new Error("empty audio chunk");
                const mimeType = (chunk.mimeType || audioResponse.headers.get("content-type") || "audio/webm").split(";")[0];
                const prompt = `Transcreva este trecho de reunião em português brasileiro com fidelidade e pontuação clara.
Não resuma, não explique e não invente nomes. Identifique falantes apenas quando o próprio áudio trouxer nomes ou quando a distinção for inequívoca.
Remova somente hesitações sem valor semântico. Retorne exclusivamente a transcrição. Se não houver fala inteligível, retorne uma string vazia.`;
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const response = await fetch(geminiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [
                                    { inlineData: { mimeType, data: buffer.toString("base64") } },
                                    { text: prompt },
                                ] }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 8192,
                        },
                    }),
                });
                if (!response.ok) {
                    const detail = await response.text();
                    throw new Error(`Gemini returned ${response.status}: ${detail.slice(0, 500)}`);
                }
                const json = await response.json();
                const text = (json.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "").trim();
                transcriptions.push({ index: chunk.index, text });
                console.log(`[PROCESS_MEETING] Chunk ${chunk.index} transcribed (${text.length} chars)`);
            }
            catch (error) {
                const message = errorMessage(error);
                failures.push({ index: chunk.index, error: message });
                console.error(`[PROCESS_MEETING] Chunk ${chunk.index} failed:`, message);
            }
        };
        // A small concurrency window keeps long meetings within the function
        // timeout without producing a burst large enough to trip provider limits.
        const TRANSCRIPTION_CONCURRENCY = 3;
        for (let offset = 0; offset < orderedChunks.length; offset += TRANSCRIPTION_CONCURRENCY) {
            await Promise.all(orderedChunks
                .slice(offset, offset + TRANSCRIPTION_CONCURRENCY)
                .map(transcribeChunk));
        }
        const transcription = transcriptions
            .sort((a, b) => a.index - b.index)
            .map(item => item.text)
            .filter(Boolean)
            .join("\n\n")
            .trim();
        if (!transcription) {
            await (0, firestore_1.getFirestore)().doc(`workspaces/felipe_dutra/pulso_meetings/${sessionId}`).set({
                status: "failed",
                errorMessage: "Nenhuma fala inteligível foi transcrita.",
                failedChunks: failures,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            res.status(422).json({
                error: "Nenhuma fala inteligível foi transcrita.",
                failedChunks: failures,
            });
            return;
        }
        await (0, firestore_1.getFirestore)().doc(`workspaces/felipe_dutra/pulso_meetings/${sessionId}`).set({
            status: "transcribed",
            transcription,
            transcriptionProvider: "gemini-2.5-flash",
            transcriptionPartial: failures.length > 0,
            processedChunks: transcriptions.length,
            failedChunks: failures,
            transcribedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.status(200).json({
            sessionId,
            contextId: contextId || null,
            transcription,
            processedChunks: transcriptions.length,
            failedChunks: failures,
            partial: failures.length > 0,
        });
    }
    catch (error) {
        console.error("[PROCESS_MEETING] Fatal error:", error);
        res.status(500).json({ error: errorMessage(error) || "Unknown error" });
    }
});
//# sourceMappingURL=processMeeting.js.map