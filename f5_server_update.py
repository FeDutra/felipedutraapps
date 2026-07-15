import io
import traceback
import torch
import torchaudio
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from huggingface_hub import hf_hub_download
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    input: str
    voice: str = "samantha"
    speed: float = 1.0

device = "cuda" if torch.cuda.is_available() else "cpu"
repo_id = "firstpixel/F5-TTS-pt-br"
file_name = "pt-br/model_last.pt"
print(f"Downloading/Locating model {repo_id}/{file_name}...")
local_ckpt_path = hf_hub_download(repo_id=repo_id, filename=file_name)
print(f"Loading model from {local_ckpt_path} on {device}...")

vocoder = load_vocoder()
model = load_model(
    model_cls=DiT, 
    model_cfg=dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4),
    ckpt_path=local_ckpt_path,
    mel_spec_type="vocos",
    vocab_file="",
    ode_method="euler",
    use_ema=True,
    device=device
)

ref_audio = "/root/samantha_ref.wav"
ref_text = "Ou em quem? A Shield tomou conhecimento de mim de um jeito ruim. O agente Barton foi enviado para me matar. Não é seguro. Nunca pense assim, John! Nunca pense assim! Olha pra mim!"

@app.post("/v1/audio/speech")
async def generate_speech(req: TTSRequest):
    try:
        audio, sample_rate, _ = infer_process(
            ref_audio, 
            ref_text,
            req.input,
            model,
            vocoder,
            mel_spec_type="vocos",
            speed=req.speed
        )
        
        buffer = io.BytesIO()
        torchaudio.save(buffer, torch.tensor(audio).unsqueeze(0), sample_rate, format="mp3")
        return Response(content=buffer.getvalue(), media_type="audio/mpeg")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8881)
