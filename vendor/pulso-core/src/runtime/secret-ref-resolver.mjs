import { invariant } from "../domain/assertions.mjs";
import { assertNoSecrets, sanitizeSecrets } from "../control-plane/secrets.mjs";
import {
  parseSecretRef,
  validateSecretRefDescriptor
} from "./runtime-contracts.mjs";

export class SecretRefResolver {
  #envStore;
  #memoryStore;
  #keychainStore;
  #knownRawValues;
  #allowProcessEnv;
  #clock;

  constructor({
    env = {},
    memory = {},
    keychain = {},
    allowProcessEnv = false,
    clock = () => new Date().toISOString()
  } = {}) {
    this.#envStore = new Map();
    this.#memoryStore = new Map();
    this.#keychainStore = new Map();
    this.#knownRawValues = new Set();
    this.#allowProcessEnv = Boolean(allowProcessEnv);
    this.#clock = clock;

    for (const [k, v] of Object.entries(env || {})) {
      this.setSecret(`env:${k}`, v);
    }
    for (const [k, v] of Object.entries(memory || {})) {
      this.setSecret(`memory:${k}`, v);
    }
    for (const [k, v] of Object.entries(keychain || {})) {
      this.setSecret(`keychain:${k}`, v);
    }
  }

  setSecret(secretRefOrScheme, keyOrRawValue, maybeRawValue) {
    const hasThreeArgs = maybeRawValue !== undefined;
    const secretRef = hasThreeArgs ? `${secretRefOrScheme}:${keyOrRawValue}` : secretRefOrScheme;
    const rawValue = hasThreeArgs ? maybeRawValue : keyOrRawValue;
    const parsed = parseSecretRef(secretRef);
    invariant(typeof rawValue === "string" && rawValue.length > 0, "secret_raw_value_required");
    invariant(
      rawValue.trim().length >= 4,
      "secret_raw_value_too_short: minimum 4 non-whitespace characters required"
    );
    this.#knownRawValues.add(rawValue);
    if (rawValue.trim() !== rawValue && rawValue.trim().length >= 4) {
      this.#knownRawValues.add(rawValue.trim());
    }

    if (parsed.scheme === "env") {
      this.#envStore.set(parsed.keyId, rawValue);
    } else if (parsed.scheme === "memory") {
      this.#memoryStore.set(parsed.keyId, rawValue);
    } else if (parsed.scheme === "keychain") {
      this.#keychainStore.set(parsed.keyId, rawValue);
    }
    return this.inspectRef(parsed.secretRef);
  }

  deleteSecret(secretRef) {
    const parsed = parseSecretRef(secretRef);
    if (parsed.scheme === "env") {
      this.#envStore.delete(parsed.keyId);
    } else if (parsed.scheme === "memory") {
      this.#memoryStore.delete(parsed.keyId);
    } else if (parsed.scheme === "keychain") {
      this.#keychainStore.delete(parsed.keyId);
    }
    return this.inspectRef(parsed.secretRef);
  }

  hasSecret(secretRef) {
    if (!secretRef) return false;
    const parsed = parseSecretRef(secretRef);
    return this.#lookupRaw(parsed) !== null;
  }

  has(secretRef) {
    return this.hasSecret(secretRef);
  }

