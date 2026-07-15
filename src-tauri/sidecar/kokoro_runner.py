import sys
import json
import io
import traceback
import soundfile as sf
import numpy as np
# Patch numpy.load to always allow pickle (required for Kokoro with Numpy 2)
_original_load = np.load
def patched_load(*args, **kwargs):
    kwargs['allow_pickle'] = True
    return _original_load(*args, **kwargs)
np.load = patched_load

from kokoro_onnx import Kokoro
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.parse

# Global model instance
kokoro_model = None

class TTSHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            req = json.loads(post_data.decode('utf-8'))
            text = req.get("text", "")
            voice = req.get("voice", "pf_dora")
            speed = float(req.get("speed", 1.0))
            lang = req.get("lang", "pt-br")

            if not text:
                self._send_error("No text provided")
                return

            samples, sample_rate = kokoro_model.create(text, voice=voice, speed=speed, lang=lang)
            
            wav_io = io.BytesIO()
            sf.write(wav_io, samples, sample_rate, format='WAV', subtype='PCM_16')
            wav_bytes = wav_io.getvalue()
            b64_audio = base64.b64encode(wav_bytes).decode('utf-8')

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": None, "audio": b64_audio}).encode('utf-8'))

        except Exception as e:
            err_msg = traceback.format_exc()
            self._send_error(str(e), traceback=err_msg)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _send_error(self, message, traceback=None):
        self.send_response(400)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message, "traceback": traceback, "audio": None}).encode('utf-8'))

def main():
    global kokoro_model
    if len(sys.argv) < 3:
        print("Usage: kokoro_runner <model_path> <voices_path>")
        sys.exit(1)

    model_path = sys.argv[1]
    voices_path = sys.argv[2]
    
    print(f"Loading model from {model_path}...")
    kokoro_model = Kokoro(model_path, voices_path)
    print("Model loaded successfully.")

    server_address = ('127.0.0.1', 14321)
    httpd = ThreadingHTTPServer(server_address, TTSHandler)
    print(f"Kokoro sidecar HTTP server running on http://127.0.0.1:14321")
    httpd.serve_forever()

if __name__ == "__main__":
    main()

