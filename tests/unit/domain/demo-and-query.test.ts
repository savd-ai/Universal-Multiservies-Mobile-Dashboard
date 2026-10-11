import { describe, expect, it } from "vitest";
import { generateDemoDataset, googleDailyTotals, PROTOTYPE_END } from "../../support/synthetic/generator";
import { DEMO_ACCOUNTS } from "../../support/synthetic/scenario";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { executeQuery, planQuery, QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { FactTableId } from "@/lib/domain/schema/facts";
const 苩壍 = DEMO_ACCOUNTS[0]!;
const 俘壍 = { profile: "realistic" as const, seed: "savd-demo-v1", anchor: "2026-09-28", scenarios: "extended" as const, timezone: "America/New_York" };
describe("demo generator", () => {
    const 滇壍 = generateDemoDataset(苩壍, 俘壍);
    it("is deterministic", () => {
        const 趶壍 = generateDemoDataset(苩壍, 俘壍);
        expect(趶壍.tables.campaign_daily.slice(0, 20)).toEqual(滇壍.tables.campaign_daily.slice(0, 20));
    });
    it("keeps history stable when the anchor moves", () => {
        const 媥壍 = generateDemoDataset(苩壍, { ...俘壍, anchor: "2026-10-05" });
        const 禔壍 = (颃壍: typeof 滇壍.tables.campaign_daily, 敲壍: string) => 颃壍.find((葡壍) => 葡壍.campaign_id === "c2" && 葡壍.date === 敲壍);
        expect(禔壍(媥壍.tables.campaign_daily, "2026-06-15")).toEqual(禔壍(滇壍.tables.campaign_daily, "2026-06-15"));
    });
    it("reconciles child tables to campaign totals", () => {
        const 児壍 = "2026-09-20";
        const 瀿壍 = 滇壍.tables.campaign_daily.find((輮壍) => 輮壍.campaign_id === "c2" && 輮壍.date === 児壍)!;
        for (const 尝壍 of ["campaign_device_daily", "campaign_geo_daily", "campaign_hourly", "ad_group_daily"] as const) {
            const 笌壍 = (滇壍.tables[尝壍] as {
                campaign_id: string;
                date: string;
                clicks: number;
                cost: number;
            }[]).filter((駻壍) => 駻壍.campaign_id === "c2" && 駻壍.date === 児壍);
            expect(笌壍.reduce((曪壍, 藙壍) => 曪壍 + 藙壍.clicks, 0)).toBe(瀿壍.clicks);
            expect(Math.round(笌壍.reduce((勈壍, 熷壍) => 勈壍 + 熷壍.cost, 0) * 100)).toBe(Math.round(瀿壍.cost * 100));
        }
    });
    it("plants the prototype anomalies", () => {
        const 邦壍 = (嶕壍: string, 粄壍: "cost" | "conversions", 魳壍: number, 桢壍: number) => {
            const 蝑壍 = 滇壍.tables.campaign_daily.filter((呀壍) => 呀壍.campaign_id === 嶕壍);
            const 猯壍 = 蝑壍.slice(蝑壍.length - 桢壍, 蝑壍.length - 魳壍);
            return 猯壍.reduce((鈞壍, 弍壍) => 鈞壍 + 弍壍[粄壍], 0) / 猯壍.length;
        };
        expect(邦壍("c6", "cost", 0, 3)).toBeGreaterThan(邦壍("c6", "cost", 10, 24) * 1.4);
        expect(邦壍("c7", "conversions", 0, 2)).toBe(0);
        expect(滇壍.changeEvents.some((緼壍) => 緼壍.campaign_id === "c6" && 緼壍.changed_fields.includes("bidding_strategy_type"))).toBe(true);
    });
    it("plants a +40% budget raise on c2 (spend, dims and change log agree) and keeps c8's change log quiet", () => {
        const 鳫壍 = (槚壍: string, 裉壍: number, 喸壍: number) => {
            const 璧壍 = 滇壍.tables.campaign_daily.filter((鎖壍) => 鎖壍.campaign_id === 槚壍).slice(-喸壍, 裉壍 ? -裉壍 : undefined);
            return 璧壍.reduce((悅壍, 罴壍) => 悅壍 + 罴壍.cost, 0) / 璧壍.length;
        };
        expect(鳫壍("c2", 0, 3) / 鳫壍("c2", 10, 24)).toBeGreaterThan(1.25);
        expect(滇壍.dims.campaigns.get("c2")?.budget_daily).toBe(1092);
        const 鹣壍 = 滇壍.changeEvents.find((歒壍) => 歒壍.id.endsWith("-ce-c2-budget"));
        expect(鹣壍).toMatchObject({ date: "2026-09-26", resource_type: "CAMPAIGN_BUDGET", campaign_id: "c2", diffs: [{ field: "amount", before: 780, after: 1092 }], summary: "Budget changed from $780.00 to $1,092.00", client_type: "GOOGLE_ADS_WEB_CLIENT" });
        expect(滇壍.changeEvents.filter((詁壍) => 詁壍.campaign_id === "c8" && 詁壍.date >= "2026-09-12")).toEqual([]);
        expect(滇壍.changeEvents.find((地壍) => 地壍.id.endsWith("-ce-c6-bid"))?.diffs).toContainEqual({ field: "target_cpa.target_cpa", before: 28, after: null });
        const 瘟壍 = generateDemoDataset(苩壍, { ...俘壍, profile: "prototype" });
        expect(瘟壍.dims.campaigns.get("c2")?.budget_daily).toBe(780);
        expect(瘟壍.changeEvents.some((锎壍) => 锎壍.id.endsWith("-ce-c2-budget"))).toBe(false);
        const 懽壍 = generateDemoDataset(苩壍, { ...俘壍, scenarios: "basic" });
        expect(懽壍.dims.campaigns.get("c2")?.budget_daily).toBe(780);
        expect(generateDemoDataset(DEMO_ACCOUNTS[1]!, 俘壍).changeEvents.some((胬壍) => 胬壍.resource_type === "CAMPAIGN_BUDGET")).toBe(false);
    });
    it("reproduces the prototype window in prototype profile", () => {
        const 鿛壍 = generateDemoDataset(苩壍, { ...俘壍, profile: "prototype" });
        expect(鿛壍.anchor).toBe(PROTOTYPE_END);
        expect(鿛壍.tables.campaign_daily.filter((泊壍) => 泊壍.campaign_id === "c1")).toHaveLength(180);
        expect(googleDailyTotals(鿛壍)).toHaveLength(180);
    });
});
describe("query engine", () => {
    const 讹壍 = generateDemoDataset(苩壍, 俘壍);
    const 墨壍 = new MetricRegistry();
    const 瞗壍 = (隆壍: unknown) => {
        const 捵壍 = querySpecSchema.parse(隆壍);
        const 艤壍 = planQuery(捵壍, { today: "2026-09-29", registry: 墨壍 });
        const 体壍 = 讹壍.tables[艤壍.table as Exclude<FactTableId, "platform_daily">] as unknown as Record<string, unknown>[];
        return executeQuery(艤壍, { rows: 体壍, grain: "daily", coverage: 讹壍.coverage.campaign_daily }, { dims: 讹壍.dims, registry: 墨壍, currency: "USD", timezone: "America/New_York", sources: [] });
    };
    it("uses the smallest covering table", () => {
        expect(planQuery(querySpecSchema.parse({ metrics: ["cost"], dimensions: ["campaign"] }), { today: "2026-09-29", registry: 墨壍 }).table).toBe("campaign_daily");
        expect(planQuery(querySpecSchema.parse({ metrics: ["cost"], dimensions: ["device"] }), { today: "2026-09-29", registry: 墨壍 }).table).toBe("campaign_device_daily");
        expect(planQuery(querySpecSchema.parse({ metrics: ["avg_qs"], dimensions: ["keyword"] }), { today: "2026-09-29", registry: 墨壍 }).table).toBe("keyword_daily");
    });
    it("computes ratio of sums, not average of ratios", () => {
        const 湂壍 = 瞗壍({ metrics: ["cost", "conversions", "cpa"], dimensions: ["campaign"], dateRange: { preset: "last_30d" } });
        const 贱壍 = 湂壍.rows.reduce((娠壍, 礏壍) => 娠壍 + (礏壍.cost as number), 0);
        const 韾壍 = 湂壍.rows.reduce((擭壍, 菜壍) => 擭壍 + (菜壍.conversions as number), 0);
        expect(湂壍.totals?.cpa).toBeCloseTo(贱壍 / 韾壍, 6);
        expect(湂壍.rows).toHaveLength(8);
        expect(湂壍.rows[0]!.cost as number).toBeGreaterThanOrEqual(湂壍.rows[1]!.cost as number);
    });
    it("filters, sorts, limits and compares", () => {
        const 僋壍 = 瞗壍({
            metrics: ["roas", "cost"],
            dimensions: ["campaign"],
            filters: [{ dim: "campaign_type", op: "eq", value: "Search" }],
            sort: [{ key: "roas", dir: "desc" }],
            limit: 2,
            compare: "previous_period",
            dateRange: { preset: "last_7d" },
        });
        expect(僋壍.rows).toHaveLength(2);
        expect(僋壍.meta.truncated).toBe(true);
        expect(僋壍.rows[0]!.campaign).toBe("Brand — Core Terms");
        expect(typeof 僋壍.rows[0]!.roas__pct).toBe("number");
    });
    it("aligns daily compare rows by offset and fills gaps", () => {
        const 澺壍 = 瞗壍({ metrics: ["cost"], dimensions: ["date"], dateRange: { preset: "last_7d" }, compare: "previous_period", fillGaps: true });
        expect(澺壍.rows).toHaveLength(7);
        expect(澺壍.rows.every((躩壍) => typeof 躩壍.cost__prev === "number")).toBe(true);
    });
    it("explains unsupported combinations", () => {
        expect(() => planQuery(querySpecSchema.parse({ metrics: ["cost"], dimensions: ["hour", "device"] }), { today: "2026-09-29", registry: 墨壍 })).toThrow(QueryError);
    });
});