  #lookupRaw(parsed) {
    if (parsed.scheme === "env") {
      if (this.#envStore.has(parsed.keyId)) {
        return this.#envStore.get(parsed.keyId);
      }
      if (this.#allowProcessEnv && typeof process !== "undefined" && process.env && process.env[parsed.keyId]) {
        const val = String(process.env[parsed.keyId]);
        invariant(
          val.trim().length >= 4,
          "secret_raw_value_too_short: minimum 4 non-whitespace characters required"
        );
        this.#knownRawValues.add(val);
        if (val.trim() !== val) this.#knownRawValues.add(val.trim());
        return val;
      }
      return null;
    }
    if (parsed.scheme === "memory") {
      return this.#memoryStore.get(parsed.keyId) ?? null;
    }
    if (parsed.scheme === "keychain") {
      return this.#keychainStore.get(parsed.keyId) ?? null;
    }
    return null;
  }

  inspectRef(secretRef) {
    if (secretRef === null || secretRef === undefined || secretRef === "") {
      return validateSecretRefDescriptor({
        secretRef: null,
        scheme: "none",
        keyId: null,
        configured: false,
        checkedAt: this.#clock()
      });
    }
    const parsed = parseSecretRef(secretRef);
    const configured = this.#lookupRaw(parsed) !== null;
    return validateSecretRefDescriptor({
      secretRef: parsed.secretRef,
      scheme: parsed.scheme,
      keyId: parsed.keyId,
      configured,
      checkedAt: this.#clock()
    });
  }

  /**
   * Resolves a secretRef strictly at runtime for transport authentication.
   * Never persist, log, or include the returned string in domain events or errors.
   */
  resolve(secretRef) {
    const parsed = parseSecretRef(secretRef);
    const rawValue = this.#lookupRaw(parsed);
    if (rawValue === null || rawValue === undefined || String(rawValue).length === 0) {
      const err = new Error(`secret_ref_not_found:${parsed.secretRef} (secret_resolution_failed)`);
      err.code = "secret_ref_not_found";
      err.secretRef = parsed.secretRef;
      err.redactedPreview = parsed.redactedPreview;
      throw err;
    }
    invariant(
      String(rawValue).trim().length >= 4,
      "secret_raw_value_too_short: minimum 4 non-whitespace characters required"
    );
    this.#knownRawValues.add(rawValue);
    return rawValue;
  }

  redactString(text) {
    if (typeof text !== "string" || text.length === 0) return text;
    let out = text;
    for (const raw of this.#knownRawValues) {
      if (typeof raw === "string" && raw.length >= 4 && out.includes(raw)) {
        out = out.split(raw).join("[REDACTED_SECRET]");
      }
    }
    // Also scrub Bearer / sk- / ghp_ / etc. patterns embedded in text
    out = out.replace(/Bearer\s+[A-Za-z0-9._\-]{8,}/gi, "Bearer [REDACTED_SECRET]");
    out = out.replace(/sk-[A-Za-z0-9_\-]{10,}/g, "[REDACTED_SECRET]");
    out = out.replace(/x-api-key:\s*[^\s,;]+/gi, "x-api-key: [REDACTED_SECRET]");
    return out;
  }

  redact(target) {
    const preSanitized = sanitizeSecrets(target);
    const seen = new WeakMap();

    const walk = (value) => {
      if (value === null || value === undefined) return value;
      if (typeof value === "string") {
        return this.redactString(value);
      }
      if (typeof value !== "object") return value;
      if (seen.has(value)) return seen.get(value);

      if (Array.isArray(value)) {
        const arr = [];
        seen.set(value, arr);
        for (const item of value) arr.push(walk(item));
        return arr;
      }

      const obj = {};
      seen.set(value, obj);
      for (const [k, v] of Object.entries(value)) {
        obj[k] = walk(v);
      }
      return obj;
    };

    return walk(preSanitized);
  }

  redactError(error, secretRef = null) {
    const rawMessage = error instanceof Error ? error.message : String(error ?? "unknown_error");
    const rawCode = (error && typeof error === "object" && error.code) ? String(error.code) : "provider_error";
    const safeMessage = this.redactString(rawMessage);
    const descriptor = secretRef ? this.inspectRef(secretRef) : null;

    return Object.freeze({
      code: this.redactString(rawCode),
      message: safeMessage,
      secretRef: descriptor ? descriptor.secretRef : null,
      authSource: descriptor ? descriptor.redactedPreview : null,
      redacted: true
    });
  }

  assertZeroLeakage(target) {
    assertNoSecrets(target);
    const serialized = JSON.stringify(target ?? null);
    if (!serialized) return true;
    for (const raw of this.#knownRawValues) {
      if (typeof raw === "string" && raw.length >= 4 && serialized.includes(raw)) {
        throw new Error("secret_detected: known_resolved_secret_value_leaked_in_output");
      }
    }
    return true;
  }

  listConfiguredRefs() {
    const refs = [];
    for (const k of this.#envStore.keys()) refs.push(this.inspectRef(`env:${k}`));
    for (const k of this.#memoryStore.keys()) refs.push(this.inspectRef(`memory:${k}`));
    for (const k of this.#keychainStore.keys()) refs.push(this.inspectRef(`keychain:${k}`));
    return refs;
  }

  toJSON() {
    return {
      allowProcessEnv: this.#allowProcessEnv,
      configuredRefs: this.listConfiguredRefs()
    };
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toJSON();
  }
}
