fn main() {
  const COMMANDS: &[&str] = &[
    "local_open_url",
    "execute_applescript",
    "local_music_play",
    "execute_shell_command",
    "execute_long_command_stream",
    "desktop_boot_probe",
    "local_presence_read",
    "local_device_origin_status",
    "local_device_origin_assert",
    "voice_recording_begin",
    "voice_recording_append",
    "voice_recording_finalize",
    "voice_recording_mark",
    "voice_recording_recover_incomplete",
    "ensure_kokoro_sidecar",
    "bridge_request",
    "store_provider_secret",
    "hydrate_provider_secret",
    "provider_secret_status",
    "delete_provider_secret",
    "core_canary_rendered",
    "shutdown_bridge",
  ];

  tauri_build::try_build(
    tauri_build::Attributes::new()
      .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
  )
  .expect("Tauri build configuration should be valid");
}
