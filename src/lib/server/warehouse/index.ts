import "server-only";
import { statSync } from "node:fs";
import path from "node:path";
import type { Mode } from "@/lib/domain/types";
import { singleton } from "../cache";
import { now } from "../clock";
import { appConfig, warehouseConfig } from "../env/config";
import { log } from "../log";
import { WarehouseRepo } from "./repo";
import { migrate } from "./schema";
import { openDatabase, sqliteModule, SQLITE_UNAVAILABLE, sqliteVersion } from "./sqlite";
export interface Warehouse {
    mode: Mode;
    repo: WarehouseRepo;
    location: string;
    sqliteVersion: string | null;
    knownAccounts: Set<string>;
}
interface Slot {
    warehouse: Warehouse | null;
    reason: string | null;
    location: string | null;
}
export function warehouseLocation(): string {
    const app = appConfig();
    if (app.storeDriver === "memory" || !app.dataDir)
        return ":memory:";
    const dir = warehouseConfig().dir ?? path.join(app.dataDir, "warehouse");
    return path.resolve(process.cwd(), dir, "live.sqlite");
}
function open(): Slot {
    const location = warehouseLocation();
    if (!sqliteModule())
        return { warehouse: null, reason: SQLITE_UNAVAILABLE, location };
    try {
        const db = openDatabase(location);
        const nowIso = now().toISOString();
        const applied = migrate(db, nowIso);
        const repo = new WarehouseRepo(db);
        if (!repo.getMeta("created_at"))
            repo.setMeta("created_at", nowIso);
        repo.setMeta("mode", "live");
        repo.abandonRuns(nowIso);
        if (applied.length)
            log.info("Warehouse schema migrated", { versions: applied.join(","), file: location });
        return { warehouse: { mode: "live", repo, location, sqliteVersion: sqliteVersion(db), knownAccounts: new Set() }, reason: null, location };
    }
    catch (err) {
        const reason = `The warehouse could not be opened: ${err instanceof Error ? err.message : String(err)}`;
        log.warn(reason);
        return { warehouse: null, reason, location };
    }
}
const slot = (): Slot => singleton("store:warehouse:live", () => open());
export function getWarehouse(mode: Mode): Warehouse | null {
    if (!warehouseConfig().enabled || mode !== "live")
        return null;
    return slot().warehouse;
}
export function warehouseAvailability(mode: Mode): {
    enabled: boolean;
    available: boolean;
    reason: string | null;
    location: string | null;
} {
    const cfg = warehouseConfig();
    if (!cfg.enabled)
        return { enabled: false, available: false, reason: "WAREHOUSE_ENABLED=false: Google Ads data is not stored.", location: null };
    if (mode !== "live")
        return { enabled: true, available: false, reason: "No live Google Ads account is connected, so nothing is stored.", location: null };
    const value = slot();
    return { enabled: true, available: !!value.warehouse, reason: value.reason, location: value.location };
}
export function warehouseSize(w: Warehouse): number | null {
    if (w.location === ":memory:")
        return null;
    let total = 0;
    for (const f of [w.location, `${w.location}-wal`]) {
        try {
            total += statSync(f).size;
        }
        catch {
        }
    }
    return total;
}
