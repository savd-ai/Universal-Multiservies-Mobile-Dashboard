import "server-only";
import { maxDate, minDate } from "@/lib/domain/dates";
import { executeQuery, planQuery, type FactSlice } from "@/lib/domain/query/engine";
import { specHash, type QueryResult, type QuerySourceMeta, type QuerySpec } from "@/lib/domain/query/spec";
import { describeBlankReason } from "@/lib/domain/types";
import { Lru, singleton } from "../cache";
import type { RequestContext } from "../context";
import type { GoogleTableId } from "../datasource/types";
const resultCache = () => singleton("query:results", () => new Lru<QueryResult>(300, 60000));
const epoch = () => singleton("query:epoch", () => ({ n: 0 }));
export function invalidateQueryCache(): void {
    epoch().n++;
    resultCache().clear();
}
export async function runQuery(spec: QuerySpec, ctx: RequestContext): Promise<QueryResult> {
    const t0 = Date.now();
    const key = `${ctx.source.mode}|${ctx.accountId}|${ctx.today}|${epoch().n}|${specHash(spec)}`;
    const hit = resultCache().get(key);
    if (hit)
        return hit;
    const plan = planQuery(spec, { today: ctx.today, registry: ctx.registry });
    let slice: FactSlice;
    let sources: QuerySourceMeta[] = [];
    const extraWarnings: string[] = [];
    if (plan.table === "platform_daily") {
        slice = { rows: [], grain: "daily" };
        extraWarnings.push("Only Google Ads data is available; other platforms are not connected.");
    }
    else {
        const table = plan.table as GoogleTableId;
        const coverage = await ctx.source.coverage(ctx.accountId, table);
        const range = coverage ? { start: maxDate(plan.fetchRange.start, coverage.start), end: minDate(plan.fetchRange.end, coverage.end) } : plan.fetchRange;
        slice = range.start <= range.end ? await ctx.source.getTable(ctx.accountId, table, range) : { rows: [], grain: "daily", coverage: coverage ?? undefined };
        if (slice.grain === "range" && plan.compare) {
            const clamp = (r: {
                start: string;
                end: string;
            }) => (coverage ? { start: maxDate(r.start, coverage.start), end: minDate(r.end, coverage.end) } : r);
            const fetch = async (r: {
                start: string;
                end: string;
            }) => (r.start <= r.end ? (await ctx.source.getTable(ctx.accountId, table, r)).rows : []);
            const [cur, cmp] = await Promise.all([fetch(clamp(plan.current)), fetch(clamp(plan.compare))]);
            slice = { rows: cur, grain: "range", compareRows: cmp };
        }
        if (coverage)
            slice.coverage = coverage;
        sources = [{ id: "google_ads", label: "Google Ads", mode: ctx.source.mode, reason: ctx.source.reason ? describeBlankReason(ctx.source.reason) : undefined }];
    }
    const dims = await ctx.source.getDims(ctx.accountId);
    const result = executeQuery(plan, slice, { dims, registry: ctx.registry, currency: ctx.account.currency, timezone: ctx.account.timezone, sources });
    result.meta.warnings.push(...extraWarnings);
    result.meta.tookMs = Date.now() - t0;
    resultCache().set(key, result);
    return result;
}
