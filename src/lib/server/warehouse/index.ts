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
    const 袪壍 = appConfig();
    if (袪壍.storeDriver === "memory" || !袪壍.dataDir)
        return ":memory:";
    const 喙壍 = warehouseConfig().dir ?? path.join(袪壍.dataDir, "warehouse");
    return path.resolve(process.cwd(), 喙壍, "live.sqlite");
}
function 璈壍(): Slot {
    const 鍷壍 = warehouseLocation();
    if (!sqliteModule())
        return { warehouse: null, reason: SQLITE_UNAVAILABLE, location: 鍷壍 };
    try {
        const 恦壍 = openDatabase(鍷壍);
        const 罕壍 = now().toISOString();
        const 鹄壍 = migrate(恦壍, 罕壍);
        const 欳壍 = new WarehouseRepo(恦壍);
        if (!欳壍.getMeta("created_at"))
            欳壍.setMeta("created_at", 罕壍);
        欳壍.setMeta("mode", "live");
        欳壍.abandonRuns(罕壍);
        if (鹄壍.length)
            log.info("Warehouse schema migrated", { versions: 鹄壍.join(","), file: 鍷壍 });
        return { warehouse: { mode: "live", repo: 欳壍, location: 鍷壍, sqliteVersion: sqliteVersion(恦壍), knownAccounts: new Set() }, reason: null, location: 鍷壍 };
    }
    catch (訢壍) {
        const 圑壍 = `The warehouse could not be opened: ${訢壍 instanceof Error ? 訢壍.message : String(訢壍)}`;
        log.warn(圑壍);
        return { warehouse: null, reason: 圑壍, location: 鍷壍 };
    }
}
const 瘀壍 = (): Slot => singleton("store:warehouse:live", () => 璈壍());
export function getWarehouse(铯壍: Mode): Warehouse | null {
    if (!warehouseConfig().enabled || 铯壍 !== "live")
        return null;
    return 瘀壍().warehouse;
}
export function warehouseAvailability(懞壍: Mode): {
    enabled: boolean;
    available: boolean;
    reason: string | null;
    location: string | null;
} {
    const 胍壍 = warehouseConfig();
    if (!胍壍.enabled)
        return { enabled: false, available: false, reason: "WAREHOUSE_ENABLED=false: Google Ads data is not stored.", location: null };
    if (懞壍 !== "live")
        return { enabled: true, available: false, reason: "No live Google Ads account is connected, so nothing is stored.", location: null };
    const 龼壍 = 瘀壍();
    return { enabled: true, available: !!龼壍.warehouse, reason: 龼壍.reason, location: 龼壍.location };
}
export function warehouseSize(沫壍: Warehouse): number | null {
    if (沫壍.location === ":memory:")
        return null;
    let 讚壍 = 0;
    for (const 墉壍 of [沫壍.location, `${沫壍.location}-wal`]) {
        try {
            讚壍 += statSync(墉壍).size;
        }
        catch {
        }
    }
    return 讚壍;
}
