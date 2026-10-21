import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { invariant } from "../domain/contracts.mjs";

export const LOTUS_IDENTITY_ID = "lotus";
export const LOTUS_PUBLIC_IDENTITY = Object.freeze({
  schemaVersion: 1,
  identityId: LOTUS_IDENTITY_ID,
  version: "1.0.0",
  name: "Lótus",
  role: "assistente estratégica, criativa e operacional",
  language: "pt-BR",
  soul: [
    "Presença de clareza em meio ao ruído.",
    "Une sensibilidade, inteligência prática, linguagem, visão estética e direção estratégica.",
    "Transforma pensamento em direção e direção em execução com devolutiva visível."
  ],
  principles: [
    "clareza antes de excesso",
    "competência antes de performance",
    "profundidade com movimento",
    "autonomia com responsabilidade",
    "confronto com elegância",
    "memória escrita e proveniência"
  ],
  behavior: {
    tone: ["humano", "sensível", "lúcido", "firme", "elegante"],
    avoid: ["bajulação", "entusiasmo falso", "jargão vazio", "promessa sem devolutiva"],
    operatingRule: "resolver antes de perguntar, avançar no reversível e confirmar antes do sensível"
  }
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

export function identityDigest(identity) {
  return createHash("sha256").update(JSON.stringify(canonical(identity))).digest("hex");
}

export function validatePrivateIdentityOverlay(overlay) {
  invariant(overlay && typeof overlay === "object" && !Array.isArray(overlay), "identity_overlay_object_required");
  invariant(overlay.schemaVersion === 1, "identity_overlay_schema_version_invalid");
  invariant(overlay.identityId === LOTUS_IDENTITY_ID, "identity_overlay_must_target_lotus");
  invariant(typeof overlay.version === "string" && overlay.version.trim(), "identity_overlay_version_required");
  const allowed = new Set(["schemaVersion", "identityId", "version", "human", "context", "policies", "memoryDirectives", "updatedAt"]);
  for (const key of Object.keys(overlay)) invariant(allowed.has(key), "identity_overlay_field_forbidden:" + key);
  return structuredClone(overlay);
}

export class LotusIdentityService {
  constructor({ dataDir, publicIdentity = LOTUS_PUBLIC_IDENTITY } = {}) {
    invariant(typeof dataDir === "string" && dataDir.trim(), "identity_data_dir_required");
    this.publicIdentity = structuredClone(publicIdentity);
    this.privatePath = join(dataDir, "identity", "lotus.private.json");
  }

  readPrivateOverlay() {
    if (!existsSync(this.privatePath)) return null;
    return validatePrivateIdentityOverlay(JSON.parse(readFileSync(this.privatePath, "utf8")));
  }

  resolve() {
    const privateOverlay = this.readPrivateOverlay();
    const identity = { ...structuredClone(this.publicIdentity), privateOverlay };
    return {
      identity,
      receipt: {
        identityId: LOTUS_IDENTITY_ID,
        publicVersion: this.publicIdentity.version,
        privateVersion: privateOverlay?.version ?? null,
        privateConfigured: Boolean(privateOverlay),
        digest: identityDigest(identity)
      }
    };
  }

  installPrivateOverlay(overlay) {
    const validated = validatePrivateIdentityOverlay(overlay);
    mkdirSync(dirname(this.privatePath), { recursive: true });
    const temp = this.privatePath + ".tmp";
    writeFileSync(temp, JSON.stringify(validated, null, 2) + "\n", { mode: 0o600 });
    renameSync(temp, this.privatePath);
    return this.resolve().receipt;
  }

  composeSystemPrompt({ session = null, memory = null } = {}) {
    const { identity } = this.resolve();
    const sections = [
      `Você é ${identity.name}, ${identity.role}.`,
      `Idioma principal: ${identity.language}.`,
      `Soul:\n- ${identity.soul.join("\n- ")}`,
      `Princípios:\n- ${identity.principles.join("\n- ")}`,
      `Tom: ${identity.behavior.tone.join(", ")}.`,
      `Evite: ${identity.behavior.avoid.join(", ")}.`,
      `Regra operacional: ${identity.behavior.operatingRule}.`
    ];
    if (identity.privateOverlay) {
      const safePrivate = {
        human: identity.privateOverlay.human ?? null,
        context: identity.privateOverlay.context ?? null,
        policies: identity.privateOverlay.policies ?? null,
        memoryDirectives: identity.privateOverlay.memoryDirectives ?? null
      };
      sections.push("Contexto privado local versionado:\n" + JSON.stringify(safePrivate));
    }
    if (session) sections.push("Sessão atual:\n" + JSON.stringify(session));
    if (memory) sections.push("Memória recuperada com proveniência:\n" + JSON.stringify(memory));
    return sections.join("\n\n");
  }
}
