import { invariant } from "../domain/assertions.mjs";

const FORBIDDEN_KEY_PATTERNS = [
  /^apikey$/i,
  /^api_key$/i,
  /^secret$/i,
  /^client_?secret$/i,
  /^password$/i,
  /^passwd$/i,
  /^token$/i,
  /^auth_?token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^private_?key$/i,
  /^credentials?$/i
];

const ALLOWED_KEY_EXCEPTIONS = [
  /ref$/i,
  /_ref$/i,
  /id$/i,
  /_id$/i,
  /hash$/i,
  /fingerprint$/i
];

const SECRET_VALUE_PATTERNS = [
  /^sk-[a-zA-Z0-9_\-]{15,}/,
  /^gh[pousr]_[a-zA-Z0-9]{20,}/,
  /^xox[baprs]-[a-zA-Z0-9\-]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^Bearer\s+[a-zA-Z0-9._\-]{20,}/i
];

export function isForbiddenSecretKey(key) {
  if (!key || typeof key !== "string") return false;
  for (const exception of ALLOWED_KEY_EXCEPTIONS) {
    if (exception.test(key)) return false;
  }
  for (const pattern of FORBIDDEN_KEY_PATTERNS) {
    if (pattern.test(key)) return true;
  }
  return false;
}

export function matchesSecretValue(value) {
  if (!value || typeof value !== "string") return false;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(value.trim())) return true;
  }
  return false;
}

export function assertNoSecrets(target, path = "") {
  const seen = new Set();

  function scan(value, currentPath = "") {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      if (matchesSecretValue(value)) {
        throw new Error(
          `secret_detected: value at path '${currentPath}' resembles a raw secret; raw secrets are strictly forbidden in control plane entities`
        );
      }
      return;
    }
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        scan(value[i], `${currentPath}[${i}]`);
      }
      return;
    }

    for (const [key, val] of Object.entries(value)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (isForbiddenSecretKey(key) && val !== "[REDACTED_SECRET]") {
        throw new Error(
          `secret_detected: key '${key}' at path '${childPath}' is forbidden; raw credentials must never be stored. Use secretRef instead.`
        );
      }
      scan(val, childPath);
    }
  }

  scan(target, path);
  return true;
}

export function sanitizeSecrets(target) {
  if (target === null || target === undefined) return target;
  if (typeof target === "string") {
    if (matchesSecretValue(target)) return "[REDACTED_SECRET]";
    return target;
  }
  if (typeof target !== "object") return target;

  if (Array.isArray(target)) {
    return target.map(item => sanitizeSecrets(item));
  }

  const cleaned = {};
  for (const [key, val] of Object.entries(target)) {
    if (isForbiddenSecretKey(key)) {
      cleaned[key] = "[REDACTED_SECRET]";
    } else {
      cleaned[key] = sanitizeSecrets(val);
    }
  }
  return cleaned;
}
