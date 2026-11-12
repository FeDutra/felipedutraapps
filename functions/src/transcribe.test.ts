import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inspectPcmWav } from "./transcribe.ts";

function pcmWav(sampleRate: number, durationMs: number): Buffer {
  const dataBytes = Math.round((sampleRate * durationMs / 1_000)) * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataBytes, 40);
  return wav;
}

describe("PULSO durable WAV validation", () => {
  test("accepts a complete mono PCM WAV and reports its duration", () => {
    const inspection = inspectPcmWav(pcmWav(16_000, 88_000));
    assert.deepEqual(inspection, {
      sampleRate: 16_000,
      channels: 1,
      bitsPerSample: 16,
      dataBytes: 2_816_000,
      durationMs: 88_000,
    });
  });

  test("rejects the truncated body that previously reached Gemini", () => {
    const complete = pcmWav(16_000, 88_000);
    assert.equal(inspectPcmWav(complete.subarray(0, 53_104)), null);
  });

  test("rejects a MediaRecorder fragment disguised as WAV", () => {
    const fragment = Buffer.alloc(53_104);
    fragment.write("ftyp", 4, "ascii");
    assert.equal(inspectPcmWav(fragment), null);
  });
});
