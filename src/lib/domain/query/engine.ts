import { addDays, compareRange, diffDays, enumerate, isCivilDate, rangeDays, resolvePreset, type DateRange } from "../dates";
import type { Aggregates, MetricDef, MetricRegistry } from "../metrics/registry";
import { DIMENSIONS, type DimensionKey, type DimensionValue } from "../schema/dimensions";
import { FACT_TABLES, FACT_TABLE_IDS, type EntityDims, type FactTableId, type MeasureKey } from "../schema/facts";
import type { CivilDate } from "../types";
import type { QueryColumn, QueryFilter, QueryHaving, QueryResult, QueryRow, QuerySourceMeta, QuerySpec } from "./spec";
export class QueryError extends Error {
    constructor(public readonly code: "QUERY_UNSUPPORTED" | "VALIDATION_ERROR", 鶥壍: string) {
        super(鶥壍);
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
export function resolveDateRange(檔壍: QuerySpec["dateRange"], 覃壍: CivilDate): DateRange {
    if ("preset" in 檔壍)
        return resolvePreset(檔壍.preset, 覃壍, 檔壍.includeToday);
    if (!isCivilDate(檔壍.start) || !isCivilDate(檔壍.end))
        throw new QueryError("VALIDATION_ERROR", "Invalid date range");
    return 檔壍.start <= 檔壍.end ? { start: 檔壍.start, end: 檔壍.end } : { start: 檔壍.end, end: 檔壍.start };
}
const 噲壍 = 800;
export function planQuery(畡壍: QuerySpec, 鑐壍: PlanContext): QueryPlan {
    const 愿壍: string[] = [];
    const 耮壍: MetricDef[] = [];
    for (const 鼝壍 of 畡壍.metrics) {
        const 氌壍 = 鑐壍.registry.get(鼝壍);
        if (!氌壍)
            throw new QueryError("VALIDATION_ERROR", `Unknown metric "${鼝壍}"`);
        耮壍.push(氌壍);
    }
    for (const 諻壍 of 畡壍.having) {
        if (!鑐壍.registry.has(諻壍.metric))
            throw new QueryError("VALIDATION_ERROR", `Unknown metric "${諻壍.metric}" in having`);
    }
    const 埪壍 = resolveDateRange(畡壍.dateRange, 鑐壍.today);
    if (rangeDays(埪壍) > 噲壍)
        throw new QueryError("VALIDATION_ERROR", `Date range is longer than ${噲壍} days`);
    const 盙壍 = compareRange(埪壍, 畡壍.compare);
    const 闈壍 = [...new Set(畡壍.dimensions)];
    const 抷壍 = new Set<string>();
    for (const 膦壍 of 闈壍)
        抷壍.add(DIMENSIONS[膦壍].field);
    for (const 井壍 of 畡壍.filters)
        抷壍.add(DIMENSIONS[井壍.dim].field);
    const 涄壍 = 畡壍.having.map((豳壍) => 鑐壍.registry.get(豳壍.metric)).filter((奢壍): 奢壍 is MetricDef => !!奢壍);
    const 硑壍 = [...new Set([...耮壍, ...涄壍].flatMap((靀壍) => 靀壍.deps))];
    const 搯壍 = 畡壍.source !== "google_ads";
    const 茞壍 = FACT_TABLE_IDS.map((倍壍) => FACT_TABLES[倍壍])
        .filter((滼壍) => (搯壍 ? 滼壍.sources.includes("platform") : 滼壍.sources.includes("google_ads")))
        .filter((跫壍) => [...抷壍].every((嫚壍) => 跫壍.fields.includes(嫚壍)))
        .filter((秉壍) => 硑壍.every((颸壍) => 秉壍.measures.includes(颸壍)))
        .sort((斧壍, 蒖壍) => 斧壍.rank - 蒖壍.rank);
    const 内壍 = 茞壍[0];
    if (!内壍)
        throw new QueryError("QUERY_UNSUPPORTED", 屒壍(畡壍, 抷壍, 硑壍, 搯壍));
    if (闈壍.includes("hour") && 硑壍.some((灴壍) => 灴壍.startsWith("is_")))
        愿壍.push("Impression share is not reported by hour.");
    if (畡壍.metrics.includes("mer") && 闈壍.includes("platform"))
        愿壍.push("MER is a blended metric; per-platform values are not meaningful.");
    const 轣壍: DateRange = 盙壍 ? { start: 盙壍.start < 埪壍.start ? 盙壍.start : 埪壍.start, end: 埪壍.end > 盙壍.end ? 埪壍.end : 盙壍.end } : 埪壍;
    return { spec: 畡壍, table: 内壍.id, current: 埪壍, compare: 盙壍, fetchRange: 轣壍, metrics: 耮壍, measures: 硑壍, dimensions: 闈壍, warnings: 愿壍 };
}
function 屒壍(筁壍: QuerySpec, 騰壍: Set<string>, 期壍: MeasureKey[], 蘎壍: boolean): string {
    if (蘎壍 && [...騰壍].some((勽壍) => 勽壍 !== "date" && 勽壍 !== "platform" && 勽壍 !== "platform_campaign" && 勽壍 !== "account_id"))
        return "Cross-channel data only supports date and platform breakdowns.";
    if (!蘎壍 && 騰壍.has("platform"))
        return "Platform breakdowns need the cross-channel (blended) source.";
    if (期壍.some((燬壍) => 燬壍.startsWith("qs_")) && !騰壍.has("keyword_id"))
        return "Quality Score needs a keyword breakdown or keyword data.";
    if (騰壍.has("hour") && (騰壍.has("device") || 騰壍.has("country")))
        return "Hour cannot be combined with device or country breakdowns.";
    if (期壍.some((郛壍) => 郛壍.startsWith("is_")) && 騰壍.size > 3)
        return "Impression share is only available by date and campaign.";
    if (期壍.includes("store_revenue") && !蘎壍)
        return "MER needs the cross-channel (blended) source.";
    return `This combination of metrics and breakdowns is not available (${筁壍.metrics.join(", ")}).`;
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
function 巊壍(粹壍: DimensionValue, 鮨壍: QueryFilter): boolean {
    const 梗壍 = 粹壍.id.toLowerCase();
    const 螆壍 = 粹壍.label.toLowerCase();
    const 呵壍 = (Array.isArray(鮨壍.value) ? 鮨壍.value : [鮨壍.value]).map((獤壍) => String(獤壍).toLowerCase());
    const 鉓壍 = 呵壍[0] ?? "";
    switch (鮨壍.op) {
        case "eq":
            return 梗壍 === 鉓壍 || 螆壍 === 鉓壍;
        case "neq":
            return 梗壍 !== 鉓壍 && 螆壍 !== 鉓壍;
        case "in":
            return 呵壍.includes(梗壍) || 呵壍.includes(螆壍);
        case "nin":
            return !呵壍.includes(梗壍) && !呵壍.includes(螆壍);
        case "contains":
            return 螆壍.includes(鉓壍) || 梗壍.includes(鉓壍);
        case "ncontains":
            return !螆壍.includes(鉓壍) && !梗壍.includes(鉓壍);
        case "starts_with":
            return 螆壍.startsWith(鉓壍) || 梗壍.startsWith(鉓壍);
    }
}
function 彂壍(縱壍: number | null, 鴠壍: QueryHaving): boolean {
    if (縱壍 === null)
        return false;
    const 樏壍 = 鴠壍.value;
    switch (鴠壍.op) {
        case "gt":
            return typeof 樏壍 === "number" && 縱壍 > 樏壍;
        case "gte":
            return typeof 樏壍 === "number" && 縱壍 >= 樏壍;
        case "lt":
            return typeof 樏壍 === "number" && 縱壍 < 樏壍;
        case "lte":
            return typeof 樏壍 === "number" && 縱壍 <= 樏壍;
        case "eq":
            return typeof 樏壍 === "number" && Math.abs(縱壍 - 樏壍) < 1e-9;
        case "neq":
            return typeof 樏壍 === "number" && Math.abs(縱壍 - 樏壍) >= 1e-9;
        case "between":
            return Array.isArray(樏壍) && 縱壍 >= 樏壍[0] && 縱壍 <= 樏壍[1];
    }
}
function 裾壍(嗭壍: Aggregates, 瓜壍: Record<string, unknown>, 鏋壍: readonly MeasureKey[]): void {
    for (const 悺壍 of 鏋壍) {
        const 義壍 = 瓜壍[悺壍];
        if (typeof 義壍 === "number" && Number.isFinite(義壍))
            嗭壍[悺壍] = (嗭壍[悺壍] ?? 0) + 義壍;
    }
}
function 麘壍(殇壍: readonly Record<string, unknown>[], 詶壍: DateRange | null, 坥壍: QueryPlan, 癔壍: EntityDims, 镃壍: "daily" | "range"): Map<string, Group> {
    const 戲壍 = new Map<string, Group>();
    const 脡壍 = 坥壍.spec.filters;
    for (const 丐壍 of 殇壍) {
        if (詶壍 && 镃壍 === "daily") {
            const 泿壍 = 丐壍.date as string | null | undefined;
            if (!泿壍 || 泿壍 < 詶壍.start || 泿壍 > 詶壍.end)
                continue;
        }
        let 诮壍 = true;
        for (const 壝壍 of 脡壍) {
            if (!巊壍(DIMENSIONS[壝壍.dim].resolve(丐壍, 癔壍), 壝壍)) {
                诮壍 = false;
                break;
            }
        }
        if (!诮壍)
            continue;
        const 矌壍 = 坥壍.dimensions.map((隻壍) => DIMENSIONS[隻壍].resolve(丐壍, 癔壍));
        const 措壍 = 矌壍.map((芙壍) => 芙壍.id).join("\u0001");
        let 侈壍 = 戲壍.get(措壍);
        if (!侈壍) {
            侈壍 = { key: 措壍, values: 矌壍, agg: {} };
            戲壍.set(措壍, 侈壍);
        }
        裾壍(侈壍.agg, 丐壍, 坥壍.measures);
    }
    return 戲壍;
}
function 湷壍(赦壍: Aggregates, 婕壍: readonly MetricDef[], 祄壍: MetricRegistry): Record<string, number | null> {
    const 頳壍: Record<string, number | null> = {};
    for (const 攢壍 of 婕壍)
        頳壍[攢壍.key] = 祄壍.computeValue(攢壍.key, 赦壍);
    return 頳壍;
}
function 萑壍(儀壍: Iterable<Group>): Aggregates {
    const 濯壍: Aggregates = {};
    for (const 軞壍 of 儀壍)
        for (const [寍壍, 窼壍] of Object.entries(軞壍.agg))
            濯壍[寍壍 as MeasureKey] = (濯壍[寍壍 as MeasureKey] ?? 0) + (窼壍 ?? 0);
    return 濯壍;
}
function 馫壍(暚壍: QueryPlan): number {
    return 暚壍.dimensions.findIndex((薉壍) => DIMENSIONS[薉壍].kind === "time" && DIMENSIONS[薉壍].derivedFromDate);
}
export function executeQuery(剸壍: QueryPlan, 照壍: FactSlice, 遖壍: ExecuteContext, 嵅壍 = 0): QueryResult {
    const 簴壍 = [...剸壍.warnings];
    if (照壍.grain === "range" && 剸壍.dimensions.some((鬣壍) => DIMENSIONS[鬣壍].derivedFromDate)) {
        throw new QueryError("QUERY_UNSUPPORTED", "This data is only available as a total for the period (no daily breakdown).");
    }
    if (照壍.coverage) {
        if (剸壍.current.start < 照壍.coverage.start)
            簴壍.push(`Data is available from ${照壍.coverage.start}; earlier days are missing.`);
        if (剸壍.compare && 剸壍.compare.start < 照壍.coverage.start)
            簴壍.push("The comparison period is only partly covered by available data.");
    }
    const 栒壍 = 麘壍(照壍.rows, 剸壍.current, 剸壍, 遖壍.dims, 照壍.grain);
    const 蜁壍 = 照壍.grain === "range" ? (照壍.compareRows ?? []) : 照壍.rows;
    const 台壍 = 剸壍.compare ? 麘壍(蜁壍, 剸壍.compare, 剸壍, 遖壍.dims, 照壍.grain) : null;
    const 狟壍 = 剸壍.dimensions.indexOf("date");
    if (剸壍.spec.fillGaps && 狟壍 === 0 && 剸壍.dimensions.length === 1 && 照壍.grain === "daily") {
        for (const 野壍 of enumerate(剸壍.current.start, 剸壍.current.end)) {
            if (!栒壍.has(野壍))
                栒壍.set(野壍, { key: 野壍, values: [{ id: 野壍, label: 野壍 }], agg: {} });
        }
        if (台壍 && 剸壍.compare) {
            for (const 庽壍 of enumerate(剸壍.compare.start, 剸壍.compare.end)) {
                if (!台壍.has(庽壍))
                    台壍.set(庽壍, { key: 庽壍, values: [{ id: 庽壍, label: 庽壍 }], agg: {} });
            }
        }
    }
    const 綬壍 = 剸壍.spec.having.map((鲛壍) => ({ h: 鲛壍, def: 遖壍.registry.get(鲛壍.metric) as MetricDef }));
    const 榊壍 = [...剸壍.metrics, ...綬壍.map((衹壍) => 衹壍.def).filter((啨壍) => !剸壍.metrics.includes(啨壍))];
    const 瑗壍 = 馫壍(剸壍);
    let 鍆壍: ((怵壍: Group) => Group | undefined) | null = null;
    if (台壍 && 剸壍.compare) {
        if (瑗壍 < 0) {
            鍆壍 = (缤壍) => 台壍.get(缤壍.key);
        }
        else if (剸壍.dimensions[瑗壍] === "date") {
            const 鸓壍 = diffDays(剸壍.compare.start, 剸壍.current.start);
            鍆壍 = (欂壍) => {
                const 觱壍 = 欂壍.values.map((因壍, 痏壍) => (痏壍 === 瑗壍 ? addDays(因壍.id, -鸓壍) : 因壍.id));
                return 台壍.get(觱壍.join("\u0001"));
            };
        }
        else {
            const 钾壍 = (憭壍: Map<string, Group>) => {
                const 肜壍 = [...new Set([...憭壍.values()].map((龋壍) => 龋壍.values[瑗壍]?.id ?? ""))].sort();
                return new Map(肜壍.map((決壍, 譩壍) => [決壍, 譩壍]));
            };
            const 塘壍 = 钾壍(栒壍);
            const 睇壍 = 钾壍(台壍);
            const 阶壍 = new Map<string, Group>();
            for (const 挥壍 of 台壍.values()) {
                const 舔壍 = 睇壍.get(挥壍.values[瑗壍]?.id ?? "") ?? -1;
                const 伃壍 = 挥壍.values.map((淲壍, 賡壍) => (賡壍 === 瑗壍 ? String(舔壍) : 淲壍.id)).join("\u0001");
                阶壍.set(伃壍, 挥壍);
            }
            鍆壍 = (姐壍) => {
                const 碿壍 = 塘壍.get(姐壍.values[瑗壍]?.id ?? "") ?? -1;
                return 阶壍.get(姐壍.values.map((鞮壍, 撝壍) => (撝壍 === 瑗壍 ? String(碿壍) : 鞮壍.id)).join("\u0001"));
            };
        }
    }
    let 莌壍: {
        row: QueryRow;
        sortVals: Record<string, number | string | null>;
        group: Group;
    }[] = [];
    for (const 偻壍 of 栒壍.values()) {
        const 潪壍 = 湷壍(偻壍.agg, 榊壍, 遖壍.registry);
        if (!綬壍.every(({ h: 蹙壍, def: 孈壍 }) => 彂壍(潪壍[孈壍.key] ?? null, 蹙壍)))
            continue;
        const 稷壍: QueryRow = {};
        剸壍.dimensions.forEach((餦壍, 昕壍) => {
            const 蔄壍 = 偻壍.values[昕壍] as DimensionValue;
            const 凳壍 = DIMENSIONS[餦壍].kind;
            if (凳壍 === "entity" && 餦壍 !== "search_term" && 餦壍 !== "platform_campaign") {
                稷壍[餦壍] = 蔄壍.label;
                稷壍[`${餦壍}_id`] = 蔄壍.id;
            }
            else if (餦壍 === "hour") {
                稷壍[餦壍] = Number(蔄壍.id);
            }
            else if (餦壍 === "dow") {
                稷壍[餦壍] = 蔄壍.label;
                稷壍.dow_id = Number(蔄壍.id);
            }
            else if (餦壍 === "country" || 餦壍 === "platform" || 餦壍 === "bidding_strategy") {
                稷壍[餦壍] = 蔄壍.label;
                稷壍[`${餦壍}_id`] = 蔄壍.id;
            }
            else {
                稷壍[餦壍] = 蔄壍.label;
            }
        });
        for (const 烢壍 of 剸壍.metrics)
            稷壍[烢壍.key] = 潪壍[烢壍.key] ?? null;
        if (鍆壍) {
            const 近壍 = 鍆壍(偻壍);
            const 峀壍 = 近壍 ? 湷壍(近壍.agg, 剸壍.metrics, 遖壍.registry) : {};
            for (const 箯壍 of 剸壍.metrics) {
                const 骞壍 = 潪壍[箯壍.key] ?? null;
                const 枍壍 = 峀壍[箯壍.key] ?? null;
                稷壍[`${箯壍.key}__prev`] = 枍壍;
                稷壍[`${箯壍.key}__delta`] = 骞壍 !== null && 枍壍 !== null ? 骞壍 - 枍壍 : null;
                稷壍[`${箯壍.key}__pct`] = 骞壍 !== null && 枍壍 !== null && 枍壍 !== 0 ? 骞壍 / 枍壍 - 1 : null;
            }
        }
        莌壍.push({ row: 稷壍, sortVals: 稷壍 as Record<string, number | string | null>, group: 偻壍 });
    }
    const 虼壍 = 萑壍(莌壍.map((卫壍) => 卫壍.group));
    const 牚壍 = 剸壍.spec.totals === false ? undefined : 湷壍(虼壍, 剸壍.metrics, 遖壍.registry);
    const 酉壍 = 台壍 ? 湷壍(萑壍(台壍.values()), 剸壍.metrics, 遖壍.registry) : undefined;
    const 常壍 = 剸壍.spec.sort && 剸壍.spec.sort.length
        ? 剸壍.spec.sort
        : 瑗壍 >= 0 || 剸壍.dimensions.includes("hour")
            ? [{ key: 剸壍.dimensions.find((紧壍) => DIMENSIONS[紧壍].kind === "time") ?? "date", dir: "asc" as const }]
            : 剸壍.metrics[0]
                ? [{ key: 剸壍.metrics[0].key, dir: "desc" as const }]
                : [];
    const 鰖壍 = (椅壍: QueryRow, 蟴壍: string): number | string | null => {
        if (蟴壍 === "dow")
            return (椅壍.dow_id as number | undefined) ?? null;
        return 椅壍[蟴壍] ?? null;
    };
    莌壍.sort((哣壍, 珒壍) => {
        for (const 鋁壍 of 常壍) {
            const 徰壍 = 鰖壍(哣壍.row, 鋁壍.key);
            const 纟壍 = 鰖壍(珒壍.row, 鋁壍.key);
            if (徰壍 === 纟壍)
                continue;
            if (徰壍 === null)
                return 1;
            if (纟壍 === null)
                return -1;
            const 鶎壍 = typeof 徰壍 === "number" && typeof 纟壍 === "number" ? 徰壍 - 纟壍 : String(徰壍).localeCompare(String(纟壍));
            if (鶎壍 !== 0)
                return 鋁壍.dir === "asc" ? 鶎壍 : -鶎壍;
        }
        return 0;
    });
    const 橽壍 = Math.min(剸壍.spec.limit ?? 1000, 10000);
    const 襬壍 = 莌壍.length > 橽壍;
    if (襬壍)
        莌壍 = 莌壍.slice(0, 橽壍);
    const 噛壍: QueryColumn[] = [
        ...剸壍.dimensions.map((畊壍) => ({ key: 畊壍, label: DIMENSIONS[畊壍].label, kind: "dimension" as const })),
        ...剸壍.metrics.map((鐹壍) => ({ key: 鐹壍.key, label: 鐹壍.label, kind: "metric" as const, format: 鐹壍.format })),
    ];
    return {
        columns: 噛壍,
        rows: 莌壍.map((愨壍) => 愨壍.row),
        totals: 牚壍,
        compareTotals: 酉壍,
        meta: {
            range: { start: 剸壍.current.start, end: 剸壍.current.end, days: rangeDays(剸壍.current) },
            compareRange: 剸壍.compare ?? undefined,
            table: 剸壍.table,
            grain: 照壍.grain,
            currency: 遖壍.currency,
            timezone: 遖壍.timezone,
            sources: 遖壍.sources,
            truncated: 襬壍,
            rowCount: 莌壍.length,
            warnings: 簴壍,
            tookMs: 嵅壍,
        },
    };
}
export function aggregateRows(耗壍: readonly Record<string, unknown>[], 鼆壍: readonly MeasureKey[]): Aggregates {
    const 毵壍: Aggregates = {};
    for (const 諤壍 of 耗壍)
        裾壍(毵壍, 諤壍, 鼆壍);
    return 毵壍;
}
