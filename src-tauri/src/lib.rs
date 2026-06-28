use std::process::{Command, Stdio};
use std::io::Write;
use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
fn synthesize_piper(text: String) -> Result<String, String> {
  let piper_path = "/Users/felipedutra/Projetos/eden-terra/scratch-piper/venv/bin/piper";
  let model_path = "/Users/felipedutra/Projetos/eden-terra/scratch-piper/pt_BR-edresson-low.onnx";

  let mut child = Command::new(piper_path)
    .args(&["-m", model_path, "-f", "-"])
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("Failed to spawn Piper process: {}", e))?;

  {
    let mut stdin = child.stdin.take().ok_or("Failed to open stdin")?;
    stdin.write_all(text.as_bytes()).map_err(|e| format!("Failed to write to stdin: {}", e))?;
  }

  let output = child.wait_with_output().map_err(|e| format!("Failed to read stdout: {}", e))?;

  if !output.status.success() {
    let err_msg = String::from_utf8_lossy(&output.stderr);
    return Err(format!("Piper process failed: {}", err_msg));
  }

  let b64 = general_purpose::STANDARD.encode(&output.stdout);
  Ok(b64)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    .invoke_handler(tauri::generate_handler![synthesize_piper])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
