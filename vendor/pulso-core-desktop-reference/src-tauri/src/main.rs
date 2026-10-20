// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use parking_lot::Mutex;
use serde_json::{json, Value};
use std::fs::create_dir_all;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use tauri::{AppHandle, Manager, State};

struct BridgeProcess {
    child: Child,
    stdin: ChildStdin,
    reader: BufReader<ChildStdout>,
}

impl BridgeProcess {
    fn request(&mut self, request: &Value) -> Result<Value, String> {
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
struct BridgeManager {
    process: Option<BridgeProcess>,
}

impl BridgeManager {
    fn ensure(&mut self, app: &AppHandle) -> Result<&mut BridgeProcess, String> {
        if self.process.is_none() {
            let current_exe = std::env::current_exe()
                .map_err(|e| format!("Failed to resolve current exe: {}", e))?;
            let exe_parent = current_exe
                .parent()
                .ok_or_else(|| "Failed to resolve parent directory of current exe".to_string())?;

            let mut node_bin = exe_parent.join("pulso-node");
            if !node_bin.exists() {
                let fallback = exe_parent.join("pulso-node-x86_64-apple-darwin");
                if fallback.exists() {
                    node_bin = fallback;
                }
            }

            if !node_bin.exists() {
                return Err("Bundled Node sidecar not found".to_string());
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource dir: {}", e))?;
            let script_path = resource_dir
                .join("resources")
                .join("core")
                .join("desktop")
                .join("bridge.mjs");

            if !script_path.exists() {
                return Err("Bundled Core bridge resource not found".to_string());
            }

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;

            create_dir_all(&app_data_dir).map_err(|e| {
                format!(
                    "Failed to create app data directory at {:?}: {}",
                    app_data_dir, e
                )
            })?;

            let mut cmd = Command::new(&node_bin);
            cmd.arg(&script_path)
                .arg("--data-dir")
                .arg(&app_data_dir)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null());

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

            self.process = Some(BridgeProcess {
                child,
                stdin,
                reader,
            });
        }

        self.process
            .as_mut()
            .ok_or_else(|| "Bridge process is unexpectedly unavailable".to_string())
    }

    fn send(&mut self, app: &AppHandle, request: &Value) -> Result<Value, String> {
        let process = self.ensure(app)?;
        process.request(request)
    }

    fn shutdown(&mut self) -> Result<Value, String> {
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

const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

fn validate_provider_id(provider_id: &str) -> Result<(), String> {
    if provider_id.is_empty() {
        return Err("Provider ID must not be empty".to_string());
    }
    if provider_id.len() > 80 {
        return Err("Provider ID length must not exceed 80 characters".to_string());
    }
    if !provider_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(
            "Provider ID may only contain ASCII alphanumeric characters, dashes, underscores, and dots"
                .to_string(),
        );
    }
    Ok(())
}

fn validate_secret_value(secret: &str) -> Result<(), String> {
    if secret.trim().len() < 4 {
        return Err("Secret must be at least 4 characters long after trimming".to_string());
    }
    Ok(())
}

fn keychain_service_name(provider_id: &str) -> String {
    format!(
        "com.felipedutraapps.pulso.core-preview.provider.{}",
        provider_id
    )
}

fn keychain_coordinates(provider_id: &str) -> Result<(String, String), String> {
    validate_provider_id(provider_id)?;
    Ok((keychain_service_name(provider_id), provider_id.to_string()))
}

fn interpret_keychain_lookup_status(result: Result<(), i32>) -> Result<bool, String> {
    match result {
        Ok(()) => Ok(true),
        Err(ERR_SEC_ITEM_NOT_FOUND) => Ok(false),
        Err(_) => Err("Failed to query secret status in keychain".to_string()),
    }
}

fn interpret_keychain_delete_status(result: Result<(), i32>) -> Result<(), String> {
    match result {
        Ok(()) | Err(ERR_SEC_ITEM_NOT_FOUND) => Ok(()),
        Err(_) => Err("Failed to delete secret from keychain".to_string()),
    }
}

fn build_secret_stored_receipt(provider_id: &str) -> Value {
    json!({
        "providerId": provider_id,
        "configured": true,
        "secretRef": format!("keychain:{}", provider_id)
    })
}

fn build_secret_status_receipt(provider_id: &str, configured: bool) -> Value {
    json!({
        "providerId": provider_id,
        "configured": configured
    })
}

#[cfg(target_os = "macos")]
fn keychain_store_secret(provider_id: &str, secret: &[u8]) -> Result<(), String> {
    let (service, account) = keychain_coordinates(provider_id)?;
    security_framework::passwords::set_generic_password(&service, &account, secret)
        .map_err(|_| "Failed to store secret in keychain".to_string())
}

#[cfg(not(target_os = "macos"))]
fn keychain_store_secret(provider_id: &str, _secret: &[u8]) -> Result<(), String> {
    let _ = keychain_coordinates(provider_id)?;
    Err("Failed to store secret in keychain: native macOS Keychain unavailable".to_string())
}

#[cfg(target_os = "macos")]
fn keychain_has_secret(provider_id: &str) -> Result<bool, String> {
    let (service, account) = keychain_coordinates(provider_id)?;
    let lookup = security_framework::passwords::get_generic_password(&service, &account)
        .map(|_| ())
        .map_err(|err| err.code());
    interpret_keychain_lookup_status(lookup)
}

#[cfg(not(target_os = "macos"))]
fn keychain_has_secret(provider_id: &str) -> Result<bool, String> {
    let _ = keychain_coordinates(provider_id)?;
    Err("Failed to query secret status in keychain: native macOS Keychain unavailable".to_string())
}

#[cfg(target_os = "macos")]
fn keychain_delete_secret(provider_id: &str) -> Result<(), String> {
    let (service, account) = keychain_coordinates(provider_id)?;
    let deletion = security_framework::passwords::delete_generic_password(&service, &account)
        .map_err(|err| err.code());
    interpret_keychain_delete_status(deletion)
}

#[cfg(not(target_os = "macos"))]
fn keychain_delete_secret(provider_id: &str) -> Result<(), String> {
    let _ = keychain_coordinates(provider_id)?;
    Err("Failed to delete secret from keychain: native macOS Keychain unavailable".to_string())
}

#[tauri::command]
fn bridge_request(
    app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
    request: Value,
) -> Result<Value, String> {
    let mut manager = state.lock();
    manager.send(&app, &request)
}

#[tauri::command]
fn store_provider_secret(
    app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
    provider_id: String,
    secret: String,
) -> Result<Value, String> {
    validate_provider_id(&provider_id)?;
    validate_secret_value(&secret)?;
    keychain_store_secret(&provider_id, secret.as_bytes())?;

    let inject_request = json!({
        "requestId": format!("native-keychain-{}", provider_id),
        "method": "provider.secret.inject",
        "params": {
            "providerId": provider_id,
            "secret": secret
        }
    });

    let mut manager = state.lock();
    let response = manager.send(&app, &inject_request)?;

    if response.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        return Err("Core refused the Keychain reference".to_string());
    }

    Ok(build_secret_stored_receipt(&provider_id))
}

#[tauri::command]
fn provider_secret_status(provider_id: String) -> Result<Value, String> {
    validate_provider_id(&provider_id)?;
    let configured = keychain_has_secret(&provider_id)?;

    Ok(build_secret_status_receipt(&provider_id, configured))
}

#[tauri::command]
fn delete_provider_secret(provider_id: String) -> Result<Value, String> {
    validate_provider_id(&provider_id)?;
    keychain_delete_secret(&provider_id)?;

    Ok(build_secret_status_receipt(&provider_id, false))
}

#[tauri::command]
fn shutdown_bridge(
    _app: AppHandle,
    state: State<'_, Mutex<BridgeManager>>,
) -> Result<Value, String> {
    let mut manager = state.lock();
    manager.shutdown()
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(BridgeManager::default()))
        .invoke_handler(tauri::generate_handler![
            bridge_request,
            store_provider_secret,
            provider_secret_status,
            delete_provider_secret,
            shutdown_bridge
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_provider_id_accepts_valid_identifiers() {
        assert!(validate_provider_id("openai").is_ok());
        assert!(validate_provider_id("anthropic-claude_3.5").is_ok());
        assert!(validate_provider_id("local.provider-01").is_ok());
        let max_len_id = "a".repeat(80);
        assert!(validate_provider_id(&max_len_id).is_ok());
    }

    #[test]
    fn validate_provider_id_rejects_empty_and_overlong_identifiers() {
        assert_eq!(
            validate_provider_id(""),
            Err("Provider ID must not be empty".to_string())
        );
        let overlong_id = "a".repeat(81);
        assert_eq!(
            validate_provider_id(&overlong_id),
            Err("Provider ID length must not exceed 80 characters".to_string())
        );
    }

    #[test]
    fn validate_provider_id_rejects_disallowed_characters() {
        for invalid in [
            "open ai",
            "../openai",
            "provider/secret",
            "provider:secret",
            "provider;rm",
            "público",
        ] {
            assert!(
                validate_provider_id(invalid).is_err(),
                "expected provider_id {:?} to be rejected",
                invalid
            );
        }
    }

    #[test]
    fn validate_secret_value_enforces_trimmed_length_without_leaking_secret() {
        assert!(validate_secret_value("abcd").is_ok());
        assert!(validate_secret_value("   abcd   ").is_ok());

        for invalid_secret in ["", "   ", "xy!", "  abc  "] {
            let err = validate_secret_value(invalid_secret).unwrap_err();
            assert_eq!(
                err,
                "Secret must be at least 4 characters long after trimming"
            );
            if !invalid_secret.trim().is_empty() {
                assert!(!err.contains(invalid_secret.trim()));
            }
        }
    }

    #[test]
    fn keychain_coordinates_preserve_service_and_account_contract() {
        let (service, account) = keychain_coordinates("openai-prod_1.0").unwrap();
        assert_eq!(
            service,
            "com.felipedutraapps.pulso.core-preview.provider.openai-prod_1.0"
        );
        assert_eq!(account, "openai-prod_1.0");
        assert!(keychain_coordinates("invalid/provider").is_err());
    }

    #[test]
    fn keychain_status_and_delete_interpreters_handle_not_found_idempotently() {
        assert_eq!(interpret_keychain_lookup_status(Ok(())), Ok(true));
        assert_eq!(
            interpret_keychain_lookup_status(Err(ERR_SEC_ITEM_NOT_FOUND)),
            Ok(false)
        );
        assert!(interpret_keychain_lookup_status(Err(-25293)).is_err());

        assert_eq!(interpret_keychain_delete_status(Ok(())), Ok(()));
        assert_eq!(
            interpret_keychain_delete_status(Err(ERR_SEC_ITEM_NOT_FOUND)),
            Ok(())
        );
        assert!(interpret_keychain_delete_status(Err(-25293)).is_err());
    }

    #[test]
    fn receipts_never_expose_raw_secret() {
        let stored = build_secret_stored_receipt("openai");
        assert_eq!(
            stored,
            json!({
                "providerId": "openai",
                "configured": true,
                "secretRef": "keychain:openai"
            })
        );
        assert!(stored.get("secret").is_none());

        let status_true = build_secret_status_receipt("openai", true);
        assert_eq!(
            status_true,
            json!({
                "providerId": "openai",
                "configured": true
            })
        );

        let status_false = build_secret_status_receipt("openai", false);
        assert_eq!(
            status_false,
            json!({
                "providerId": "openai",
                "configured": false
            })
        );
    }
}
