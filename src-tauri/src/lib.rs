#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use std::io::{BufRead, BufReader};
#[cfg(desktop)]
use std::process::Stdio;
#[cfg(desktop)]
use std::fs;
#[cfg(desktop)]
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(desktop)]
use base64::Engine;
#[cfg(desktop)]
use ed25519_dalek::{pkcs8::DecodePrivateKey, Signer, SigningKey};
#[cfg(desktop)]
use serde::{Deserialize, Serialize};
#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_shell::ShellExt;

#[cfg(desktop)]
mod agent;
#[cfg(desktop)]
use agent::local_machine::{local_open_url, execute_applescript};
#[cfg(desktop)]
use agent::presence_broker::local_presence_read;
#[cfg(desktop)]
use agent::voice_recording::{
  voice_recording_append,
  voice_recording_begin,
  voice_recording_finalize,
  voice_recording_mark,
  voice_recording_recover_incomplete,
};

#[cfg(desktop)]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceOriginConfig {
  version: u8,
  installation_id: String,
  device_key: String,
  private_key_pkcs8_base64: String,
}

#[cfg(desktop)]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceOriginStatus {
  configured: bool,
  installation_id: Option<String>,
  device_key: Option<String>,
}

#[cfg(desktop)]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceOriginAssertion {
  version: u8,
  installation_id: String,
  issued_at_ms: u64,
  signature: String,
}

#[cfg(desktop)]
fn read_device_origin_config(app: &tauri::AppHandle) -> Result<DeviceOriginConfig, String> {
  let path = app.path().app_data_dir()
    .map_err(|error| format!("device origin directory unavailable: {error}"))?
    .join("device-origin.json");
  let content = fs::read_to_string(&path)
    .map_err(|_| "device origin is not provisioned on this installation".to_string())?;
  let config: DeviceOriginConfig = serde_json::from_str(&content)
    .map_err(|_| "device origin configuration is invalid".to_string())?;
  if config.version != 1
    || config.installation_id.len() < 16
    || !matches!(config.device_key.as_str(), "imac" | "macbook")
    || config.private_key_pkcs8_base64.len() < 48
  {
    return Err("device origin configuration is invalid".to_string());
  }
  Ok(config)
}

#[cfg(desktop)]
#[tauri::command]
fn local_device_origin_status(app: tauri::AppHandle) -> DeviceOriginStatus {
  match read_device_origin_config(&app) {
    Ok(config) => DeviceOriginStatus {
      configured: true,
      installation_id: Some(config.installation_id),
      device_key: Some(config.device_key),
    },
    Err(_) => DeviceOriginStatus {
      configured: false,
      installation_id: None,
      device_key: None,
    },
  }
}

#[cfg(desktop)]
#[tauri::command]
fn local_device_origin_assert(app: tauri::AppHandle, request_id: &str) -> Result<DeviceOriginAssertion, String> {
  if request_id.len() < 8 || request_id.len() > 160 {
    return Err("request id is invalid".to_string());
  }
  let config = read_device_origin_config(&app)?;
  let private_key_der = base64::engine::general_purpose::STANDARD
    .decode(config.private_key_pkcs8_base64.as_bytes())
    .map_err(|_| "device origin private key is invalid".to_string())?;
  let signing_key = SigningKey::from_pkcs8_der(&private_key_der)
    .map_err(|_| "device origin private key is invalid".to_string())?;
  let issued_at_ms = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|_| "system clock is invalid".to_string())?
    .as_millis() as u64;
  let message = format!("v1\n{}\n{}\n{}", config.installation_id, request_id, issued_at_ms);
  let signature = signing_key.sign(message.as_bytes()).to_bytes()
    .iter()
    .map(|byte| format!("{byte:02x}"))
    .collect::<String>();
  Ok(DeviceOriginAssertion {
    version: 1,
    installation_id: config.installation_id,
    issued_at_ms,
    signature,
  })
}

#[cfg(mobile)]
#[tauri::command]
fn local_open_url(_url: &str) -> Result<String, String> {
    Err("Abertura local não está disponível no iPhone.".into())
}

#[cfg(mobile)]
#[tauri::command]
fn execute_applescript(_script: &str) -> Result<String, String> {
    Err("Automação do macOS não está disponível no iPhone.".into())
}

#[cfg(desktop)]
#[tauri::command]
fn execute_shell_command(command: &str) -> Result<String, String> {
    println!("Executing shell command: {}", command);
    match std::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Error: {}\nOutput: {}", stderr, stdout))
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(mobile)]
#[tauri::command]
fn execute_shell_command(_command: &str) -> Result<String, String> {
    Err("Execução local não está disponível no iPhone.".into())
}

#[cfg(desktop)]
#[tauri::command]
fn execute_long_command_stream(app: tauri::AppHandle, command: &str) -> Result<(), String> {
    println!("Executing streaming shell command: {}", command);
    let mut child = std::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("cmd_output", line);
            }
        }
    });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("cmd_output", line);
            }
        }
    });

    std::thread::spawn(move || {
        let _ = child.wait();
        let _ = app.emit("cmd_output_done", ());
    });

    Ok(())
}

#[cfg(mobile)]
#[tauri::command]
fn execute_long_command_stream(_app: tauri::AppHandle, _command: &str) -> Result<(), String> {
    Err("Execução local não está disponível no iPhone.".into())
}

#[cfg(desktop)]
fn start_desktop_voice(app: &tauri::AppHandle) {
    let resource_dir = app
        .path()
        .resource_dir()
        .expect("Failed to get resource dir");
    let model_path = resource_dir.join("resources").join("kokoro-v0_19.onnx");
    let voices_path = resource_dir.join("resources").join("voices.bin");

    println!("Starting Kokoro sidecar with model: {:?}", model_path);

    if !model_path.exists() || !voices_path.exists() {
        eprintln!(
            "Kokoro sidecar resources missing: model_exists={}, voices_exists={}",
            model_path.exists(),
            voices_path.exists()
        );
    } else {
        match app.shell().sidecar("kokoro_runner") {
            Ok(sidecar_command) => {
                let command = sidecar_command
                    .args([model_path.to_str().unwrap(), voices_path.to_str().unwrap()]);
                match command.spawn() {
                    Ok((_rx, _child)) => println!("Kokoro sidecar started successfully."),
                    Err(e) => eprintln!("Failed to spawn Kokoro sidecar: {}", e),
                }
            }
            Err(e) => eprintln!("Failed to create kokoro sidecar command: {}", e),
        }
    }
}

#[cfg(desktop)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      local_open_url,
      execute_applescript,
      execute_shell_command,
      execute_long_command_stream,
      local_presence_read,
      local_device_origin_status,
      local_device_origin_assert,
      voice_recording_begin,
      voice_recording_append,
      voice_recording_finalize,
      voice_recording_mark,
      voice_recording_recover_incomplete
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      start_desktop_voice(app.handle());

            // O microsserviço Node.js do WhatsApp agora roda externamente (via PM2)
            // para garantir persistência independentemente do ciclo de vida da interface.

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      local_open_url,
      execute_applescript,
      execute_shell_command,
      execute_long_command_stream
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
