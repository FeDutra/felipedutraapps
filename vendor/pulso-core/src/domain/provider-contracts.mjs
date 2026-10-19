import { invariant } from "./assertions.mjs";

export const PROVIDER_TYPES = Object.freeze(new Set(["model", "executor"]));

export function validateProviderBinding(binding) {
  invariant(binding, "binding_required");
  invariant(typeof binding === "object", "binding_must_be_object");
  invariant(PROVIDER_TYPES.has(binding.providerType), "invalid_provider_type:" + binding.providerType);
  invariant(typeof binding.providerId === "string" && binding.providerId.length > 0, "provider_id_required");
  invariant(typeof binding.connectionId === "string" && binding.connectionId.length > 0, "connection_id_required");
  invariant("externalRunId" in binding, "external_run_id_field_required");
  invariant("externalSessionId" in binding, "external_session_id_field_required");
  invariant(typeof binding.boundAt === "string" && binding.boundAt.length > 0, "bound_at_required");
  invariant(binding.metadata && typeof binding.metadata === "object", "binding_metadata_required");
  return binding;
}

/**
 * Deeply verifies that external IDs do not leak into Pulso domain entities
 * (turn, session, run, event, artifact) outside of providerBinding or metadata.external.
 */
export function assertExternalIdsConfined(target, externalPrefixes = ["openclaw_", "claw_", "ext_", "external_"]) {
  const seen = new Set();
  const allowedKeys = new Set([
    "providerBinding",
    "providerId",
    "executorProviderId",
    "modelProviderId"
  ]);

  function scan(value, path = "", parentKey = "") {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    // providerBinding and metadata.external are the sole authorized boundaries for external IDs
    if (
      path.endsWith("providerBinding") ||
      path.includes("providerBinding.") ||
      path.endsWith("metadata.external") ||
      path.includes("metadata.external.")
    ) {
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        scan(value[i], `${path}[${i}]`, parentKey);
      }
      return;
    }

    for (const [key, val] of Object.entries(value)) {
      if (allowedKeys.has(key)) {
        continue;
      }
      // An actor of kind 'provider' has id referencing the provider's registered name
      if (key === "id" && value.kind === "provider") {
        continue;
      }
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof val === "string") {
        for (const prefix of externalPrefixes) {
          if (val.toLowerCase().startsWith(prefix.toLowerCase())) {
            throw new Error(`external_id_leakage_detected: '${val}' at path '${currentPath}'`);
          }
        }
      } else if (typeof val === "object" && val !== null) {
        scan(val, currentPath, key);
      }
    }
  }

  scan(target);
  return true;
}

export class ModelProvider {
  constructor(id, label = id) {
    invariant(id && typeof id === "string", "provider_id_required");
    this.id = id;
    this.label = label;
  }

  async capabilities() {
    throw new Error("capabilities_not_implemented");
  }

  async complete(request) {
    throw new Error("complete_not_implemented");
  }

  async health() {
    return { status: "healthy", providerId: this.id };
  }
}

export class ExecutorProvider {
  constructor(id) {
    invariant(id && typeof id === "string", "provider_id_required");
    this.id = id;
  }

  async capabilities() {
    throw new Error("capabilities_not_implemented");
  }

  async submit(request) {
    throw new Error("submit_not_implemented");
  }

  async *observe(binding) {
    throw new Error("observe_not_implemented");
  }

  async steer(binding, instruction) {
    throw new Error("steer_not_implemented");
  }

  async cancel(binding, reason) {
    throw new Error("cancel_not_implemented");
  }

  async collect(binding) {
    throw new Error("collect_not_implemented");
  }

  async health() {
    return { status: "healthy", providerId: this.id };
  }
}
