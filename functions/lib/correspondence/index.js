"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correspondenceApi = exports.resendApiKey = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-admin/firestore");
const core_1 = require("./core");
const templates_1 = require("./templates");
const mailer_1 = require("./mailer");
exports.resendApiKey = (0, params_1.defineSecret)("RESEND_API_KEY");
const WORKSPACE_ID = "felipe_dutra";
const SUBSCRIBERS_COLLECTION = `workspaces/${WORKSPACE_ID}/correspondence_subscribers`;
const GENERIC_SUBSCRIBE_RESPONSE = {
    status: "ok",
    message: "Inscrição processada com sucesso. Se o e-mail for válido, você receberá uma confirmação em breve."
};
function getCorrespondenceBaseUrl() {
    return (process.env.CORRESPONDENCE_BASE_URL ||
        "https://felipedutra.com/api/correspondence");
}
exports.correspondenceApi = (0, https_1.onRequest)({
    region: "us-central1",
    secrets: [exports.resendApiKey]
}, async (req, res) => {
    // ── 1. CORS & Preflight ──────────────────────────────────────────────────
    const origin = req.headers.origin;
    if (origin) {
        if ((0, core_1.isAllowedOrigin)(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.setHeader("Access-Control-Max-Age", "86400");
        }
        else if (req.method === "OPTIONS" || req.method === "POST") {
            // Reject cross-origin requests from unauthorized origins
            res.status(403).json({ error: "Origin not allowed" });
            return;
        }
    }
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    const db = (0, firestore_1.getFirestore)();
    const apiKey = exports.resendApiKey.value() || process.env.RESEND_API_KEY || "";
    // ── 2. GET: Confirm or Unsubscribe ──────────────────────────────────────
    if (req.method === "GET") {
        const mode = (req.query.mode || req.query.action || "");
        const rawToken = (req.query.token || "");
        if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
            res.redirect("https://felipedutra.com/?correspondence=error#correspondencia");
            return;
        }
        const tokenHash = (0, core_1.hashToken)(rawToken);
        try {
            if (mode === "confirm") {
                // Find subscriber by confirmationTokenHash
                const snapshot = await db
                    .collection(SUBSCRIBERS_COLLECTION)
                    .where("confirmationTokenHash", "==", tokenHash)
                    .limit(1)
                    .get();
                if (snapshot.empty) {
                    console.warn("[correspondence] Confirmation token not found or already used");
                    res.redirect("https://felipedutra.com/?correspondence=expired#correspondencia");
                    return;
                }
                const docSnap = snapshot.docs[0];
                const data = docSnap.data();
                // Check expiration (48 hours)
                if ((0, core_1.isTokenExpired)(data.confirmationExpiresAt)) {
                    console.warn("[correspondence] Confirmation token expired for docId:", docSnap.id);
                    await docSnap.ref.update({
                        status: "error",
                        errorCode: "TOKEN_EXPIRED",
                        updatedAt: firestore_1.FieldValue.serverTimestamp()
                    });
                    res.redirect("https://felipedutra.com/?correspondence=expired#correspondencia");
                    return;
                }
                // Generate single-use unsubscribe token for future use
                const unsubRawToken = (0, core_1.generateSecureToken)();
                const unsubTokenHash = (0, core_1.hashToken)(unsubRawToken);
                // Update subscriber to active
                const nowTs = firestore_1.FieldValue.serverTimestamp();
                await docSnap.ref.update({
                    status: "active",
                    confirmedAt: nowTs,
                    updatedAt: nowTs,
                    confirmationTokenHash: null, // Single use: invalidated immediately
                    confirmationExpiresAt: null,
                    unsubscribeTokenHash: unsubTokenHash,
                    lastDeliveryStatus: "welcome_queued",
                    errorCode: null
                });
                console.log("[correspondence] Subscriber confirmed successfully:", docSnap.id.slice(0, 8));
                // Send welcome auto-response email asynchronously
                const unsubUrl = `${getCorrespondenceBaseUrl()}?mode=unsubscribe&token=${unsubRawToken}`;
                const welcomeMail = (0, templates_1.buildWelcomeEmail)({
                    name: data.name,
                    unsubscribeUrl: unsubUrl
                });
                (0, mailer_1.sendEmailWithResend)({
                    apiKey,
                    to: data.email,
                    subject: welcomeMail.subject,
                    html: welcomeMail.html,
                    text: welcomeMail.text
                })
                    .then(async (sendResult) => {
                    if (sendResult.success) {
                        await docSnap.ref.update({
                            lastDeliveryStatus: "welcome_sent",
                            lastDeliveryAt: firestore_1.FieldValue.serverTimestamp()
                        });
                    }
                    else {
                        console.error("[correspondence] Failed to send welcome email for doc:", docSnap.id.slice(0, 8), sendResult.errorCode);
                        await docSnap.ref.update({
                            lastDeliveryStatus: "failed",
                            lastDeliveryAt: firestore_1.FieldValue.serverTimestamp(),
                            errorCode: sendResult.errorCode || "WELCOME_DELIVERY_FAILED"
                        });
                    }
                })
                    .catch((err) => {
                    console.error("[correspondence] Unexpected welcome delivery error:", err?.message);
                });
                res.redirect("https://felipedutra.com/?correspondence=confirmed#correspondencia");
                return;
            }
            if (mode === "unsubscribe") {
                // Try finding by unsubscribeTokenHash or confirmationTokenHash
                let snapshot = await db
                    .collection(SUBSCRIBERS_COLLECTION)
                    .where("unsubscribeTokenHash", "==", tokenHash)
                    .limit(1)
                    .get();
                if (snapshot.empty) {
                    snapshot = await db
                        .collection(SUBSCRIBERS_COLLECTION)
                        .where("confirmationTokenHash", "==", tokenHash)
                        .limit(1)
                        .get();
                }
                if (snapshot.empty) {
                    console.warn("[correspondence] Unsubscribe token not found");
                    res.redirect("https://felipedutra.com/?correspondence=error#correspondencia");
                    return;
                }
                const docSnap = snapshot.docs[0];
                const nowTs = firestore_1.FieldValue.serverTimestamp();
                await docSnap.ref.update({
                    status: "unsubscribed",
                    unsubscribedAt: nowTs,
                    updatedAt: nowTs,
                    confirmationTokenHash: null,
                    unsubscribeTokenHash: null
                });
                console.log("[correspondence] Subscriber unsubscribed successfully:", docSnap.id.slice(0, 8));
                res.redirect("https://felipedutra.com/?correspondence=unsubscribed");
                return;
            }
            // Unknown mode
            res.redirect("https://felipedutra.com/?correspondence=error#correspondencia");
            return;
        }
        catch (err) {
            console.error("[correspondence] GET processing error:", err?.code || "INTERNAL_ERROR");
            res.redirect("https://felipedutra.com/?correspondence=error#correspondencia");
            return;
        }
    }
    // ── 3. POST: Subscribe ───────────────────────────────────────────────────
    if (req.method === "POST") {
        const body = (req.body || {});
        // Honeypot check: If filled by automated bot, return generic 200 silently
        if (body.honeypot && String(body.honeypot).trim().length > 0) {
            console.log("[correspondence] Honeypot triggered, silently dropping");
            res.status(200).json(GENERIC_SUBSCRIBE_RESPONSE);
            return;
        }
        // Check action
        if (body.action && body.action !== "subscribe") {
            res.status(400).json({ error: "Ação inválida." });
            return;
        }
        // Consent check: Must be true
        const hasConsent = body.consent === true || body.consent === "true";
        if (!hasConsent) {
            res.status(400).json({ error: "Consentimento obrigatório para inscrição." });
            return;
        }
        // Email normalization and validation
        const rawEmail = body.email || "";
        if (!(0, core_1.validateEmail)(rawEmail)) {
            res.status(400).json({ error: "Formato de e-mail inválido." });
            return;
        }
        const email = (0, core_1.normalizeEmail)(rawEmail);
        const emailId = (0, core_1.hashEmail)(email);
        const name = (0, core_1.sanitizeName)(body.name);
        const source = (0, core_1.sanitizeSource)(body.source);
        const subscriberRef = db.collection(SUBSCRIBERS_COLLECTION).doc(emailId);
        try {
            const docSnap = await subscriberRef.get();
            const now = new Date();
            const serverNow = firestore_1.FieldValue.serverTimestamp();
            if (docSnap.exists) {
                const current = docSnap.data();
                // If already active: Return generic response without revealing status or spamming
                if (current.status === "active") {
                    console.log("[correspondence] Already active subscriber, suppressing:", emailId.slice(0, 8));
                    res.status(200).json(GENERIC_SUBSCRIBE_RESPONSE);
                    return;
                }
                // If pending: Check cooldown to prevent email flooding
                if (current.status === "pending" && (0, core_1.isCooldownActive)(current.updatedAt || current.createdAt, 120000, now)) {
                    console.log("[correspondence] Cooldown active, suppressing email flood:", emailId.slice(0, 8));
                    res.status(200).json(GENERIC_SUBSCRIBE_RESPONSE);
                    return;
                }
            }
            // Generate fresh single-use confirmation token (valid for 48h)
            const rawToken = (0, core_1.generateSecureToken)();
            const tokenHash = (0, core_1.hashToken)(rawToken);
            const expiresAtDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
            const expiresAt = firestore_1.Timestamp.fromDate(expiresAtDate);
            // Save / update document in Firestore
            const subscriberData = {
                id: emailId,
                name: name || (docSnap.exists ? docSnap.data()?.name : null) || null,
                email,
                source,
                status: "pending",
                consentAt: serverNow,
                updatedAt: serverNow,
                confirmationTokenHash: tokenHash,
                confirmationExpiresAt: expiresAt,
                lastDeliveryStatus: "queued",
                errorCode: null
            };
            if (!docSnap.exists) {
                subscriberData.createdAt = serverNow;
                subscriberData.confirmedAt = null;
                subscriberData.unsubscribedAt = null;
            }
            await subscriberRef.set(subscriberData, { merge: true });
            // Dispatch confirmation email
            const confirmUrl = `${getCorrespondenceBaseUrl()}?mode=confirm&token=${rawToken}`;
            const confirmationMail = (0, templates_1.buildConfirmationEmail)({
                name: name || undefined,
                confirmUrl
            });
            const sendResult = await (0, mailer_1.sendEmailWithResend)({
                apiKey,
                to: email,
                subject: confirmationMail.subject,
                html: confirmationMail.html,
                text: confirmationMail.text
            });
            if (sendResult.success) {
                await subscriberRef.update({
                    lastDeliveryStatus: "confirmation_sent",
                    lastDeliveryAt: firestore_1.FieldValue.serverTimestamp()
                });
                console.log("[correspondence] Confirmation email sent for hash:", emailId.slice(0, 8));
            }
            else {
                console.error("[correspondence] Delivery error for hash:", emailId.slice(0, 8), "code:", sendResult.errorCode);
                await subscriberRef.update({
                    lastDeliveryStatus: "failed",
                    lastDeliveryAt: firestore_1.FieldValue.serverTimestamp(),
                    errorCode: sendResult.errorCode || "CONFIRMATION_DELIVERY_FAILED"
                });
            }
            // Always return generic response to avoid enumeration
            res.status(200).json(GENERIC_SUBSCRIBE_RESPONSE);
            return;
        }
        catch (err) {
            console.error("[correspondence] Fatal subscribe error for hash:", emailId.slice(0, 8), "code:", err?.code || "UNKNOWN");
            // Persist error status if possible
            try {
                await subscriberRef.set({
                    id: emailId,
                    email,
                    status: "error",
                    errorCode: "INTERNAL_PROCESSING_ERROR",
                    updatedAt: firestore_1.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            catch {
                // ignore secondary failure
            }
            // Return generic response even on error
            res.status(200).json(GENERIC_SUBSCRIBE_RESPONSE);
            return;
        }
    }
    res.status(405).json({ error: "Método não permitido" });
});
//# sourceMappingURL=index.js.map