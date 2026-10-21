use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::{create_dir_all, rename, File};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

pub const SIDECAR_BIN_NAME: &str = "pulso-node";
pub const SIDECAR_TRIPLE_BIN_NAME: &str = "pulso-node-x86_64-apple-darwin";
pub const CODEX_BIN_NAME: &str = "pulso-codex";
pub const CODEX_TRIPLE_BIN_NAME: &str = "pulso-codex-x86_64-apple-darwin";
pub const CANARY_RECEIPT_FILENAME: &str = "core-canary-rendered.json";
const CANARY_FIELD_MAX_BYTES: usize = 128;
#[cfg(target_os = "macos")]
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CanaryRenderedPayload {
    pub status: String,
    pub active_area_id: Option<String>,
    pub active_session_id: Option<String>,
    pub runtime_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanaryRenderedReceipt {
    pub schema_version: u8,
    pub status: String,
    pub active_area_id: Option<String>,
    pub active_session_id: Option<String>,
    pub runtime_status: String,
    pub generated_at: String,
}

fn validate_canary_field(
    field_name: &str,
    value: Option<&str>,
    required: bool,
) -> Result<(), String> {
    let Some(value) = value else {
        return if required {
            Err(format!("{} is required", field_name))
        } else {
            Ok(())
        };
    };
    if value.is_empty() || value.trim() != value {
        return Err(format!("{} must be non-empty and trimmed", field_name));
    }
    if value.len() > CANARY_FIELD_MAX_BYTES {
        return Err(format!(
            "{} exceeds {} bytes",
            field_name, CANARY_FIELD_MAX_BYTES
        ));
    }
    if value
        .chars()
        .any(|c| c.is_control() || c == '/' || c == '\\')
    {
        return Err(format!("{} contains forbidden characters", field_name));
    }
    Ok(())
}

pub fn write_canary_rendered_receipt(
    app_data_dir: &Path,
    payload: CanaryRenderedPayload,
) -> Result<CanaryRenderedReceipt, String> {
    if payload.status != "connected" {
        return Err("status must be exactly connected".to_string());
    }
    validate_canary_field("activeAreaId", payload.active_area_id.as_deref(), false)?;
    validate_canary_field(
        "activeSessionId",
        payload.active_session_id.as_deref(),
        false,
    )?;
    validate_canary_field("runtimeStatus", Some(&payload.runtime_status), true)?;

    create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let generated_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System clock error: {}", e))?
        .as_millis()
        .to_string();
    let receipt = CanaryRenderedReceipt {
        schema_version: 1,
        status: payload.status,
        active_area_id: payload.active_area_id,
        active_session_id: payload.active_session_id,
        runtime_status: payload.runtime_status,
        generated_at,
    };

    let destination = app_data_dir.join(CANARY_RECEIPT_FILENAME);
    let temporary = app_data_dir.join(format!(
        ".{}.{}.tmp",
        CANARY_RECEIPT_FILENAME,
        std::process::id()
    ));
    let mut file =
        File::create(&temporary).map_err(|e| format!("Failed to create canary receipt: {}", e))?;
    serde_json::to_writer_pretty(&mut file, &receipt)
        .map_err(|e| format!("Failed to serialize canary receipt: {}", e))?;
    file.write_all(b"\n")
        .map_err(|e| format!("Failed to finalize canary receipt: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync canary receipt: {}", e))?;
    rename(&temporary, &destination)
        .map_err(|e| format!("Failed to publish canary receipt atomically: {}", e))?;

    Ok(receipt)
}

pub fn resolve_node_sidecar_path(exe_parent: &Path) -> Result<PathBuf, String> {
    let candidates = [
        exe_parent.join(SIDECAR_BIN_NAME),
        exe_parent.join(SIDECAR_TRIPLE_BIN_NAME),
        exe_parent.join("binaries").join(SIDECAR_TRIPLE_BIN_NAME),
        exe_parent.join("binaries").join(SIDECAR_BIN_NAME),
    ];

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err("Bundled Node sidecar not found".to_string())
}

pub fn resolve_codex_sidecar_path(exe_parent: &Path) -> Result<PathBuf, String> {
    let candidates = [
        exe_parent.join(CODEX_BIN_NAME),
        exe_parent.join(CODEX_TRIPLE_BIN_NAME),
        exe_parent.join("binaries").join(CODEX_TRIPLE_BIN_NAME),
        exe_parent.join("binaries").join(CODEX_BIN_NAME),
    ];

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err("Bundled Codex app-server sidecar not found".to_string())
}

pub fn resolve_bridge_script_path(resource_dir: &Path) -> Result<PathBuf, String> {
    let candidates = [
        resource_dir
            .join("resources")
            .join("core")
            .join("desktop")
            .join("bridge.mjs"),
        resource_dir.join("core").join("desktop").join("bridge.mjs"),
    ];

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err("Bundled Core bridge resource not found".to_string())
}

pub struct BridgeProcess {
    child: Child,
    stdin: ChildStdin,
    reader: BufReader<ChildStdout>,
}

impl BridgeProcess {
    pub fn spawn_with_paths(
        node_bin: &Path,
        script_path: &Path,
        app_data_dir: &Path,
    ) -> Result<Self, String> {
        if !node_bin.is_file() {
            return Err("Bundled Node sidecar not found".to_string());
        }
        if !script_path.is_file() {
            return Err("Bundled Core bridge resource not found".to_string());
        }

        create_dir_all(app_data_dir).map_err(|e| {
            format!(
                "Failed to create app data directory at {:?}: {}",
                app_data_dir, e
            )
        })?;

        let mut cmd = Command::new(node_bin);
        cmd.arg(script_path)
            .arg("--data-dir")
            .arg(app_data_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        if let Some(exe_parent) = node_bin.parent() {
            if let Ok(codex_bin) = resolve_codex_sidecar_path(exe_parent) {
                cmd.env("PULSO_CODEX_BIN", codex_bin);
            }
        }

        let mut child = cmd.spawn().map_err(|e| {
            format!(
                "Failed to spawn node sidecar at {:?} with script {:?}: {}",
                node_bin, script_path, e
            )
        })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to capture stdin of sidecar process".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout of sidecar process".to_string())?;
        let reader = BufReader::new(stdout);

        Ok(Self {
            child,
            stdin,
            reader,
        })
    }

    pub fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    pub fn request(&mut self, request: &Value) -> Result<Value, String> {
        let serialized = serde_json::to_string(request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;
        writeln!(self.stdin, "{}", serialized)
            .map_err(|e| format!("Failed to write request to stdin: {}", e))?;
        self.stdin
            .flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        let mut line = String::new();
        let bytes_read = self
            .reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read response line from stdout: {}", e))?;

        if bytes_read == 0 {
            return Err("Bridge process closed output stream prematurely".to_string());
        }

        serde_json::from_str::<Value>(line.trim())
            .map_err(|e| format!("Failed to parse response JSON: {}", e))
    }
}

impl Drop for BridgeProcess {
    fn drop(&mut self) {
        let shutdown_envelope = json!({
            "requestId": "native-drop-shutdown",
            "method": "shutdown",
            "params": {}
        });
        if let Ok(serialized) = serde_json::to_string(&shutdown_envelope) {
            let _ = writeln!(self.stdin, "{}", serialized);
            let _ = self.stdin.flush();
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub struct BridgeManager {
    process: Option<BridgeProcess>,
}

fn validate_provider_id(provider_id: &str) -> Result<(), String> {
    if provider_id.is_empty() || provider_id.len() > 80 {
        return Err("Provider ID must contain between 1 and 80 characters".to_string());
    }
    if !provider_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err("Provider ID contains forbidden characters".to_string());
    }
    Ok(())
}

fn validate_secret_value(secret: &str) -> Result<(), String> {
    if secret.trim().len() < 4 {
        return Err("Secret must be at least 4 characters long".to_string());
    }
    Ok(())
}

fn keychain_coordinates(provider_id: &str) -> Result<(String, String), String> {
    validate_provider_id(provider_id)?;
    Ok((
        format!("com.felipedutraapps.pulso.provider.{}", provider_id),
        provider_id.to_string(),
    ))
}

#[cfg(target_os = "macos")]
fn keychain_store_secret(provider_id: &str, secret: &[u8]) -> Result<(), String> {
    let (service, account) = keychain_coordinates(provider_id)?;
    security_framework::passwords::set_generic_password(&service, &account, secret)
        .map_err(|_| "Failed to store provider secret in macOS Keychain".to_string())
}

#[cfg(target_os = "macos")]
fn keychain_read_secret(provider_id: &str) -> Result<Option<Vec<u8>>, String> {
    let (service, account) = keychain_coordinates(provider_id)?;
    match security_framework::passwords::get_generic_password(&service, &account) {
        Ok(secret) => Ok(Some(secret)),
        Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(None),
        Err(_) => Err("Failed to read provider secret from macOS Keychain".to_string()),
    }
}

#[cfg(target_os = "macos")]
fn keychain_delete_secret(provider_id: &str) -> Result<(), String> {
    let (service, account) = keychain_coordinates(provider_id)?;
    match security_framework::passwords::delete_generic_password(&service, &account) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(()),
        Err(_) => Err("Failed to delete provider secret from macOS Keychain".to_string()),
    }
}

#[cfg(not(target_os = "macos"))]
fn keychain_store_secret(provider_id: &str, _secret: &[u8]) -> Result<(), String> {
    let _ = keychain_coordinates(provider_id)?;
    Err("Native macOS Keychain unavailable".to_string())
}

#[cfg(not(target_os = "macos"))]
fn keychain_read_secret(provider_id: &str) -> Result<Option<Vec<u8>>, String> {
    let _ = keychain_coordinates(provider_id)?;
    Err("Native macOS Keychain unavailable".to_string())
}

#[cfg(not(target_os = "macos"))]
fn keychain_delete_secret(provider_id: &str) -> Result<(), String> {
    let _ = keychain_coordinates(provider_id)?;
    Err("Native macOS Keychain unavailable".to_string())
}

fn secret_receipt(provider_id: &str, configured: bool) -> Value {
    json!({
        "providerId": provider_id,
        "configured": configured,
        "secretRef": if configured { Some(format!("keychain:{}", provider_id)) } else { None },
    })
}

fn inject_secret_into_core(
    app: &AppHandle,
    manager: &mut BridgeManager,
    provider_id: &str,
    secret: String,
) -> Result<(), String> {
    let response = manager.send(app, &json!({
        "requestId": format!("native-keychain-{}", provider_id),
        "method": "provider.secret.inject",
        "params": { "providerId": provider_id, "secret": secret }
    }))?;
    if response.get("ok").and_then(Value::as_bool) != Some(true) {
        return Err("PULSO Core refused the Keychain credential".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn store_provider_secret(
    app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
    provider_id: String,
    secret: String,
) -> Result<Value, String> {
    validate_provider_id(&provider_id)?;
    validate_secret_value(&secret)?;
    keychain_store_secret(&provider_id, secret.as_bytes())?;
    let mut manager = state.lock().map_err(|_| "Bridge manager mutex poisoned".to_string())?;
    inject_secret_into_core(&app, &mut manager, &provider_id, secret)?;
    Ok(secret_receipt(&provider_id, true))
}

#[tauri::command]
pub fn hydrate_provider_secret(
    app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
    provider_id: String,
) -> Result<Value, String> {
    validate_provider_id(&provider_id)?;
    let Some(secret_bytes) = keychain_read_secret(&provider_id)? else {
        return Ok(secret_receipt(&provider_id, false));
    };
    let secret = String::from_utf8(secret_bytes)
        .map_err(|_| "Provider secret in Keychain is not valid UTF-8".to_string())?;
    let mut manager = state.lock().map_err(|_| "Bridge manager mutex poisoned".to_string())?;
    inject_secret_into_core(&app, &mut manager, &provider_id, secret)?;
    Ok(secret_receipt(&provider_id, true))
}

#[tauri::command]
pub fn provider_secret_status(provider_id: String) -> Result<Value, String> {
    let configured = keychain_read_secret(&provider_id)?.is_some();
    Ok(secret_receipt(&provider_id, configured))
}

#[tauri::command]
pub fn delete_provider_secret(provider_id: String) -> Result<Value, String> {
    keychain_delete_secret(&provider_id)?;
    Ok(secret_receipt(&provider_id, false))
}

impl BridgeManager {
    fn ensure(&mut self, app: &AppHandle) -> Result<&mut BridgeProcess, String> {
        if let Some(existing) = self.process.as_mut() {
            if !existing.is_alive() {
                self.process = None;
            }
        }

        if self.process.is_none() {
            let current_exe = std::env::current_exe()
                .map_err(|e| format!("Failed to resolve current exe: {}", e))?;
            let exe_parent = current_exe
                .parent()
                .ok_or_else(|| "Failed to resolve parent directory of current exe".to_string())?;

            let node_bin = resolve_node_sidecar_path(exe_parent)?;

            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource dir: {}", e))?;
            let script_path = resolve_bridge_script_path(&resource_dir)?;

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;

            let proc = BridgeProcess::spawn_with_paths(&node_bin, &script_path, &app_data_dir)?;
            self.process = Some(proc);
        }

        self.process
            .as_mut()
            .ok_or_else(|| "Bridge process is unexpectedly unavailable".to_string())
    }

    pub fn send(&mut self, app: &AppHandle, request: &Value) -> Result<Value, String> {
        let is_shutdown = request
            .get("method")
            .and_then(|m| m.as_str())
            .map(|m| m == "shutdown")
            .unwrap_or(false);

        let result = {
            let process = self.ensure(app)?;
            process.request(request)
        };

        if result.is_err() || is_shutdown {
            self.process = None;
        }

        result
    }

    pub fn shutdown(&mut self) -> Result<Value, String> {
        if let Some(mut proc) = self.process.take() {
            let shutdown_envelope = json!({
                "requestId": "native-explicit-shutdown",
                "method": "shutdown",
                "params": {}
            });
            let res = proc.request(&shutdown_envelope);
            drop(proc);
            res.or_else(|_| Ok(json!({ "status": "shutdown" })))
        } else {
            Ok(json!({ "status": "already_shutdown" }))
        }
    }
}

#[tauri::command]
pub fn bridge_request(
    app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
    request: Value,
) -> Result<Value, String> {
    let mut manager = state
        .lock()
        .map_err(|_| "Bridge manager mutex poisoned".to_string())?;
    manager.send(&app, &request)
}

#[tauri::command]
pub fn shutdown_bridge(
    _app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
) -> Result<Value, String> {
    let mut manager = state
        .lock()
        .map_err(|_| "Bridge manager mutex poisoned".to_string())?;
    manager.shutdown()
}

#[tauri::command]
pub fn core_canary_rendered(
    app: AppHandle,
    payload: CanaryRenderedPayload,
) -> Result<Value, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let receipt = write_canary_rendered_receipt(&app_data_dir, payload)?;
    serde_json::to_value(receipt).map_err(|e| format!("Failed to return canary receipt: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{remove_dir_all, File};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{}-{}-{}", prefix, std::process::id(), nanos));
        create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolve_node_sidecar_fails_explicitly_when_missing() {
        let temp = unique_temp_dir("pulso-sidecar-missing");
        let err = resolve_node_sidecar_path(&temp).unwrap_err();
        assert_eq!(err, "Bundled Node sidecar not found");
        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn resolve_node_sidecar_prefers_pulso_node_and_falls_back_to_target_triple() {
        let temp = unique_temp_dir("pulso-sidecar-resolve");
        let triple_path = temp.join(SIDECAR_TRIPLE_BIN_NAME);
        File::create(&triple_path).unwrap();
        assert_eq!(resolve_node_sidecar_path(&temp).unwrap(), triple_path);

        let direct_path = temp.join(SIDECAR_BIN_NAME);
        File::create(&direct_path).unwrap();
        assert_eq!(resolve_node_sidecar_path(&temp).unwrap(), direct_path);

        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn resolve_codex_sidecar_fails_explicitly_when_missing() {
        let temp = unique_temp_dir("pulso-codex-sidecar-missing");
        let err = resolve_codex_sidecar_path(&temp).unwrap_err();
        assert_eq!(err, "Bundled Codex app-server sidecar not found");
        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn resolve_codex_sidecar_prefers_direct_name_and_falls_back_to_target_triple() {
        let temp = unique_temp_dir("pulso-codex-sidecar-resolve");
        let triple_path = temp.join(CODEX_TRIPLE_BIN_NAME);
        File::create(&triple_path).unwrap();
        assert_eq!(resolve_codex_sidecar_path(&temp).unwrap(), triple_path);

        let direct_path = temp.join(CODEX_BIN_NAME);
        File::create(&direct_path).unwrap();
        assert_eq!(resolve_codex_sidecar_path(&temp).unwrap(), direct_path);

        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn resolve_bridge_script_fails_explicitly_when_missing() {
        let temp = unique_temp_dir("pulso-bridge-missing");
        let err = resolve_bridge_script_path(&temp).unwrap_err();
        assert_eq!(err, "Bundled Core bridge resource not found");
        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn resolve_bridge_script_locates_nested_resource() {
        let temp = unique_temp_dir("pulso-bridge-resolve");
        let script = temp
            .join("resources")
            .join("core")
            .join("desktop")
            .join("bridge.mjs");
        create_dir_all(script.parent().unwrap()).unwrap();
        File::create(&script).unwrap();

        assert_eq!(resolve_bridge_script_path(&temp).unwrap(), script);
        let _ = remove_dir_all(&temp);
    }

    fn valid_canary_payload() -> CanaryRenderedPayload {
        CanaryRenderedPayload {
            status: "connected".to_string(),
            active_area_id: Some("area_pulso".to_string()),
            active_session_id: Some("session_geral".to_string()),
            runtime_status: "stopped".to_string(),
        }
    }

    #[test]
    fn canary_receipt_rejects_invalid_or_path_like_fields() {
        let temp = unique_temp_dir("pulso-canary-invalid");

        let mut invalid_status = valid_canary_payload();
        invalid_status.status = "error".to_string();
        assert!(write_canary_rendered_receipt(&temp, invalid_status).is_err());

        let mut path_like = valid_canary_payload();
        path_like.active_area_id = Some("../secrets".to_string());
        assert!(write_canary_rendered_receipt(&temp, path_like).is_err());

        let mut blank_runtime = valid_canary_payload();
        blank_runtime.runtime_status = " ".to_string();
        assert!(write_canary_rendered_receipt(&temp, blank_runtime).is_err());

        assert!(!temp.join(CANARY_RECEIPT_FILENAME).exists());
        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn canary_receipt_is_valid_json_and_atomically_replaces_prior_content() {
        let temp = unique_temp_dir("pulso-canary-receipt");
        let receipt_path = temp.join(CANARY_RECEIPT_FILENAME);
        std::fs::write(&receipt_path, b"stale").unwrap();

        let receipt = write_canary_rendered_receipt(&temp, valid_canary_payload()).unwrap();
        let parsed: Value = serde_json::from_slice(&std::fs::read(&receipt_path).unwrap()).unwrap();

        assert_eq!(receipt.schema_version, 1);
        assert_eq!(parsed["status"], "connected");
        assert_eq!(parsed["activeAreaId"], "area_pulso");
        assert_eq!(parsed["activeSessionId"], "session_geral");
        assert_eq!(parsed["runtimeStatus"], "stopped");
        assert!(parsed["generatedAt"]
            .as_str()
            .unwrap()
            .parse::<u128>()
            .is_ok());
        assert_eq!(
            std::fs::read_dir(&temp)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
                .count(),
            0
        );

        let _ = remove_dir_all(&temp);
    }

    #[test]
    fn provider_id_validation_rejects_path_and_shell_like_values() {
        assert!(validate_provider_id("openai").is_ok());
        assert!(validate_provider_id("anthropic_primary-1").is_ok());
        for invalid in ["", "../openai", "open ai", "provider:secret", "provider;rm"] {
            assert!(validate_provider_id(invalid).is_err());
        }
    }

    #[test]
    fn secret_receipt_never_contains_raw_secret_material() {
        let receipt = secret_receipt("openai", true);
        assert_eq!(receipt["configured"], true);
        assert_eq!(receipt["secretRef"], "keychain:openai");
        assert!(receipt.get("secret").is_none());
    }
}
