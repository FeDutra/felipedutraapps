use tauri::Manager;

#[cfg(desktop)]
use std::io::{BufRead, BufReader};
#[cfg(desktop)]
use std::process::Stdio;
#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_shell::ShellExt;

#[cfg(desktop)]
mod agent;
#[cfg(desktop)]
use agent::local_machine::{execute_applescript, local_open_url};

#[cfg(mobile)]
#[tauri::command]
fn local_open_url(_url: &str) -> Result<String, String> {
    Err("Abertura local não está disponível no iPhone.".into())
}

#[cfg(mobile)]
#[tauri::command]
fn execute_applescript(_script: &str) -> Result<String, String> {
    Err("Automação do macOS não está disponível no iPhone.".into())
}

#[cfg(desktop)]
#[tauri::command]
fn execute_shell_command(command: &str) -> Result<String, String> {
    println!("Executing shell command: {}", command);
    match std::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Error: {}\nOutput: {}", stderr, stdout))
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(mobile)]
#[tauri::command]
fn execute_shell_command(_command: &str) -> Result<String, String> {
    Err("Execução local não está disponível no iPhone.".into())
}

#[cfg(desktop)]
#[tauri::command]
fn execute_long_command_stream(app: tauri::AppHandle, command: &str) -> Result<(), String> {
    println!("Executing streaming shell command: {}", command);
    let mut child = std::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("cmd_output", line);
            }
        }
    });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("cmd_output", line);
            }
        }
    });

    std::thread::spawn(move || {
        let _ = child.wait();
        let _ = app.emit("cmd_output_done", ());
    });

    Ok(())
}

#[cfg(mobile)]
#[tauri::command]
fn execute_long_command_stream(_app: tauri::AppHandle, _command: &str) -> Result<(), String> {
    Err("Execução local não está disponível no iPhone.".into())
}

#[cfg(desktop)]
fn start_desktop_voice(app: &tauri::AppHandle) {
    let resource_dir = app
        .path()
        .resource_dir()
        .expect("Failed to get resource dir");
    let model_path = resource_dir.join("resources").join("kokoro-v0_19.onnx");
    let voices_path = resource_dir.join("resources").join("voices.bin");

    println!("Starting Kokoro sidecar with model: {:?}", model_path);

    if !model_path.exists() || !voices_path.exists() {
        eprintln!(
            "Kokoro sidecar resources missing: model_exists={}, voices_exists={}",
            model_path.exists(),
            voices_path.exists()
        );
    } else {
        match app.shell().sidecar("kokoro_runner") {
            Ok(sidecar_command) => {
                let command = sidecar_command
                    .args([model_path.to_str().unwrap(), voices_path.to_str().unwrap()]);
                match command.spawn() {
                    Ok((_rx, _child)) => println!("Kokoro sidecar started successfully."),
                    Err(e) => eprintln!("Failed to spawn Kokoro sidecar: {}", e),
                }
            }
            Err(e) => eprintln!("Failed to create kokoro sidecar command: {}", e),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            local_open_url,
            execute_applescript,
            execute_shell_command,
            execute_long_command_stream
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            start_desktop_voice(app.handle());

            // O microsserviço Node.js do WhatsApp agora roda externamente (via PM2)
            // para garantir persistência independentemente do ciclo de vida da interface.

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
