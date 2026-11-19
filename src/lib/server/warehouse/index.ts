import "server-only";
import { statSync } from "node:fs";
import path from "node:path";
import type { Mode } from "@/lib/domain/types";
import { singleton } from "../cache";
import { now } from "../clock";
import { demoAnchor } from "../datasource/demo-source";
import { appConfig, demoConfig, warehouseConfig } from "../env/config";
import { log } from "../log";
import { WarehouseRepo } from "./repo";
import { migrate } from "./schema";
import { openDatabase, sqliteModule, SQLITE_UNAVAILABLE, sqliteVersion } from "./sqlite";

// The analytics warehouse handle: one SQLite file per data mode (<DATA_DIR>/warehouse/live.sqlite and demo.sqlite,
// so demo rows never mix with an account's real history), opened lazily, migrated on open and kept on globalThis.
// With STORE_DRIVER=memory (tests, read-only disks) it lives in memory. The singleton key starts with "store:" so
// test resets drop it together with the JSON store.

export interface Warehouse {
  mode: Mode;
  repo: WarehouseRepo;
  /** absolute path, or ":memory:" */
  location: string;
  sqliteVersion: string | null;
  /** accounts known to have a dim_account row (facts reference it) */
  knownAccounts: Set<string>;
}

interface Slot {
  warehouse: Warehouse | null;
  reason: string | null;
  location: string | null;
}

export function warehouseLocation(mode: Mode): string {
  const app = appConfig();
  if (app.storeDriver === "memory" || !app.dataDir) return ":memory:";
  const dir = warehouseConfig().dir ?? path.join(app.dataDir, "warehouse");
  return path.resolve(process.cwd(), dir, `${mode}.sqlite`);
}

function open(mode: Mode): Slot {
  const location = warehouseLocation(mode);
  if (!sqliteModule()) return { warehouse: null, reason: SQLITE_UNAVAILABLE, location };
  try {
    const db = openDatabase(location);
    const nowIso = now().toISOString();
    const applied = migrate(db, nowIso);
    const repo = new WarehouseRepo(db);
    if (!repo.getMeta("created_at")) repo.setMeta("created_at", nowIso);
    repo.setMeta("mode", mode);
    repo.abandonRuns(nowIso);
    if (applied.length) log.info("Warehouse schema migrated", { mode, versions: applied.join(","), file: location });
    return { warehouse: { mode, repo, location, sqliteVersion: sqliteVersion(db), knownAccounts: new Set() }, reason: null, location };
  } catch (err) {
    const reason = `The warehouse could not be opened: ${err instanceof Error ? err.message : String(err)}`;
    log.warn(reason, { mode });
    return { warehouse: null, reason, location };
  }
}

const slot = (mode: Mode): Slot => singleton(`store:warehouse:${mode}`, () => open(mode));

/** The warehouse for a data mode, or null when it is turned off or can't be opened (see warehouseAvailability). */
export function getWarehouse(mode: Mode): Warehouse | null {
  if (!warehouseConfig().enabled) return null;
  const w = slot(mode).warehouse;
  if (w && mode === "demo") ensureDemoDataset(w);
  return w;
}

export function warehouseAvailability(mode: Mode): { enabled: boolean; available: boolean; reason: string | null; location: string | null } {
  const cfg = warehouseConfig();
  if (!cfg.enabled) return { enabled: false, available: false, reason: "WAREHOUSE_ENABLED=false: Google Ads data is not stored.", location: null };
  const s = slot(mode);
  return { enabled: true, available: !!s.warehouse, reason: s.reason, location: s.location };
}

/** The demo dataset moves with its anchor (planted problems sit just before it), so the demo warehouse is rebuilt when it changes. */
export function demoDatasetKey(): string {
  const cfg = demoConfig();
  return [cfg.profile, cfg.seed, cfg.scenarios, demoAnchor(), cfg.currency, cfg.timezone].join("|");
}

function ensureDemoDataset(w: Warehouse): void {
  const key = demoDatasetKey();
  try {
    if (w.repo.getMeta("demo_dataset") === key) return;
    if (w.repo.getMeta("demo_dataset") !== null) log.info("Demo dataset changed: the demo warehouse starts over", { anchor: demoAnchor() });
    w.repo.resetData();
    w.knownAccounts.clear();
    w.repo.setMeta("demo_dataset", key);
  } catch (err) {
    log.warn("Demo warehouse could not be reset", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** File size in bytes (database + write-ahead log), null in memory. */
export function warehouseSize(w: Warehouse): number | null {
  if (w.location === ":memory:") return null;
  let total = 0;
  for (const f of [w.location, `${w.location}-wal`]) {
    try {
      // runtime path (DATA_DIR): keep it out of the build's file tracing
      total += statSync(/*turbopackIgnore: true*/ f).size;
    } catch {
      /* no WAL yet */
    }
  }
  return total;
}
