use serde::Serialize;
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::time::{Duration, Instant};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPresenceReadResult {
    capability: String,
    ok: bool,
    duration_ms: u128,
    architecture: String,
    hermes_profile_ready: bool,
    hermes_gateway_active: bool,
    ollama_active: bool,
    kokoro_active: bool,
    local_stt_active: bool,
    whatsapp_bridge_active: bool,
}

fn loopback_port_open(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(180)).is_ok()
}

fn home_dir() -> Option<String> {
    std::env::var("HOME").ok().filter(|value| !value.trim().is_empty())
}

/// Broker local de leitura da Presença.
///
/// A superfície é deliberadamente enumerada: o frontend não envia shell,
/// AppleScript ou caminho arbitrário. Novas capacidades entram uma a uma,
/// com contrato, risco e teste próprios.
#[tauri::command]
pub fn local_presence_read(capability: String) -> Result<LocalPresenceReadResult, String> {
    let started_at = Instant::now();
    if capability != "runtime_health" {
        return Err(format!("Capacidade local não permitida: {capability}"));
    }

    let hermes_profile_ready = home_dir()
        .map(|home| Path::new(&home).join(".hermes/profiles/pulso/config.yaml").is_file())
        .unwrap_or(false);

    // O gateway do perfil PULSO deve permanecer desligado na canária. A porta
    // 9119 aberta significa backend Hermes ativo, não requisito de saúde.
    let hermes_gateway_active = loopback_port_open(9119);
    let ollama_active = loopback_port_open(11434);
    let kokoro_active = loopback_port_open(14321);
    let local_stt_active = loopback_port_open(14323);
    let whatsapp_bridge_active = loopback_port_open(3005);

    Ok(LocalPresenceReadResult {
        capability,
        ok: true,
        duration_ms: started_at.elapsed().as_millis(),
        architecture: std::env::consts::ARCH.to_string(),
        hermes_profile_ready,
        hermes_gateway_active,
        ollama_active,
        kokoro_active,
        local_stt_active,
        whatsapp_bridge_active,
    })
}

#[cfg(test)]
mod tests {
    use super::local_presence_read;

    #[test]
    fn rejects_unknown_capabilities() {
        assert!(local_presence_read("shell".to_string()).is_err());
    }
}
