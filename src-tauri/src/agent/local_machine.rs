use serde::Serialize;
use std::process::Command;

const ARC_APP_PATH: &str = "/Applications/Arc.app";

fn validate_external_url(url: &str) -> Result<&str, String> {
    let trimmed = url.trim();
    if trimmed.len() > 8192 {
        return Err("URL externa excede o limite permitido".to_string());
    }
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Apenas URLs HTTP(S) podem ser abertas externamente".to_string());
    }
    Ok(trimmed)
}

#[tauri::command]
pub fn local_open_url(url: String) -> Result<(), String> {
    let url = validate_external_url(&url)?;
    if !std::path::Path::new(ARC_APP_PATH).exists() {
        return Err(
            "Arc não está instalado neste Mac; a PULSO não abrirá outro navegador como fallback"
                .to_string(),
        );
    }

    // O login deve acontecer no navegador operacional autorizado, nunca
    // dentro da WKWebView da PULSO. Não registramos a URL porque fluxos OAuth
    // carregam parâmetros efêmeros sensíveis.
    let output = Command::new("/usr/bin/open")
        .arg("-a")
        .arg("Arc")
        .arg(url)
        .output()
        .map_err(|error| format!("Falha ao abrir o Arc: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            "O macOS recusou a abertura do Arc".to_string()
        } else {
            format!("O macOS recusou a abertura do Arc: {detail}")
        });
    }
    Ok(())
}

#[cfg(test)]
mod external_url_tests {
    use super::validate_external_url;

    #[test]
    fn accepts_only_http_and_https_urls() {
        assert_eq!(
            validate_external_url("https://auth.openai.com/oauth/authorize").unwrap(),
            "https://auth.openai.com/oauth/authorize"
        );
        assert!(validate_external_url("http://127.0.0.1:1455/auth/callback").is_ok());
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("file:///tmp/private").is_err());
        assert!(validate_external_url("tauri://localhost/pulso/live").is_err());
    }
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
        return Err(format!(
            "Não encontrei {query} na biblioteca do Apple Music"
        ));
    }
    Ok(LocalMusicPlayResult {
        matched: matched.to_string(),
        kind: kind.to_string(),
    })
}
