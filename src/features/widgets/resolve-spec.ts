import type { Catalog } from "@/lib/api/hooks";
import type { FilterKey, WidgetQueryInput } from "@/lib/domain/contracts/dashboard";
import type { QueryFilter, QuerySpecInput } from "@/lib/domain/query/spec";
import type { ResolvedFilters } from "@/lib/filters";
const FILTER_KEY_OF_DIM: Record<string, FilterKey> = { campaign_type: "campaignType", campaign: "campaign", campaign_status: "status", device: "device" };
const DIM_LABEL: Record<string, string> = { campaign_type: "Campaign type", campaign: "Campaign", campaign_status: "Status", device: "Device", country: "Country", platform: "Platform" };
export interface ResolvedWidgetSpec {
    spec: QuerySpecInput;
    ignored: string[];
}
function tablesFor(source: string, catalog: Catalog) {
    return source === "google_ads" ? catalog.tables.filter((t) => t.id !== "platform_daily") : catalog.tables.filter((t) => t.id === "platform_daily");
}
export function covers(catalog: Catalog, source: string, metrics: readonly string[], dims: readonly string[]): boolean {
    const fieldOf = (d: string) => catalog.dimensions.find((x) => x.key === d)?.field ?? d;
    const fields = dims.map(fieldOf);
    const metricTables = metrics.map((m) => catalog.metrics.find((x) => x.key === m)?.availableIn ?? []);
    return tablesFor(source, catalog).some((t) => fields.every((f) => t.fields.includes(f)) && metricTables.every((tables) => tables.includes(t.id)));
}
export function resolveWidgetSpec(query: WidgetQueryInput | QuerySpecInput, filters: ResolvedFilters, catalog: Catalog | undefined, optOut: readonly FilterKey[] = [], honours?: readonly FilterKey[]): ResolvedWidgetSpec {
    const source = query.source ?? "google_ads";
    const metrics = query.metrics ?? [];
    const dims = [...(query.dimensions ?? [])];
    const skip = (k: FilterKey) => optOut.includes(k) || (honours ? !honours.includes(k) : false);
    const dateRange = query.dateRange ?? (skip("range") ? { preset: "last_30d" as const } : filters.dateRange);
    const wantsCompare = !!query.compare && query.compare !== "none";
    const compare = wantsCompare ? (skip("compare") ? query.compare : filters.compare) : "none";
    const own: QueryFilter[] = [...((query.filters as QueryFilter[] | undefined) ?? [])];
    const ownDims = own.map((f) => f.dim);
    const applied: QueryFilter[] = [];
    const ignored: string[] = [];
    const candidates: {
        f: QueryFilter;
        key: FilterKey;
    }[] = [];
    for (const f of filters.filters) {
        const isCross = filters.crossFilters.some((c) => c.dim === f.dim && (f.op === "nin") === c.exclude && c.values.join() === (f.value as string[]).join());
        const key: FilterKey = isCross ? "cross" : (FILTER_KEY_OF_DIM[f.dim] ?? "cross");
        candidates.push({ f, key });
    }
    const acceptedDims = [...dims, ...ownDims];
    for (const { f, key } of candidates) {
        if (skip(key))
            continue;
        if (ownDims.includes(f.dim))
            continue;
        const ok = catalog ? covers(catalog, source, metrics, [...acceptedDims, f.dim]) : true;
        if (ok) {
            applied.push(f);
            acceptedDims.push(f.dim);
        }
        else {
            const label = DIM_LABEL[f.dim] ?? f.dim;
            if (!ignored.includes(label))
                ignored.push(label);
        }
    }
    const spec: QuerySpecInput = {
        ...query,
        source,
        metrics,
        dimensions: dims as QuerySpecInput["dimensions"],
        filters: [...own, ...applied],
        dateRange,
        compare,
    };
    return { spec, ignored };
}
