import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedOrigin,
  normalizePlainText,
  sanitizeDisplayName,
  validateAndSanitizeMessage,
  isHoneypotTriggered,
  generateConversationId,
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
  deriveOpaqueKey,
  deriveContextId,
  deriveOpenClawSessionKey,
  evaluateRateLimit,
  mapWorkerStatus,
  extractSanitizedResponseText,
  DEFAULT_RATE_LIMIT_CONFIG
} from "./core.ts";

describe("Public Conversation Bridge - Core Pure Functions", () => {
  describe("CORS and Origin Validation", () => {
    test("allows official production domains", () => {
      assert.equal(isAllowedOrigin("https://felipedutra.com"), true);
      assert.equal(isAllowedOrigin("https://www.felipedutra.com"), true);
    });

    test("allows local dev origins", () => {
      assert.equal(isAllowedOrigin("http://localhost"), true);
      assert.equal(isAllowedOrigin("http://localhost:3000"), true);
      assert.equal(isAllowedOrigin("http://localhost:5173"), true);
      assert.equal(isAllowedOrigin("http://127.0.0.1"), true);
      assert.equal(isAllowedOrigin("http://127.0.0.1:3000"), true);
    });

    test("rejects unauthorized origins", () => {
      assert.equal(isAllowedOrigin("https://evil.com"), false);
      assert.equal(isAllowedOrigin("http://felipedutra.com"), false); // HTTP not allowed
      assert.equal(isAllowedOrigin("https://sub.felipedutra.com"), false);
      assert.equal(isAllowedOrigin(""), false);
      assert.equal(isAllowedOrigin(null), false);
      assert.equal(isAllowedOrigin(undefined), false);
    });
  });

  describe("Plain Text Normalization & Sanitization", () => {
    test("strips HTML tags and zero-width characters", () => {
      const malicious = "Olá <script>alert('xss')</script>\u200B mundo!<b>Como vai?</b>";
      assert.equal(normalizePlainText(malicious), "Olá alert('xss') mundo!Como vai?");
    });

    test("normalizes CRLF and multiple line breaks", () => {
      const input = "Linha 1\r\n\r\n\r\n\r\nLinha 2\rLinha 3";
      const normalized = normalizePlainText(input);
      assert.equal(normalized, "Linha 1\n\nLinha 2\nLinha 3");
    });

    test("handles non-string or empty input safely", () => {
      assert.equal(normalizePlainText(""), "");
      assert.equal(normalizePlainText(null as any), "");
      assert.equal(normalizePlainText(undefined as any), "");
    });
  });

  describe("sanitizeDisplayName", () => {
    test("cleans, collapses spaces and truncates to 80 chars", () => {
      const longName = "   Visitante   " + "A".repeat(100) + " <p>tag</p>";
      const sanitized = sanitizeDisplayName(longName);
      assert.ok(sanitized);
      assert.equal(sanitized.length, 80);
      assert.equal(sanitized.includes("<p>"), false);
      assert.equal(sanitized.startsWith("Visitante A"), true);
    });

    test("returns null for empty or non-string names", () => {
      assert.equal(sanitizeDisplayName(""), null);
      assert.equal(sanitizeDisplayName("    "), null);
      assert.equal(sanitizeDisplayName(null), null);
      assert.equal(sanitizeDisplayName(undefined), null);
      assert.equal(sanitizeDisplayName(12345), null);
    });
  });

  describe("validateAndSanitizeMessage", () => {
    test("accepts valid message within 2000 chars", () => {
      const result = validateAndSanitizeMessage("Olá, gostaria de saber mais sobre a Pulso.");
      assert.equal(result.valid, true);
      assert.equal(result.message, "Olá, gostaria de saber mais sobre a Pulso.");
    });

    test("rejects empty or whitespace-only messages", () => {
      assert.equal(validateAndSanitizeMessage("").valid, false);
      assert.equal(validateAndSanitizeMessage("   \n\n\t  ").valid, false);
      assert.equal(validateAndSanitizeMessage(null).valid, false);
      assert.equal(validateAndSanitizeMessage(undefined).valid, false);
    });

    test("accepts boundary message of exactly 2000 chars", () => {
      const boundaryMsg = "x".repeat(2000);
      const result = validateAndSanitizeMessage(boundaryMsg);
      assert.equal(result.valid, true);
      assert.equal(result.message.length, 2000);
    });

    test("rejects message exceeding 2000 chars", () => {
      const longMsg = "x".repeat(2001);
      const result = validateAndSanitizeMessage(longMsg);
      assert.equal(result.valid, false);
      assert.match(result.error || "", /2000 caracteres/);
    });
  });

  describe("Honeypot Detection", () => {
    test("detects when website field is filled", () => {
      assert.equal(isHoneypotTriggered("https://spam.com"), true);
      assert.equal(isHoneypotTriggered(" spam "), true);
    });

    test("returns false when website field is empty or absent", () => {
      assert.equal(isHoneypotTriggered(""), false);
      assert.equal(isHoneypotTriggered("   "), false);
      assert.equal(isHoneypotTriggered(undefined), false);
      assert.equal(isHoneypotTriggered(null), false);
    });
  });

  describe("Token Generation and Constant-Time Verification", () => {
    test("generateConversationId returns valid UUID", () => {
      const id = generateConversationId();
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test("generateSessionToken produces 64-char hex string (32 bytes)", () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      assert.equal(token1.length, 64);
      assert.equal(token2.length, 64);
      assert.notEqual(token1, token2);
    });

    test("hashSessionToken produces deterministic SHA-256", () => {
      const raw = generateSessionToken();
      const hash1 = hashSessionToken(raw);
      const hash2 = hashSessionToken(raw);
      assert.equal(hash1.length, 64);
      assert.equal(hash1, hash2);
      assert.notEqual(raw, hash1);
    });

    test("verifySessionToken validates matching token constant-time", () => {
      const raw = generateSessionToken();
      const hash = hashSessionToken(raw);
      assert.equal(verifySessionToken(raw, hash), true);
    });

    test("verifySessionToken rejects incorrect or tampered tokens", () => {
      const raw = generateSessionToken();
      const hash = hashSessionToken(raw);

      // Wrong token
      assert.equal(verifySessionToken("wrongtoken", hash), false);
      // Tampered token (one char altered)
      const tampered = raw.slice(0, -1) + (raw.endsWith("0") ? "1" : "0");
      assert.equal(verifySessionToken(tampered, hash), false);
      // Empty/null inputs
      assert.equal(verifySessionToken("", hash), false);
      assert.equal(verifySessionToken(raw, ""), false);
      assert.equal(verifySessionToken(null as any, hash), false);
      assert.equal(verifySessionToken(raw, null as any), false);
    });
  });

  describe("Opaque Identifiers and Session Keys", () => {
    test("deriveOpaqueKey removes non-alphanumeric chars from conversationId", () => {
      const uuid = "e5b87190-64d8-4f81-80a5-2dcfa2ea6895";
      const opaque = deriveOpaqueKey(uuid);
      assert.equal(opaque, "e5b8719064d84f8180a52dcfa2ea6895");
    });

    test("deriveContextId formats correctly as public_site_<opaque>", () => {
      const opaque = "e5b8719064d84f8180a52dcfa2ea6895";
      assert.equal(deriveContextId(opaque), "public_site_e5b8719064d84f8180a52dcfa2ea6895");
    });

    test("deriveOpenClawSessionKey matches exact agent contract", () => {
      const opaque = "e5b8719064d84f8180a52dcfa2ea6895";
      assert.equal(
        deriveOpenClawSessionKey(opaque),
        "agent:lotus-conversa:pulso:e5b8719064d84f8180a52dcfa2ea6895"
      );
    });
  });

  describe("Rate Limiting and Cooldown Evaluation", () => {
    test("allows initial message on new conversation", () => {
      const now = new Date();
      const evalResult = evaluateRateLimit({}, now);
      assert.equal(evalResult.allowed, true);
      assert.equal(evalResult.messageCountHour, 1);
    });

    test("blocks message sent within cooldown period (< 5s)", () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 2000); // 2s ago
      const evalResult = evaluateRateLimit(
        { lastMessageAt: recent, messageCountHour: 1, hourWindowStart: recent },
        now
      );
      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.reason, "cooldown");
    });

    test("allows message sent after cooldown period (>= 5s)", () => {
      const now = new Date();
      const older = new Date(now.getTime() - 6000); // 6s ago
      const evalResult = evaluateRateLimit(
        { lastMessageAt: older, messageCountHour: 2, hourWindowStart: older },
        now
      );
      assert.equal(evalResult.allowed, true);
      assert.equal(evalResult.messageCountHour, 3);
    });

    test("enforces hourly message cap", () => {
      const now = new Date();
      const older = new Date(now.getTime() - 10000); // 10s ago
      const windowStart = new Date(now.getTime() - 600000); // 10m ago

      const evalResult = evaluateRateLimit(
        {
          lastMessageAt: older,
          messageCountHour: DEFAULT_RATE_LIMIT_CONFIG.maxPerHour, // e.g. 20
          hourWindowStart: windowStart
        },
        now
      );
      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.reason, "hourly_cap");
    });

    test("resets hourly count after 1 hour has elapsed", () => {
      const now = new Date();
      const older = new Date(now.getTime() - 10000); // 10s ago
      const windowStart = new Date(now.getTime() - 3600000 - 1000); // 1h 1s ago

      const evalResult = evaluateRateLimit(
        {
          lastMessageAt: older,
          messageCountHour: DEFAULT_RATE_LIMIT_CONFIG.maxPerHour,
          hourWindowStart: windowStart
        },
        now
      );
      assert.equal(evalResult.allowed, true);
      assert.equal(evalResult.messageCountHour, 1);
    });

    test("handles Firestore Timestamp objects with toDate()", () => {
      const now = new Date();
      const mockTimestamp = {
        toDate: () => new Date(now.getTime() - 1000) // 1s ago
      };
      const evalResult = evaluateRateLimit({ lastMessageAt: mockTimestamp }, now);
      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.reason, "cooldown");
    });
  });

  describe("Worker Status Mapping", () => {
    test("maps queued states to 'queued'", () => {
      assert.equal(mapWorkerStatus("requested"), "queued");
      assert.equal(mapWorkerStatus("queued_for_openclaw"), "queued");
      assert.equal(mapWorkerStatus("queued"), "queued");
    });

    test("maps running states to 'running'", () => {
      assert.equal(mapWorkerStatus("running"), "running");
      assert.equal(mapWorkerStatus("processing_openclaw"), "running");
      assert.equal(mapWorkerStatus("processing_by_openclaw"), "running");
      assert.equal(mapWorkerStatus("processing_extraction"), "running");
      assert.equal(mapWorkerStatus("processing"), "running");
    });

    test("maps success states to 'success'", () => {
      assert.equal(mapWorkerStatus("proposal_ready"), "success");
      assert.equal(mapWorkerStatus("waiting_user_approval"), "success");
      assert.equal(mapWorkerStatus("completed"), "success");
      assert.equal(mapWorkerStatus("success"), "success");
    });

    test("maps failure states to 'error'", () => {
      assert.equal(mapWorkerStatus("failed"), "error");
      assert.equal(mapWorkerStatus("openclaw_failed"), "error");
      assert.equal(mapWorkerStatus("error"), "error");
    });

    test("maps unknown or null status safely to 'error'", () => {
      assert.equal(mapWorkerStatus("unexpected_state"), "error");
      assert.equal(mapWorkerStatus(null), "error");
      assert.equal(mapWorkerStatus(undefined), "error");
    });
  });

  describe("Response Sanitization and Metadata Protection", () => {
    test("extracts responseText from openclawResult", () => {
      const doc = {
        openclawResult: {
          responseText: "Olá! Como posso ajudar?",
          summary: "Internal OpenClaw summary",
          confidence: "high"
        }
      };
      const extracted = extractSanitizedResponseText(doc);
      assert.equal(extracted, "Olá! Como posso ajudar?");
    });

    test("extracts responseText from fallback result.responseText", () => {
      const doc = {
        result: {
          responseText: "Resposta via result."
        }
      };
      const extracted = extractSanitizedResponseText(doc);
      assert.equal(extracted, "Resposta via result.");
    });

    test("strips HTML and truncates responseText safely", () => {
      const doc = {
        openclawResult: {
          responseText: "Texto <b>seguro</b> com <script>alert(1)</script> tags."
        }
      };
      const extracted = extractSanitizedResponseText(doc, 20);
      assert.equal(extracted, "Texto seguro com ale");
    });

    test("returns undefined when no response text is present", () => {
      assert.equal(extractSanitizedResponseText({}), undefined);
      assert.equal(extractSanitizedResponseText(null), undefined);
      assert.equal(
        extractSanitizedResponseText({
          openclawResult: { confidence: "high" }
        }),
        undefined
      );
    });
  });
});
