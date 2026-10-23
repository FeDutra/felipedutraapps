import { existsSync, readFileSync } from "node:fs";
import { invariant } from "../domain/assertions.mjs";
import { computeBlueprintHash } from "./agent-contracts.mjs";

const IMPORT_ACTOR = Object.freeze({ kind: "import", id: "pulso-constellation-importer" });

export class ConstellationImporter {
  constructor({ foundry, snapshotPath }) {
    invariant(foundry, "foundry_required");
    invariant(typeof snapshotPath === "string" && snapshotPath.trim(), "constellation_snapshot_path_required");
    this.foundry = foundry;
    this.snapshotPath = snapshotPath;
  }

  readSnapshot() {
    if (!existsSync(this.snapshotPath)) return null;
    const snapshot = JSON.parse(readFileSync(this.snapshotPath, "utf8"));
    invariant(snapshot?.schemaVersion === 1, "unsupported_constellation_snapshot");
    invariant(Array.isArray(snapshot.configuredAgents), "configured_agents_required");
    invariant(Array.isArray(snapshot.archivedAgentCandidates), "archived_agent_candidates_required");
    return snapshot;
  }

  plan() {
    const snapshot = this.readSnapshot();
    if (!snapshot) {
      return {
        available: false,
        snapshotPath: this.snapshotPath,
        configured: 0,
        create: 0,
        revise: 0,
        unchanged: 0,
        materialize: 0,
        archivedCandidates: 0,
        agents: [],
      };
    }

    const agents = snapshot.configuredAgents.map(record => {
      const blueprint = this.foundry.validateBlueprint(record.blueprint);
      const existingBlueprint = this.foundry.get("blueprint", blueprint.blueprintId);
      const existingInstance = this.foundry.get("agent", record.agentId);
      const incomingHash = computeBlueprintHash(blueprint);
      const existingHash = existingBlueprint ? computeBlueprintHash(existingBlueprint) : null;
      return {
        sourceAgentId: record.sourceAgentId,
        agentId: record.agentId,
        blueprintId: blueprint.blueprintId,
        incomingHash,
        action: !existingBlueprint ? "create" : (existingHash === incomingHash ? "unchanged" : "revise"),
        materialize: !existingInstance,
        initialStatus: record.initialStatus === "active" ? "active" : "paused",
      };
    });

    return {
      available: true,
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      source: snapshot.source,
      snapshotPath: this.snapshotPath,
      configured: agents.length,
      create: agents.filter(agent => agent.action === "create").length,
      revise: agents.filter(agent => agent.action === "revise").length,
      unchanged: agents.filter(agent => agent.action === "unchanged").length,
      materialize: agents.filter(agent => agent.materialize).length,
      archivedCandidates: snapshot.archivedAgentCandidates.length,
      agents,
      archivedAgentCandidates: snapshot.archivedAgentCandidates,
    };
  }

  async apply() {
    const snapshot = this.readSnapshot();
    invariant(snapshot, "constellation_snapshot_unavailable");
    const before = this.plan();
    const receipts = [];

    for (const record of snapshot.configuredAgents) {
      const blueprint = this.foundry.validateBlueprint(record.blueprint);
      const existingBlueprint = this.foundry.get("blueprint", blueprint.blueprintId);
      const incomingHash = computeBlueprintHash(blueprint);
      let blueprintAction = "unchanged";

      if (!existingBlueprint) {
        await this.foundry.createBlueprint(blueprint, {
          actor: IMPORT_ACTOR,
          idempotencyKey: `constellation:create:${blueprint.blueprintId}:${incomingHash}`,
        });
        blueprintAction = "created";
      } else if (computeBlueprintHash(existingBlueprint) !== incomingHash) {
        await this.foundry.reviseBlueprint({
          blueprintId: blueprint.blueprintId,
          changes: blueprint,
          changelog: `Imported from private constellation snapshot ${snapshot.generatedAt || "unknown"}`,
          provenance: blueprint.provenance,
        }, {
          actor: IMPORT_ACTOR,
          idempotencyKey: `constellation:revise:${blueprint.blueprintId}:${incomingHash}`,
        });
        blueprintAction = "revised";
      }

      let materialized = false;
      if (!this.foundry.get("agent", record.agentId)) {
        await this.foundry.materializeAgent({
          agentId: record.agentId,
          instanceId: `instance_${record.agentId}`,
          blueprintId: blueprint.blueprintId,
          identityId: record.sourceAgentId === "main" ? "lotus" : `identity_${record.sourceAgentId}`,
          initialStatus: record.initialStatus === "active" ? "active" : "paused",
          metadata: {
            importedFrom: snapshot.source || "private-constellation",
            sourceAgentId: record.sourceAgentId,
            formationRoot: blueprint.metadata?.formationRoot || null,
          },
        }, {
          actor: IMPORT_ACTOR,
          idempotencyKey: `constellation:materialize:${record.agentId}:${incomingHash}`,
        });
        materialized = true;
      }

      receipts.push({
        sourceAgentId: record.sourceAgentId,
        agentId: record.agentId,
        blueprintId: blueprint.blueprintId,
        blueprintAction,
        materialized,
      });
    }

    return {
      importedAt: new Date().toISOString(),
      before,
      after: this.plan(),
      receipts,
      archivedAgentCandidates: snapshot.archivedAgentCandidates,
    };
  }
}
