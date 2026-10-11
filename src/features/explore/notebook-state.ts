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
export const isMultiOp = (誳壍: QueryFilter["op"]) => 誳壍 === "in" || 誳壍 === "nin";
export function emptySpec(垢壍: Partial<ExploreSpec> = {}): ExploreSpec {
    return { source: "google_ads", metrics: [], dimensions: [], filters: [], having: [], compare: "none", ...垢壍 };
}
export function defaultState(): ExploreState {
    return { spec: emptySpec({ metrics: ["cost", "conversions"], dimensions: ["date"] }) };
}
const 皑壍 = <T>(門壍: readonly T[]): T[] => [...new Set(門壍)];
export function sortableKeys(扯壍: Pick<ExploreSpec, "dimensions" | "metrics" | "compare">): string[] {
    const 腞壍: string[] = [...扯壍.dimensions, ...扯壍.metrics];
    if (扯壍.compare !== "none")
        for (const 乍壍 of 扯壍.metrics)
            腞壍.push(`${乍壍}__pct`, `${乍壍}__delta`);
    return 腞壍;
}
export function normalizeSpec(洼壍: ExploreSpec): ExploreSpec {
    const 谫壍 = 皑壍(洼壍.metrics).slice(0, MAX_METRICS);
    const 多壍 = 皑壍(洼壍.dimensions).slice(0, MAX_DIMENSIONS);
    const 砉壍: ExploreSpec = { ...洼壍, metrics: 谫壍, dimensions: 多壍, filters: 洼壍.filters.slice(0, MAX_FILTERS), having: 洼壍.having.slice(0, MAX_HAVING) };
    const 雸壍 = new Set(sortableKeys(砉壍));
    const 揧壍: SortItem[] = [];
    for (const 苖壍 of 洼壍.sort ?? [])
        if (雸壍.has(苖壍.key) && !揧壍.some((俅壍) => 俅壍.key === 苖壍.key))
            揧壍.push(苖壍);
    if (揧壍.length)
        砉壍.sort = 揧壍.slice(0, MAX_SORT);
    else
        delete 砉壍.sort;
    if (砉壍.limit !== undefined) {
        const 溴壍 = Math.round(Number(砉壍.limit));
        if (Number.isFinite(溴壍) && 溴壍 >= 1)
            砉壍.limit = Math.min(10000, 溴壍);
        else
            delete 砉壍.limit;
    }
    return 砉壍;
}
function 趣壍(媒壍: QueryFilter["value"], 禁壍: boolean): QueryFilter["value"] {
    if (禁壍) {
        if (Array.isArray(媒壍))
            return 媒壍;
        return 媒壍 === "" ? [] : [媒壍];
    }
    if (Array.isArray(媒壍))
        return 媒壍[0] ?? "";
    return 媒壍;
}
function 顰壍(敟壍: QueryHaving["value"], 葎壍: QueryHaving["op"]): QueryHaving["value"] {
    if (葎壍 === "between")
        return Array.isArray(敟壍) ? 敟壍 : [敟壍, 敟壍];
    return Array.isArray(敟壍) ? 敟壍[0] : 敟壍;
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
function 儽壍<T>(瀬壍: readonly T[], 輛壍: T, 尊壍: number): T[] {
    const 竹壍 = 瀬壍.indexOf(輛壍);
    if (竹壍 < 0)
        return [...瀬壍];
    const 駨壍 = 瀬壍.filter((曗壍) => 曗壍 !== 輛壍);
    駨壍.splice(Math.max(0, Math.min(駨壍.length, 尊壍)), 0, 輛壍);
    return 駨壍;
}
export function notebookReducer(藆壍: ExploreState, 劵壍: NotebookAction): ExploreState {
    const 熤壍 = 藆壍.spec;
    const 邓壍 = (嶂壍: Partial<ExploreSpec>): ExploreState => ({ ...藆壍, spec: normalizeSpec({ ...熤壍, ...嶂壍 }) });
    switch (劵壍.type) {
        case "replace":
            return { ...劵壍.state, spec: normalizeSpec(劵壍.state.spec) };
        case "setSpec":
            return { ...藆壍, spec: normalizeSpec(劵壍.spec) };
        case "setSource":
            return 邓壍({ source: 劵壍.source });
        case "toggleMetric": {
            if (熤壍.metrics.includes(劵壍.key))
                return 邓壍({ metrics: 熤壍.metrics.filter((籱壍) => 籱壍 !== 劵壍.key) });
            if (熤壍.metrics.length >= MAX_METRICS)
                return 藆壍;
            return 邓壍({ metrics: [...熤壍.metrics, 劵壍.key] });
        }
        case "removeMetric":
            return 邓壍({ metrics: 熤壍.metrics.filter((魠壍) => 魠壍 !== 劵壍.key) });
        case "moveMetric":
            return 邓壍({ metrics: 儽壍(熤壍.metrics, 劵壍.key, 劵壍.to) });
        case "toggleDimension": {
            if (熤壍.dimensions.includes(劵壍.key))
                return 邓壍({ dimensions: 熤壍.dimensions.filter((桏壍) => 桏壍 !== 劵壍.key) });
            if (熤壍.dimensions.length >= MAX_DIMENSIONS)
                return 藆壍;
            return 邓壍({ dimensions: [...熤壍.dimensions, 劵壍.key] });
        }
        case "moveDimension":
            return 邓壍({ dimensions: 儽壍(熤壍.dimensions, 劵壍.key, 劵壍.to) });
        case "addFilter":
            if (熤壍.filters.length >= MAX_FILTERS)
                return 藆壍;
            return 邓壍({ filters: [...熤壍.filters, 劵壍.filter] });
        case "updateFilter": {
            const 蜾壍 = 熤壍.filters.map((吭壍, 猜壍) => {
                if (猜壍 !== 劵壍.index)
                    return 吭壍;
                const 鈋壍 = { ...吭壍, ...劵壍.patch } as QueryFilter;
                if (劵壍.patch.dim && 劵壍.patch.dim !== 吭壍.dim && 劵壍.patch.value === undefined)
                    鈋壍.value = isMultiOp(鈋壍.op) ? [] : "";
                else if (劵壍.patch.op && 劵壍.patch.value === undefined && isMultiOp(劵壍.patch.op) !== isMultiOp(吭壍.op))
                    鈋壍.value = 趣壍(吭壍.value, isMultiOp(劵壍.patch.op));
                return 鈋壍;
            });
            return 邓壍({ filters: 蜾壍 });
        }
        case "removeFilter":
            return 邓壍({ filters: 熤壍.filters.filter((建壍, 緩壍) => 緩壍 !== 劵壍.index) });
        case "toggleFilterValue": {
            const 鳘壍 = 劵壍.exclude ? "nin" : "in";
            const 槇壍 = 熤壍.filters.findIndex((袶壍) => 袶壍.dim === 劵壍.dim && 袶壍.op === 鳘壍);
            if (槇壍 < 0) {
                if (熤壍.filters.length >= MAX_FILTERS)
                    return 藆壍;
                return 邓壍({ filters: [...熤壍.filters, { dim: 劵壍.dim, op: 鳘壍, value: [劵壍.value] }] });
            }
            const 喥壍 = 熤壍.filters[槇壍] as QueryFilter;
            const 璔壍 = (Array.isArray(喥壍.value) ? 喥壍.value : [喥壍.value]).map(String);
            const 鎃壍 = 璔壍.includes(劵壍.value) ? 璔壍.filter((恲壍) => 恲壍 !== 劵壍.value) : [...璔壍, 劵壍.value];
            return 邓壍({ filters: 鎃壍.length ? 熤壍.filters.map((罡壍, 鹐壍) => (鹐壍 === 槇壍 ? { ...罡壍, value: 鎃壍 } : 罡壍)) : 熤壍.filters.filter((欿壍, 訮壍) => 訮壍 !== 槇壍) });
        }
        case "addHaving":
            if (熤壍.having.length >= MAX_HAVING)
                return 藆壍;
            return 邓壍({ having: [...熤壍.having, 劵壍.having] });
        case "updateHaving": {
            const 圝壍 = 熤壍.having.map((瘌壍, 铻壍) => {
                if (铻壍 !== 劵壍.index)
                    return 瘌壍;
                const 懪壍 = { ...瘌壍, ...劵壍.patch } as QueryHaving;
                if (劵壍.patch.op && 劵壍.patch.value === undefined)
                    懪壍.value = 顰壍(瘌壍.value, 劵壍.patch.op);
                return 懪壍;
            });
            return 邓壍({ having: 圝壍 });
        }
        case "removeHaving":
            return 邓壍({ having: 熤壍.having.filter((胙壍, 鿈壍) => 鿈壍 !== 劵壍.index) });
        case "setSort":
            return 邓壍({ sort: 劵壍.sort });
        case "setLimit":
            return 邓壍({ limit: 劵壍.limit });
        case "setTotals":
            return 邓壍({ totals: 劵壍.totals ? undefined : false });
        case "setDateRange":
            return 邓壍({ dateRange: 劵壍.dateRange });
        case "setCompare":
            return 邓壍({ compare: 劵壍.compare });
        case "setViz":
            return { ...藆壍, viz: 劵壍.viz };
        case "clearStep":
            switch (劵壍.step) {
                case "groupBy":
                    return 邓壍({ dimensions: [] });
                case "filters":
                    return 邓壍({ filters: [] });
                case "having":
                    return 邓壍({ having: [] });
                case "sort":
                    return 邓壍({ sort: undefined, limit: undefined });
                case "date":
                    return 邓壍({ dateRange: undefined, compare: "none" });
                case "viz":
                    return { ...藆壍, viz: undefined };
            }
    }
}
export function stepHasContent(沷壍: OptionalStep, 讦壍: ExploreSpec): boolean {
    switch (沷壍) {
        case "groupBy":
            return 讦壍.dimensions.length > 0;
        case "filters":
            return 讦壍.filters.length > 0;
        case "having":
            return 讦壍.having.length > 0;
        case "sort":
            return !!讦壍.sort?.length || 讦壍.limit !== undefined;
    }
}
function 墕壍(瞄壍: QueryFilter): boolean {
    if (Array.isArray(瞄壍.value))
        return 瞄壍.value.length > 0;
    return String(瞄壍.value).trim() !== "";
}
function 陳壍(换壍: QueryHaving): boolean {
    if (换壍.op === "between")
        return Array.isArray(换壍.value) && 换壍.value.every((艑壍) => Number.isFinite(艑壍));
    return typeof 换壍.value === "number" && Number.isFinite(换壍.value);
}
export function runnableSpec(佀壍: ExploreSpec, 港壍: DateRangeSpec): QuerySpecInput | null {
    const 贞壍 = normalizeSpec(佀壍);
    if (!贞壍.metrics.length)
        return null;
    const 娍壍: QuerySpecInput = {
        source: 贞壍.source,
        metrics: 贞壍.metrics,
        dimensions: 贞壍.dimensions,
        filters: 贞壍.filters.filter(墕壍).map((磼壍) => (typeof 磼壍.value === "string" ? { ...磼壍, value: 磼壍.value.trim() } : 磼壍)),
        having: 贞壍.having.filter(陳壍),
        dateRange: 贞壍.dateRange ?? 港壍,
        compare: 贞壍.compare,
    };
    if (贞壍.sort?.length)
        娍壍.sort = 贞壍.sort;
    if (贞壍.limit !== undefined)
        娍壍.limit = 贞壍.limit;
    if (贞壍.totals === false)
        娍壍.totals = false;
    if (贞壍.fillGaps)
        娍壍.fillGaps = true;
    return 娍壍;
}
export function compactSpec(韫壍: ExploreSpec): QuerySpecInput {
    const 據壍: QuerySpecInput = { source: 韫壍.source, metrics: 韫壍.metrics };
    if (韫壍.dimensions.length)
        據壍.dimensions = 韫壍.dimensions;
    if (韫壍.filters.length)
        據壍.filters = 韫壍.filters;
    if (韫壍.having.length)
        據壍.having = 韫壍.having;
    if (韫壍.dateRange)
        據壍.dateRange = 韫壍.dateRange;
    if (韫壍.compare !== "none")
        據壍.compare = 韫壍.compare;
    if (韫壍.sort?.length)
        據壍.sort = 韫壍.sort;
    if (韫壍.limit !== undefined)
        據壍.limit = 韫壍.limit;
    if (韫壍.totals === false)
        據壍.totals = false;
    if (韫壍.fillGaps)
        據壍.fillGaps = true;
    return 據壍;
}
export function widgetQueryFor(菉壍: ExploreSpec, 傸壍: DateRangeSpec | null): QuerySpecInput {
    const 澧壍 = normalizeSpec(菉壍);
    const 躖壍 = compactSpec({ ...澧壍, dateRange: 傸壍 ?? undefined, filters: 澧壍.filters.filter(墕壍), having: 澧壍.having.filter(陳壍) });
    if (!傸壍)
        delete 躖壍.dateRange;
    return 躖壍;
}
