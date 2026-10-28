import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { setClockForTests } from "@/lib/server/clock";
import { FixtureGoogleAdsSource } from "../../support/fixture-source";
import { WarehouseSource } from "@/lib/server/warehouse/source";
import { DAILY_TABLE_IDS } from "@/lib/server/warehouse/tables";
import { demoDataset, resetServerState, restoreServerState } from "../analytics/helpers";
import { FakeLiveSource, memoryWarehouse, sorted } from "./helpers";
const TODAY = "2026-09-29";
const ACCOUNT = demoDataset().account.id;
function setup() {
    const inner = new FakeLiveSource(demoDataset(), TODAY);
    const w = memoryWarehouse("live");
    const source = new WarehouseSource(inner, w, { reads: true, restatementDays: 14 });
    return { inner, w, source };
}
describe("warehouse read path (live)", () => {
    beforeEach(() => setClockForTests(() => new Date("2026-09-29T12:00:00Z")));
    afterEach(() => setClockForTests(undefined));
    it("asks Google once for cold days, then serves them from SQLite with identical rows", async () => {
        const { inner, source } = setup();
        const range = { start: "2026-08-01", end: "2026-09-10" };
        const direct = await new FakeLiveSource(demoDataset(), TODAY).getTable(ACCOUNT, "campaign_daily", range);
        const first = await source.getTable(ACCOUNT, "campaign_daily", range);
        expect(inner.calls).toEqual([{ table: "campaign_daily", range }]);
        const second = await source.getTable(ACCOUNT, "campaign_daily", range);
        expect(inner.calls).toHaveLength(1);
        expect(sorted(first.rows)).toEqual(sorted(direct.rows));
        expect(sorted(second.rows)).toEqual(sorted(direct.rows));
    });
    it("always asks Google for the hot days and writes only the cold part through", async () => {
        const { inner, w, source } = setup();
        await source.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-01", end: "2026-09-28" });
        expect(w.repo.storedSpan(ACCOUNT, "campaign_daily")).toEqual({ start: "2026-09-01", end: "2026-09-14" });
        await source.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-01", end: "2026-09-28" });
        expect(inner.calls.map((c) => c.range)).toEqual([
            { start: "2026-09-01", end: "2026-09-28" },
            { start: "2026-09-15", end: "2026-09-28" },
        ]);
    });
    it("serves every daily table the same as Google would", { timeout: 20000 }, async () => {
        const { source } = setup();
        const reference = new FakeLiveSource(demoDataset(), TODAY);
        for (const table of DAILY_TABLE_IDS) {
            const range = { start: "2026-09-05", end: "2026-09-28" };
            const want = sorted((await reference.getTable(ACCOUNT, table, range)).rows);
            expect(sorted((await source.getTable(ACCOUNT, table, range)).rows)).toEqual(want);
            expect(sorted((await source.getTable(ACCOUNT, table, range)).rows)).toEqual(want);
        }
    });
    it("keeps days Google no longer serves and reports them in the coverage", async () => {
        const { inner, source } = setup();
        await source.getTable(ACCOUNT, "campaign_hourly", { start: "2026-06-01", end: "2026-09-10" });
        inner.googleDays.campaign_hourly = 92;
        const googleFrom = (await inner.coverage(ACCOUNT, "campaign_hourly")).start;
        expect(googleFrom).toBe(addDays(TODAY, -91));
        expect((await source.coverage(ACCOUNT, "campaign_hourly"))?.start).toBe("2026-06-02");
        inner.calls = [];
        const slice = await source.getTable(ACCOUNT, "campaign_hourly", { start: "2026-06-01", end: "2026-09-28" });
        expect(inner.calls.every((c) => c.range.start >= googleFrom)).toBe(true);
        expect(slice.rows.some((r) => String(r.date) < googleFrom)).toBe(true);
        expect(slice.coverage?.start).toBe("2026-06-02");
    });
    it("keeps change events beyond Google's 30 days and names removed campaigns from stored dimensions", async () => {
        const { inner, w, source } = setup();
        const ds = demoDataset();
        w.repo.upsertAccount(ds.account, "2026-09-29T00:00:00.000Z");
        const oldEvent = { ...ds.changeEvents[0]!, id: "old-event", date: "2026-07-01", ts: "2026-07-01 09:00:00" };
        w.repo.upsertChangeEvents(ACCOUNT, [oldEvent], "2026-07-02T00:00:00.000Z");
        const events = await source.getChangeEvents(ACCOUNT, { start: "2026-06-01", end: TODAY });
        expect(events.some((e) => e.id === "old-event")).toBe(true);
        expect(events.filter((e) => e.date >= addDays(TODAY, -29)).length).toBe(ds.changeEvents.filter((e) => e.date >= addDays(TODAY, -29)).length);
        expect(w.repo.counts(ACCOUNT).changeEvents.count).toBeGreaterThan(1);
        w.repo.upsertDims(ACCOUNT, ds.dims, "2026-09-01", "2026-09-01T00:00:00.000Z");
        inner.dims = { ...ds.dims, campaigns: new Map([...ds.dims.campaigns].filter(([id]) => id !== "c8")) };
        const dims = await source.getDims(ACCOUNT);
        expect(dims.campaigns.get("c8")?.name).toBe(ds.dims.campaigns.get("c8")?.name);
        expect(dims.campaigns.size).toBe(ds.dims.campaigns.size);
    });
    it("snapshots Google's estimates at most every ten minutes", async () => {
        const { w, source } = setup();
        await source.getGoogleEstimates(ACCOUNT);
        await source.getGoogleEstimates(ACCOUNT);
        expect(w.repo.counts(ACCOUNT).estimates.simulations).toBeGreaterThan(0);
        expect((w.repo.db.prepare("SELECT COUNT(*) AS n FROM google_recommendation").get() as {
            n: number;
        }).n).toBe(1);
    });
    it("falls back to Google when SQLite fails, and stores nothing with reads off", async () => {
        const broken = setup();
        broken.w.repo.db.close();
        const rows = await broken.source.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-01", end: "2026-09-10" });
        expect(rows.rows.length).toBeGreaterThan(0);
        const inner = new FakeLiveSource(demoDataset(), TODAY);
        const w = memoryWarehouse("live");
        const off = new WarehouseSource(inner, w, { reads: false, restatementDays: 14 });
        await off.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-01", end: "2026-09-10" });
        await off.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-01", end: "2026-09-10" });
        expect(inner.calls).toHaveLength(2);
        expect(w.repo.storedSpan(ACCOUNT, "campaign_daily")).toBeNull();
    });
});
describe("warehouse read path (demo)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("returns exactly what the demo generator returns, and leaves overlays (dims, search terms, events) to it", { timeout: 20000 }, async () => {
        const demo = new FixtureGoogleAdsSource();
        const w = memoryWarehouse("live");
        const source = new WarehouseSource(demo, w, { reads: true, restatementDays: 14 });
        for (const table of DAILY_TABLE_IDS) {
            const range = { start: "2026-09-05", end: "2026-09-28" };
            const want = sorted((await demo.getTable(ACCOUNT, table, range)).rows);
            expect(sorted((await source.getTable(ACCOUNT, table, range)).rows)).toEqual(want);
            expect(sorted((await source.getTable(ACCOUNT, table, range)).rows)).toEqual(want);
        }
        expect(w.repo.storedSpan(ACCOUNT, "campaign_daily")).toEqual({ start: "2026-09-05", end: "2026-09-14" });
        expect(await source.getDims(ACCOUNT)).toBe(await demo.getDims(ACCOUNT));
        expect(sorted((await source.getTable(ACCOUNT, "search_term_daily", { start: "2026-09-01", end: "2026-09-28" })).rows)).toEqual(sorted((await demo.getTable(ACCOUNT, "search_term_daily", { start: "2026-09-01", end: "2026-09-28" })).rows));
        expect(w.repo.storedSpan(ACCOUNT, "search_term_daily")).toBeNull();
    });
});
