use base64::Engine;
use ed25519_dalek::{pkcs8::DecodePrivateKey, Signer, SigningKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;

const KOKORO_PORT: u16 = 14321;

// Next's client router normalizes the physical document URL with the History
// API during hydration. WKWebView on macOS 14 turns any native History API
// mutation on the packaged document into its error page. This script is
// injected by Wry at document start, before any page script. It gives Next the
// mutable router state it expects without calling WebKit's native History API.
const PULSO_DESKTOP_HISTORY_GUARD: &str = r#"
(() => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  if (protocol === "http:" && hostname === "127.0.0.1" && window.location.port === "14322") return;

  const nativeStateDescriptor = Object.getOwnPropertyDescriptor(History.prototype, "state");
  let virtualState = null;
  try {
    virtualState = nativeStateDescriptor?.get?.call(window.history) ?? window.history.state;
  } catch (_) {}

  const updateVirtualState = function (state) {
    virtualState = state;
    return undefined;
  };
  const lock = (target, key, value) => {
    try {
      Object.defineProperty(target, key, {
        value,
        configurable: false,
        writable: false,
      });
    } catch (_) {}
  };

  lock(History.prototype, "pushState", updateVirtualState);
  lock(History.prototype, "replaceState", updateVirtualState);
  lock(window.history, "pushState", updateVirtualState);
  lock(window.history, "replaceState", updateVirtualState);
  try {
    Object.defineProperty(window.history, "state", {
      get: () => virtualState,
      configurable: false,
    });
  } catch (_) {
    try {
      Object.defineProperty(History.prototype, "state", {
        get() {
          if (this === window.history) return virtualState;
          return nativeStateDescriptor?.get?.call(this) ?? null;
        },
        configurable: false,
      });
    } catch (_) {}
  }

  Object.defineProperty(window, "__PULSO_DESKTOP_HISTORY_GUARD__", {
    value: true,
    configurable: false,
    writable: false,
  });

  const report = (stage, detail = {}) => {
    const payload = JSON.stringify({ stage, href: window.location.href, detail });
    let attempts = 0;
    const send = () => {
      try {
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (typeof invoke === "function") {
          void invoke("desktop_boot_probe", { payload }).catch(() => {});
          return;
        }
      } catch (_) {}
      attempts += 1;
      if (attempts < 50) setTimeout(send, 50);
    };
    send();
  };

  window.addEventListener("error", (event) => {
    report("window-error", {
      message: String(event.message || ""),
      filename: String(event.filename || ""),
      line: event.lineno || 0,
      column: event.colno || 0,
      stack: String(event.error?.stack || "").slice(0, 8000),
    });
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report("unhandled-rejection", {
      message: String(reason?.message || reason || ""),
      stack: String(reason?.stack || "").slice(0, 8000),
    });
  }, true);
  document.addEventListener("DOMContentLoaded", () => {
    report("dom-content-loaded", {
      htmlId: document.documentElement.id || "",
      body: String(document.body?.innerText || "").slice(0, 1000),
    });
    setTimeout(() => report("post-hydration", {
      htmlId: document.documentElement.id || "",
      body: String(document.body?.innerText || "").slice(0, 1000),
    }), 1500);
  }, { once: true });
  setTimeout(() => report("guard-installed", {
    hasTauriInvoke: typeof window.__TAURI_INTERNALS__?.invoke === "function",
    protocol,
    hostname,
    virtualState: true,
  }), 0);
})();
"#;

const PULSO_DESKTOP_HTTP_PORT: u16 = 14322;

fn desktop_content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn desktop_static_path(root: &Path, request_path: &str) -> Option<PathBuf> {
    let raw = request_path.split('?').next().unwrap_or("/");
    if raw.contains("..") || raw.contains('%') || raw.contains('\\') {
        return None;
    }
    let relative = raw.trim_start_matches('/');
    let mut candidate = if relative.is_empty() {
        root.join("index.html")
    } else {
        root.join(relative)
    };
    if candidate.is_dir() {
        candidate = candidate.join("index.html");
    } else if !candidate.exists() && candidate.extension().is_none() {
        let html = candidate.with_extension("html");
        candidate = if html.exists() { html } else { candidate.join("index.html") };
    }
    candidate.is_file().then_some(candidate)
}

fn serve_desktop_connection(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(3)))?;
    let mut request = [0_u8; 8192];
    let read = stream.read(&mut request)?;
    let line = String::from_utf8_lossy(&request[..read]);
    let mut parts = line.lines().next().unwrap_or("").split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");
    if method != "GET" && method != "HEAD" {
        stream.write_all(b"HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")?;
        return Ok(());
    }
    let Some(file_path) = desktop_static_path(root, path) else {
        stream.write_all(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")?;
        return Ok(());
    };
    let body = fs::read(&file_path)?;
    let headers = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        desktop_content_type(&file_path),
        body.len()
    );
    stream.write_all(headers.as_bytes())?;
    if method != "HEAD" {
        stream.write_all(&body)?;
    }
    Ok(())
}

