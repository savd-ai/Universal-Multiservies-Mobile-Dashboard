import "server-only";
import type { ApiRange, CampaignDetail, CampaignListResponse, CampaignListRow, CampaignMetrics, ChangeEventsResponse, ChangeImpactMetric, ChangeImpactResult } from "@/lib/domain/contracts/actions";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { addDays, enumerate, minDate, type CompareMode, type DatePreset } from "@/lib/domain/dates";
import { additiveContributions, logDecomposition, ratioContributions, type DriverContribution, type DriversSummary, type LogDecomposition, type Totals } from "@/lib/domain/insights/drivers";
import { querySpecSchema, type QueryFilter, type QueryResult, type QueryRow, type QuerySource, type QuerySpecInput } from "@/lib/domain/query/spec";
import { humanizeEnum, type DimensionKey } from "@/lib/domain/schema/dimensions";
import type { CampaignDailyRow, SearchTermMatchType, SearchTermStatus } from "@/lib/domain/schema/facts";
import { mean, round, welchT } from "@/lib/domain/stats";
import type { CivilDate, Severity } from "@/lib/domain/types";
import { listSignals } from "./anomaly/service";
import { getPacingReport } from "./budget/service";
import { loadCampaignDaily, loadCampaigns, loadChangeEvents } from "./budget/data";
import type { RequestContext } from "./context";
import { googleAdsConfig } from "./env/config";
import { AppError, notFound } from "./http/errors";
import { log } from "./log";
import { runQuery } from "./query/service";
const METRICS = ["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa", "roas", "conv_value", "cvr"] as const;
const SEVERITY_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export interface RangeQuery {
    range?: DatePreset;
    start?: CivilDate;
    end?: CivilDate;
    compare?: CompareMode;
}
export function deepLink(accountId: string, campaignId: string): string {
    return googleAdsConfig()
        .uiUrlTemplate.replace(/\{campaignId\}/g, encodeURIComponent(campaignId))
        .replace(/\{customerId\}/g, encodeURIComponent(accountId));
}
const dateRangeOf = (q: RangeQuery): QuerySpecInput["dateRange"] => (q.start && q.end ? { start: q.start, end: q.end } : { preset: q.range ?? "last_30d" });
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ratio = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
function metricsOf(src: Record<string, unknown> | undefined, suffix = ""): CampaignMetrics {
    const g = (k: string) => src?.[`${k}${suffix}`];
    return {
        cost: round(num(g("cost")), 2),
        impressions: num(g("impressions")),
        clicks: num(g("clicks")),
        ctr: ratio(g("ctr")),
        cpc: ratio(g("cpc")),
        conversions: round(num(g("conversions")), 2),
        cpa: ratio(g("cpa")),
        roas: ratio(g("roas")),
        conv_value: round(num(g("conv_value")), 2),
        cvr: ratio(g("cvr")),
    };
}
const zeroMetrics = (): CampaignMetrics => metricsOf(undefined);
function rangeOf(result: QueryResult): ApiRange {
    const r = result.meta.range;
    return { start: r.start, end: r.end, days: r.days, compare: result.meta.compareRange ? { start: result.meta.compareRange.start, end: result.meta.compareRange.end } : undefined };
}
async function activeSignals(ctx: RequestContext, warnings: string[]): Promise<SignalView[]> {
    try {
        return await listSignals(ctx);
    }
    catch (err) {
        log.warn("Signals unavailable for campaigns", { error: err instanceof Error ? err.message : String(err) });
        warnings.push("Anomaly signals are unavailable right now.");
        return [];
    }
}
function denseCost(rows: readonly CampaignDailyRow[], dates: readonly CivilDate[]): Map<string, number[]> {
    const index = new Map(dates.map((d, i) => [d, i]));
    const out = new Map<string, number[]>();
    for (const r of rows) {
        const i = index.get(r.date);
        if (i === undefined)
            continue;
        let arr = out.get(r.campaign_id);
        if (!arr) {
            arr = new Array<number>(dates.length).fill(0);
            out.set(r.campaign_id, arr);
        }
        arr[i] = round((arr[i] as number) + r.cost, 2);
    }
    return out;
}
export async function listCampaigns(ctx: RequestContext, q: RangeQuery): Promise<CampaignListResponse> {
    const warnings: string[] = [];
    const spec = querySpecSchema.parse({ metrics: [...METRICS], dimensions: ["campaign"], dateRange: dateRangeOf(q), compare: q.compare ?? "none", limit: 10000 });
    const [result, campaigns, signals] = await Promise.all([runQuery(spec, ctx), loadCampaigns(ctx), activeSignals(ctx, warnings)]);
    warnings.push(...result.meta.warnings);
    const range = rangeOf(result);
    const dates = enumerate(range.start, range.end);
    const spark = denseCost(await loadCampaignDaily(ctx, { start: range.start, end: range.end }), dates);
    const byId = new Map(result.rows.map((r) => [String(r.campaign_id ?? ""), r]));
    const worst = new Map<string, {
        severity: Severity;
        count: number;
    }>();
    for (const s of signals) {
        if (s.status !== "open")
            continue;
        const w = worst.get(s.entity.id);
        worst.set(s.entity.id, { severity: !w || SEVERITY_RANK[s.severity] > SEVERITY_RANK[w.severity] ? s.severity : w.severity, count: (w?.count ?? 0) + 1 });
    }
    const compare = spec.compare !== "none";
    const rows: CampaignListRow[] = campaigns
        .filter((c) => c.status !== "Removed" || byId.has(c.id))
        .map((c) => {
        const r = byId.get(c.id);
        return {
            id: c.id,
            name: c.name,
            type: c.type,
            status: c.status,
            biddingStrategy: c.bidding_strategy,
            biddingLabel: humanizeEnum(c.bidding_strategy),
            dailyBudget: c.budget_daily,
            budgetShared: c.budget_shared,
            budgetId: c.budget_id ?? undefined,
            simulated: c.simulated,
            metrics: r ? metricsOf(r) : zeroMetrics(),
            prev: compare ? (r ? metricsOf(r, "__prev") : zeroMetrics()) : undefined,
            spark: spark.get(c.id) ?? new Array<number>(dates.length).fill(0),
            worstSeverity: worst.get(c.id)?.severity ?? null,
            signalCount: worst.get(c.id)?.count ?? 0,
            deepLink: deepLink(ctx.accountId, c.id),
        };
    })
        .sort((a, b) => b.metrics.cost - a.metrics.cost || a.name.localeCompare(b.name));
    return {
        rows,
        totals: { ...metricsOf(result.totals ?? undefined), dailyBudget: round(enabledBudgetTotal(campaigns), 2), count: rows.length },
        prevTotals: compare ? metricsOf(result.compareTotals ?? undefined) : undefined,
        range,
        mode: ctx.source.mode,
        currency: ctx.account.currency,
        warnings: [...new Set(warnings)],
    };
}
async function safeQuery(ctx: RequestContext, input: QuerySpecInput, warnings: string[], label: string): Promise<QueryResult | null> {
    try {
        const res = await runQuery(querySpecSchema.parse(input), ctx);
        warnings.push(...res.meta.warnings.map((w) => `${label}: ${w}`));
        return res;
    }
    catch (err) {
        warnings.push(`${label} are unavailable: ${err instanceof Error ? err.message : "query failed"}`);
        return null;
    }
}
const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export async function getCampaignDetail(ctx: RequestContext, id: string, q: RangeQuery): Promise<CampaignDetail> {
    const warnings: string[] = [];
    const dims = await ctx.source.getDims(ctx.accountId);
    const c = dims.campaigns.get(id);
    if (!c)
        throw notFound("Campaign");
    const filters = [{ dim: "campaign" as const, op: "eq" as const, value: id }];
    const dateRange = dateRangeOf(q);
    const kpiRes = await runQuery(querySpecSchema.parse({ metrics: [...METRICS], dimensions: [], filters, dateRange, compare: q.compare ?? "previous_period" }), ctx);
    warnings.push(...kpiRes.meta.warnings);
    const range = rangeOf(kpiRes);
    const [devices, adGroups, keywords, terms, hours, rows, signals, pacing, events] = await Promise.all([
        safeQuery(ctx, { metrics: [...METRICS], dimensions: ["device"], filters, dateRange }, warnings, "Devices"),
        safeQuery(ctx, { metrics: [...METRICS], dimensions: ["ad_group"], filters, dateRange }, warnings, "Ad groups"),
        safeQuery(ctx, { metrics: [...METRICS, "avg_qs"], dimensions: ["keyword"], filters, dateRange }, warnings, "Keywords"),
        safeQuery(ctx, { metrics: [...METRICS], dimensions: ["search_term", "st_status", "st_match_type"], filters, dateRange, sort: [{ key: "cost", dir: "desc" }], limit: 50 }, warnings, "Search terms"),
        safeQuery(ctx, { metrics: ["conversions", "clicks", "cost"], dimensions: ["dow", "hour"], filters, dateRange }, warnings, "Hour × weekday"),
        loadCampaignDaily(ctx, { start: range.start, end: range.end }),
        activeSignals(ctx, warnings),
        getPacingReport(ctx).catch(() => null),
        loadChangeEvents(ctx, { start: addDays(ctx.dataThrough, -29), end: ctx.dataThrough }, warnings),
    ]);
    const byDate = new Map<CivilDate, CampaignDetail["daily"][number]>();
    for (const d of enumerate(range.start, range.end))
        byDate.set(d, { date: d, cost: 0, conversions: 0, clicks: 0, impressions: 0, conv_value: 0 });
    for (const r of rows) {
        if (r.campaign_id !== id)
            continue;
        const p = byDate.get(r.date);
        if (!p)
            continue;
        p.cost = round(p.cost + r.cost, 2);
        p.conversions = round(p.conversions + r.conversions, 2);
        p.clicks += r.clicks;
        p.impressions += r.impressions;
        p.conv_value = round(p.conv_value + r.conv_value, 2);
    }
    const pacingRow = pacing?.rows.find((r) => r.campaignIds.includes(id)) ?? null;
    const unitIds = new Set([id, ...(pacingRow ? [pacingRow.unitId] : [])]);
    const matrix = () => DOWS.map(() => new Array<number>(24).fill(0));
    const hourDow = { dows: DOWS, hours: Array.from({ length: 24 }, (_, h) => h), conversions: matrix(), clicks: matrix(), cost: matrix() };
    for (const r of hours?.rows ?? []) {
        const d = Number(r.dow_id) - 1;
        const h = Number(r.hour);
        if (!(d >= 0 && d < 7 && h >= 0 && h < 24))
            continue;
        (hourDow.conversions[d] as number[])[h] = round(num(r.conversions), 2);
        (hourDow.clicks[d] as number[])[h] = num(r.clicks);
        (hourDow.cost[d] as number[])[h] = round(num(r.cost), 2);
    }
    return {
        campaign: { ...c, biddingLabel: humanizeEnum(c.bidding_strategy) },
        deepLink: deepLink(ctx.accountId, id),
        range,
        kpis: metricsOf(kpiRes.totals ?? undefined),
        prev: kpiRes.compareTotals ? metricsOf(kpiRes.compareTotals) : undefined,
        daily: [...byDate.values()],
        budgetLine: [...byDate.keys()].map((date) => ({ date, value: c.budget_daily })),
        signals: signals.filter((s) => unitIds.has(s.entity.id) && s.status !== "resolved"),
        pacing: pacingRow,
        devices: (devices?.rows ?? []).map((r) => ({ device: String(r.device ?? ""), ...metricsOf(r) })),
        adGroups: (adGroups?.rows ?? []).map((r) => {
            const agId = String(r.ad_group_id ?? "");
            return { id: agId, name: String(r.ad_group ?? agId), status: dims.adGroups.get(agId)?.status ?? "Enabled", ...metricsOf(r) };
        }),
        keywords: (keywords?.rows ?? []).map((r: QueryRow) => {
            const kId = String(r.keyword_id ?? "");
            const k = dims.keywords.get(kId);
            const agId = k?.ad_group_id ?? "";
            return {
                id: kId,
                adGroupId: agId,
                adGroupName: dims.adGroups.get(agId)?.name ?? agId,
                text: k?.text ?? String(r.keyword ?? kId),
                matchType: k?.match_type ?? "Broad",
                status: k?.status ?? "Enabled",
                qs: k?.qs ?? null,
                qsCtr: k?.qs_ctr ?? null,
                qsRelevance: k?.qs_relevance ?? null,
                qsLanding: k?.qs_landing ?? null,
                cpcBid: k?.cpc_bid ?? null,
                avgQs: ratio(r.avg_qs),
                ...metricsOf(r),
            };
        }),
        searchTerms: (terms?.rows ?? []).map((r) => ({ term: String(r.search_term ?? ""), status: String(r.st_status ?? "none") as SearchTermStatus, matchType: String(r.st_match_type ?? "Unknown") as SearchTermMatchType, ...metricsOf(r) })),
        hourDow,
        changes: events.filter((e) => e.campaign_id === id),
        mode: ctx.source.mode,
        currency: ctx.account.currency,
        warnings: [...new Set(warnings)],
    };
}
const IMPACT_DAYS = 14;
export async function changeImpact(ctx: RequestContext, campaignId: string, eventId: string): Promise<ChangeImpactResult> {
    const campaigns = await loadCampaigns(ctx);
    if (!campaigns.some((c) => c.id === campaignId))
        throw notFound("Campaign");
    const events = await loadChangeEvents(ctx, { start: addDays(ctx.dataThrough, -119), end: ctx.dataThrough });
    const event = events.find((e) => e.id === eventId && (!e.campaign_id || e.campaign_id === campaignId));
    if (!event)
        throw notFound("Change event");
    const before = { start: addDays(event.date, -IMPACT_DAYS), end: addDays(event.date, -1) };
    const afterEnd = minDate(addDays(event.date, IMPACT_DAYS), ctx.dataThrough);
    const after = { start: addDays(event.date, 1), end: afterEnd };
    const rows = (await loadCampaignDaily(ctx, { start: before.start, end: afterEnd > event.date ? afterEnd : event.date })).filter((r) => r.campaign_id === campaignId);
    const byDate = new Map<CivilDate, CampaignDailyRow>();
    for (const r of rows)
        byDate.set(r.date, r);
    const days = (w: {
        start: CivilDate;
        end: CivilDate;
    }) => (w.start <= w.end ? enumerate(w.start, w.end) : []);
    const facts = (d: CivilDate) => byDate.get(d) ?? { cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 };
    const bDays = days(before);
    const aDays = days(after);
    const defs: {
        metric: ChangeImpactMetric["metric"];
        label: string;
        format: ChangeImpactMetric["format"];
        daily: (f: ReturnType<typeof facts>) => number | null;
        total: (ds: CivilDate[]) => number | null;
    }[] = [
        { metric: "cost", label: "Spend / day", format: "money", daily: (f) => f.cost, total: (ds) => (ds.length ? mean(ds.map((d) => facts(d).cost)) : null) },
        { metric: "conversions", label: "Conversions / day", format: "decimal", daily: (f) => f.conversions, total: (ds) => (ds.length ? mean(ds.map((d) => facts(d).conversions)) : null) },
        {
            metric: "cpa",
            label: "CPA",
            format: "money",
            daily: (f) => (f.conversions > 0 ? f.cost / f.conversions : null),
            total: (ds) => {
                const cost = ds.reduce((s, d) => s + facts(d).cost, 0);
                const conv = ds.reduce((s, d) => s + facts(d).conversions, 0);
                return conv > 0 ? cost / conv : null;
            },
        },
        {
            metric: "ctr",
            label: "CTR",
            format: "percent",
            daily: (f) => (f.impressions > 0 ? f.clicks / f.impressions : null),
            total: (ds) => {
                const clicks = ds.reduce((s, d) => s + facts(d).clicks, 0);
                const impr = ds.reduce((s, d) => s + facts(d).impressions, 0);
                return impr > 0 ? clicks / impr : null;
            },
        },
    ];
    const metrics: ChangeImpactMetric[] = defs.map((m) => {
        const b = bDays.map((d) => m.daily(facts(d))).filter((v): v is number => v !== null);
        const a = aDays.map((d) => m.daily(facts(d))).filter((v): v is number => v !== null);
        const t = welchT(a, b);
        const bv = m.total(bDays);
        const av = m.total(aDays);
        return {
            metric: m.metric,
            label: m.label,
            format: m.format,
            before: bv === null ? null : round(bv, 4),
            after: av === null ? null : round(av, 4),
            deltaPct: bv && av !== null ? round(av / bv - 1, 4) : null,
            t: round(t.t, 3),
            df: round(t.df, 1),
            p: round(t.p, 4),
            significant: t.p < 0.05 && a.length >= 2 && b.length >= 2,
        };
    });
    const note = aDays.length === 0
        ? "The change is too recent — there is no complete day after it yet."
        : aDays.length < 7
            ? `Only ${aDays.length} day${aDays.length === 1 ? "" : "s"} of data after the change; treat the comparison as preliminary.`
            : undefined;
    return { event, before: { ...before, days: bDays.length }, after: { ...after, days: aDays.length }, metrics, note };
}
export async function listChangeEvents(ctx: RequestContext, q: {
    start?: CivilDate;
    end?: CivilDate;
    campaignId?: string;
}): Promise<ChangeEventsResponse> {
    const warnings: string[] = [];
    const end = q.end ?? ctx.dataThrough;
    let start = q.start ?? addDays(end, -29);
    if (start > end)
        start = end;
    if (ctx.source.mode === "live") {
        const oldest = addDays(ctx.today, -29);
        if (start < oldest) {
            start = oldest;
            warnings.push("Google Ads keeps change history for the last 30 days only; earlier changes are not available.");
        }
    }
    const events = (await loadChangeEvents(ctx, { start, end }, warnings)).filter((e) => !q.campaignId || e.campaign_id === q.campaignId);
    return { events, range: { start, end }, warnings };
}
export interface DriversRequest {
    metric: string;
    dimension: DimensionKey;
    dateRange: QuerySpecInput["dateRange"];
    compare: "previous_period" | "previous_year";
    filters: QueryFilter[];
    source: QuerySource;
    limit: number;
}
export interface DriversResponse {
    metric: string;
    label: string;
    format: string;
    dimension: DimensionKey;
    kind: "additive" | "ratio" | "other";
    range: ApiRange;
    total: DriversSummary;
    contributions: DriverContribution[];
    decomposition: LogDecomposition | null;
    warnings: string[];
}
const BASE_KEYS = ["cost", "impressions", "clicks", "conversions", "conv_value"] as const;
export async function computeDrivers(ctx: RequestContext, req: DriversRequest): Promise<DriversResponse> {
    const def = ctx.registry.get(req.metric);
    if (!def)
        throw new AppError("VALIDATION_ERROR", `Unknown metric "${req.metric}"`);
    const warnings: string[] = [];
    const isBase = (k: string) => (BASE_KEYS as readonly string[]).includes(k);
    let kind: DriversResponse["kind"] = "other";
    let num2: string | null = null;
    let den: string | null = null;
    let scale = 1;
    if (def.kind === "base" && isBase(def.key))
        kind = "additive";
    else if (def.kind === "derived" && def.deps.length === 2 && isBase(def.deps[0] as string) && isBase(def.deps[1] as string)) {
        kind = "ratio";
        num2 = def.deps[0] as string;
        den = def.deps[1] as string;
        const m = /^(\d+(?:\.\d+)?) \* /.exec(def.formula ?? "");
        scale = m ? Number(m[1]) : 1;
    }
    const metrics = [...new Set([def.key, ...(num2 && den ? [num2, den] : []), ...BASE_KEYS])].slice(0, 12);
    const result = await runQuery(querySpecSchema.parse({ source: req.source, metrics, dimensions: [req.dimension], filters: req.filters, dateRange: req.dateRange, compare: req.compare, limit: 10000 }), ctx);
    warnings.push(...result.meta.warnings);
    const idOf = (r: QueryRow) => String(r[`${req.dimension}_id`] ?? r[req.dimension] ?? "");
    const labelOf = (r: QueryRow) => String(r[req.dimension] ?? idOf(r));
    const cur = (k: string) => num0(result.totals?.[k]);
    const prev = (k: string) => num0(result.compareTotals?.[k]);
    let out: {
        total: DriversSummary;
        contributions: DriverContribution[];
    };
    if (kind === "additive") {
        const segments = result.rows.map((r) => ({ id: idOf(r), label: labelOf(r), current: num0(r[def.key]), previous: num0(r[`${def.key}__prev`]) }));
        const gone = prev(def.key) - segments.reduce((s, x) => s + x.previous, 0);
        if (Math.abs(gone) > 1e-6)
            segments.push({ id: "__not_in_period__", label: "Not active in this period", current: 0, previous: gone });
        out = additiveContributions(segments);
    }
    else if (kind === "ratio" && num2 && den) {
        const n = num2;
        const d = den;
        const segments = result.rows.map((r) => ({ id: idOf(r), label: labelOf(r), num1: num0(r[n]), den1: num0(r[d]), num0: num0(r[`${n}__prev`]), den0: num0(r[`${d}__prev`]) }));
        const goneN = prev(n) - segments.reduce((s, x) => s + x.num0, 0);
        const goneD = prev(d) - segments.reduce((s, x) => s + x.den0, 0);
        if (Math.abs(goneN) > 1e-6 || Math.abs(goneD) > 1e-6)
            segments.push({ id: "__not_in_period__", label: "Not active in this period", num1: 0, den1: 0, num0: goneN, den0: goneD });
        const ratioOut = ratioContributions(segments, scale);
        if (ratioOut)
            out = ratioOut;
        else {
            warnings.push(`${def.label} is undefined in one of the periods (no ${d}); showing raw differences.`);
            out = additiveContributions(result.rows.map((r) => ({ id: idOf(r), label: labelOf(r), current: num0(r[def.key]), previous: num0(r[`${def.key}__prev`]) })));
        }
    }
    else {
        warnings.push(`${def.label} is not additive; contributions are raw differences per ${req.dimension} and do not sum to the total change.`);
        const diff = additiveContributions(result.rows.map((r) => ({ id: idOf(r), label: labelOf(r), current: num0(r[def.key]), previous: num0(r[`${def.key}__prev`]) })));
        const c = result.totals?.[def.key] ?? null;
        const p = result.compareTotals?.[def.key] ?? null;
        out = { total: { current: c, previous: p, delta: c !== null && p !== null ? c - p : null, deltaPct: c !== null && p ? c / p - 1 : null }, contributions: diff.contributions.map((x) => ({ ...x, share: null })) };
    }
    const totals = (f: (k: string) => number): Totals => ({ cost: f("cost"), impressions: f("impressions"), clicks: f("clicks"), conversions: f("conversions"), conv_value: f("conv_value") });
    return {
        metric: def.key,
        label: def.label,
        format: def.format,
        dimension: req.dimension,
        kind,
        range: rangeOf(result),
        total: out.total,
        contributions: out.contributions.slice(0, req.limit),
        decomposition: logDecomposition(def.key, totals(cur), totals(prev)),
        warnings: [...new Set(warnings)],
    };
}
const num0 = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
function enabledBudgetTotal(campaigns: {
    status: string;
    budget_daily: number | null;
    budget_id?: string | null;
    budget_shared?: boolean;
}[]): number {
    const seen = new Set<string>();
    let total = 0;
    for (const c of campaigns) {
        if (c.status !== "Enabled" || c.budget_daily === null)
            continue;
        if (c.budget_shared && c.budget_id) {
            if (seen.has(c.budget_id))
                continue;
            seen.add(c.budget_id);
        }
        total += c.budget_daily;
    }
    return total;
}
