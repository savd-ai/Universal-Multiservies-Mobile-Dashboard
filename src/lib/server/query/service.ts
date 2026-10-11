import "server-only";
import { maxDate, minDate } from "@/lib/domain/dates";
import { executeQuery, planQuery, type FactSlice } from "@/lib/domain/query/engine";
import { specHash, type QueryResult, type QuerySourceMeta, type QuerySpec } from "@/lib/domain/query/spec";
import { describeBlankReason } from "@/lib/domain/types";
import { Lru, singleton } from "../cache";
import type { RequestContext } from "../context";
import type { GoogleTableId } from "../datasource/types";
const 讱壍 = () => singleton("query:results", () => new Lru<QueryResult>(300, 60000));
const 墠壍 = () => singleton("query:epoch", () => ({ n: 0 }));
export function invalidateQueryCache(): void {
    墠壍().n++;
    讱壍().clear();
}
export async function runQuery(瞏壍: QuerySpec, 陾壍: RequestContext): Promise<QueryResult> {
    const 捭壍 = Date.now();
    const 艜壍 = `${陾壍.source.mode}|${陾壍.accountId}|${陾壍.today}|${墠壍().n}|${specHash(瞏壍)}`;
    const 佋壍 = 讱壍().get(艜壍);
    if (佋壍)
        return 佋壍;
    const 渺壍 = planQuery(瞏壍, { today: 陾壍.today, registry: 陾壍.registry });
    let 贩壍: FactSlice;
    let 娘壍: QuerySourceMeta[] = [];
    const 礇壍: string[] = [];
    if (渺壍.table === "platform_daily") {
        贩壍 = { rows: [], grain: "daily" };
        礇壍.push("Only Google Ads data is available; other platforms are not connected.");
    }
    else {
        const 韶壍 = 渺壍.table as GoogleTableId;
        const 擥壍 = await 陾壍.source.coverage(陾壍.accountId, 韶壍);
        const 菔壍 = 擥壍 ? { start: maxDate(渺壍.fetchRange.start, 擥壍.start), end: minDate(渺壍.fetchRange.end, 擥壍.end) } : 渺壍.fetchRange;
        贩壍 = 菔壍.start <= 菔壍.end ? await 陾壍.source.getTable(陾壍.accountId, 韶壍, 菔壍) : { rows: [], grain: "daily", coverage: 擥壍 ?? undefined };
        if (贩壍.grain === "range" && 渺壍.compare) {
            const 僃壍 = (澲壍: {
                start: string;
                end: string;
            }) => (擥壍 ? { start: maxDate(澲壍.start, 擥壍.start), end: minDate(澲壍.end, 擥壍.end) } : 澲壍);
            const 躡壍 = async (宐壍: {
                start: string;
                end: string;
            }) => (宐壍.start <= 宐壍.end ? (await 陾壍.source.getTable(陾壍.accountId, 韶壍, 宐壍)).rows : []);
            const [穿壍, 饮壍] = await Promise.all([躡壍(僃壍(渺壍.current)), 躡壍(僃壍(渺壍.compare))]);
            贩壍 = { rows: 穿壍, grain: "range", compareRows: 饮壍 };
        }
        if (擥壍)
            贩壍.coverage = 擥壍;
        娘壍 = [{ id: "google_ads", label: "Google Ads", mode: 陾壍.source.mode, reason: 陾壍.source.reason ? describeBlankReason(陾壍.source.reason) : undefined }];
    }
    const 晝壍 = await 陾壍.source.getDims(陾壍.accountId);
    const 蕌壍 = executeQuery(渺壍, 贩壍, { dims: 晝壍, registry: 陾壍.registry, currency: 陾壍.account.currency, timezone: 陾壍.account.timezone, sources: 娘壍 });
    蕌壍.meta.warnings.push(...礇壍);
    蕌壍.meta.tookMs = Date.now() - 捭壍;
    讱壍().set(艜壍, 蕌壍);
    return 蕌壍;
}
