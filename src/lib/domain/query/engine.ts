import { addDays, compareRange, diffDays, enumerate, isCivilDate, rangeDays, resolvePreset, type DateRange } from "../dates";
import type { Aggregates, MetricDef, MetricRegistry } from "../metrics/registry";
import { DIMENSIONS, type DimensionKey, type DimensionValue } from "../schema/dimensions";
import { FACT_TABLES, FACT_TABLE_IDS, type EntityDims, type FactTableId, type MeasureKey } from "../schema/facts";
import type { CivilDate } from "../types";
import type { QueryColumn, QueryFilter, QueryHaving, QueryResult, QueryRow, QuerySourceMeta, QuerySpec } from "./spec";
export class QueryError extends Error {
    constructor(public readonly code: "QUERY_UNSUPPORTED" | "VALIDATION_ERROR", message: string) {
        super(message);
        this.name = "QueryError";
    }
}
export interface QueryPlan {
    spec: QuerySpec;
    table: FactTableId;
    current: DateRange;
    compare: DateRange | null;
    fetchRange: DateRange;
    metrics: MetricDef[];
    measures: MeasureKey[];
    dimensions: DimensionKey[];
    warnings: string[];
}
export interface PlanContext {
    today: CivilDate;
    registry: MetricRegistry;
}
export function resolveDateRange(spec: QuerySpec["dateRange"], today: CivilDate): DateRange {
    if ("preset" in spec)
        return resolvePreset(spec.preset, today, spec.includeToday);
    if (!isCivilDate(spec.start) || !isCivilDate(spec.end))
        throw new QueryError("VALIDATION_ERROR", "Invalid date range");
    return spec.start <= spec.end ? { start: spec.start, end: spec.end } : { start: spec.end, end: spec.start };
}
const MAX_RANGE_DAYS = 800;
export function planQuery(spec: QuerySpec, ctx: PlanContext): QueryPlan {
    const warnings: string[] = [];
    const metrics: MetricDef[] = [];
    for (const key of spec.metrics) {
        const def = ctx.registry.get(key);
        if (!def)
            throw new QueryError("VALIDATION_ERROR", `Unknown metric "${key}"`);
        metrics.push(def);
    }
    for (const h of spec.having) {
        if (!ctx.registry.has(h.metric))
            throw new QueryError("VALIDATION_ERROR", `Unknown metric "${h.metric}" in having`);
    }
    const current = resolveDateRange(spec.dateRange, ctx.today);
    if (rangeDays(current) > MAX_RANGE_DAYS)
        throw new QueryError("VALIDATION_ERROR", `Date range is longer than ${MAX_RANGE_DAYS} days`);
    const compare = compareRange(current, spec.compare);
    const dims = [...new Set(spec.dimensions)];
    const requiredFields = new Set<string>();
    for (const d of dims)
        requiredFields.add(DIMENSIONS[d].field);
    for (const f of spec.filters)
        requiredFields.add(DIMENSIONS[f.dim].field);
    const havingDefs = spec.having.map((h) => ctx.registry.get(h.metric)).filter((d): d is MetricDef => !!d);
    const measures = [...new Set([...metrics, ...havingDefs].flatMap((m) => m.deps))];
    const platformSource = spec.source !== "google_ads";
    const candidates = FACT_TABLE_IDS.map((id) => FACT_TABLES[id])
        .filter((t) => (platformSource ? t.sources.includes("platform") : t.sources.includes("google_ads")))
        .filter((t) => [...requiredFields].every((f) => t.fields.includes(f)))
        .filter((t) => measures.every((m) => t.measures.includes(m)))
        .sort((a, b) => a.rank - b.rank);
    const table = candidates[0];
    if (!table)
        throw new QueryError("QUERY_UNSUPPORTED", unsupportedHint(spec, requiredFields, measures, platformSource));
    if (dims.includes("hour") && measures.some((m) => m.startsWith("is_")))
        warnings.push("Impression share is not reported by hour.");
    if (spec.metrics.includes("mer") && dims.includes("platform"))
        warnings.push("MER is a blended metric; per-platform values are not meaningful.");
    const fetchRange: DateRange = compare ? { start: compare.start < current.start ? compare.start : current.start, end: current.end > compare.end ? current.end : compare.end } : current;
    return { spec, table: table.id, current, compare, fetchRange, metrics, measures, dimensions: dims, warnings };
}
function unsupportedHint(spec: QuerySpec, fields: Set<string>, measures: MeasureKey[], platform: boolean): string {
    if (platform && [...fields].some((f) => f !== "date" && f !== "platform" && f !== "platform_campaign" && f !== "account_id"))
        return "Cross-channel data only supports date and platform breakdowns.";
    if (!platform && fields.has("platform"))
        return "Platform breakdowns need the cross-channel (blended) source.";
    if (measures.some((m) => m.startsWith("qs_")) && !fields.has("keyword_id"))
        return "Quality Score needs a keyword breakdown or keyword data.";
    if (fields.has("hour") && (fields.has("device") || fields.has("country")))
        return "Hour cannot be combined with device or country breakdowns.";
    if (measures.some((m) => m.startsWith("is_")) && fields.size > 3)
        return "Impression share is only available by date and campaign.";
    if (measures.includes("store_revenue") && !platform)
        return "MER needs the cross-channel (blended) source.";
    return `This combination of metrics and breakdowns is not available (${spec.metrics.join(", ")}).`;
}
export interface FactSlice {
    rows: readonly Record<string, unknown>[];
    grain: "daily" | "range";
    coverage?: DateRange;
    compareRows?: readonly Record<string, unknown>[];
}
export interface ExecuteContext {
    dims: EntityDims;
    registry: MetricRegistry;
    currency: string;
    timezone: string;
    sources: QuerySourceMeta[];
}
interface Group {
    key: string;
    values: DimensionValue[];
    agg: Aggregates;
}
function matchesFilter(value: DimensionValue, f: QueryFilter): boolean {
    const v = value.id.toLowerCase();
    const label = value.label.toLowerCase();
    const list = (Array.isArray(f.value) ? f.value : [f.value]).map((x) => String(x).toLowerCase());
    const first = list[0] ?? "";
    switch (f.op) {
        case "eq":
            return v === first || label === first;
        case "neq":
            return v !== first && label !== first;
        case "in":
            return list.includes(v) || list.includes(label);
        case "nin":
            return !list.includes(v) && !list.includes(label);
        case "contains":
            return label.includes(first) || v.includes(first);
        case "ncontains":
            return !label.includes(first) && !v.includes(first);
        case "starts_with":
            return label.startsWith(first) || v.startsWith(first);
    }
}
function matchesHaving(v: number | null, h: QueryHaving): boolean {
    if (v === null)
        return false;
    const x = h.value;
    switch (h.op) {
        case "gt":
            return typeof x === "number" && v > x;
        case "gte":
            return typeof x === "number" && v >= x;
        case "lt":
            return typeof x === "number" && v < x;
        case "lte":
            return typeof x === "number" && v <= x;
        case "eq":
            return typeof x === "number" && Math.abs(v - x) < 1e-9;
        case "neq":
            return typeof x === "number" && Math.abs(v - x) >= 1e-9;
        case "between":
            return Array.isArray(x) && v >= x[0] && v <= x[1];
    }
}
function accumulate(agg: Aggregates, row: Record<string, unknown>, measures: readonly MeasureKey[]): void {
    for (const m of measures) {
        const v = row[m];
        if (typeof v === "number" && Number.isFinite(v))
            agg[m] = (agg[m] ?? 0) + v;
    }
}
function groupRows(rows: readonly Record<string, unknown>[], range: DateRange | null, plan: QueryPlan, dims: EntityDims, grain: "daily" | "range"): Map<string, Group> {
    const groups = new Map<string, Group>();
    const filters = plan.spec.filters;
    for (const row of rows) {
        if (range && grain === "daily") {
            const d = row.date as string | null | undefined;
            if (!d || d < range.start || d > range.end)
                continue;
        }
        let ok = true;
        for (const f of filters) {
            if (!matchesFilter(DIMENSIONS[f.dim].resolve(row, dims), f)) {
                ok = false;
                break;
            }
        }
        if (!ok)
            continue;
        const values = plan.dimensions.map((d) => DIMENSIONS[d].resolve(row, dims));
        const key = values.map((v) => v.id).join("\u0001");
        let g = groups.get(key);
        if (!g) {
            g = { key, values, agg: {} };
            groups.set(key, g);
        }
        accumulate(g.agg, row, plan.measures);
    }
    return groups;
}
function metricValues(agg: Aggregates, defs: readonly MetricDef[], registry: MetricRegistry): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const d of defs)
        out[d.key] = registry.computeValue(d.key, agg);
    return out;
}
function sumAggs(groups: Iterable<Group>): Aggregates {
    const total: Aggregates = {};
    for (const g of groups)
        for (const [k, v] of Object.entries(g.agg))
            total[k as MeasureKey] = (total[k as MeasureKey] ?? 0) + (v ?? 0);
    return total;
}
function timeIndexKey(plan: QueryPlan): number {
    return plan.dimensions.findIndex((d) => DIMENSIONS[d].kind === "time" && DIMENSIONS[d].derivedFromDate);
}
export function executeQuery(plan: QueryPlan, slice: FactSlice, ctx: ExecuteContext, tookMs = 0): QueryResult {
    const warnings = [...plan.warnings];
    if (slice.grain === "range" && plan.dimensions.some((d) => DIMENSIONS[d].derivedFromDate)) {
        throw new QueryError("QUERY_UNSUPPORTED", "This data is only available as a total for the period (no daily breakdown).");
    }
    if (slice.coverage) {
        if (plan.current.start < slice.coverage.start)
            warnings.push(`Data is available from ${slice.coverage.start}; earlier days are missing.`);
        if (plan.compare && plan.compare.start < slice.coverage.start)
            warnings.push("The comparison period is only partly covered by available data.");
    }
    const current = groupRows(slice.rows, plan.current, plan, ctx.dims, slice.grain);
    const compareSource = slice.grain === "range" ? (slice.compareRows ?? []) : slice.rows;
    const compare = plan.compare ? groupRows(compareSource, plan.compare, plan, ctx.dims, slice.grain) : null;
    const dateIdx = plan.dimensions.indexOf("date");
    if (plan.spec.fillGaps && dateIdx === 0 && plan.dimensions.length === 1 && slice.grain === "daily") {
        for (const d of enumerate(plan.current.start, plan.current.end)) {
            if (!current.has(d))
                current.set(d, { key: d, values: [{ id: d, label: d }], agg: {} });
        }
        if (compare && plan.compare) {
            for (const d of enumerate(plan.compare.start, plan.compare.end)) {
                if (!compare.has(d))
                    compare.set(d, { key: d, values: [{ id: d, label: d }], agg: {} });
            }
        }
    }
    const havingDefs = plan.spec.having.map((h) => ({ h, def: ctx.registry.get(h.metric) as MetricDef }));
    const allDefs = [...plan.metrics, ...havingDefs.map((x) => x.def).filter((d) => !plan.metrics.includes(d))];
    const tIdx = timeIndexKey(plan);
    let compareLookup: ((g: Group) => Group | undefined) | null = null;
    if (compare && plan.compare) {
        if (tIdx < 0) {
            compareLookup = (g) => compare.get(g.key);
        }
        else if (plan.dimensions[tIdx] === "date") {
            const shift = diffDays(plan.compare.start, plan.current.start);
            compareLookup = (g) => {
                const vals = g.values.map((v, i) => (i === tIdx ? addDays(v.id, -shift) : v.id));
                return compare.get(vals.join("\u0001"));
            };
        }
        else {
            const rank = (groups: Map<string, Group>) => {
                const vals = [...new Set([...groups.values()].map((g) => g.values[tIdx]?.id ?? ""))].sort();
                return new Map(vals.map((v, i) => [v, i]));
            };
            const curRank = rank(current);
            const cmpRank = rank(compare);
            const cmpByRank = new Map<string, Group>();
            for (const g of compare.values()) {
                const r = cmpRank.get(g.values[tIdx]?.id ?? "") ?? -1;
                const k = g.values.map((v, i) => (i === tIdx ? String(r) : v.id)).join("\u0001");
                cmpByRank.set(k, g);
            }
            compareLookup = (g) => {
                const r = curRank.get(g.values[tIdx]?.id ?? "") ?? -1;
                return cmpByRank.get(g.values.map((v, i) => (i === tIdx ? String(r) : v.id)).join("\u0001"));
            };
        }
    }
    let rows: {
        row: QueryRow;
        sortVals: Record<string, number | string | null>;
        group: Group;
    }[] = [];
    for (const g of current.values()) {
        const vals = metricValues(g.agg, allDefs, ctx.registry);
        if (!havingDefs.every(({ h, def }) => matchesHaving(vals[def.key] ?? null, h)))
            continue;
        const row: QueryRow = {};
        plan.dimensions.forEach((d, i) => {
            const v = g.values[i] as DimensionValue;
            const kind = DIMENSIONS[d].kind;
            if (kind === "entity" && d !== "search_term" && d !== "platform_campaign") {
                row[d] = v.label;
                row[`${d}_id`] = v.id;
            }
            else if (d === "hour") {
                row[d] = Number(v.id);
            }
            else if (d === "dow") {
                row[d] = v.label;
                row.dow_id = Number(v.id);
            }
            else if (d === "country" || d === "platform" || d === "bidding_strategy") {
                row[d] = v.label;
                row[`${d}_id`] = v.id;
            }
            else {
                row[d] = v.label;
            }
        });
        for (const m of plan.metrics)
            row[m.key] = vals[m.key] ?? null;
        if (compareLookup) {
            const cg = compareLookup(g);
            const prev = cg ? metricValues(cg.agg, plan.metrics, ctx.registry) : {};
            for (const m of plan.metrics) {
                const cur = vals[m.key] ?? null;
                const p = prev[m.key] ?? null;
                row[`${m.key}__prev`] = p;
                row[`${m.key}__delta`] = cur !== null && p !== null ? cur - p : null;
                row[`${m.key}__pct`] = cur !== null && p !== null && p !== 0 ? cur / p - 1 : null;
            }
        }
        rows.push({ row, sortVals: row as Record<string, number | string | null>, group: g });
    }
    const totalsAgg = sumAggs(rows.map((r) => r.group));
    const totals = plan.spec.totals === false ? undefined : metricValues(totalsAgg, plan.metrics, ctx.registry);
    const compareTotals = compare ? metricValues(sumAggs(compare.values()), plan.metrics, ctx.registry) : undefined;
    const sortSpec = plan.spec.sort && plan.spec.sort.length
        ? plan.spec.sort
        : tIdx >= 0 || plan.dimensions.includes("hour")
            ? [{ key: plan.dimensions.find((d) => DIMENSIONS[d].kind === "time") ?? "date", dir: "asc" as const }]
            : plan.metrics[0]
                ? [{ key: plan.metrics[0].key, dir: "desc" as const }]
                : [];
    const sortKeyOf = (r: QueryRow, key: string): number | string | null => {
        if (key === "dow")
            return (r.dow_id as number | undefined) ?? null;
        return r[key] ?? null;
    };
    rows.sort((a, b) => {
        for (const s of sortSpec) {
            const av = sortKeyOf(a.row, s.key);
            const bv = sortKeyOf(b.row, s.key);
            if (av === bv)
                continue;
            if (av === null)
                return 1;
            if (bv === null)
                return -1;
            const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
            if (cmp !== 0)
                return s.dir === "asc" ? cmp : -cmp;
        }
        return 0;
    });
    const limit = Math.min(plan.spec.limit ?? 1000, 10000);
    const truncated = rows.length > limit;
    if (truncated)
        rows = rows.slice(0, limit);
    const columns: QueryColumn[] = [
        ...plan.dimensions.map((d) => ({ key: d, label: DIMENSIONS[d].label, kind: "dimension" as const })),
        ...plan.metrics.map((m) => ({ key: m.key, label: m.label, kind: "metric" as const, format: m.format })),
    ];
    return {
        columns,
        rows: rows.map((r) => r.row),
        totals,
        compareTotals,
        meta: {
            range: { start: plan.current.start, end: plan.current.end, days: rangeDays(plan.current) },
            compareRange: plan.compare ?? undefined,
            table: plan.table,
            grain: slice.grain,
            currency: ctx.currency,
            timezone: ctx.timezone,
            sources: ctx.sources,
            truncated,
            rowCount: rows.length,
            warnings,
            tookMs,
        },
    };
}
export function aggregateRows(rows: readonly Record<string, unknown>[], measures: readonly MeasureKey[]): Aggregates {
    const agg: Aggregates = {};
    for (const r of rows)
        accumulate(agg, r, measures);
    return agg;
}
