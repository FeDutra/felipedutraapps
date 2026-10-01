import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  hashDownloadEmail,
  isDownloadCooldownActive,
  isMusicOcreOriginAllowed,
  normalizeDownloadEmail,
  sanitizeDownloadName,
  sanitizeDownloadSource,
  validateDownloadEmail
} from "./core.ts";

describe("music ocre download helpers", () => {
  test("normalizes and validates e-mail", () => {
    assert.equal(normalizeDownloadEmail(" Fe\u200B@Example.COM "), "fe@example.com");
    assert.equal(validateDownloadEmail("fe@example.com"), true);
    assert.equal(validateDownloadEmail("fe@invalid"), false);
  });

  test("sanitizes name and source", () => {
    assert.equal(sanitizeDownloadName(" <b>Fe</b>   Dutra "), "Fe Dutra");
    assert.equal(sanitizeDownloadSource("Música Ocre / Site"), "msicaocresite");
  });

  test("creates deterministic private document id", () => {
    assert.equal(hashDownloadEmail("fe@example.com"), hashDownloadEmail("fe@example.com"));
    assert.equal(hashDownloadEmail("fe@example.com").length, 64);
  });

  test("allows only the official site and local development", () => {
    assert.equal(isMusicOcreOriginAllowed("https://musicaocre.com.br"), true);
    assert.equal(isMusicOcreOriginAllowed("https://www.musicaocre.com.br"), true);
    assert.equal(isMusicOcreOriginAllowed("http://localhost:8080"), true);
    assert.equal(isMusicOcreOriginAllowed("https://example.com"), false);
  });

  test("applies a one-minute dedupe window", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    assert.equal(isDownloadCooldownActive(new Date("2026-10-01T11:59:30Z"), now), true);
    assert.equal(isDownloadCooldownActive(new Date("2026-10-01T11:58:00Z"), now), false);
  });
});
