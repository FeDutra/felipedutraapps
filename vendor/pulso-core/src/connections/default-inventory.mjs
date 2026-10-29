export const DEFAULT_CONNECTION_INVENTORY_ID = "pulso-access-inventory-2026-10-29-v1";

export const DEFAULT_CONNECTIONS = Object.freeze([
  { connectionId: "notion-fe", service: "notion", label: "Notion · Fe", principal: "felipemachadodutra@gmail.com", tenant: "Fe", adapter: "external_mcp_transition", credentialSlot: "mcp:notion-fe", capabilities: ["pages.read", "pages.write", "search"], status: "transition", source: "legacy-mcp-audit-2026-10-29" },
  { connectionId: "notion-despertar", service: "notion", label: "Notion · Despertar", principal: "felipemachadodutra@gmail.com", tenant: "Despertar", adapter: "codex_apps", credentialSlot: "codex:fe-pessoal:notion", capabilities: ["pages.read", "pages.write", "search"], status: "available", source: "pulso-runtime-audit-2026-10-28" },
  { connectionId: "notion-mila", service: "notion", label: "Notion · MILA MIRANDA", principal: "felipemachadodutra@gmail.com", tenant: "MILA MIRANDA", adapter: "external_mcp_transition", credentialSlot: "mcp:notion-mila", capabilities: ["pages.read", "pages.write", "search"], status: "transition", source: "legacy-mcp-audit-2026-10-29" },
  { connectionId: "google-pessoal", service: "google", label: "Google · pessoal", principal: "felipemachadodutra@gmail.com", adapter: "codex_apps", credentialSlot: "codex:fe-pessoal:google-personal", capabilities: ["calendar.read", "calendar.write", "drive.read", "drive.write", "gmail.read", "gmail.write"], status: "needs_auth", source: "codex-app-audit-2026-10-29", metadata: { reason: "confirmado fora do perfil instalado da PULSO; exige autenticação própria" } },
  { connectionId: "google-acessos-despertar", service: "google", label: "Google · Acessos Despertar", principal: "acessos@adespertar.com.br", adapter: "codex_apps", credentialSlot: "codex:fe-pessoal:google-despertar", capabilities: ["calendar.read", "calendar.write", "drive.read", "drive.write", "gmail.read", "gmail.write"], status: "available", source: "pulso-runtime-audit-2026-10-28" },
  { connectionId: "google-felipe-despertar", service: "google", label: "Google · Felipe Despertar", principal: "felipe@adespertar.com.br", adapter: "codex_apps", credentialSlot: "codex:fe-pessoal:google-felipe-despertar", capabilities: ["calendar.read", "calendar.write", "drive.read", "drive.write", "gmail.read", "gmail.write"], status: "needs_auth", source: "filesystem-presence-only-2026-10-28" },
  { connectionId: "whatsapp-fe", service: "whatsapp", label: "WhatsApp · Fe", adapter: "pulso_operator", credentialSlot: "keychain:pulso-operator", capabilities: ["messages.read", "messages.prepare", "messages.send"], status: "available", source: "pulso-operator-canary-2026-10-28" },
  { connectionId: "scheduler-oficial", service: "jobs", label: "Agendador oficial", adapter: "pulso_operator", credentialSlot: "keychain:pulso-operator", capabilities: ["jobs.read", "jobs.create", "jobs.update", "jobs.run"], status: "available", source: "pulso-operator-canary-2026-10-28" },
  { connectionId: "fe-macs", service: "devices", label: "Fe Macs", adapter: "pulso_operator", credentialSlot: "keychain:pulso-operator", capabilities: ["devices.status", "devices.execute_internal"], status: "available", source: "trusted-pool" },
  { connectionId: "open-design-imac", service: "open_design", label: "Open Design · iMac", adapter: "opendesign_backstage", capabilities: ["projects.read", "projects.write", "projects.promote"], status: "degraded", source: "opendesign-diagnostic-2026-10-28", metadata: { reason: "capacidade comprovada no iMac; ainda não exposta como ferramenta do Core" } },
  { connectionId: "vps-admin", service: "vps", label: "VPS · administração governada", adapter: "unassigned", capabilities: ["health.read", "services.read", "storage.read"], status: "needs_auth", source: "vps-audit-2026-10-28" },
  { connectionId: "telegram-fe", service: "telegram", label: "Telegram · Fe", adapter: "external_channel_transition", credentialSlot: "external:telegram", capabilities: ["messages.receive", "messages.send"], status: "transition", source: "legacy-channel-inventory-2026-10-29" },
  { connectionId: "matrix-fio", service: "matrix", label: "Matrix · FIO", principal: "@lotus:fio.felipedutra.com", adapter: "external_channel_transition", credentialSlot: "external:matrix-fio", capabilities: ["messages.receive", "messages.send", "encryption"], status: "transition", source: "legacy-channel-inventory-2026-10-29" },
  { connectionId: "github-fe", service: "github", label: "GitHub · FeDutra", principal: "FeDutra", adapter: "codex_apps", credentialSlot: "codex:fe-pessoal:github", capabilities: ["repositories.read", "issues.read", "pull_requests.read", "workflows.read"], status: "transition", source: "direct-session-audit-2026-10-29", metadata: { reason: "identidade confirmada fora do perfil instalado; requer prova dentro da PULSO" } },
  { connectionId: "rede-fe-sync", service: "sync", label: "Rede Fe · sincronização entre Macs", adapter: "peer_folder_transport", capabilities: ["events.push", "events.pull", "conflicts.quarantine"], status: "available", source: "core-sync-canary-2026-10-28" },
  { connectionId: "ollama-imac", service: "ollama", label: "Ollama · iMac", adapter: "local_model_transition", capabilities: ["models.list", "models.complete"], status: "degraded", source: "imac-runtime-audit-2026-10-28", metadata: { reason: "serviço local respondeu; ainda não vinculado como adapter do Core" } },
  { connectionId: "transcricao-imac", service: "transcription", label: "Transcrição local · iMac", adapter: "local_service_transition", capabilities: ["audio.transcribe"], status: "degraded", source: "imac-runtime-audit-2026-10-28", metadata: { reason: "endpoint saudável; ferramenta do Core ainda não materializada" } },
  { connectionId: "arc-fe-macs", service: "browser", label: "Arc · Fe Macs", adapter: "hermes_transition", capabilities: ["pages.read", "pages.operate_authenticated"], status: "degraded", source: "browser-contract", metadata: { reason: "rota operacional definida; executor canônico ainda não exposto no Core" } },
  { connectionId: "turbo-cloud-fe", service: "hosting", label: "Turbo Cloud · Fe", adapter: "hosting_transition", capabilities: ["panel.read", "sites.health", "files.read"], status: "needs_auth", source: "hosting-audit-2026-10-28" },
  { connectionId: "microsoft-fe", service: "microsoft", label: "Microsoft · Fe", adapter: "external_connector_transition", capabilities: ["mail.read", "calendar.read", "files.read"], status: "unknown", source: "capability-inventory-2026-10-29", metadata: { reason: "capacidade instalada no ecossistema; identidade e sessão ainda não comprovadas" } },
]);

