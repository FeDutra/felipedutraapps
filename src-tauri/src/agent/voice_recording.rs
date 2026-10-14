use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceRecordingArtifact {
    pub recording_id: String,
    pub wav_path: String,
    pub status: String,
    pub raw_available: bool,
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
}
