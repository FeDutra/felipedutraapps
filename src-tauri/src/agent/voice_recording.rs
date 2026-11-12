use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const TRANSCRIPTION_ENDPOINT: &str =
    "https://us-central1-felipedutraapps.cloudfunctions.net/pulsoTranscribe";
const TRANSCRIPTION_SAMPLE_RATE: u32 = 16_000;
const TRANSCRIPTION_TIMEOUT_SECONDS: u64 = 280;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceRecordingArtifact {
    pub recording_id: String,
    pub wav_path: String,
    pub status: String,
    pub raw_available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceRecordingTranscription {
    pub text: String,
    pub source_bytes: u64,
    pub uploaded_bytes: u64,
    pub duration_ms: u64,
    pub source_sample_rate: u32,
    pub uploaded_sample_rate: u32,
}

#[derive(Debug, Deserialize)]
struct TranscriptionResponse {
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoiceRecordingManifest {
    recording_id: String,
    sample_rate: u32,
    status: String,
    started_at_ms: u128,
    updated_at_ms: u128,
    bytes_written: u64,
}

fn now_ms() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

fn validate_recording_id(recording_id: &str) -> Result<(), String> {
    if recording_id.len() < 8
        || recording_id.len() > 120
        || !recording_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("recordingId inválido".to_string());
    }
    Ok(())
}

fn recordings_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME indisponível".to_string())?;
    let directory = PathBuf::from(home)
        .join("Documents")
        .join("PULSO")
        .join("Áudios recuperáveis");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn pcm_path(directory: &Path, recording_id: &str) -> PathBuf {
    directory.join(format!("{}.pcm", recording_id))
}

fn wav_path(directory: &Path, recording_id: &str) -> PathBuf {
    directory.join(format!("{}.wav", recording_id))
}

fn manifest_path(directory: &Path, recording_id: &str) -> PathBuf {
    directory.join(format!("{}.json", recording_id))
}

fn read_manifest(path: &Path) -> Result<VoiceRecordingManifest, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    serde_json::from_slice(&bytes).map_err(|error| error.to_string())
}

fn write_manifest(path: &Path, manifest: &VoiceRecordingManifest) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

