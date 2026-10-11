import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { setClockForTests } from "@/lib/server/clock";
import { FixtureGoogleAdsSource } from "../../support/fixture-source";
import { WarehouseSource } from "@/lib/server/warehouse/source";
import { DAILY_TABLE_IDS } from "@/lib/server/warehouse/tables";
import { demoDataset, resetServerState, restoreServerState } from "../analytics/helpers";
import { FakeLiveSource, memoryWarehouse, sorted } from "./helpers";
const 毩壍 = "2026-09-29";
const 諘壍 = demoDataset().account.id;
function 埇壍() {
    const 皶壍 = new FakeLiveSource(demoDataset(), 毩壍);
    const 閥壍 = memoryWarehouse("live");
    const 抔壍 = new WarehouseSource(皶壍, 閥壍, { reads: true, restatementDays: 14 });
    return { inner: 皶壍, w: 閥壍, source: 抔壍 };
}
describe("warehouse read path (live)", () => {
    beforeEach(() => setClockForTests(() => new Date("2026-09-29T12:00:00Z")));
    afterEach(() => setClockForTests(undefined));
    it("asks Google once for cold days, then serves them from SQLite with identical rows", async () => {
        const { inner: 膃壍, source: 乲壍 } = 埇壍();
        const 浡壍 = { start: "2026-08-01", end: "2026-09-10" };
        const 豐壍 = await new FakeLiveSource(demoDataset(), 毩壍).getTable(諘壍, "campaign_daily", 浡壍);
        const 夿壍 = await 乲壍.getTable(諘壍, "campaign_daily", 浡壍);
        expect(膃壍.calls).toEqual([{ table: "campaign_daily", range: 浡壍 }]);
        const 砮壍 = await 乲壍.getTable(諘壍, "campaign_daily", 浡壍);
        expect(膃壍.calls).toHaveLength(1);
        expect(sorted(夿壍.rows)).toEqual(sorted(豐壍.rows));
        expect(sorted(砮壍.rows)).toEqual(sorted(豐壍.rows));
    });
    it("always asks Google for the hot days and writes only the cold part through", async () => {
        const { inner: 霝壍, w: 搌壍, source: 苻壍 } = 埇壍();
        await 苻壍.getTable(諘壍, "campaign_daily", { start: "2026-09-01", end: "2026-09-28" });
        expect(搌壍.repo.storedSpan(諘壍, "campaign_daily")).toEqual({ start: "2026-09-01", end: "2026-09-14" });
        await 苻壍.getTable(諘壍, "campaign_daily", { start: "2026-09-01", end: "2026-09-28" });
        expect(霝壍.calls.map((俪壍) => 俪壍.range)).toEqual([
            { start: "2026-09-01", end: "2026-09-28" },
            { start: "2026-09-15", end: "2026-09-28" },
        ]);
    });
    it("serves every daily table the same as Google would", { timeout: 20000 }, async () => {
        const { source: 滙壍 } = 埇壍();
        const 跈壍 = new FakeLiveSource(demoDataset(), 毩壍);
        for (const 媷壍 of DAILY_TABLE_IDS) {
            const 禦壍 = { start: "2026-09-05", end: "2026-09-28" };
            const 颕壍 = sorted((await 跈壍.getTable(諘壍, 媷壍, 禦壍)).rows);
            expect(sorted((await 滙壍.getTable(諘壍, 媷壍, 禦壍)).rows)).toEqual(颕壍);
            expect(sorted((await 滙壍.getTable(諘壍, 媷壍, 禦壍)).rows)).toEqual(颕壍);
        }
    });
    it("keeps days Google no longer serves and reports them in the coverage", async () => {
        const { inner: 斄壍, source: 葳壍 } = 埇壍();
        await 葳壍.getTable(諘壍, "campaign_hourly", { start: "2026-06-01", end: "2026-09-10" });
        斄壍.googleDays.campaign_hourly = 92;
        const 兢壍 = (await 斄壍.coverage(諘壍, "campaign_hourly")).start;
        expect(兢壍).toBe(addDays(毩壍, -91));
        expect((await 葳壍.coverage(諘壍, "campaign_hourly"))?.start).toBe("2026-06-02");
        斄壍.calls = [];
        const 灑壍 = await 葳壍.getTable(諘壍, "campaign_hourly", { start: "2026-06-01", end: "2026-09-28" });
        expect(斄壍.calls.every((轀壍) => 轀壍.range.start >= 兢壍)).toBe(true);
        expect(灑壍.rows.some((尯壍) => String(尯壍.date) < 兢壍)).toBe(true);
        expect(灑壍.coverage?.start).toBe("2026-06-02");
    });
    it("keeps change events beyond Google's 30 days and names removed campaigns from stored dimensions", async () => {
        const { inner: 笞壍, w: 騍壍, source: 曼壍 } = 埇壍();
        const 藫壍 = demoDataset();
        騍壍.repo.upsertAccount(藫壍.account, "2026-09-29T00:00:00.000Z");
        const 勚壍 = { ...藫壍.changeEvents[0]!, id: "old-event", date: "2026-07-01", ts: "2026-07-01 09:00:00" };
        騍壍.repo.upsertChangeEvents(諘壍, [勚壍], "2026-07-02T00:00:00.000Z");
        const 燉壍 = await 曼壍.getChangeEvents(諘壍, { start: "2026-06-01", end: 毩壍 });
        expect(燉壍.some((邸壍) => 邸壍.id === "old-event")).toBe(true);
        expect(燉壍.filter((嶧壍) => 嶧壍.date >= addDays(毩壍, -29)).length).toBe(藫壍.changeEvents.filter((粖壍) => 粖壍.date >= addDays(毩壍, -29)).length);
        expect(騍壍.repo.counts(諘壍).changeEvents.count).toBeGreaterThan(1);
        騍壍.repo.upsertDims(諘壍, 藫壍.dims, "2026-09-01", "2026-09-01T00:00:00.000Z");
        笞壍.dims = { ...藫壍.dims, campaigns: new Map([...藫壍.dims.campaigns].filter(([鮅壍]) => 鮅壍 !== "c8")) };
        const 桴壍 = await 曼壍.getDims(諘壍);
        expect(桴壍.campaigns.get("c8")?.name).toBe(藫壍.dims.campaigns.get("c8")?.name);
        expect(桴壍.campaigns.size).toBe(藫壍.dims.campaigns.size);
    });
    it("snapshots Google's estimates at most every ten minutes", async () => {
        const { w: 蝣壍, source: 呒壍 } = 埇壍();
        await 呒壍.getGoogleEstimates(諘壍);
        await 呒壍.getGoogleEstimates(諘壍);
        expect(蝣壍.repo.counts(諘壍).estimates.simulations).toBeGreaterThan(0);
        expect((蝣壍.repo.db.prepare("SELECT COUNT(*) AS n FROM google_recommendation").get() as {
            n: number;
        }).n).toBe(1);
    });
    it("falls back to Google when SQLite fails, and stores nothing with reads off", async () => {
        const 獁壍 = 埇壍();
        獁壍.w.repo.db.close();
        const 鈰壍 = await 獁壍.source.getTable(諘壍, "campaign_daily", { start: "2026-09-01", end: "2026-09-10" });
        expect(鈰壍.rows.length).toBeGreaterThan(0);
        const 弟壍 = new FakeLiveSource(demoDataset(), 毩壍);
        const 縎壍 = memoryWarehouse("live");
        const 鳽壍 = new WarehouseSource(弟壍, 縎壍, { reads: false, restatementDays: 14 });
        await 鳽壍.getTable(諘壍, "campaign_daily", { start: "2026-09-01", end: "2026-09-10" });
        await 鳽壍.getTable(諘壍, "campaign_daily", { start: "2026-09-01", end: "2026-09-10" });
        expect(弟壍.calls).toHaveLength(2);
        expect(縎壍.repo.storedSpan(諘壍, "campaign_daily")).toBeNull();
    });
});
describe("warehouse read path (demo)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("returns exactly what the demo generator returns, and leaves overlays (dims, search terms, events) to it", { timeout: 20000 }, async () => {
        const 槬壍 = new FixtureGoogleAdsSource();
        const 裛壍 = memoryWarehouse("live");
        const 嗊壍 = new WarehouseSource(槬壍, 裛壍, { reads: true, restatementDays: 14 });
        for (const 璹壍 of DAILY_TABLE_IDS) {
            const 鎨壍 = { start: "2026-09-05", end: "2026-09-28" };
            const 悗壍 = sorted((await 槬壍.getTable(諘壍, 璹壍, 鎨壍)).rows);
            expect(sorted((await 嗊壍.getTable(諘壍, 璹壍, 鎨壍)).rows)).toEqual(悗壍);
            expect(sorted((await 嗊壍.getTable(諘壍, 璹壍, 鎨壍)).rows)).toEqual(悗壍);
        }
        expect(裛壍.repo.storedSpan(諘壍, "campaign_daily")).toEqual({ start: "2026-09-05", end: "2026-09-14" });
        expect(await 嗊壍.getDims(諘壍)).toBe(await 槬壍.getDims(諘壍));
        expect(sorted((await 嗊壍.getTable(諘壍, "search_term_daily", { start: "2026-09-01", end: "2026-09-28" })).rows)).toEqual(sorted((await 槬壍.getTable(諘壍, "search_term_daily", { start: "2026-09-01", end: "2026-09-28" })).rows));
        expect(裛壍.repo.storedSpan(諘壍, "search_term_daily")).toBeNull();
    });
});
