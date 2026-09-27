"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RATE_LIMIT_CONFIG = exports.ALLOWED_ORIGINS = void 0;
exports.isAllowedOrigin = isAllowedOrigin;
exports.normalizePlainText = normalizePlainText;
exports.sanitizeDisplayName = sanitizeDisplayName;
exports.validateAndSanitizeMessage = validateAndSanitizeMessage;
exports.isHoneypotTriggered = isHoneypotTriggered;
exports.generateConversationId = generateConversationId;
exports.generateSessionToken = generateSessionToken;
exports.hashSessionToken = hashSessionToken;
exports.verifySessionToken = verifySessionToken;
exports.deriveOpaqueKey = deriveOpaqueKey;
exports.deriveContextId = deriveContextId;
exports.deriveOpenClawSessionKey = deriveOpenClawSessionKey;
exports.parseDate = parseDate;
exports.evaluateRateLimit = evaluateRateLimit;
exports.mapWorkerStatus = mapWorkerStatus;
exports.extractSanitizedResponseText = extractSanitizedResponseText;
const crypto = __importStar(require("node:crypto"));
/**
 * Origin validation.
 * Allow only https://felipedutra.com and localhost/127.0.0.1 for local tests.
 */
exports.ALLOWED_ORIGINS = [
    "https://felipedutra.com",
    "https://www.felipedutra.com",
];
const DEV_LOCALHOST_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function isAllowedOrigin(origin) {
    if (!origin || typeof origin !== "string")
        return false;
    const lower = origin.toLowerCase().trim();
    if (exports.ALLOWED_ORIGINS.includes(lower))
        return true;
    return DEV_LOCALHOST_REGEX.test(lower);
}
/**
 * Normalizes plain text by stripping HTML tags, zero-width characters,
 * and normalizing whitespace while preserving basic line breaks.
 */
function normalizePlainText(text) {
    if (!text || typeof text !== "string")
        return "";
    return text
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // Strip zero-width characters
        .replace(/<[^>]*>?/gm, "") // Strip HTML tags
        .replace(/\r\n/g, "\n") // Normalize CRLF to LF
        .replace(/\r/g, "\n")
        .replace(/[^\S\n]+/g, " ") // Collapse horizontal whitespace
        .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive line breaks
        .trim();
}
/**
 * Sanitizes visitor display name (optional, max 80 characters).
 */
function sanitizeDisplayName(name) {
    if (!name || typeof name !== "string")
        return null;
    const cleaned = name
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/<[^>]*>?/gm, "")
        .replace(/[\r\n\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return cleaned.length > 0 ? cleaned : null;
}
/**
 * Validates and sanitizes message content (max 2000 characters).
 */
function validateAndSanitizeMessage(message) {
    if (typeof message !== "string") {
        return { valid: false, message: "", error: "A mensagem é obrigatória e deve ser um texto." };
    }
    const normalized = normalizePlainText(message);
    if (normalized.length === 0) {
        return { valid: false, message: "", error: "A mensagem não pode ser vazia." };
    }
    if (normalized.length > 2000) {
        return {
            valid: false,
            message: "",
            error: "A mensagem excede o limite máximo permitido de 2000 caracteres."
        };
    }
    return { valid: true, message: normalized };
}
/**
 * Honeypot check: website field should remain empty.
 */
function isHoneypotTriggered(website) {
    if (!website)
        return false;
    if (typeof website === "string" && website.trim().length > 0)
        return true;
    return false;
}
/**
 * Generates a crypto-random UUID for conversation identification.
 */
function generateConversationId() {
    return crypto.randomUUID();
}
/**
 * Generates a 32-byte opaque session token (64 hex characters).
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}
/**
 * SHA-256 hash of token to store in Firestore (never store raw token).
 */
function hashSessionToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string")
        return "";
    return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}
/**
 * Constant-time verification of session token against stored SHA-256 hash.
 */