export const DEFAULT_CONNECTION_BINDINGS = Object.freeze([
  { scopeType: "system", scopeId: "global", service: "notion", connectionId: "notion-fe", priority: 100 },
  { scopeType: "area", scopeId: "area_pulso", service: "notion", connectionId: "notion-fe", priority: 10 },
  { scopeType: "area", scopeId: "area_despertar", service: "notion", connectionId: "notion-despertar", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "google", connectionId: "google-pessoal", priority: 100 },
  { scopeType: "area", scopeId: "area_despertar", service: "google", connectionId: "google-acessos-despertar", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "whatsapp", connectionId: "whatsapp-fe", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "jobs", connectionId: "scheduler-oficial", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "devices", connectionId: "fe-macs", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "telegram", connectionId: "telegram-fe", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "matrix", connectionId: "matrix-fio", priority: 10 },
  { scopeType: "area", scopeId: "area_pulso", service: "open_design", connectionId: "open-design-imac", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "github", connectionId: "github-fe", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "sync", connectionId: "rede-fe-sync", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "ollama", connectionId: "ollama-imac", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "transcription", connectionId: "transcricao-imac", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "browser", connectionId: "arc-fe-macs", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "hosting", connectionId: "turbo-cloud-fe", priority: 10 },
  { scopeType: "system", scopeId: "global", service: "microsoft", connectionId: "microsoft-fe", priority: 10 },
]);

export const DEFAULT_CONNECTION_INVENTORY = Object.freeze({
  inventoryId: DEFAULT_CONNECTION_INVENTORY_ID,
  connections: DEFAULT_CONNECTIONS,
  bindings: DEFAULT_CONNECTION_BINDINGS,
});