fn write_wav_from_pcm(pcm: &Path, wav: &Path, sample_rate: u32) -> Result<u64, String> {
    let mut input = File::open(pcm).map_err(|error| error.to_string())?;
    let data_size = input.metadata().map_err(|error| error.to_string())?.len();
    if data_size == 0 || data_size > u32::MAX as u64 {
        return Err("áudio bruto vazio ou grande demais".to_string());
    }

    let temporary = wav.with_extension("wav.tmp");
    let mut output = File::create(&temporary).map_err(|error| error.to_string())?;
    let riff_size = 36_u32.saturating_add(data_size as u32);
    let byte_rate = sample_rate.saturating_mul(2);

    output
        .write_all(b"RIFF")
        .map_err(|error| error.to_string())?;
    output
        .write_all(&riff_size.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(b"WAVEfmt ")
        .map_err(|error| error.to_string())?;
    output
        .write_all(&16_u32.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(&1_u16.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(&1_u16.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(&sample_rate.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(&byte_rate.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(&2_u16.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(&16_u16.to_le_bytes())
        .map_err(|error| error.to_string())?;
    output
        .write_all(b"data")
        .map_err(|error| error.to_string())?;
    output
        .write_all(&(data_size as u32).to_le_bytes())
        .map_err(|error| error.to_string())?;
    std::io::copy(&mut input, &mut output).map_err(|error| error.to_string())?;
    output.sync_all().map_err(|error| error.to_string())?;
    fs::rename(&temporary, wav).map_err(|error| error.to_string())?;
    Ok(data_size)
}

fn encode_pcm_wav(pcm: &[u8], sample_rate: u32) -> Result<Vec<u8>, String> {
    if pcm.is_empty() || pcm.len() % 2 != 0 || pcm.len() > u32::MAX as usize {
        return Err("áudio PCM inválido".to_string());
    }
    let data_size = pcm.len() as u32;
    let mut wav = Vec::with_capacity(pcm.len() + 44);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&36_u32.saturating_add(data_size).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&sample_rate.saturating_mul(2).to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    wav.extend_from_slice(pcm);
    Ok(wav)
}

fn resample_pcm16_mono(pcm: &[u8], source_rate: u32, target_rate: u32) -> Result<Vec<u8>, String> {
    if pcm.is_empty() || pcm.len() % 2 != 0 || source_rate == 0 || target_rate == 0 {
        return Err("áudio PCM inválido".to_string());
    }
    if source_rate == target_rate {
        return Ok(pcm.to_vec());
    }

    let source_samples = pcm
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    let target_samples = ((source_samples.len() as u64)
        .saturating_mul(target_rate as u64)
        .saturating_add(source_rate as u64 - 1)
        / source_rate as u64) as usize;
    let mut output = Vec::with_capacity(target_samples.saturating_mul(2));

    for target_index in 0..target_samples {
        let source_position = target_index as f64 * source_rate as f64 / target_rate as f64;
        let left_index = source_position.floor() as usize;
        let right_index = (left_index + 1).min(source_samples.len() - 1);
        let fraction = source_position - left_index as f64;
        let sample = source_samples[left_index] as f64 * (1.0 - fraction)
            + source_samples[right_index] as f64 * fraction;
        output.extend_from_slice(&(sample.round() as i16).to_le_bytes());
    }
    Ok(output)
}

fn transcription_wav(
    pcm: &[u8],
    source_rate: u32,
) -> Result<(Vec<u8>, u32), String> {
    let upload_rate = source_rate.min(TRANSCRIPTION_SAMPLE_RATE);
    let upload_pcm = resample_pcm16_mono(pcm, source_rate, upload_rate)?;
    Ok((encode_pcm_wav(&upload_pcm, upload_rate)?, upload_rate))
}

fn validate_durable_recording(
    directory: &Path,
    manifest: &VoiceRecordingManifest,
) -> Result<Vec<u8>, String> {
    if manifest.status == "recording" {
        return Err("gravação ainda não foi finalizada".to_string());
    }
    let pcm = fs::read(pcm_path(directory, &manifest.recording_id))
        .map_err(|error| error.to_string())?;
    if pcm.len() as u64 != manifest.bytes_written || pcm.is_empty() || pcm.len() % 2 != 0 {
        return Err("PCM durável diverge do manifesto".to_string());
    }

    let wav = wav_path(directory, &manifest.recording_id);
    let wav_size = fs::metadata(&wav).map_err(|error| error.to_string())?.len();
    if wav_size != manifest.bytes_written.saturating_add(44) {
        return Err("WAV durável diverge do manifesto".to_string());
    }
    let mut header = [0_u8; 44];
    File::open(&wav)
        .map_err(|error| error.to_string())?
        .read_exact(&mut header)
        .map_err(|error| error.to_string())?;
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" || &header[36..40] != b"data" {
        return Err("WAV durável inválido".to_string());
    }
    Ok(pcm)
}

#[tauri::command]
pub fn voice_recording_begin(
    recording_id: String,
    sample_rate: u32,
) -> Result<VoiceRecordingArtifact, String> {
    validate_recording_id(&recording_id)?;
    if !(8_000..=192_000).contains(&sample_rate) {
        return Err("sampleRate inválido".to_string());
    }
    let directory = recordings_dir()?;
    let pcm = pcm_path(&directory, &recording_id);
    let wav = wav_path(&directory, &recording_id);
    if pcm.exists() || wav.exists() {
        return Err("recordingId já existe".to_string());
    }
    File::create(&pcm)
        .map_err(|error| error.to_string())?
        .sync_all()
        .map_err(|error| error.to_string())?;
    let now = now_ms()?;
    let manifest = VoiceRecordingManifest {
        recording_id: recording_id.clone(),
        sample_rate,
        status: "recording".to_string(),
        started_at_ms: now,
        updated_at_ms: now,
        bytes_written: 0,
    };
    write_manifest(&manifest_path(&directory, &recording_id), &manifest)?;
    Ok(VoiceRecordingArtifact {
        recording_id,
        wav_path: wav.to_string_lossy().to_string(),
        status: "recording".to_string(),
        raw_available: true,
    })
}

#[tauri::command]
pub fn voice_recording_append(recording_id: String, pcm_bytes: Vec<u8>) -> Result<u64, String> {
    validate_recording_id(&recording_id)?;
    if pcm_bytes.is_empty() || pcm_bytes.len() % 2 != 0 {
        return Err("chunk PCM inválido".to_string());
    }
    let directory = recordings_dir()?;
    let manifest_file = manifest_path(&directory, &recording_id);
    let mut manifest = read_manifest(&manifest_file)?;
    if manifest.status != "recording" {
        return Err("gravação não aceita novos chunks".to_string());
    }
    let mut output = OpenOptions::new()
        .append(true)
        .open(pcm_path(&directory, &recording_id))
        .map_err(|error| error.to_string())?;
    output
        .write_all(&pcm_bytes)
        .map_err(|error| error.to_string())?;
    output.sync_data().map_err(|error| error.to_string())?;
    manifest.bytes_written = manifest
        .bytes_written
        .saturating_add(pcm_bytes.len() as u64);
    manifest.updated_at_ms = now_ms()?;
    write_manifest(&manifest_file, &manifest)?;
    Ok(manifest.bytes_written)
}

#[tauri::command]
pub fn voice_recording_finalize(recording_id: String) -> Result<VoiceRecordingArtifact, String> {
    validate_recording_id(&recording_id)?;
    let directory = recordings_dir()?;
    let manifest_file = manifest_path(&directory, &recording_id);
    let mut manifest = read_manifest(&manifest_file)?;
    let pcm = pcm_path(&directory, &recording_id);
    let wav = wav_path(&directory, &recording_id);
    write_wav_from_pcm(&pcm, &wav, manifest.sample_rate)?;
    manifest.status = "captured".to_string();
    manifest.updated_at_ms = now_ms()?;
    write_manifest(&manifest_file, &manifest)?;
    Ok(VoiceRecordingArtifact {
        recording_id,
        wav_path: wav.to_string_lossy().to_string(),
        status: manifest.status,
        raw_available: true,
    })
}

#[tauri::command]
pub async fn voice_recording_transcribe(
    recording_id: String,
) -> Result<VoiceRecordingTranscription, String> {
    validate_recording_id(&recording_id)?;
    let directory = recordings_dir()?;
    let manifest = read_manifest(&manifest_path(&directory, &recording_id))?;
    let pcm = validate_durable_recording(&directory, &manifest)?;
    let source_bytes = pcm.len() as u64;
    let duration_ms = source_bytes
        .saturating_mul(1_000)
        / (manifest.sample_rate as u64).saturating_mul(2);
    let (upload_wav, uploaded_sample_rate) = transcription_wav(&pcm, manifest.sample_rate)?;
    let uploaded_bytes = upload_wav.len() as u64;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TRANSCRIPTION_TIMEOUT_SECONDS))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(TRANSCRIPTION_ENDPOINT)
        .header("Content-Type", "audio/wav")
        .header("X-Pulso-Audio-Source", "tauri-durable-wav")
        .header("X-Pulso-Recording-Id", &recording_id)
        .header("X-Pulso-Audio-Bytes", uploaded_bytes.to_string())
        .header("X-Pulso-Audio-Duration-Ms", duration_ms.to_string())
        .body(upload_wav)
        .send()
        .await
        .map_err(|error| format!("falha ao alcançar o transcritor: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("transcritor recusou o WAV durável ({status})"));
    }
    let payload = response
        .json::<TranscriptionResponse>()
        .await
        .map_err(|error| format!("resposta inválida do transcritor: {error}"))?;

    Ok(VoiceRecordingTranscription {
        text: payload.text,
        source_bytes,
        uploaded_bytes,
        duration_ms,
        source_sample_rate: manifest.sample_rate,
        uploaded_sample_rate,
    })
}

#[tauri::command]
pub fn voice_recording_mark(recording_id: String, status: String) -> Result<(), String> {
    validate_recording_id(&recording_id)?;
    const ALLOWED: [&str; 6] = [
        "captured",
        "transcribing",
        "transcribed",
        "message_queued",
        "committed",
        "failed",
    ];
    if !ALLOWED.contains(&status.as_str()) {
        return Err("status inválido".to_string());
    }
    let directory = recordings_dir()?;
    let manifest_file = manifest_path(&directory, &recording_id);
    let mut manifest = read_manifest(&manifest_file)?;
    manifest.status = status;
    manifest.updated_at_ms = now_ms()?;
    write_manifest(&manifest_file, &manifest)
}

#[tauri::command]
pub fn voice_recording_recover_incomplete() -> Result<Vec<VoiceRecordingArtifact>, String> {
    let directory = recordings_dir()?;
    let mut recovered = Vec::new();
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let mut manifest = match read_manifest(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let pcm = pcm_path(&directory, &manifest.recording_id);
        let wav = wav_path(&directory, &manifest.recording_id);
        if !wav.exists() && pcm.exists() && pcm.metadata().map(|meta| meta.len()).unwrap_or(0) > 0 {
            if write_wav_from_pcm(&pcm, &wav, manifest.sample_rate).is_ok() {
                manifest.status = "failed".to_string();
                manifest.updated_at_ms = now_ms()?;
                write_manifest(&path, &manifest)?;
            }
        }
        if wav.exists() && manifest.status != "committed" {
            recovered.push(VoiceRecordingArtifact {
                recording_id: manifest.recording_id,
                wav_path: wav.to_string_lossy().to_string(),
                status: manifest.status,
                raw_available: true,
            });
        }
    }
    Ok(recovered)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_recording_ids() {
        assert!(validate_recording_id("../../segredo").is_err());
        assert!(validate_recording_id("audio_12345678_ok").is_ok());
    }

    #[test]
    fn creates_a_playable_pcm_wav_container() {
        let unique = format!("pulso-wav-test-{}", now_ms().unwrap());
        let directory = std::env::temp_dir().join(unique);
        fs::create_dir_all(&directory).unwrap();
        let pcm = directory.join("input.pcm");
        let wav = directory.join("output.wav");
        fs::write(&pcm, [0_u8, 0, 255, 127, 0, 128]).unwrap();

        let written = write_wav_from_pcm(&pcm, &wav, 16_000).unwrap();
        let bytes = fs::read(&wav).unwrap();
        assert_eq!(written, 6);
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
        assert_eq!(&bytes[36..40], b"data");
        assert_eq!(u32::from_le_bytes(bytes[40..44].try_into().unwrap()), 6);
        assert_eq!(&bytes[44..], &[0_u8, 0, 255, 127, 0, 128]);

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn derives_a_compact_16khz_wav_without_changing_duration() {
        let source_rate = 48_000_u32;
        let source_pcm = vec![0_u8; source_rate as usize * 2];
        let (wav, upload_rate) = transcription_wav(&source_pcm, source_rate).unwrap();

        assert_eq!(upload_rate, 16_000);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(u32::from_le_bytes(wav[24..28].try_into().unwrap()), 16_000);
        assert_eq!(u32::from_le_bytes(wav[40..44].try_into().unwrap()), 32_000);
        assert_eq!(wav.len(), 32_044);
    }
}
