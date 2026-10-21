import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LegacyImportService, LiveService, SqliteEventStore } from "../vendor/pulso-core/src/index.mjs";

const inputArg = process.argv[2];
if (!inputArg) throw new Error("usage: node scripts/validate-pulso-legacy-snapshot.mjs <private-snapshot.json>");
const document = JSON.parse(readFileSync(resolve(inputArg), "utf8"));
const store = new SqliteEventStore(":memory:");
const service = new LegacyImportService({ live: new LiveService({ store }), store });
const plan = service.plan(document.snapshot ?? document);
console.log(JSON.stringify({ snapshotHash: plan.snapshotHash, ...plan.counts }));
store.close();
