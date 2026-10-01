import * as crypto from "node:crypto";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const MUSIC_OCRE_ALLOWED_ORIGINS = [
  "https://musicaocre.com.br",
  "https://www.musicaocre.com.br"
];

const DEV_LOCALHOST_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function normalizeDownloadEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export function validateDownloadEmail(value: unknown): boolean {
  const email = normalizeDownloadEmail(value);
  return email.length > 0 && email.length <= 254 && EMAIL_REGEX.test(email);
}

export function sanitizeDownloadName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/<[^>]*>?/gm, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export function sanitizeDownloadSource(value: unknown): string {
  if (typeof value !== "string") return "musicaocre.com.br";
  const source = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 100);
  return source || "musicaocre.com.br";
}

export function hashDownloadEmail(email: string): string {
  return crypto.createHash("sha256").update(email).digest("hex");
}

export function isMusicOcreOriginAllowed(origin: unknown): boolean {
  if (typeof origin !== "string") return false;
  const normalized = origin.trim().toLowerCase();
  return MUSIC_OCRE_ALLOWED_ORIGINS.includes(normalized) || DEV_LOCALHOST_REGEX.test(normalized);
}

export function isDownloadCooldownActive(lastDownloadedAt: any, now = new Date()): boolean {
  if (!lastDownloadedAt) return false;
  const last = typeof lastDownloadedAt?.toDate === "function"
    ? lastDownloadedAt.toDate()
    : new Date(lastDownloadedAt);
  if (Number.isNaN(last.getTime())) return false;
  return now.getTime() - last.getTime() < 60_000;
}
