use serde_json::{json, Value};
use std::fs::create_dir_all;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub const SIDECAR_BIN_NAME: &str = "pulso-node";
pub const SIDECAR_TRIPLE_BIN_NAME: &str = "pulso-node-x86_64-apple-darwin";

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

pub fn resolve_bridge_script_path(resource_dir: &Path) -> Result<PathBuf, String> {
    let candidates = [
        resource_dir
            .join("resources")
            .join("core")
            .join("desktop")
            .join("bridge.mjs"),
        resource_dir
            .join("core")
            .join("desktop")
            .join("bridge.mjs"),
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{File, remove_dir_all};
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
}
