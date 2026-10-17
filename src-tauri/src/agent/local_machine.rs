use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde::Serialize;

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMusicPlayResult {
    matched: String,
    kind: String,
}

/// Reflexo local tipado para o Apple Music. A consulta segue como argumento
/// do `osascript`, nunca é interpolada no programa AppleScript.
#[tauri::command]
pub fn local_music_play(query: String) -> Result<LocalMusicPlayResult, String> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 120 {
        return Err("Consulta musical inválida".to_string());
    }

    let script = r#"
on run argv
  set searchTerm to item 1 of argv
  tell application "Music"
    set matchingPlaylists to every user playlist whose name contains searchTerm
    if (count matchingPlaylists) > 0 then
      set chosenPlaylist to item 1 of matchingPlaylists
      play chosenPlaylist
      return "playlist" & tab & (name of chosenPlaylist)
    end if

    set matchingTracks to search library playlist 1 for searchTerm only songs
    if (count matchingTracks) > 0 then
      set chosenTrack to item 1 of matchingTracks
      play chosenTrack
      set artistName to artist of chosenTrack
      if artistName is missing value then set artistName to searchTerm
      return "track" & tab & artistName
    end if
    return "not_found" & tab & searchTerm
  end tell
end run
"#;

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .arg("--")
        .arg(query)
        .output()
        .map_err(|error| format!("Falha ao executar o Apple Music: {error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let (kind, matched) = raw.split_once('\t').unwrap_or(("unknown", query));
    if kind == "not_found" {
        return Err(format!("Não encontrei {query} na biblioteca do Apple Music"));
    }
    Ok(LocalMusicPlayResult { matched: matched.to_string(), kind: kind.to_string() })
}
