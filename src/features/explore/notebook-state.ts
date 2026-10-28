import { z } from "zod";
import { widgetQuerySchema, type VizSettings } from "@/lib/domain/contracts/dashboard";
import type { CompareMode } from "@/lib/domain/dates";
import type { DateRangeSpec, QueryFilter, QueryHaving, QuerySpecInput } from "@/lib/domain/query/spec";
import type { DimensionKey } from "@/lib/domain/schema/dimensions";
export const MAX_METRICS = 12;
export const MAX_DIMENSIONS = 3;
export const MAX_FILTERS = 10;
export const MAX_HAVING = 5;
export const MAX_SORT = 3;
export const DEFAULT_LIMIT = 1000;
export const exploreSpecSchema = widgetQuerySchema.omit({ accountId: true }).extend({ metrics: z.array(z.string().min(1).max(64)).max(MAX_METRICS) });
export type ExploreSpec = z.infer<typeof exploreSpecSchema>;
export interface ExploreState {
    spec: ExploreSpec;
    viz?: VizSettings;
}
export type SortItem = {
    key: string;
    dir: "asc" | "desc";
};
export type StepKey = "data" | "metrics" | "groupBy" | "filters" | "having" | "sort" | "date" | "viz";
export type OptionalStep = "groupBy" | "filters" | "having" | "sort";
export const OPTIONAL_STEPS: readonly OptionalStep[] = ["groupBy", "filters", "having", "sort"];
export const SINGLE_VALUE_OPS = new Set<QueryFilter["op"]>(["eq", "neq", "contains", "ncontains", "starts_with"]);
export const isMultiOp = (op: QueryFilter["op"]) => op === "in" || op === "nin";
export function emptySpec(over: Partial<ExploreSpec> = {}): ExploreSpec {
    return { source: "google_ads", metrics: [], dimensions: [], filters: [], having: [], compare: "none", ...over };
}
export function defaultState(): ExploreState {
    return { spec: emptySpec({ metrics: ["cost", "conversions"], dimensions: ["date"] }) };
}
const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
export function sortableKeys(spec: Pick<ExploreSpec, "dimensions" | "metrics" | "compare">): string[] {
    const keys: string[] = [...spec.dimensions, ...spec.metrics];
    if (spec.compare !== "none")
        for (const m of spec.metrics)
            keys.push(`${m}__pct`, `${m}__delta`);
    return keys;
}
export function normalizeSpec(spec: ExploreSpec): ExploreSpec {
    const metrics = uniq(spec.metrics).slice(0, MAX_METRICS);
    const dimensions = uniq(spec.dimensions).slice(0, MAX_DIMENSIONS);
    const next: ExploreSpec = { ...spec, metrics, dimensions, filters: spec.filters.slice(0, MAX_FILTERS), having: spec.having.slice(0, MAX_HAVING) };
    const valid = new Set(sortableKeys(next));
    const sort: SortItem[] = [];
    for (const s of spec.sort ?? [])
        if (valid.has(s.key) && !sort.some((x) => x.key === s.key))
            sort.push(s);
    if (sort.length)
        next.sort = sort.slice(0, MAX_SORT);
    else
        delete next.sort;
    if (next.limit !== undefined) {
        const n = Math.round(Number(next.limit));
        if (Number.isFinite(n) && n >= 1)
            next.limit = Math.min(10000, n);
        else
            delete next.limit;
    }
    return next;
}
function convertFilterValue(value: QueryFilter["value"], toMulti: boolean): QueryFilter["value"] {
    if (toMulti) {
        if (Array.isArray(value))
            return value;
        return value === "" ? [] : [value];
    }
    if (Array.isArray(value))
        return value[0] ?? "";
    return value;
}
function convertHavingValue(value: QueryHaving["value"], op: QueryHaving["op"]): QueryHaving["value"] {
    if (op === "between")
        return Array.isArray(value) ? value : [value, value];
    return Array.isArray(value) ? value[0] : value;
}
export type NotebookAction = {
    type: "replace";
    state: ExploreState;
} | {
    type: "setSpec";
    spec: ExploreSpec;
} | {
    type: "setSource";
    source: string;
} | {
    type: "toggleMetric";
    key: string;
} | {
    type: "removeMetric";
    key: string;
} | {
    type: "moveMetric";
    key: string;
    to: number;
} | {
    type: "toggleDimension";
    key: DimensionKey;
} | {
    type: "moveDimension";
    key: DimensionKey;
    to: number;
} | {
    type: "addFilter";
    filter: QueryFilter;
} | {
    type: "updateFilter";
    index: number;
    patch: Partial<QueryFilter>;
} | {
    type: "removeFilter";
    index: number;
} | {
    type: "toggleFilterValue";
    dim: DimensionKey;
    value: string;
    exclude?: boolean;
} | {
    type: "addHaving";
    having: QueryHaving;
} | {
    type: "updateHaving";
    index: number;
    patch: Partial<QueryHaving>;
} | {
    type: "removeHaving";
    index: number;
} | {
    type: "setSort";
    sort: SortItem[];
} | {
    type: "setLimit";
    limit: number | undefined;
} | {
    type: "setTotals";
    totals: boolean;
} | {
    type: "setDateRange";
    dateRange: DateRangeSpec | undefined;
} | {
    type: "setCompare";
    compare: CompareMode;
} | {
    type: "setViz";
    viz: VizSettings | undefined;
} | {
    type: "clearStep";
    step: OptionalStep | "date" | "viz";
};
function move<T>(list: readonly T[], item: T, to: number): T[] {
    const indexOf = list.indexOf(item);
    if (indexOf < 0)
        return [...list];
    const next = list.filter((x) => x !== item);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
    return next;
}
export function notebookReducer(state: ExploreState, action: NotebookAction): ExploreState {
    const spec = state.spec;
    const withSpec = (patch: Partial<ExploreSpec>): ExploreState => ({ ...state, spec: normalizeSpec({ ...spec, ...patch }) });
    switch (action.type) {
        case "replace":
            return { ...action.state, spec: normalizeSpec(action.state.spec) };
        case "setSpec":
            return { ...state, spec: normalizeSpec(action.spec) };
        case "setSource":
            return withSpec({ source: action.source });
        case "toggleMetric": {
            if (spec.metrics.includes(action.key))
                return withSpec({ metrics: spec.metrics.filter((m) => m !== action.key) });
            if (spec.metrics.length >= MAX_METRICS)
                return state;
            return withSpec({ metrics: [...spec.metrics, action.key] });
        }
        case "removeMetric":
            return withSpec({ metrics: spec.metrics.filter((m) => m !== action.key) });
        case "moveMetric":
            return withSpec({ metrics: move(spec.metrics, action.key, action.to) });
        case "toggleDimension": {
            if (spec.dimensions.includes(action.key))
                return withSpec({ dimensions: spec.dimensions.filter((d) => d !== action.key) });
            if (spec.dimensions.length >= MAX_DIMENSIONS)
                return state;
            return withSpec({ dimensions: [...spec.dimensions, action.key] });
        }
        case "moveDimension":
            return withSpec({ dimensions: move(spec.dimensions, action.key, action.to) });
        case "addFilter":
            if (spec.filters.length >= MAX_FILTERS)
                return state;
            return withSpec({ filters: [...spec.filters, action.filter] });
        case "updateFilter": {
            const filters = spec.filters.map((f, i) => {
                if (i !== action.index)
                    return f;
                const next = { ...f, ...action.patch } as QueryFilter;
                if (action.patch.dim && action.patch.dim !== f.dim && action.patch.value === undefined)
                    next.value = isMultiOp(next.op) ? [] : "";
                else if (action.patch.op && action.patch.value === undefined && isMultiOp(action.patch.op) !== isMultiOp(f.op))
                    next.value = convertFilterValue(f.value, isMultiOp(action.patch.op));
                return next;
            });
            return withSpec({ filters });
        }
        case "removeFilter":
            return withSpec({ filters: spec.filters.filter((_, i) => i !== action.index) });
        case "toggleFilterValue": {
            const op = action.exclude ? "nin" : "in";
            const i = spec.filters.findIndex((f2) => f2.dim === action.dim && f2.op === op);
            if (i < 0) {
                if (spec.filters.length >= MAX_FILTERS)
                    return state;
                return withSpec({ filters: [...spec.filters, { dim: action.dim, op, value: [action.value] }] });
            }
            const f = spec.filters[i] as QueryFilter;
            const values = (Array.isArray(f.value) ? f.value : [f.value]).map(String);
            const nextValues = values.includes(action.value) ? values.filter((v) => v !== action.value) : [...values, action.value];
            return withSpec({ filters: nextValues.length ? spec.filters.map((x, j) => (j === i ? { ...x, value: nextValues } : x)) : spec.filters.filter((_, j) => j !== i) });
        }
        case "addHaving":
            if (spec.having.length >= MAX_HAVING)
                return state;
            return withSpec({ having: [...spec.having, action.having] });
        case "updateHaving": {
            const having = spec.having.map((h, i) => {
                if (i !== action.index)
                    return h;
                const next = { ...h, ...action.patch } as QueryHaving;
                if (action.patch.op && action.patch.value === undefined)
                    next.value = convertHavingValue(h.value, action.patch.op);
                return next;
            });
            return withSpec({ having });
        }
        case "removeHaving":
            return withSpec({ having: spec.having.filter((_, i) => i !== action.index) });
        case "setSort":
            return withSpec({ sort: action.sort });
        case "setLimit":
            return withSpec({ limit: action.limit });
        case "setTotals":
            return withSpec({ totals: action.totals ? undefined : false });
        case "setDateRange":
            return withSpec({ dateRange: action.dateRange });
        case "setCompare":
            return withSpec({ compare: action.compare });
        case "setViz":
            return { ...state, viz: action.viz };
        case "clearStep":
            switch (action.step) {
                case "groupBy":
                    return withSpec({ dimensions: [] });
                case "filters":
                    return withSpec({ filters: [] });
                case "having":
                    return withSpec({ having: [] });
                case "sort":
                    return withSpec({ sort: undefined, limit: undefined });
                case "date":
                    return withSpec({ dateRange: undefined, compare: "none" });
                case "viz":
                    return { ...state, viz: undefined };
            }
    }
}
export function stepHasContent(step: OptionalStep, spec: ExploreSpec): boolean {
    switch (step) {
        case "groupBy":
            return spec.dimensions.length > 0;
        case "filters":
            return spec.filters.length > 0;
        case "having":
            return spec.having.length > 0;
        case "sort":
            return !!spec.sort?.length || spec.limit !== undefined;
    }
}
function filterIsComplete(f: QueryFilter): boolean {
    if (Array.isArray(f.value))
        return f.value.length > 0;
    return String(f.value).trim() !== "";
}
function havingIsComplete(h: QueryHaving): boolean {
    if (h.op === "between")
        return Array.isArray(h.value) && h.value.every((v) => Number.isFinite(v));
    return typeof h.value === "number" && Number.isFinite(h.value);
}
export function runnableSpec(spec: ExploreSpec, pageRange: DateRangeSpec): QuerySpecInput | null {
    const s = normalizeSpec(spec);
    if (!s.metrics.length)
        return null;
    const out: QuerySpecInput = {
        source: s.source,
        metrics: s.metrics,
        dimensions: s.dimensions,
        filters: s.filters.filter(filterIsComplete).map((f) => (typeof f.value === "string" ? { ...f, value: f.value.trim() } : f)),
        having: s.having.filter(havingIsComplete),
        dateRange: s.dateRange ?? pageRange,
        compare: s.compare,
    };
    if (s.sort?.length)
        out.sort = s.sort;
    if (s.limit !== undefined)
        out.limit = s.limit;
    if (s.totals === false)
        out.totals = false;
    if (s.fillGaps)
        out.fillGaps = true;
    return out;
}
export function compactSpec(spec: ExploreSpec): QuerySpecInput {
    const out: QuerySpecInput = { source: spec.source, metrics: spec.metrics };
    if (spec.dimensions.length)
        out.dimensions = spec.dimensions;
    if (spec.filters.length)
        out.filters = spec.filters;
    if (spec.having.length)
        out.having = spec.having;
    if (spec.dateRange)
        out.dateRange = spec.dateRange;
    if (spec.compare !== "none")
        out.compare = spec.compare;
    if (spec.sort?.length)
        out.sort = spec.sort;
    if (spec.limit !== undefined)
        out.limit = spec.limit;
    if (spec.totals === false)
        out.totals = false;
    if (spec.fillGaps)
        out.fillGaps = true;
    return out;
}
export function widgetQueryFor(spec: ExploreSpec, pin: DateRangeSpec | null): QuerySpecInput {
    const s = normalizeSpec(spec);
    const q = compactSpec({ ...s, dateRange: pin ?? undefined, filters: s.filters.filter(filterIsComplete), having: s.having.filter(havingIsComplete) });
    if (!pin)
        delete q.dateRange;
    return q;
}
