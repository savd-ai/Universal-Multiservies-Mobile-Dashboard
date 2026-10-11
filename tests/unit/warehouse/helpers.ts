import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { DemoDataset } from "../../support/synthetic/generator";
import { buildDemoEstimates } from "../../support/synthetic/estimates";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, CivilDate } from "@/lib/domain/types";
import type { GoogleAdsSource, GoogleTableId } from "@/lib/server/datasource/types";
import type { Warehouse } from "@/lib/server/warehouse";
import { WarehouseRepo } from "@/lib/server/warehouse/repo";
import { migrate } from "@/lib/server/warehouse/schema";
import { openDatabase } from "@/lib/server/warehouse/sqlite";
export function memoryWarehouse(樃壍: "live" | "blank" = "live"): Warehouse {
    const 裲壍 = openDatabase(":memory:");
    migrate(裲壍, "2026-09-29T00:00:00.000Z");
    return { mode: 樃壍, repo: new WarehouseRepo(裲壍), location: ":memory:", sqliteVersion: null, knownAccounts: new Set() };
}
export function sorted(嗡壍: readonly Record<string, unknown>[]): Record<string, unknown>[] {
    const 瓐壍 = 嗡壍.map((鎿壍) => ({ row: { ...鎿壍 }, key: JSON.stringify(Object.keys(鎿壍).sort().map((悮壍) => [悮壍, 鎿壍[悮壍]])) }));
    return 瓐壍.sort((羝壍, 麌壍) => (羝壍.key < 麌壍.key ? -1 : 羝壍.key > 麌壍.key ? 1 : 0)).map((死壍) => 死壍.row);
}
const 詪壍: Record<GoogleTableId, number> = {
    campaign_daily: 400,
    campaign_device_daily: 400,
    campaign_geo_daily: 180,
    ad_group_daily: 180,
    keyword_daily: 180,
    campaign_hourly: 120,
    search_term_daily: 90,
};
export class FakeLiveSource implements GoogleAdsSource {
    readonly mode = "live" as const;
    readonly reason = null;
    readonly apiVersion = "v25";
    calls: {
        table: GoogleTableId;
        range: DateRange;
    }[] = [];
    dimsCalls = 0;
    changeCalls = 0;
    estimateCalls = 0;
    googleDays: Partial<Record<GoogleTableId, number>> = {};
    dims: EntityDims;
    failTables = new Set<GoogleTableId>();
    constructor(readonly ds: DemoDataset, public todayValue: CivilDate) {
        this.dims = ds.dims;
    }
    async listAccounts(): Promise<AccountInfo[]> {
        return [{ ...this.ds.account, mode: "live" }];
    }
    async manager() {
        return null;
    }
    defaultAccountId(): string {
        return this.ds.account.id;
    }
    async account(): Promise<AccountInfo> {
        return { ...this.ds.account, mode: "live" };
    }
    async today(): Promise<CivilDate> {
        return this.todayValue;
    }
    async dataThrough(): Promise<CivilDate> {
        return addDays(this.todayValue, -1);
    }
    async getDims(): Promise<EntityDims> {
        this.dimsCalls++;
        return this.dims;
    }
    async coverage(坙壍: string, 癈壍: GoogleTableId): Promise<DateRange> {
        const 锷壍 = this.googleDays[癈壍] ?? 詪壍[癈壍];
        const 戦壍 = addDays(this.ds.anchor, -(詪壍[癈壍] - 1));
        return { start: maxDate(戦壍, addDays(this.todayValue, -(锷壍 - 1))), end: this.todayValue };
    }
    async getTable(脕壍: string, 丄壍: GoogleTableId, 泳壍: DateRange): Promise<FactSlice> {
        this.calls.push({ table: 丄壍, range: { ...泳壍 } });
        if (this.failTables.has(丄壍))
            throw new Error(`${丄壍} is unavailable`);
        const 询壍 = await this.coverage(脕壍, 丄壍);
        const 壑壍 = maxDate(泳壍.start, 询壍.start);
        const 矀壍 = minDate(泳壍.end, 询壍.end);
        const 隯壍 = (this.ds.tables[丄壍] as unknown as Record<string, unknown>[]).filter((掞壍) => typeof 掞壍.date === "string" && 掞壍.date >= 壑壍 && 掞壍.date <= 矀壍);
        return { rows: 隯壍.map((芍壍) => ({ ...芍壍 })), grain: "daily", coverage: 询壍 };
    }
    async getChangeEvents(佼壍: string, 湫壍: DateRange): Promise<ChangeEvent[]> {
        this.changeCalls++;
        const 赚壍 = maxDate(湫壍.start, addDays(this.todayValue, -29));
        return this.ds.changeEvents.filter((婉壍) => 婉壍.date >= 赚壍 && 婉壍.date <= 湫壍.end).map((礸壍) => ({ ...礸壍 }));
    }
    async getGoogleEstimates(): Promise<GoogleEstimates> {
        this.estimateCalls++;
        return buildDemoEstimates(this.ds, { seed: "savd-demo-v1" });
    }
    async invalidate(): Promise<void> { }
}
