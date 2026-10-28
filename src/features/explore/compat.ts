import type { Catalog } from "@/lib/api/hooks";
import type { ExploreSpec } from "./notebook-state";
import { normalizeSpec } from "./notebook-state";
type Table = Catalog["tables"][number];
export const PLATFORM_TABLE = "platform_daily";
export interface Availability {
    ok: boolean;
    reason?: string;
}
const OK: Availability = { ok: true };
export function isPlatformSource(source: string): boolean {
    return source !== "google_ads";
}
export function sourceTables(catalog: Catalog, source: string): Table[] {
    const platform = isPlatformSource(source);
    return catalog.tables.filter((t) => (t.id === PLATFORM_TABLE) === platform);
}
export function fieldOf(catalog: Catalog, dim: string): string {
    return catalog.dimensions.find((d) => d.key === dim)?.field ?? dim;
}
function dimLabel(catalog: Catalog, dim: string): string {
    return catalog.dimensions.find((d) => d.key === dim)?.label ?? dim;
}
function metricLabel(catalog: Catalog, key: string): string {
    const m = catalog.metrics.find((x) => x.key === key);
    return m ? m.label : key;
}
function tablesOf(catalog: Catalog, metric: string): readonly string[] {
    return catalog.metrics.find((m) => m.key === metric)?.availableIn ?? [];
}
export function listLabel(items: readonly string[]): string {
    if (items.length <= 1)
        return items[0] ?? "";
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
export interface QueryShape {
    source: string;
    metrics: readonly string[];
    dims: readonly string[];
}
export function shapeOf(spec: Pick<ExploreSpec, "source" | "metrics" | "dimensions" | "filters" | "having">): QueryShape {
    return {
        source: spec.source,
        metrics: [...new Set([...spec.metrics, ...spec.having.map((h) => h.metric)])],
        dims: [...new Set([...spec.dimensions, ...spec.filters.map((f) => f.dim)])],
    };
}
export function coveringTables(catalog: Catalog, shape: QueryShape): Table[] {
    const fields = shape.dims.map((d) => fieldOf(catalog, d));
    return sourceTables(catalog, shape.source).filter((t) => fields.every((f) => t.fields.includes(f)) && shape.metrics.every((m) => tablesOf(catalog, m).includes(t.id)));
}
export function covers(catalog: Catalog, shape: QueryShape): boolean {
    return coveringTables(catalog, shape).length > 0;
}
export function plannedTable(catalog: Catalog, spec: Pick<ExploreSpec, "source" | "metrics" | "dimensions" | "filters" | "having">): Table | null {
    return coveringTables(catalog, shapeOf(spec))[0] ?? null;
}
export function unknownMetrics(catalog: Catalog, spec: Pick<ExploreSpec, "metrics" | "having">): string[] {
    const known = new Set(catalog.metrics.map((m) => m.key));
    return [...new Set([...spec.metrics, ...spec.having.map((h) => h.metric)])].filter((k) => !known.has(k));
}
export function metricAvailability(catalog: Catalog, spec: ExploreSpec, key: string): Availability {
    const meta = catalog.metrics.find((m) => m.key === key);
    if (!meta)
        return { ok: false, reason: "Unknown metric — it may have been deleted." };
    const shape = shapeOf(spec);
    const alone: QueryShape = { ...shape, metrics: [key] };
    if (!covers(catalog, alone)) {
        const inSource = sourceTables(catalog, spec.source).filter((t) => meta.availableIn.includes(t.id));
        if (!inSource.length) {
            return isPlatformSource(spec.source)
                ? { ok: false, reason: `${meta.label} isn't reported for cross-channel data — use the Google Ads source.` }
                : { ok: false, reason: `${meta.label} needs the Blended (all platforms) source.` };
        }
        const blocking = shape.dims.filter((d) => !inSource.some((t) => t.fields.includes(fieldOf(catalog, d))));
        if (blocking.length)
            return { ok: false, reason: `${meta.label} is only in ${listLabel(inSource.map((t) => t.label))} — not by ${listLabel(blocking.map((d) => dimLabel(catalog, d)))}.` };
        return { ok: false, reason: `${meta.label} isn't available for this combination of breakdowns.` };
    }
    const others = shape.metrics.filter((m) => m !== key);
    if (others.length && covers(catalog, { ...shape, metrics: others }) && !covers(catalog, { ...shape, metrics: [...others, key] })) {
        const fields = shape.dims.map((d) => fieldOf(catalog, d));
        const withDims = sourceTables(catalog, spec.source).filter((t) => fields.every((f) => t.fields.includes(f)) && meta.availableIn.includes(t.id));
        const conflicts = others.filter((o) => !withDims.some((t) => tablesOf(catalog, o).includes(t.id)));
        return { ok: false, reason: conflicts.length ? `Can't be combined with ${listLabel(conflicts.map((c) => metricLabel(catalog, c)))} (different tables).` : "Not available with the current selection." };
    }
    return OK;
}
export function dimensionAvailability(catalog: Catalog, spec: ExploreSpec, dim: string, opts: {
    asFilter?: boolean;
    ignoreFilter?: number;
} = {}): Availability {
    const base = opts.ignoreFilter !== undefined ? { ...spec, filters: spec.filters.filter((_, i) => i !== opts.ignoreFilter) } : spec;
    if (!opts.asFilter && base.dimensions.includes(dim as ExploreSpec["dimensions"][number]))
        return OK;
    if (!opts.asFilter && base.dimensions.length >= 3)
        return { ok: false, reason: "Up to 3 breakdowns — remove one first." };
    const field = fieldOf(catalog, dim);
    const label = dimLabel(catalog, dim);
    const tables = sourceTables(catalog, spec.source).filter((t) => t.fields.includes(field));
    if (!tables.length) {
        return isPlatformSource(spec.source) ? { ok: false, reason: "Cross-channel data breaks down by date and platform only." } : { ok: false, reason: `${label} needs the Blended (all platforms) source.` };
    }
    const shape = shapeOf(base);
    const blocking = shape.metrics.filter((m) => !tables.some((t) => tablesOf(catalog, m).includes(t.id)));
    if (blocking.length)
        return { ok: false, reason: `${listLabel(blocking.map((m) => metricLabel(catalog, m)))} ${blocking.length > 1 ? "aren't" : "isn't"} available by ${label}.` };
    const test: QueryShape = { ...shape, dims: [...new Set([...shape.dims, dim])] };
    if (covers(catalog, shape) && !covers(catalog, test)) {
        const conflicting = shape.dims.filter((o) => o !== dim && !tables.some((t) => t.fields.includes(fieldOf(catalog, o)) && shape.metrics.every((m) => tablesOf(catalog, m).includes(t.id))));
        return { ok: false, reason: conflicting.length ? `Can't be combined with ${listLabel(conflicting.map((c) => dimLabel(catalog, c)))}.` : "Not available with the current selection." };
    }
    return OK;
}
export interface Fix {
    label: string;
    spec: ExploreSpec;
}
const SOURCE_NAMES: Record<string, string> = { google_ads: "Google Ads", blended: "Blended (all platforms)" };
export function fixSuggestions(catalog: Catalog, spec: ExploreSpec, max = 4): Fix[] {
    const fixes: Fix[] = [];
    const unknown = unknownMetrics(catalog, spec);
    if (unknown.length) {
        const metrics = spec.metrics.filter((m) => !unknown.includes(m));
        fixes.push({ label: `Remove ${listLabel(unknown)}`, spec: normalizeSpec({ ...spec, metrics: metrics.length ? metrics : ["cost"], having: spec.having.filter((h) => !unknown.includes(h.metric)) }) });
        return fixes;
    }
    if (covers(catalog, shapeOf(spec)))
        return [];
    const works = (s: ExploreSpec) => covers(catalog, shapeOf(s));
    const push = (label: string, s: ExploreSpec) => {
        if (fixes.length < max && works(s) && !fixes.some((f) => f.label === label))
            fixes.push({ label, spec: normalizeSpec(s) });
    };
    for (const alt of ["google_ads", "blended"])
        if (alt !== spec.source)
            push(`Switch to ${SOURCE_NAMES[alt]}`, { ...spec, source: alt });
    for (const d of spec.dimensions)
        push(`Remove ${dimLabel(catalog, d)} from Group by`, { ...spec, dimensions: spec.dimensions.filter((x) => x !== d) });
    spec.filters.forEach((f, i) => push(`Remove the ${dimLabel(catalog, f.dim)} filter`, { ...spec, filters: spec.filters.filter((_, j) => j !== i) }));
    if (spec.metrics.length > 1)
        for (const m of spec.metrics)
            push(`Remove ${metricLabel(catalog, m)}`, { ...spec, metrics: spec.metrics.filter((x) => x !== m) });
    spec.having.forEach((h, i) => push(`Remove the ${metricLabel(catalog, h.metric)} condition`, { ...spec, having: spec.having.filter((_, j) => j !== i) }));
    return fixes;
}
export function pruneForSource(catalog: Catalog, spec: ExploreSpec, source: string): {
    spec: ExploreSpec;
    removed: string[];
} {
    const tables = sourceTables(catalog, source);
    const dimOk = (d: string) => tables.some((t) => t.fields.includes(fieldOf(catalog, d)));
    const metricOk = (m: string) => tables.some((t) => tablesOf(catalog, m).includes(t.id));
    const removed = new Set<string>();
    const keep = <T>(items: readonly T[], ok: (x: T) => boolean, label: (x: T) => string): T[] => items.filter((x) => {
        if (ok(x))
            return true;
        removed.add(label(x));
        return false;
    });
    const dimensions = keep(spec.dimensions, dimOk, (d) => dimLabel(catalog, d));
    const filters = keep(spec.filters, (f) => dimOk(f.dim), (f) => `${dimLabel(catalog, f.dim)} filter`);
    const metrics = keep(spec.metrics, metricOk, (m) => metricLabel(catalog, m));
    const having = keep(spec.having, (h) => metricOk(h.metric), (h) => `${metricLabel(catalog, h.metric)} condition`);
    return { spec: normalizeSpec({ ...spec, source, dimensions, filters, metrics: metrics.length ? metrics : ["cost"], having }), removed: [...removed] };
}
