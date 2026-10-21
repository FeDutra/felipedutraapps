import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LegacyImportService,
  LiveService,
  SqliteEventStore,
} from "../src/index.mjs";

const DATABASE_FILENAME = "pulso-core.sqlite";
const STAGE_RECEIPT_FILENAME = "migration-stage-receipt.json";
const PROMOTION_RECEIPT_FILENAME = "migration-promotion-receipt.json";

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function writePrivateJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
  chmodSync(path, 0o600);
}

function requiredPath(value, code) {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return resolve(value);
}

function ensureStageInsideActive(activeDir, stageDir) {
  const rel = relative(activeDir, stageDir);
  if (!rel || rel.startsWith("..") || rel.includes("/../")) {
    throw new Error("migration_stage_must_be_inside_active_data_dir");
  }
}

export async function stageLegacyMigration({ snapshotPath, stageDir }) {
  const source = requiredPath(snapshotPath, "migration_snapshot_path_required");
  const target = requiredPath(stageDir, "migration_stage_dir_required");
  const databasePath = join(target, DATABASE_FILENAME);
  const receiptPath = join(target, STAGE_RECEIPT_FILENAME);
  if (!existsSync(source) || !statSync(source).isFile()) throw new Error("migration_snapshot_missing");
  if (existsSync(databasePath) || existsSync(receiptPath)) throw new Error("migration_stage_already_exists");

  mkdirSync(target, { recursive: true, mode: 0o700 });
  const document = JSON.parse(readFileSync(source, "utf8"));
  const store = new SqliteEventStore(databasePath);
  try {
    const live = new LiveService({ store });
    const service = new LegacyImportService({ live, store });
    const result = await service.apply(document.snapshot ?? document);
    store.close();
    chmodSync(databasePath, 0o600);
    const receipt = {
      schemaVersion: 1,
      status: "staged",
      createdAt: new Date().toISOString(),
      snapshotHash: result.snapshotHash,
      counts: result.counts,
      integrity: result.integrity,
      databaseFilename: DATABASE_FILENAME,
      databaseSha256: sha256File(databasePath),
    };
    writePrivateJson(receiptPath, receipt);
    return receipt;
  } catch (error) {
    try { store.close(); } catch {}
    throw error;
  }
}

export function promoteStagedMigration({ activeDir, stageDir, expectedSnapshotHash }) {
  const active = requiredPath(activeDir, "migration_active_dir_required");
  const stage = requiredPath(stageDir, "migration_stage_dir_required");
  ensureStageInsideActive(active, stage);
  if (typeof expectedSnapshotHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedSnapshotHash)) {
    throw new Error("migration_expected_snapshot_hash_invalid");
  }

  const stageReceiptPath = join(stage, STAGE_RECEIPT_FILENAME);
  const stagedDatabase = join(stage, DATABASE_FILENAME);
  if (!existsSync(stageReceiptPath) || !existsSync(stagedDatabase)) throw new Error("migration_stage_incomplete");
  const stageReceipt = JSON.parse(readFileSync(stageReceiptPath, "utf8"));
  if (stageReceipt.status !== "staged" || stageReceipt.snapshotHash !== expectedSnapshotHash) {
    throw new Error("migration_stage_snapshot_mismatch");
  }
  if (sha256File(stagedDatabase) !== stageReceipt.databaseSha256) {
    throw new Error("migration_stage_database_hash_mismatch");
  }

  const activeDatabase = join(active, DATABASE_FILENAME);
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(activeDatabase + suffix)) throw new Error("migration_active_database_not_cleanly_closed");
  }
  mkdirSync(join(active, "backups"), { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(active, "backups", `before-v09-migration-${stamp}.sqlite`);
  const activeDatabaseSha256 = existsSync(activeDatabase) ? sha256File(activeDatabase) : null;
  if (existsSync(activeDatabase)) {
    copyFileSync(activeDatabase, backupPath);
    chmodSync(backupPath, 0o600);
  }

  const temporary = join(active, `.${DATABASE_FILENAME}.migration-${process.pid}.tmp`);
  copyFileSync(stagedDatabase, temporary);
  chmodSync(temporary, 0o600);
  if (sha256File(temporary) !== stageReceipt.databaseSha256) {
    throw new Error("migration_promotion_copy_hash_mismatch");
  }
  renameSync(temporary, activeDatabase);
  chmodSync(activeDatabase, 0o600);

  const receipt = {
    schemaVersion: 1,
    status: "promoted",
    promotedAt: new Date().toISOString(),
    snapshotHash: stageReceipt.snapshotHash,
    counts: stageReceipt.counts,
    integrity: stageReceipt.integrity,
    activeDatabaseSha256: stageReceipt.databaseSha256,
    previousDatabaseSha256: activeDatabaseSha256,
    backupFilename: existsSync(backupPath) ? basename(backupPath) : null,
  };
  writePrivateJson(join(active, PROMOTION_RECEIPT_FILENAME), receipt);
  return receipt;
}

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    values[arg.slice(2)] = argv[i + 1];
    i += 1;
  }
  return values;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let result;
  if (command === "stage") {
    result = await stageLegacyMigration({ snapshotPath: args.snapshot, stageDir: args["stage-dir"] });
  } else if (command === "promote") {
    result = promoteStagedMigration({
      activeDir: args["active-dir"],
      stageDir: args["stage-dir"],
      expectedSnapshotHash: args["expected-snapshot-hash"],
    });
  } else {
    throw new Error("usage: migration-cli.mjs <stage|promote> [arguments]");
  }
  process.stdout.write(JSON.stringify(result) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({ ok: false, error: error.message || String(error) }) + "\n");
    process.exitCode = 1;
  });
}

