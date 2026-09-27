import * as crypto from "node:crypto";

/**
 * Standard email normalization: trim, lowercase, strip zero-width characters.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  return email
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/**
 * Strict standard email validation regex (RFC 5322 compatible subset).
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = normalizeEmail(email);
  if (normalized.length === 0 || normalized.length > 254) return false;
  return EMAIL_REGEX.test(normalized);
}

/**
 * Deterministic SHA-256 hash of normalized email for document ID and privacy.
 */
export function hashEmail(normalizedEmail: string): string {
  return crypto.createHash("sha256").update(normalizedEmail).digest("hex");
}

/**
 * Cryptographically secure 256-bit random hex token (64 characters).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash of token to store in Firestore (never store raw token).
 */
export function hashToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") return "";
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Checks whether token expiration has passed.
 */
export function isTokenExpired(expiresAt: any, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  if (typeof expiresAt?.toDate === "function") {
    return now.getTime() > expiresAt.toDate().getTime();
  }
  const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (isNaN(expirationDate.getTime())) return true;
  return now.getTime() > expirationDate.getTime();
}

/**
 * Sanitizes subscriber name.
 */
export function sanitizeName(name?: unknown): string | null {
  if (!name || typeof name !== "string") return null;
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
export function sanitizeSource(source?: unknown): string {
  if (!source || typeof source !== "string") return "web";
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
export function isCooldownActive(
  lastActionAt: any,
  cooldownMs: number = 120_000,
  now: Date = new Date()
): boolean {
  if (!lastActionAt) return false;
  if (typeof lastActionAt?.toDate === "function") {
    return (now.getTime() - lastActionAt.toDate().getTime()) < cooldownMs;
  }
  const date = lastActionAt instanceof Date ? lastActionAt : new Date(lastActionAt);
  if (isNaN(date.getTime())) return false;
  return (now.getTime() - date.getTime()) < cooldownMs;
}

/**
 * Checks if the request is originated from allowed origins.
 * Allowed: felipedutra.com, www.felipedutra.com, and dev localhost.
 */
export const ALLOWED_ORIGINS = [
  "https://felipedutra.com",
  "https://www.felipedutra.com"
];

const DEV_LOCALHOST_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin || typeof origin !== "string") return false;
  const lower = origin.toLowerCase().trim();
  if (ALLOWED_ORIGINS.includes(lower)) return true;
  return DEV_LOCALHOST_REGEX.test(lower);
}

/**
 * Direct Cloud Function URL used by default because felipedutra.com is a static site without proxy.
 */
export const DEFAULT_CORRESPONDENCE_BASE_URL =
  "https://us-central1-felipedutraapps.cloudfunctions.net/correspondenceApi";

export function getCorrespondenceBaseUrl(): string {
  return (
    process.env.CORRESPONDENCE_BASE_URL ||
    DEFAULT_CORRESPONDENCE_BASE_URL
  );
}
