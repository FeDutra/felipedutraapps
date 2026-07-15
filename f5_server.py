import io
import torch
import torchaudio
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process

app = FastAPI()

class TTSRequest(BaseModel):
    input: str
    voice: str = "samantha"
    speed: float = 1.0

device = "cuda" if torch.cuda.is_available() else "cpu"
model_name = "firstpixel/F5-TTS-pt-br"
print(f"Loading model {model_name} on {device}...")

vocoder = load_vocoder()
model = load_model(
    model_cls=DiT, 
    model_cfg=dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4),
    ckpt_path=model_name,
    mel_spec_type="vocos",
    vocab_file="",
    ode_method="euler",
    use_ema=True,
    device=device
)

ref_audio = "/root/samantha_ref.wav"
ref_text = "Eu sou a Lótus, sua assistente virtual, e estou aqui para ajudar."

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
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8881)
