export const connectorCapabilities = Object.freeze({
  notion: Object.freeze([
    "tool.asdk_app_69c18c28f1188191bf5b8445c4ab0a2e.connector_tool",
    "tool.codex_apps.notion.*",
  ]),
  gmail: Object.freeze([
    "tool.connector_2128aebfecb84f64a069897515042a44.connector_tool",
    "tool.codex_apps.gmail.*",
  ]),
  calendar: Object.freeze([
    "tool.connector_947e0d954944416db111db556030eea6.connector_tool",
    "tool.codex_apps.google_calendar.*",
  ]),
  drive: Object.freeze([
    "tool.connector_5f3c8c41a1e54ad7a76272c89e2554fa.connector_tool",
    "tool.codex_apps.google_drive.*",
  ]),
  whatsapp: Object.freeze(["tool.whatsapp.read", "tool.whatsapp.prepare", "tool.whatsapp.send"]),
  devices: Object.freeze(["tool.devices.status"]),
  jobs: Object.freeze(["tool.jobs.read", "tool.jobs.write", "tool.jobs.run"]),
});

function capabilities(...groups) {
  return [...new Set(groups.flatMap(group => connectorCapabilities[group] || []))];
}

export const agentToolGrantMatrix = Object.freeze({
  agent_lotus: capabilities("notion", "gmail", "calendar", "drive", "whatsapp", "devices", "jobs"),
  "agent_lotus-conversa": capabilities("notion", "drive"),
  "agent_lotus-crm-atendimento": capabilities("notion", "gmail", "calendar", "drive", "whatsapp"),
  agent_designer: capabilities("notion", "drive"),
  agent_audiovisual: capabilities("notion", "drive"),
  "agent_engenharia-produto": capabilities("notion", "drive", "devices", "jobs"),
  agent_comunicacao: capabilities("notion", "gmail", "drive", "whatsapp"),
  "agent_experiencia-cliente": capabilities("notion", "gmail", "calendar", "drive", "whatsapp"),
  agent_trafego: capabilities("notion", "gmail", "drive"),
  agent_financeiro: capabilities("notion", "gmail", "calendar", "drive"),
  "agent_social-media": capabilities("notion", "gmail", "drive", "whatsapp"),
});
