use base64::Engine;
use ed25519_dalek::{pkcs8::DecodePrivateKey, Signer, SigningKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{plugin, Emitter, Manager};
use tauri_plugin_shell::ShellExt;

mod agent;
pub mod pulso_core;
use agent::local_machine::{execute_applescript, local_music_play, local_open_url};
use agent::presence_broker::local_presence_read;
use agent::voice_recording::{
    voice_recording_append, voice_recording_begin, voice_recording_finalize, voice_recording_mark,
    voice_recording_recover_incomplete,
};
use pulso_core::{
    bridge_request, core_canary_rendered, delete_provider_secret, hydrate_provider_secret,
    provider_secret_status, shutdown_bridge, store_provider_secret, BridgeManager,
};

pub fn is_navigation_allowed_for_environment(
    url: &tauri::Url,
    allow_debug_localhost: bool,
) -> bool {
    let scheme = url.scheme();
    if scheme == "tauri" {
        return matches!(url.host_str(), Some("localhost") | None);
    }

    if allow_debug_localhost && (scheme == "http" || scheme == "https") {
        return matches!(url.host_str(), Some("localhost") | Some("127.0.0.1"));
    }

    false
}

pub fn is_navigation_allowed(url: &tauri::Url) -> bool {
    is_navigation_allowed_for_environment(url, cfg!(debug_assertions))
}

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
    let path = app
        .path()
        .app_data_dir()
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
fn local_device_origin_assert(
    app: tauri::AppHandle,
    request_id: &str,
) -> Result<DeviceOriginAssertion, String> {
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
    let message = format!(
        "v1\n{}\n{}\n{}",
        config.installation_id, request_id, issued_at_ms
    );
    let signature = signing_key
        .sign(message.as_bytes())
        .to_bytes()
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
    tauri::Builder::default()
    .plugin(
      plugin::Builder::<tauri::Wry>::new("pulso-navigation-guard")
        .on_navigation(|_webview, url| {
          let allowed = is_navigation_allowed(url);
          if !allowed {
            // Intencionalmente não registramos a URL para impedir vazamento
            // de parâmetros sensíveis (como tokens de autenticação/OAuth).
            eprintln!("pulso-navigation-guard: navegação externa recusada pela barreira nativa");
          }
          allowed
        })
        .build(),
    )
    .manage(Mutex::new(BridgeManager::default()))
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
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
      voice_recording_recover_incomplete,
      bridge_request,
      store_provider_secret,
      hydrate_provider_secret,
      provider_secret_status,
      delete_provider_secret,
      core_canary_rendered,
      shutdown_bridge
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
            Ok((_rx, _child)) => println!("Kokoro sidecar started successfully."),
            Err(e) => eprintln!("Failed to spawn Kokoro sidecar: {}", e),
          }
        },
        Err(e) => eprintln!("Failed to create kokoro sidecar command: {}", e),
      }}

      // O microsserviço Node.js do WhatsApp agora roda externamente (via PM2)
      // para garantir persistência independentemente do ciclo de vida da interface.

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod navigation_guard_tests {
    use super::{is_navigation_allowed, is_navigation_allowed_for_environment};
    use tauri::Url;

    #[test]
    fn permits_internal_packaged_tauri_origin() {
        let internal_root = Url::parse("tauri://localhost").unwrap();
        let internal_page = Url::parse("tauri://localhost/pulso/live").unwrap();
        let internal_asset = Url::parse("tauri://localhost/assets/index.js").unwrap();

        assert!(is_navigation_allowed_for_environment(&internal_root, false));
        assert!(is_navigation_allowed_for_environment(&internal_page, false));
        assert!(is_navigation_allowed_for_environment(
            &internal_asset,
            false
        ));
        assert!(is_navigation_allowed_for_environment(&internal_root, true));
        assert!(is_navigation_allowed_for_environment(&internal_page, true));
    }

    #[test]
    fn refuses_external_https_and_oauth_navigation() {
        let oauth_url = Url::parse(
            "https://auth.openai.com/oauth/authorize?response_type=code&client_id=pulso",
        )
        .unwrap();
        let google_oauth = Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
        let external_https = Url::parse("https://pulso.chat").unwrap();
        let external_http = Url::parse("http://example.com").unwrap();

        assert!(!is_navigation_allowed_for_environment(&oauth_url, false));
        assert!(!is_navigation_allowed_for_environment(&google_oauth, false));
        assert!(!is_navigation_allowed_for_environment(
            &external_https,
            false
        ));
        assert!(!is_navigation_allowed_for_environment(
            &external_http,
            false
        ));

        assert!(!is_navigation_allowed_for_environment(&oauth_url, true));
        assert!(!is_navigation_allowed_for_environment(&google_oauth, true));
        assert!(!is_navigation_allowed_for_environment(
            &external_https,
            true
        ));
        assert!(!is_navigation_allowed_for_environment(&external_http, true));
    }

    #[test]
    fn conditions_localhost_and_loopback_to_debug_mode_only() {
        let dev_localhost =
            Url::parse("http://localhost:3001/pulso/live?pulso_tauri_dev=1").unwrap();
        let dev_loopback = Url::parse("http://127.0.0.1:3001/pulso/live").unwrap();
        let dev_https_localhost = Url::parse("https://localhost:3001/pulso/live").unwrap();
        let dev_https_loopback = Url::parse("https://127.0.0.1:3001/pulso/live").unwrap();

        // Permitido em debug
        assert!(is_navigation_allowed_for_environment(&dev_localhost, true));
        assert!(is_navigation_allowed_for_environment(&dev_loopback, true));
        assert!(is_navigation_allowed_for_environment(
            &dev_https_localhost,
            true
        ));
        assert!(is_navigation_allowed_for_environment(
            &dev_https_loopback,
            true
        ));

        // Recusado em release
        assert!(!is_navigation_allowed_for_environment(
            &dev_localhost,
            false
        ));
        assert!(!is_navigation_allowed_for_environment(&dev_loopback, false));
        assert!(!is_navigation_allowed_for_environment(
            &dev_https_localhost,
            false
        ));
        assert!(!is_navigation_allowed_for_environment(
            &dev_https_loopback,
            false
        ));
    }

    #[test]
    fn refuses_non_web_schemes_and_foreign_tauri_hosts() {
        let file_url = Url::parse("file:///etc/passwd").unwrap();
        let javascript_url = Url::parse("javascript:alert(1)").unwrap();
        let data_url = Url::parse("data:text/html,<h1>blocked</h1>").unwrap();
        let foreign_tauri = Url::parse("tauri://malicious.com/exploit").unwrap();
        let bypass_localhost = Url::parse("http://localhost.attacker.com:3001").unwrap();
        let bypass_ip = Url::parse("http://127.0.0.2:3001").unwrap();

        for is_debug in [true, false] {
            assert!(!is_navigation_allowed_for_environment(&file_url, is_debug));
            assert!(!is_navigation_allowed_for_environment(
                &javascript_url,
                is_debug
            ));
            assert!(!is_navigation_allowed_for_environment(&data_url, is_debug));
            assert!(!is_navigation_allowed_for_environment(
                &foreign_tauri,
                is_debug
            ));
            assert!(!is_navigation_allowed_for_environment(
                &bypass_localhost,
                is_debug
            ));
            assert!(!is_navigation_allowed_for_environment(&bypass_ip, is_debug));
        }
    }

    #[test]
    fn default_policy_matches_current_build_configuration() {
        let internal_url = Url::parse("tauri://localhost/pulso/live").unwrap();
        let oauth_url = Url::parse("https://auth.openai.com/oauth/authorize").unwrap();
        let localhost_url = Url::parse("http://localhost:3001/pulso/live").unwrap();

        assert!(is_navigation_allowed(&internal_url));
        assert!(!is_navigation_allowed(&oauth_url));
        if cfg!(debug_assertions) {
            assert!(is_navigation_allowed(&localhost_url));
        } else {
            assert!(!is_navigation_allowed(&localhost_url));
        }
    }
}
