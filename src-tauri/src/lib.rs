use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
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
      let model_path = resource_dir.join("kokoro-v1.0.onnx");
      let voices_path = resource_dir.join("voices-v1.0.bin");

      println!("Starting Kokoro sidecar with model: {:?}", model_path);

      let sidecar_command = app.shell().sidecar("kokoro_runner")
        .expect("Failed to create kokoro sidecar command")
        .args([model_path.to_str().unwrap(), voices_path.to_str().unwrap()]);
        
      let (_rx, _child) = sidecar_command.spawn().expect("Failed to spawn Kokoro sidecar");

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
