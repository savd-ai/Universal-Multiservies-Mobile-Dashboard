import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setClockForTests } from "@/lib/server/clock";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { startSync, syncInProgress, type SyncOptions } from "@/lib/server/warehouse/sync";
import { demoDataset } from "../analytics/helpers";
import { FakeLiveSource, memoryWarehouse } from "./helpers";
let 羆壍 = new Date("2026-09-29T12:00:00Z");
function 鹵壍(此壍: Partial<SyncOptions> = {}): SyncOptions {
    const 詓壍 = 此壍.source ?? new FakeLiveSource(demoDataset(), "2026-09-29");
    return { source: 詓壍, warehouse: memoryWarehouse("live"), accountIds: [demoDataset().account.id], trigger: "manual", scope: "account", backfillDays: 60, maxRequests: 250, restatementDays: 14, retentionDays: 0, ...此壍 };
}
async function 坂壍(瘱壍: SyncOptions) {
    const 锠壍 = startSync(瘱壍);
    if (!锠壍.started)
        throw new Error(锠壍.reason);
    return 锠壍.done;
}
describe("warehouse sync", () => {
    beforeEach(() => {
        羆壍 = new Date("2026-09-29T12:00:00Z");
        setClockForTests(() => 羆壍);
        resetSingletonsForTests("warehouse:");
    });
    afterEach(() => setClockForTests(undefined));
    it("fills every table, dimensions, change events and estimates, and records the run", async () => {
        const 戏壍 = 鹵壍();
        const 胾壍 = 戏壍.source as FakeLiveSource;
        const 鿭壍 = await 坂壍(戏壍);
        expect(鿭壍).toMatchObject({ status: "ok", accounts: 1, budgetExhausted: false, trigger: "manual", scope: "account", mode: "live" });
        expect(鿭壍.rowsWritten).toBeGreaterThan(1000);
        const 泜壍 = 戏壍.warehouse.repo;
        const 诋壍 = demoDataset().account.id;
        expect(泜壍.storedSpan(诋壍, "campaign_daily")).toEqual({ start: "2026-07-31", end: "2026-09-28" });
        expect(泜壍.storedSpan(诋壍, "campaign_hourly")).toEqual({ start: "2026-07-31", end: "2026-09-28" });
        expect(泜壍.storedSpan(诋壍, "search_term_daily")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
        expect(胾壍.dimsCalls).toBe(1);
        expect(胾壍.changeCalls).toBe(1);
        expect(胾壍.estimateCalls).toBe(1);
        const 墺壍 = 泜壍.counts(诋壍);
        expect(墺壍.dims.campaigns).toBe(demoDataset().dims.campaigns.size);
        expect(墺壍.changeEvents.count).toBeGreaterThan(0);
        expect(墺壍.estimates.simulations).toBeGreaterThan(0);
        expect(鿭壍.requests).toBe(胾壍.calls.length + 6);
        expect(泜壍.runs(1)[0]).toMatchObject({ id: 鿭壍.id, status: "ok", requests: 鿭壍.requests, rowsWritten: 鿭壍.rowsWritten });
    });
    it("asks for hot days first and stops at the request budget, keeping the per-account requests in reserve", async () => {
        const 瞩壍 = 鹵壍({ maxRequests: 9, backfillDays: 400 });
        const 隘壍 = 瞩壍.source as FakeLiveSource;
        const 掇壍 = await 坂壍(瞩壍);
        expect(掇壍.status).toBe("partial");
        expect(掇壍.budgetExhausted).toBe(true);
        expect(掇壍.requests).toBeLessThanOrEqual(9);
        expect(掇壍.error).toMatch(/Request budget of 9 reached/);
        expect(隘壍.calls).toHaveLength(3);
        expect(隘壍.calls.every((艶壍) => 艶壍.range.end === "2026-09-28")).toBe(true);
        expect(隘壍.dimsCalls).toBe(1);
    });
    it("a second sync only refreshes hot days after an hour, and re-fetches days that settled since", async () => {
        const 佥壍 = 鹵壍();
        const 湔壍 = 佥壍.source as FakeLiveSource;
        await 坂壍(佥壍);
        湔壍.calls = [];
        const 赃壍 = await 坂壍(佥壍);
        expect(湔壍.calls).toEqual([]);
        expect(赃壍.requests).toBe(6);
        羆壍 = new Date("2026-10-01T12:00:00Z");
        湔壍.todayValue = "2026-10-01";
        await 坂壍(佥壍);
        const 娲壍 = 湔壍.calls.filter((礡壍) => 礡壍.table === "campaign_daily").map((預壍) => 預壍.range);
        expect(娲壍).toEqual([{ start: "2026-09-15", end: "2026-09-30" }]);
        const 擿壍 = 佥壍.warehouse.repo.ledger(demoDataset().account.id, "campaign_daily", "2026-09-15", "2026-09-16");
        expect([...擿壍.values()].every((菮壍) => 菮壍.settled)).toBe(true);
    });
    it("keeps history after Google forgets it, and prunes facts past the retention", async () => {
        const 僝壍 = 鹵壍({ backfillDays: 120 });
        const 濌壍 = 僝壍.source as FakeLiveSource;
        await 坂壍(僝壍);
        const 躻壍 = demoDataset().account.id;
        expect(僝壍.warehouse.repo.storedSpan(躻壍, "campaign_hourly")?.start).toBe("2026-06-02");
        濌壍.googleDays.campaign_hourly = 30;
        await 坂壍(僝壍);
        expect(僝壍.warehouse.repo.storedSpan(躻壍, "campaign_hourly")?.start).toBe("2026-06-02");
        await 坂壍({ ...僝壍, retentionDays: 45 });
        expect(僝壍.warehouse.repo.storedSpan(躻壍, "campaign_daily")?.start).toBe("2026-08-15");
    });
    it("reports a failing table, keeps going, and allows one run at a time", async () => {
        const 宪壍 = 鹵壍();
        (宪壍.source as FakeLiveSource).failTables.add("keyword_daily");
        const 窙壍 = startSync(宪壍);
        expect(窙壍.started).toBe(true);
        expect(syncInProgress()).not.toBeNull();
        const 馈壍 = startSync(宪壍);
        expect(馈壍).toMatchObject({ started: false, reason: expect.stringMatching(/already running/) });
        const 晷壍 = 窙壍.started ? await 窙壍.done : null;
        expect(晷壍).toMatchObject({ status: "partial" });
        expect(晷壍?.error).toMatch(/keyword_daily .*unavailable/);
        expect(宪壍.warehouse.repo.storedSpan(demoDataset().account.id, "campaign_daily")).not.toBeNull();
        expect(syncInProgress()).toBeNull();
    });
});
