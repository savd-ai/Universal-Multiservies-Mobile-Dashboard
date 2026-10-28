import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setClockForTests } from "@/lib/server/clock";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { startSync, syncInProgress, type SyncOptions } from "@/lib/server/warehouse/sync";
import { demoDataset } from "../analytics/helpers";
import { FakeLiveSource, memoryWarehouse } from "./helpers";
let clock = new Date("2026-09-29T12:00:00Z");
function options(over: Partial<SyncOptions> = {}): SyncOptions {
    const source = over.source ?? new FakeLiveSource(demoDataset(), "2026-09-29");
    return { source, warehouse: memoryWarehouse("live"), accountIds: [demoDataset().account.id], trigger: "manual", scope: "account", backfillDays: 60, maxRequests: 250, restatementDays: 14, retentionDays: 0, ...over };
}
async function sync(o: SyncOptions) {
    const s = startSync(o);
    if (!s.started)
        throw new Error(s.reason);
    return s.done;
}
describe("warehouse sync", () => {
    beforeEach(() => {
        clock = new Date("2026-09-29T12:00:00Z");
        setClockForTests(() => clock);
        resetSingletonsForTests("warehouse:");
    });
    afterEach(() => setClockForTests(undefined));
    it("fills every table, dimensions, change events and estimates, and records the run", async () => {
        const o = options();
        const inner = o.source as FakeLiveSource;
        const run = await sync(o);
        expect(run).toMatchObject({ status: "ok", accounts: 1, budgetExhausted: false, trigger: "manual", scope: "account", mode: "live" });
        expect(run.rowsWritten).toBeGreaterThan(1000);
        const repo = o.warehouse.repo;
        const id = demoDataset().account.id;
        expect(repo.storedSpan(id, "campaign_daily")).toEqual({ start: "2026-07-31", end: "2026-09-28" });
        expect(repo.storedSpan(id, "campaign_hourly")).toEqual({ start: "2026-07-31", end: "2026-09-28" });
        expect(repo.storedSpan(id, "search_term_daily")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
        expect(inner.dimsCalls).toBe(1);
        expect(inner.changeCalls).toBe(1);
        expect(inner.estimateCalls).toBe(1);
        const counts = repo.counts(id);
        expect(counts.dims.campaigns).toBe(demoDataset().dims.campaigns.size);
        expect(counts.changeEvents.count).toBeGreaterThan(0);
        expect(counts.estimates.simulations).toBeGreaterThan(0);
        expect(run.requests).toBe(inner.calls.length + 6);
        expect(repo.runs(1)[0]).toMatchObject({ id: run.id, status: "ok", requests: run.requests, rowsWritten: run.rowsWritten });
    });
    it("asks for hot days first and stops at the request budget, keeping the per-account requests in reserve", async () => {
        const o = options({ maxRequests: 9, backfillDays: 400 });
        const inner = o.source as FakeLiveSource;
        const run = await sync(o);
        expect(run.status).toBe("partial");
        expect(run.budgetExhausted).toBe(true);
        expect(run.requests).toBeLessThanOrEqual(9);
        expect(run.error).toMatch(/Request budget of 9 reached/);
        expect(inner.calls).toHaveLength(3);
        expect(inner.calls.every((c) => c.range.end === "2026-09-28")).toBe(true);
        expect(inner.dimsCalls).toBe(1);
    });
    it("a second sync only refreshes hot days after an hour, and re-fetches days that settled since", async () => {
        const o = options();
        const inner = o.source as FakeLiveSource;
        await sync(o);
        inner.calls = [];
        const again = await sync(o);
        expect(inner.calls).toEqual([]);
        expect(again.requests).toBe(6);
        clock = new Date("2026-10-01T12:00:00Z");
        inner.todayValue = "2026-10-01";
        await sync(o);
        const daily = inner.calls.filter((c) => c.table === "campaign_daily").map((c) => c.range);
        expect(daily).toEqual([{ start: "2026-09-15", end: "2026-09-30" }]);
        const ledger = o.warehouse.repo.ledger(demoDataset().account.id, "campaign_daily", "2026-09-15", "2026-09-16");
        expect([...ledger.values()].every((e) => e.settled)).toBe(true);
    });
    it("keeps history after Google forgets it, and prunes facts past the retention", async () => {
        const o = options({ backfillDays: 120 });
        const inner = o.source as FakeLiveSource;
        await sync(o);
        const id = demoDataset().account.id;
        expect(o.warehouse.repo.storedSpan(id, "campaign_hourly")?.start).toBe("2026-06-02");
        inner.googleDays.campaign_hourly = 30;
        await sync(o);
        expect(o.warehouse.repo.storedSpan(id, "campaign_hourly")?.start).toBe("2026-06-02");
        await sync({ ...o, retentionDays: 45 });
        expect(o.warehouse.repo.storedSpan(id, "campaign_daily")?.start).toBe("2026-08-15");
    });
    it("reports a failing table, keeps going, and allows one run at a time", async () => {
        const o = options();
        (o.source as FakeLiveSource).failTables.add("keyword_daily");
        const first = startSync(o);
        expect(first.started).toBe(true);
        expect(syncInProgress()).not.toBeNull();
        const second = startSync(o);
        expect(second).toMatchObject({ started: false, reason: expect.stringMatching(/already running/) });
        const run = first.started ? await first.done : null;
        expect(run).toMatchObject({ status: "partial" });
        expect(run?.error).toMatch(/keyword_daily .*unavailable/);
        expect(o.warehouse.repo.storedSpan(demoDataset().account.id, "campaign_daily")).not.toBeNull();
        expect(syncInProgress()).toBeNull();
    });
});
