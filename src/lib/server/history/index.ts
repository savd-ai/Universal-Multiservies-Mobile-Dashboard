import "server-only";
import { statSync } from "node:fs";
import path from "node:path";
import type { HistoryMode } from "@/lib/domain/contracts/history";
import type { GoogleAdsSource } from "../datasource/types";
import { singleton } from "../cache";
import { now } from "../clock";
import { appConfig, historyConfig } from "../env/config";
import { log } from "../log";
import { openDatabase, sqliteModule, SQLITE_UNAVAILABLE, sqliteVersion } from "../warehouse/sqlite";
import { HistoryRepo } from "./repo";
import { HISTORY_SCHEMA_VERSION, migrateHistory } from "./schema";

/**
 * The history database (SQLite, `data/history/history.sqlite` by default): long-term memory of the anomaly engine
 * and of mobile notifications. Unlike the warehouse it also keeps demo-mode records, always tagged `demo`, so the
 * phone app and the analysis views work before Google Ads is connected; live and demo rows never mix in an answer.
 * Any failure to open it leaves the dashboard working without history.
 */
interface Slot {
  repo: HistoryRepo | null;
  location: string;
  reason: string | null;
  sqliteVersion: string | null;
}

export function historyLocation(): string {
  const app = appConfig();
  if (app.storeDriver === "memory" || !app.dataDir) return ":memory:";
  return path.resolve(process.cwd(), historyConfig().file ?? path.join(app.dataDir, "history", "history.sqlite"));
}

function open(): Slot {
  const location = historyLocation();
  if (!historyConfig().enabled) return { repo: null, location, reason: "HISTORY_ENABLED=false: evaluations and notifications are not stored.", sqliteVersion: null };
  if (!sqliteModule()) return { repo: null, location, reason: SQLITE_UNAVAILABLE, sqliteVersion: null };
  try {
    const db = openDatabase(location);
    const at = now().toISOString();
    const ran = migrateHistory(db, at);
    const repo = new HistoryRepo(db);
    if (!repo.getMeta("created_at")) repo.setMeta("created_at", at);
    if (ran.length) log.info("History schema migrated", { versions: ran.join(","), file: location });
    return { repo, location, reason: null, sqliteVersion: sqliteVersion(db) };
  } catch (error) {
    const reason = `The history database could not be opened: ${error instanceof Error ? error.message : String(error)}`;
    log.warn(reason);
    return { repo: null, location, reason, sqliteVersion: null };
  }
}

// "store:" prefix: tests reset it with the other stores.
const slot = (): Slot => singleton("store:history", open);

export function getHistory(): HistoryRepo | null {
  return slot().repo;
}

export function historyUnavailableReason(): string | null {
  return slot().reason;
}

export function historyMode(source: Pick<GoogleAdsSource, "mode">): HistoryMode {
  return source.mode === "live" ? "live" : "demo";
}

export function historyStatus() {
  const current = slot();
  let bytes: number | null = null;
  if (current.repo && current.location !== ":memory:") {
    bytes = 0;
    for (const file of [current.location, `${current.location}-wal`]) {
      try {
        bytes += statSync(file).size;
      } catch {
        // the WAL file only exists while the database is open for writing
      }
    }
  }
  return {
    available: !!current.repo,
    reason: current.reason,
    file: current.location === ":memory:" ? ":memory:" : path.basename(current.location),
    schemaVersion: HISTORY_SCHEMA_VERSION,
    sqliteVersion: current.sqliteVersion,
    bytes,
    counts: current.repo?.counts() ?? null,
  };
}
