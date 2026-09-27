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
exports.ALLOWED_ORIGINS = void 0;
exports.normalizeEmail = normalizeEmail;
exports.validateEmail = validateEmail;
exports.hashEmail = hashEmail;
exports.generateSecureToken = generateSecureToken;
exports.hashToken = hashToken;
exports.isTokenExpired = isTokenExpired;
exports.sanitizeName = sanitizeName;
exports.sanitizeSource = sanitizeSource;
exports.isCooldownActive = isCooldownActive;
exports.isAllowedOrigin = isAllowedOrigin;
const crypto = __importStar(require("node:crypto"));
/**
 * Standard email normalization: trim, lowercase, strip zero-width characters.
 */
function normalizeEmail(email) {
    if (!email || typeof email !== "string")
        return "";
    return email
        .trim()
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, "");
}
/**
 * Strict standard email validation regex (RFC 5322 compatible subset).
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
function validateEmail(email) {
    if (!email || typeof email !== "string")
        return false;
    const normalized = normalizeEmail(email);
    if (normalized.length === 0 || normalized.length > 254)
        return false;
    return EMAIL_REGEX.test(normalized);
}
/**
 * Deterministic SHA-256 hash of normalized email for document ID and privacy.
 */
function hashEmail(normalizedEmail) {
    return crypto.createHash("sha256").update(normalizedEmail).digest("hex");
}
/**
 * Cryptographically secure 256-bit random hex token (64 characters).
 */
function generateSecureToken() {
    return crypto.randomBytes(32).toString("hex");
}
/**
 * SHA-256 hash of token to store in Firestore (never store raw token).
 */
function hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string")
        return "";
    return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}
/**
 * Checks whether token expiration has passed.
 */
function isTokenExpired(expiresAt, now = new Date()) {
    if (!expiresAt)
        return true;
    if (typeof expiresAt?.toDate === "function") {
        return now.getTime() > expiresAt.toDate().getTime();
    }
    const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (isNaN(expirationDate.getTime()))
        return true;
    return now.getTime() > expirationDate.getTime();
}
/**
 * Sanitizes subscriber name.
 */
function sanitizeName(name) {
    if (!name || typeof name !== "string")
        return null;
    const cleaned = name
        .trim()
        .replace(/<[^>]*>?/gm, "") // Strip HTML tags
        .replace(/[\r\n\t]/g, " ") // Normalize whitespace
        .replace(/\s+/g, " ")
        .slice(0, 100);
    return cleaned.length > 0 ? cleaned : null;
}
/**
 * Sanitizes subscriber source label.
 */
function sanitizeSource(source) {
    if (!source || typeof source !== "string")
        return "web";
    const cleaned = source
        .replace(/<[^>]*>?/gm, "") // Strip HTML tags first
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-.]/g, "")
        .slice(0, 100);
    return cleaned.length > 0 ? cleaned : "web";
}
/**
 * Validates whether cooldown period (default 120s) is currently active.
 */
function isCooldownActive(lastActionAt, cooldownMs = 120000, now = new Date()) {
    if (!lastActionAt)
        return false;
    if (typeof lastActionAt?.toDate === "function") {
        return (now.getTime() - lastActionAt.toDate().getTime()) < cooldownMs;
    }
    const date = lastActionAt instanceof Date ? lastActionAt : new Date(lastActionAt);
    if (isNaN(date.getTime()))
        return false;
    return (now.getTime() - date.getTime()) < cooldownMs;
}
/**
 * Checks if the request is originated from allowed origins.
 */
exports.ALLOWED_ORIGINS = [
    "https://felipedutra.com",
    "https://www.felipedutra.com"
];
function isAllowedOrigin(origin) {
    if (!origin)
        return false;
    return exports.ALLOWED_ORIGINS.includes(origin.toLowerCase().trim());
}
//# sourceMappingURL=core.js.map