function verifySessionToken(token, storedHash) {
    if (!token || !storedHash || typeof token !== "string" || typeof storedHash !== "string") {
        return false;
    }
    const tokenHash = hashSessionToken(token);
    const bufA = Buffer.from(tokenHash, "hex");
    const bufB = Buffer.from(storedHash, "hex");
    if (bufA.length !== bufB.length)
        return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
/**
 * Derives an opaque alphanumeric identifier from conversationId.
 */
function deriveOpaqueKey(conversationId) {
    if (!conversationId || typeof conversationId !== "string")
        return "";
    return conversationId.replace(/[^a-zA-Z0-9]/g, "");
}
/**
 * Builds contextId for pulso_requests: public_site_<opaque>
 */
function deriveContextId(opaqueKey) {
    return `public_site_${opaqueKey}`;
}
/**
 * Builds session keys: agent:lotus-conversa:pulso:<opaque>
 */
function deriveOpenClawSessionKey(opaqueKey) {
    return `agent:lotus-conversa:pulso:${opaqueKey}`;
}
/**
 * Rate limit configuration and transactional evaluator.
 */
exports.DEFAULT_RATE_LIMIT_CONFIG = {
    cooldownMs: 5000, // 5s minimum between messages
    maxPerHour: 20 // 20 messages per hour maximum
};
function parseDate(val) {
    if (!val)
        return null;
    if (typeof val.toDate === "function") {
        return val.toDate();
    }
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? null : d;
}
function evaluateRateLimit(data, now = new Date(), config = exports.DEFAULT_RATE_LIMIT_CONFIG) {
    const lastMessageDate = parseDate(data.lastMessageAt);
    if (lastMessageDate) {
        const elapsedMs = now.getTime() - lastMessageDate.getTime();
        if (elapsedMs < config.cooldownMs) {
            const currentStart = parseDate(data.hourWindowStart) || now;
            return {
                allowed: false,
                reason: "cooldown",
                messageCountHour: data.messageCountHour ?? 0,
                hourWindowStart: currentStart
            };
        }
    }
    const windowStartDate = parseDate(data.hourWindowStart);
    if (windowStartDate) {
        const windowElapsedMs = now.getTime() - windowStartDate.getTime();
        if (windowElapsedMs >= 3600000) {
            // 1 hour has elapsed, start a new window
            return {
                allowed: true,
                messageCountHour: 1,
                hourWindowStart: now
            };
        }
        const currentCount = data.messageCountHour ?? 0;
        if (currentCount >= config.maxPerHour) {
            return {
                allowed: false,
                reason: "hourly_cap",
                messageCountHour: currentCount,
                hourWindowStart: windowStartDate
            };
        }
        return {
            allowed: true,
            messageCountHour: currentCount + 1,
            hourWindowStart: windowStartDate
        };
    }
    // Initial message for conversation
    return {
        allowed: true,
        messageCountHour: 1,
        hourWindowStart: now
    };
}
/**
 * Worker status mapper: translates internal pulso_requests status
 * to the public contract: 'queued' | 'running' | 'success' | 'error'.
 */
function mapWorkerStatus(rawStatus) {
    if (!rawStatus || typeof rawStatus !== "string")
        return "error";
    switch (rawStatus) {
        case "requested":
        case "queued_for_openclaw":
        case "queued":
            return "queued";
        case "running":
        case "processing_openclaw":
        case "processing_by_openclaw":
        case "processing_extraction":
        case "processing":
            return "running";
        case "proposal_ready":
        case "waiting_user_approval":
        case "completed":
        case "success":
            return "success";
        case "failed":
        case "openclaw_failed":
        case "error":
            return "error";
        default:
            // Unknown status is treated as error to avoid leaking internal states
            return "error";
    }
}
/**
 * Extracts and sanitizes the response text, stripping HTML/scripts,
 * normalizing whitespace, and truncating to a safe length.
 * Never leaks internal metadata or error traces.
 */
function extractSanitizedResponseText(requestData, maxLength = 4000) {
    if (!requestData || typeof requestData !== "object")
        return undefined;
    const rawCandidate = requestData.openclawResult?.responseText ??
        requestData.result?.responseText ??
        requestData.result?.response ??
        requestData.responseText;
    if (!rawCandidate || typeof rawCandidate !== "string") {
        return undefined;
    }
    const cleaned = rawCandidate
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/<[^>]*>?/gm, "")
        .trim()
        .slice(0, maxLength);
    return cleaned.length > 0 ? cleaned : undefined;
}
//# sourceMappingURL=core.js.map