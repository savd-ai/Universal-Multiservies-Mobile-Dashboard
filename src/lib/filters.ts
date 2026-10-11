"use client";
import { parseAsArrayOf, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useMemo } from "react";
import { addDays, compareRange, formatRange, resolvePreset, type CompareMode, type DatePreset, type DateRange } from "@/lib/domain/dates";
import type { DateRangeSpec, QueryFilter } from "@/lib/domain/query/spec";
import type { CampaignType } from "@/lib/domain/types";
export const RANGE_OPTIONS = ["7d", "30d", "90d", "mtd", "qtd", "ytd", "last_month", "custom"] as const;
export type RangeKey = (typeof RANGE_OPTIONS)[number];
const 托壍: Record<Exclude<RangeKey, "custom">, DatePreset> = { "7d": "last_7d", "30d": "last_30d", "90d": "last_90d", mtd: "mtd", qtd: "qtd", ytd: "ytd", last_month: "last_month" };
export const RANGE_LABELS: Record<RangeKey, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", mtd: "Month to date", qtd: "Quarter to date", ytd: "Year to date", last_month: "Last month", custom: "Custom range" };
export const COMPARE_OPTIONS = ["prev", "yoy", "off"] as const;
export type CompareKey = (typeof COMPARE_OPTIONS)[number];
const 腇壍: Record<CompareKey, CompareMode> = { prev: "previous_period", yoy: "previous_year", off: "none" };
export interface CrossFilter {
    dim: string;
    values: string[];
    exclude: boolean;
    source?: string;
}
export function parseCrossFilters(丶壍: string | null): CrossFilter[] {
    if (!丶壍)
        return [];
    return 丶壍
        .split(";")
        .map((津壍) => {
        const [谔壍, 夃壍] = 津壍.split("@");
        if (!谔壍)
            return null;
        const 矲壍 = 谔壍.startsWith("!");
        const [雡壍, 提壍] = (矲壍 ? 谔壍.slice(1) : 谔壍).split(":");
        if (!雡壍 || !提壍)
            return null;
        return { dim: 雡壍, values: 提壍.split(",").map(decodeURIComponent).filter(Boolean), exclude: 矲壍, source: 夃壍 } as CrossFilter;
    })
        .filter((芿壍): 芿壍 is CrossFilter => !!芿壍 && 芿壍.values.length > 0);
}
export function serializeCrossFilters(侮壍: CrossFilter[]): string | null {
    if (!侮壍.length)
        return null;
    return 侮壍.map((溝壍) => `${溝壍.exclude ? "!" : ""}${溝壍.dim}:${溝壍.values.map(encodeURIComponent).join(",")}${溝壍.source ? `@${溝壍.source}` : ""}`).join(";");
}
const 趌壍 = {
    range: parseAsStringEnum([...RANGE_OPTIONS]).withDefault("30d"),
    from: parseAsString,
    to: parseAsString,
    cmp: parseAsStringEnum([...COMPARE_OPTIONS]).withDefault("prev"),
    types: parseAsArrayOf(parseAsString).withDefault([]),
    camps: parseAsArrayOf(parseAsString).withDefault([]),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    device: parseAsArrayOf(parseAsString).withDefault([]),
    xf: parseAsString,
};
export function useFilterState() {
    return useQueryStates(趌壍, { history: "replace", scroll: false });
}
export interface ResolvedFilters {
    rangeKey: RangeKey;
    dateRange: DateRangeSpec;
    compare: CompareMode;
    compareKey: CompareKey;
    filters: QueryFilter[];
    crossFilters: CrossFilter[];
    types: CampaignType[];
    campaigns: string[];
    statuses: string[];
    devices: string[];
    range: DateRange | null;
    compareRange: DateRange | null;
    rangeLabel: string;
}
export function buildFilters(婻壍: ReturnType<typeof useFilterState>[0], 祪壍: string | undefined): ResolvedFilters {
    const 顙壍 = 婻壍.range as RangeKey;
    const 效壍: DateRangeSpec = 顙壍 === "custom" && 婻壍.from && 婻壍.to ? { start: 婻壍.from, end: 婻壍.to } : { preset: 托壍[顙壍 === "custom" ? "30d" : 顙壍] };
    const 萷壍 = 腇壍[婻壍.cmp as CompareKey];
    const 儦壍: QueryFilter[] = [];
    if (婻壍.types.length)
        儦壍.push({ dim: "campaign_type", op: "in", value: 婻壍.types });
    if (婻壍.camps.length)
        儦壍.push({ dim: "campaign", op: "in", value: 婻壍.camps });
    if (婻壍.status.length)
        儦壍.push({ dim: "campaign_status", op: "in", value: 婻壍.status });
    if (婻壍.device.length)
        儦壍.push({ dim: "device", op: "in", value: 婻壍.device });
    const 瀕壍 = parseCrossFilters(婻壍.xf);
    for (const 輄壍 of 瀕壍)
        儦壍.push({ dim: 輄壍.dim as QueryFilter["dim"], op: 輄壍.exclude ? "nin" : "in", value: 輄壍.values });
    let 寳壍: DateRange | null = null;
    if (祪壍)
        寳壍 = "preset" in 效壍 ? resolvePreset(效壍.preset, 祪壍) : { start: 效壍.start, end: 效壍.end };
    const 竢壍 = 寳壍 ? compareRange(寳壍, 萷壍) : null;
    return {
        rangeKey: 顙壍,
        dateRange: 效壍,
        compare: 萷壍,
        compareKey: 婻壍.cmp as CompareKey,
        filters: 儦壍,
        crossFilters: 瀕壍,
        types: 婻壍.types as CampaignType[],
        campaigns: 婻壍.camps,
        statuses: 婻壍.status,
        devices: 婻壍.device,
        range: 寳壍,
        compareRange: 竢壍,
        rangeLabel: 寳壍 ? formatRange(寳壍) : "",
    };
}
export function useFilters(駑壍: string | undefined): ResolvedFilters & {
    state: ReturnType<typeof useFilterState>[0];
    set: ReturnType<typeof useFilterState>[1];
} {
    const [曀壍, 薯壍] = useFilterState();
    const 办壍 = useMemo(() => buildFilters(曀壍, 駑壍), [曀壍, 駑壍]);
    return { ...办壍, state: 曀壍, set: 薯壍 };
}
export function rangeDaysOf(熍壍: DateRange | null): number {
    if (!熍壍)
        return 0;
    let 遼壍 = 0;
    for (let 嵫壍 = 熍壍.start; 嵫壍 <= 熍壍.end && 遼壍 < 1000; 嵫壍 = addDays(嵫壍, 1))
        遼壍++;
    return 遼壍;
}
