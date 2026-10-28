"use client";
import { parseAsArrayOf, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useMemo } from "react";
import { addDays, compareRange, formatRange, resolvePreset, type CompareMode, type DatePreset, type DateRange } from "@/lib/domain/dates";
import type { DateRangeSpec, QueryFilter } from "@/lib/domain/query/spec";
import type { CampaignType } from "@/lib/domain/types";
export const RANGE_OPTIONS = ["7d", "30d", "90d", "mtd", "qtd", "ytd", "last_month", "custom"] as const;
export type RangeKey = (typeof RANGE_OPTIONS)[number];
const RANGE_TO_PRESET: Record<Exclude<RangeKey, "custom">, DatePreset> = { "7d": "last_7d", "30d": "last_30d", "90d": "last_90d", mtd: "mtd", qtd: "qtd", ytd: "ytd", last_month: "last_month" };
export const RANGE_LABELS: Record<RangeKey, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", mtd: "Month to date", qtd: "Quarter to date", ytd: "Year to date", last_month: "Last month", custom: "Custom range" };
export const COMPARE_OPTIONS = ["prev", "yoy", "off"] as const;
export type CompareKey = (typeof COMPARE_OPTIONS)[number];
const COMPARE_TO_MODE: Record<CompareKey, CompareMode> = { prev: "previous_period", yoy: "previous_year", off: "none" };
export interface CrossFilter {
    dim: string;
    values: string[];
    exclude: boolean;
    source?: string;
}
export function parseCrossFilters(raw: string | null): CrossFilter[] {
    if (!raw)
        return [];
    return raw
        .split(";")
        .map((part) => {
        const [body, source] = part.split("@");
        if (!body)
            return null;
        const exclude = body.startsWith("!");
        const [dim, vals] = (exclude ? body.slice(1) : body).split(":");
        if (!dim || !vals)
            return null;
        return { dim, values: vals.split(",").map(decodeURIComponent).filter(Boolean), exclude, source } as CrossFilter;
    })
        .filter((x): x is CrossFilter => !!x && x.values.length > 0);
}
export function serializeCrossFilters(list: CrossFilter[]): string | null {
    if (!list.length)
        return null;
    return list.map((c) => `${c.exclude ? "!" : ""}${c.dim}:${c.values.map(encodeURIComponent).join(",")}${c.source ? `@${c.source}` : ""}`).join(";");
}
const filterParsers = {
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
    return useQueryStates(filterParsers, { history: "replace", scroll: false });
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
export function buildFilters(state: ReturnType<typeof useFilterState>[0], today: string | undefined): ResolvedFilters {
    const rangeKey = state.range as RangeKey;
    const dateRange: DateRangeSpec = rangeKey === "custom" && state.from && state.to ? { start: state.from, end: state.to } : { preset: RANGE_TO_PRESET[rangeKey === "custom" ? "30d" : rangeKey] };
    const compare = COMPARE_TO_MODE[state.cmp as CompareKey];
    const filters: QueryFilter[] = [];
    if (state.types.length)
        filters.push({ dim: "campaign_type", op: "in", value: state.types });
    if (state.camps.length)
        filters.push({ dim: "campaign", op: "in", value: state.camps });
    if (state.status.length)
        filters.push({ dim: "campaign_status", op: "in", value: state.status });
    if (state.device.length)
        filters.push({ dim: "device", op: "in", value: state.device });
    const crossFilters = parseCrossFilters(state.xf);
    for (const c of crossFilters)
        filters.push({ dim: c.dim as QueryFilter["dim"], op: c.exclude ? "nin" : "in", value: c.values });
    let range: DateRange | null = null;
    if (today)
        range = "preset" in dateRange ? resolvePreset(dateRange.preset, today) : { start: dateRange.start, end: dateRange.end };
    const cmpRange = range ? compareRange(range, compare) : null;
    return {
        rangeKey,
        dateRange,
        compare,
        compareKey: state.cmp as CompareKey,
        filters,
        crossFilters,
        types: state.types as CampaignType[],
        campaigns: state.camps,
        statuses: state.status,
        devices: state.device,
        range,
        compareRange: cmpRange,
        rangeLabel: range ? formatRange(range) : "",
    };
}
export function useFilters(today: string | undefined): ResolvedFilters & {
    state: ReturnType<typeof useFilterState>[0];
    set: ReturnType<typeof useFilterState>[1];
} {
    const [state, second] = useFilterState();
    const resolved = useMemo(() => buildFilters(state, today), [state, today]);
    return { ...resolved, state, set: second };
}
export function rangeDaysOf(r: DateRange | null): number {
    if (!r)
        return 0;
    let n = 0;
    for (let d = r.start; d <= r.end && n < 1000; d = addDays(d, 1))
        n++;
    return n;
}
