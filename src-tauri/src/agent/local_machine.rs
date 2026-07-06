use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn local_open_url(app: AppHandle, url: String) -> Result<(), String> {
    println!("Recebido comando local_open_url para URL: {}", url);
    app.shell().open(url.as_str(), None).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn execute_applescript(script: String) -> Result<String, String> {
    println!("Executando AppleScript...");
    
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Falha ao executar osascript: {}", e))?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(result)
    } else {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Erro no AppleScript: {}", error))
    }
}