fn start_desktop_http(app: &tauri::AppHandle) -> Result<String, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("desktop resource directory unavailable: {error}"))?;
    let root = [
        resource_dir.join("resources").join("web"),
        resource_dir.join("_up_").join("out"),
        resource_dir.join("out"),
        resource_dir.join("web"),
    ]
    .into_iter()
    .find(|candidate| candidate.join("index.html").is_file())
    .ok_or_else(|| format!("desktop web root unavailable under {}", resource_dir.display()))?;
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, PULSO_DESKTOP_HTTP_PORT))
        .map_err(|error| format!("desktop HTTP listener unavailable: {error}"))?;
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let root = root.clone();
                    std::thread::spawn(move || {
                        let _ = serve_desktop_connection(stream, &root);
                    });
                }
                Err(_) => break,
            }
        }
    });
    Ok(format!("http://127.0.0.1:{PULSO_DESKTOP_HTTP_PORT}/"))
}

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

fn kokoro_is_ready() -> bool {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), KOKORO_PORT);
    TcpStream::connect_timeout(&address, Duration::from_millis(120)).is_ok()
}

#[tauri::command]
fn ensure_kokoro_sidecar(app: tauri::AppHandle) -> Result<String, String> {
    // Voice is an optional capability. It must never participate in the cold
    // path that creates the desktop HOME. Reuse an existing local listener
    // (for example the stable PULSO) and spawn this bundle's sidecar only when
    // an explicit voice action asks for it.
    if kokoro_is_ready() {
        return Ok("ready".to_string());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Kokoro resource directory unavailable: {error}"))?;
    let model_path = resource_dir.join("resources").join("kokoro-v0_19.onnx");
    let voices_path = resource_dir.join("resources").join("voices.bin");
    if !model_path.exists() || !voices_path.exists() {
        return Err("Kokoro sidecar resources are unavailable".to_string());
    }

    let command = app
        .shell()
        .sidecar("kokoro_runner")
        .map_err(|error| format!("Failed to create Kokoro sidecar command: {error}"))?
        .args([
            model_path.to_string_lossy().to_string(),
            voices_path.to_string_lossy().to_string(),
        ]);
    command
        .spawn()
        .map_err(|error| format!("Failed to spawn Kokoro sidecar: {error}"))?;

    for _ in 0..40 {
        if kokoro_is_ready() {
            return Ok("started".to_string());
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    Err("Kokoro sidecar did not become ready".to_string())
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

#[tauri::command]
fn desktop_boot_probe(app: tauri::AppHandle, payload: &str) -> Result<(), String> {
    if payload.is_empty() || payload.len() > 16_384 {
        return Err("desktop boot probe payload is invalid".to_string());
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("desktop boot probe directory unavailable: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("desktop boot probe directory could not be created: {error}"))?;
    let path = app_data_dir.join("desktop-boot-probe.log");
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("desktop boot probe could not be opened: {error}"))?;
    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is invalid".to_string())?
        .as_millis();
    let safe_payload = payload.replace(['\n', '\r', '\0'], " ");
    writeln!(file, "{timestamp_ms}\t{safe_payload}")
        .map_err(|error| format!("desktop boot probe could not be written: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .append_invoke_initialization_script(PULSO_DESKTOP_HISTORY_GUARD)
    .manage(Mutex::new(BridgeManager::default()))
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      local_open_url,
      execute_applescript,
      local_music_play,
      execute_shell_command,
      execute_long_command_stream,
      desktop_boot_probe,
      local_presence_read,
      local_device_origin_status,
      local_device_origin_assert,
      voice_recording_begin,
      voice_recording_append,
      voice_recording_finalize,
      voice_recording_mark,
      voice_recording_recover_incomplete,
      ensure_kokoro_sidecar,
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

      if app.config().identifier.ends_with(".next-preview") {
        let url = start_desktop_http(app.handle())?;
        let window = app
          .get_webview_window("main")
          .ok_or_else(|| "PULSO main window is unavailable".to_string())?;
        window.navigate(
          url.parse()
            .map_err(|error| format!("desktop HTTP URL is invalid: {error}"))?,
        )?;
      }

      // O microsserviço Node.js do WhatsApp agora roda externamente (via PM2)
      // para garantir persistência independentemente do ciclo de vida da interface.

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
