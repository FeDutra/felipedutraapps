#!/usr/bin/env python3
"""Servidor STT local da Presença PULSO.

Mantém o faster-whisper carregado em memória e aceita WAV bruto somente no
loopback. A inteligência/orquestração continua no OpenClaw; este processo faz
apenas fala -> texto, sem credencial externa e sem cota de nuvem.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel


HOST = "127.0.0.1"
PORT = int(os.environ.get("PULSO_STT_PORT", "14323"))
MODEL_NAME = os.environ.get("PULSO_STT_MODEL", "base")
MODEL_CACHE = os.environ.get("PULSO_STT_MODEL_CACHE", os.path.expanduser("~/.cache/faster-whisper"))
MAX_AUDIO_BYTES = 12 * 1024 * 1024

MODEL = WhisperModel(
    MODEL_NAME,
    device="cpu",
    compute_type="int8",
    download_root=MODEL_CACHE,
)
MODEL_LOCK = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "PulsoPresenceSTT/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[presence-stt] {self.address_string()} {fmt % args}", flush=True)

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in {"tauri://localhost", "http://tauri.localhost", "https://tauri.localhost", "null"}:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._json(404, {"error": "not_found"})
            return
        self._json(200, {"ok": True, "engine": "faster-whisper-local", "model": MODEL_NAME})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/transcribe":
            self._json(404, {"error": "not_found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 44 or length > MAX_AUDIO_BYTES:
            self._json(400, {"error": "invalid_audio_size"})
            return

        audio = self.rfile.read(length)
        if not audio.startswith(b"RIFF") or b"WAVE" not in audio[:16]:
            self._json(415, {"error": "wav_required"})
            return

        started = time.perf_counter()
        path = ""
        try:
            with tempfile.NamedTemporaryFile(prefix="pulso-presence-", suffix=".wav", delete=False) as handle:
                handle.write(audio)
                path = handle.name

            with MODEL_LOCK:
                segments, _ = MODEL.transcribe(
                    path,
                    language="pt",
                    beam_size=1,
                    best_of=1,
                    vad_filter=True,
                    condition_on_previous_text=False,
                    temperature=0.0,
                )
                text = "".join(segment.text for segment in segments).strip()

            duration_ms = round((time.perf_counter() - started) * 1000)
            self._json(200, {
                "text": text,
                "engine": "faster-whisper-local",
                "durationMs": duration_ms,
            })
        except Exception as error:  # noqa: BLE001
            print(f"[presence-stt] transcription error: {error!r}", flush=True)
            self._json(500, {"error": "transcription_failed"})
        finally:
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass


if __name__ == "__main__":
    print(f"[presence-stt] ready on http://{HOST}:{PORT} model={MODEL_NAME}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
