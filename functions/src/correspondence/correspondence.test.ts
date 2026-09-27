import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  validateEmail,
  hashEmail,
  generateSecureToken,
  hashToken,
  isTokenExpired,
  sanitizeName,
  sanitizeSource,
  isCooldownActive,
  isAllowedOrigin,
  getCorrespondenceBaseUrl,
  DEFAULT_CORRESPONDENCE_BASE_URL
} from "./core.ts";
import {
  buildConfirmationEmail,
  buildWelcomeEmail,
  escapeHtml
} from "./templates.ts";

describe("Correspondence Core Pure Functions", () => {
  describe("normalizeEmail", () => {
    test("trims and lowercases standard emails", () => {
      assert.equal(normalizeEmail("  Felipe.Dutra@Example.COM  "), "felipe.dutra@example.com");
    });

    test("removes zero-width characters", () => {
      const emailWithZeroWidth = "felipe\u200B@felipedutra.com";
      assert.equal(normalizeEmail(emailWithZeroWidth), "felipe@felipedutra.com");
    });

    test("handles empty or non-string inputs safely", () => {
      assert.equal(normalizeEmail(""), "");
      assert.equal(normalizeEmail(null as any), "");
      assert.equal(normalizeEmail(undefined as any), "");
    });
  });

  describe("validateEmail", () => {
    test("accepts valid email addresses", () => {
      assert.equal(validateEmail("contato@felipedutra.com"), true);
      assert.equal(validateEmail("user.name+tag@sub.domain.co"), true);
      assert.equal(validateEmail("a@b.com"), true);
    });

    test("rejects invalid email formats", () => {
      assert.equal(validateEmail("invalid-email"), false);
      assert.equal(validateEmail("user@"), false);
      assert.equal(validateEmail("@domain.com"), false);
      assert.equal(validateEmail("user@domain"), false);
      assert.equal(validateEmail("user @domain.com"), false);
      assert.equal(validateEmail(""), false);
      assert.equal(validateEmail("a".repeat(250) + "@domain.com"), false); // exceeds 254 chars
    });
  });

  describe("hashEmail", () => {
    test("produces a 64-character SHA-256 hex string", () => {
      const hash = hashEmail("contato@felipedutra.com");
      assert.equal(typeof hash, "string");
      assert.equal(hash.length, 64);
      assert.match(hash, /^[a-f0-9]{64}$/);
    });

    test("is deterministic and matches for normalized equivalents", () => {
      const email1 = normalizeEmail("Contato@FelipeDutra.com ");
      const email2 = normalizeEmail(" contato@felipedutra.com");
      assert.equal(hashEmail(email1), hashEmail(email2));
    });
  });

  describe("generateSecureToken & hashToken", () => {
    test("generates 64-character random hex token", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      assert.equal(token1.length, 64);
      assert.equal(token2.length, 64);
      assert.notEqual(token1, token2);
    });

    test("hashToken generates SHA-256 and never matches raw token", () => {
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      assert.equal(tokenHash.length, 64);
      assert.notEqual(rawToken, tokenHash);
      assert.equal(hashToken(rawToken), tokenHash); // deterministic
    });
  });

  describe("isTokenExpired", () => {
    test("returns false for future dates", () => {
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
      assert.equal(isTokenExpired(future), false);
    });

    test("returns true for past dates", () => {
      const past = new Date(Date.now() - 1000);
      assert.equal(isTokenExpired(past), true);
    });

    test("handles Firestore Timestamp-like objects with toDate()", () => {
      const mockTimestampFuture = {
        toDate: () => new Date(Date.now() + 3600 * 1000)
      };
      assert.equal(isTokenExpired(mockTimestampFuture), false);

      const mockTimestampPast = {
        toDate: () => new Date(Date.now() - 3600 * 1000)
      };
      assert.equal(isTokenExpired(mockTimestampPast), true);
    });

    test("returns true for null or undefined", () => {
      assert.equal(isTokenExpired(null), true);
      assert.equal(isTokenExpired(undefined), true);
    });
  });

  describe("sanitizeName & sanitizeSource", () => {
    test("strips HTML tags and collapses spaces", () => {
      const malicious = "<script>alert('xss')</script> Felipe   Dutra ";
      assert.equal(sanitizeName(malicious), "alert('xss') Felipe Dutra");
    });

    test("truncates names longer than 100 characters", () => {
      const longName = "A".repeat(150);
      const sanitized = sanitizeName(longName);
      assert.equal(sanitized?.length, 100);
    });

    test("sanitizeSource allows alphanumeric and dashes, defaults to web", () => {
      assert.equal(sanitizeSource("landing_page-v1"), "landing_page-v1");
      assert.equal(sanitizeSource("landing <script>"), "landing");
      assert.equal(sanitizeSource(""), "web");
      assert.equal(sanitizeSource(null), "web");
    });
  });

  describe("isCooldownActive", () => {
    test("returns true if action was within cooldown period", () => {
      const recent = new Date(Date.now() - 30_000); // 30s ago
      assert.equal(isCooldownActive(recent, 120_000), true);
    });

    test("returns false if action was beyond cooldown period", () => {
      const older = new Date(Date.now() - 130_000); // 130s ago
      assert.equal(isCooldownActive(older, 120_000), false);
    });

    test("handles mock Firestore Timestamp with toDate()", () => {
      const mockTimestamp = {
        toDate: () => new Date(Date.now() - 5_000)
      };
      assert.equal(isCooldownActive(mockTimestamp, 60_000), true);
    });

    test("returns false when lastActionAt is null", () => {
      assert.equal(isCooldownActive(null), false);
    });
  });

  describe("isAllowedOrigin", () => {
    test("allows official domains", () => {
      assert.equal(isAllowedOrigin("https://felipedutra.com"), true);
      assert.equal(isAllowedOrigin("https://www.felipedutra.com"), true);
    });

    test("allows dev localhost origins", () => {
      assert.equal(isAllowedOrigin("http://localhost:3000"), true);
      assert.equal(isAllowedOrigin("http://localhost:5173"), true);
      assert.equal(isAllowedOrigin("http://localhost"), true);
      assert.equal(isAllowedOrigin("http://127.0.0.1:3000"), true);
      assert.equal(isAllowedOrigin("http://127.0.0.1"), true);
    });

    test("rejects unauthorized domains", () => {
      assert.equal(isAllowedOrigin("https://evil.com"), false);
      assert.equal(isAllowedOrigin("http://felipedutra.com"), false); // HTTP not HTTPS
      assert.equal(isAllowedOrigin("https://sub.felipedutra.com"), false);
      assert.equal(isAllowedOrigin(null), false);
      assert.equal(isAllowedOrigin(""), false);
    });
  });

  describe("getCorrespondenceBaseUrl", () => {
    test("defaults to direct Cloud Function url without proxy", () => {
      const originalEnv = process.env.CORRESPONDENCE_BASE_URL;
      delete process.env.CORRESPONDENCE_BASE_URL;
      try {
        assert.equal(
          getCorrespondenceBaseUrl(),
          "https://us-central1-felipedutraapps.cloudfunctions.net/correspondenceApi"
        );
      } finally {
        if (originalEnv) process.env.CORRESPONDENCE_BASE_URL = originalEnv;
      }
    });

    test("respects environment variable override when set", () => {
      const originalEnv = process.env.CORRESPONDENCE_BASE_URL;
      process.env.CORRESPONDENCE_BASE_URL = "https://custom.example.com/api";
      try {
        assert.equal(getCorrespondenceBaseUrl(), "https://custom.example.com/api");
      } finally {
        if (originalEnv) {
          process.env.CORRESPONDENCE_BASE_URL = originalEnv;
        } else {
          delete process.env.CORRESPONDENCE_BASE_URL;
        }
      }
    });
  });
});

