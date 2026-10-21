import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LegacyImportService, LiveService, SqliteEventStore } from "../vendor/pulso-core/src/index.mjs";

const [inputArg, databaseArg] = process.argv.slice(2);
if (!inputArg || !databaseArg) throw new Error("usage: node scripts/trial-import-pulso-legacy-snapshot.mjs <snapshot.json> <trial.sqlite>");
const document = JSON.parse(readFileSync(resolve(inputArg), "utf8"));
const store = new SqliteEventStore(resolve(databaseArg));
const live = new LiveService({ store });
const service = new LegacyImportService({ live, store });
const first = await service.apply(document.snapshot ?? document);
const beforeRepeat = store.all().length;
const second = await service.apply(document.snapshot ?? document);
const afterRepeat = store.all().length;
console.log(JSON.stringify({
  snapshotHash: first.snapshotHash,
  counts: first.counts,
  events: afterRepeat,
  repeatAddedEvents: afterRepeat - beforeRepeat,
  integrity: second.integrity
}));
store.close();
