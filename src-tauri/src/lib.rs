use tauri::{Manager, Emitter, RunEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use base64::Engine;
use ed25519_dalek::{pkcs8::DecodePrivateKey, Signer, SigningKey};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

mod agent;
use agent::local_machine::{local_open_url, execute_applescript, local_music_play};
use agent::presence_broker::local_presence_read;
use agent::voice_recording::{
  voice_recording_append,
  voice_recording_begin,
  voice_recording_finalize,
  voice_recording_mark,
  voice_recording_recover_incomplete,
};

#[derive(Default)]
struct KokoroSidecarState(Mutex<Option<CommandChild>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceOriginConfig {
  version: u8,
  installation_id: String,
  device_key: String,
  private_key_pkcs8_base64: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceOriginStatus {
  configured: bool,
  installation_id: Option<String>,
  device_key: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceOriginAssertion {
  version: u8,
  installation_id: String,
  issued_at_ms: u64,
  signature: String,
}

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

#[tauri::command]
fn execute_shell_command(command: &str) -> Result<String, String> {
    println!("Executing shell command: {}", command);
    match std::process::Command::new("sh").arg("-c").arg(command).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Error: {}\nOutput: {}", stderr, stdout))
            }
        },
        Err(e) => Err(e.to_string()),
    }
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .manage(KokoroSidecarState::default())
    .invoke_handler(tauri::generate_handler![
      local_open_url,
      execute_applescript,
      local_music_play,
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

      // Start Kokoro HTTP server Sidecar
      let resource_dir = app.path().resource_dir().expect("Failed to get resource dir");
      let model_path = resource_dir.join("resources").join("kokoro-v0_19.onnx");
      let voices_path = resource_dir.join("resources").join("voices.bin");

      println!("Starting Kokoro sidecar with model: {:?}", model_path);

      if !model_path.exists() || !voices_path.exists() {
        eprintln!(
          "Kokoro sidecar resources missing: model_exists={}, voices_exists={}",
          model_path.exists(),
          voices_path.exists()
        );
      } else { match app.shell().sidecar("kokoro_runner") {
        Ok(sidecar_command) => {
          let command = sidecar_command.args([model_path.to_str().unwrap(), voices_path.to_str().unwrap()]);
          match command.spawn() {
            Ok((mut receiver, child)) => {
              // Kokoro mantém um servidor HTTP local. Se os eventos do
              // sidecar não forem drenados, stdout/stderr podem encher e
              // bloquear justamente as próximas respostas de voz.
              tauri::async_runtime::spawn(async move {
                while receiver.recv().await.is_some() {}
              });
              *app.state::<KokoroSidecarState>().0.lock().unwrap() = Some(child);
              println!("Kokoro sidecar started successfully.");
            },
            Err(e) => eprintln!("Failed to spawn Kokoro sidecar: {}", e),
          }
        },
        Err(e) => eprintln!("Failed to create kokoro sidecar command: {}", e),
      }}

      // O microsserviço Node.js do WhatsApp agora roda externamente (via PM2)
      // para garantir persistência independentemente do ciclo de vida da interface.

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if !matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
      return;
    }

    let sidecar = app_handle.state::<KokoroSidecarState>();
    let Some(child) = sidecar.0.lock().unwrap().take() else {
      return;
    };

    // PyInstaller mantém um processo-filho que serve a porta 14321. Encerrar
    // somente o bootloader deixa esse servidor órfão e a próxima abertura da
    // PULSO fica sem voz. Derrubamos primeiro os descendentes e depois o
    // processo controlado pelo plugin.
    let _ = std::process::Command::new("/usr/bin/pkill")
      .args(["-TERM", "-P", &child.pid().to_string()])
      .status();
    let _ = child.kill();
  });
}