describe("Email Templates & HTML Generation", () => {
  test("escapeHtml prevents injection", () => {
    assert.equal(escapeHtml('<script>"test" & \'more\'</script>'), "&lt;script&gt;&quot;test&quot; &amp; &#039;more&#039;&lt;/script&gt;");
  });

  test("buildConfirmationEmail contains required minimal text without invented biography", () => {
    const confirmUrl = "https://us-central1-felipedutraapps.cloudfunctions.net/correspondenceApi?mode=confirm&token=abc123token";
    const mail = buildConfirmationEmail({
      name: "Felipe",
      confirmUrl
    });

    assert.equal(mail.subject, "confirme sua inscrição · correspondência");
    assert.ok(mail.html.includes(escapeHtml(confirmUrl)));
    assert.ok(mail.html.includes("Olá, Felipe."));
    assert.ok(mail.html.includes("Você pediu para receber a correspondência de fe."));
    assert.ok(mail.text.includes("Você pediu para receber a correspondência de fe."));
    assert.ok(mail.text.includes(confirmUrl));
    assert.ok(mail.text.includes("fe · felipedutra.com"));

    // Verify absence of forbidden strings
    assert.equal(mail.html.includes("Fê Dutra"), false);
    assert.equal(mail.text.includes("Fê Dutra"), false);
    assert.equal(mail.html.includes("eu leio"), false);
    assert.equal(mail.text.includes("eu leio"), false);
  });

  test("buildWelcomeEmail contains required minimal welcome text without invented biography", () => {
    const unsubscribeUrl = "https://us-central1-felipedutraapps.cloudfunctions.net/correspondenceApi?mode=unsubscribe&token=unsub789";
    const mail = buildWelcomeEmail({
      name: "Leitor",
      unsubscribeUrl
    });

    assert.equal(mail.subject, "inscrição confirmada · correspondência");
    assert.ok(mail.html.includes(escapeHtml(unsubscribeUrl)));
    assert.ok(mail.html.includes("Sua inscrição está confirmada. Quando algo merecer circular, chega por aqui."));
    assert.ok(mail.text.includes("Sua inscrição está confirmada. Quando algo merecer circular, chega por aqui."));
    assert.ok(mail.html.includes("Cancelar recebimento"));
    assert.ok(mail.text.includes(unsubscribeUrl));
    assert.ok(mail.text.includes("fe · felipedutra.com"));

    // Verify absence of forbidden strings
    assert.equal(mail.html.includes("Fê Dutra"), false);
    assert.equal(mail.text.includes("Fê Dutra"), false);
    assert.equal(mail.html.includes("eu leio"), false);
    assert.equal(mail.text.includes("eu leio"), false);
  });
});
