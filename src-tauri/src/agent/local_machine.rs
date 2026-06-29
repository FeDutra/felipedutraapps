use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn local_open_url(app: AppHandle, url: String) -> Result<(), String> {
    println!("Recebido comando local_open_url para URL: {}", url);
    app.shell().open(url.as_str(), None).map_err(|e| e.to_string())?;
    Ok(())
}
