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
exports.MUSIC_OCRE_ALLOWED_ORIGINS = void 0;
exports.normalizeDownloadEmail = normalizeDownloadEmail;
exports.validateDownloadEmail = validateDownloadEmail;
exports.sanitizeDownloadName = sanitizeDownloadName;
exports.sanitizeDownloadSource = sanitizeDownloadSource;
exports.hashDownloadEmail = hashDownloadEmail;
exports.isMusicOcreOriginAllowed = isMusicOcreOriginAllowed;
exports.isDownloadCooldownActive = isDownloadCooldownActive;
const crypto = __importStar(require("node:crypto"));
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
exports.MUSIC_OCRE_ALLOWED_ORIGINS = [
    "https://musicaocre.com.br",
    "https://www.musicaocre.com.br"
];
const DEV_LOCALHOST_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function normalizeDownloadEmail(value) {
    if (typeof value !== "string")
        return "";
    return value.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
}
function validateDownloadEmail(value) {
    const email = normalizeDownloadEmail(value);
    return email.length > 0 && email.length <= 254 && EMAIL_REGEX.test(email);
}
function sanitizeDownloadName(value) {
    if (typeof value !== "string")
        return "";
    return value
        .trim()
        .replace(/<[^>]*>?/gm, "")
        .replace(/[\r\n\t]/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 100);
}
function sanitizeDownloadSource(value) {
    if (typeof value !== "string")
        return "musicaocre.com.br";
    const source = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, "")
        .slice(0, 100);
    return source || "musicaocre.com.br";
}
function hashDownloadEmail(email) {
    return crypto.createHash("sha256").update(email).digest("hex");
}
function isMusicOcreOriginAllowed(origin) {
    if (typeof origin !== "string")
        return false;
    const normalized = origin.trim().toLowerCase();
    return exports.MUSIC_OCRE_ALLOWED_ORIGINS.includes(normalized) || DEV_LOCALHOST_REGEX.test(normalized);
}
function isDownloadCooldownActive(lastDownloadedAt, now = new Date()) {
    if (!lastDownloadedAt)
        return false;
    const last = typeof lastDownloadedAt?.toDate === "function"
        ? lastDownloadedAt.toDate()
        : new Date(lastDownloadedAt);
    if (Number.isNaN(last.getTime()))
        return false;
    return now.getTime() - last.getTime() < 60000;
}
//# sourceMappingURL=core.js.map