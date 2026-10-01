"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.musicOcreDownloadApi = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const core_1 = require("./core");
const WORKSPACE_ID = "felipe_dutra";
const DOWNLOADS_COLLECTION = `workspaces/${WORKSPACE_ID}/music_ocre_downloads`;
const NOTICE_VERSION = "music-ocre-download-v1";
const GENERIC_SUCCESS = {
    status: "ok",
    message: "download liberado"
};
exports.musicOcreDownloadApi = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    const origin = req.headers.origin;
    if (req.method === "OPTIONS") {
        if (!(0, core_1.isMusicOcreOriginAllowed)(origin)) {
            res.status(403).json({ error: "Origin not allowed" });
            return;
        }
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Max-Age", "86400");
        res.status(204).end();
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    if (!(0, core_1.isMusicOcreOriginAllowed)(origin)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");
    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > 8192) {
        res.status(413).json({ error: "Payload too large" });
        return;
    }
    const body = (req.body || {});
    // Bots preenchem este campo visualmente oculto. A resposta permanece genérica
    // para não transformar o honeypot em um oráculo.
    if (typeof body.company === "string" && body.company.trim().length > 0) {
        res.status(200).json(GENERIC_SUCCESS);
        return;
    }
    if (body.action !== "register_download") {
        res.status(400).json({ error: "Ação inválida." });
        return;
    }
    const noticeAccepted = body.noticeAccepted === true || body.noticeAccepted === "true";
    if (!noticeAccepted) {
        res.status(400).json({ error: "Confirme a informação sobre o uso dos dados." });
        return;
    }
    const name = (0, core_1.sanitizeDownloadName)(body.name);
    if (name.length < 2) {
        res.status(400).json({ error: "Informe seu nome." });
        return;
    }
    if (!(0, core_1.validateDownloadEmail)(body.email)) {
        res.status(400).json({ error: "Informe um e-mail válido." });
        return;
    }
    const email = (0, core_1.normalizeDownloadEmail)(body.email);
    const source = (0, core_1.sanitizeDownloadSource)(body.source);
    const ref = (0, firestore_1.getFirestore)().collection(DOWNLOADS_COLLECTION).doc((0, core_1.hashDownloadEmail)(email));
    try {
        await (0, firestore_1.getFirestore)().runTransaction(async (transaction) => {
            const snapshot = await transaction.get(ref);
            const existing = snapshot.data();
            const cooldownActive = (0, core_1.isDownloadCooldownActive)(existing?.lastDownloadedAt);
            if (!snapshot.exists) {
                transaction.create(ref, {
                    name,
                    email,
                    source,
                    purpose: "ep_download",
                    release: "PULSAO_EP_2016",
                    downloadCount: 1,
                    firstDownloadedAt: firestore_1.FieldValue.serverTimestamp(),
                    lastDownloadedAt: firestore_1.FieldValue.serverTimestamp(),
                    noticeAcceptedAt: firestore_1.FieldValue.serverTimestamp(),
                    noticeVersion: NOTICE_VERSION,
                    marketingConsent: false,
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp()
                });
                return;
            }
            transaction.update(ref, {
                name,
                source,
                lastDownloadedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                noticeAcceptedAt: firestore_1.FieldValue.serverTimestamp(),
                noticeVersion: NOTICE_VERSION,
                marketingConsent: false,
                ...(!cooldownActive ? { downloadCount: firestore_1.FieldValue.increment(1) } : {})
            });
        });
        console.log("[music-ocre-download] download registered", (0, core_1.hashDownloadEmail)(email).slice(0, 10));
        res.status(200).json(GENERIC_SUCCESS);
    }
    catch (error) {
        console.error("[music-ocre-download] registration failed", error?.code || "UNKNOWN");
        res.status(500).json({ error: "Não foi possível liberar o download agora. Tente novamente." });
    }
});
//# sourceMappingURL=index.js.map