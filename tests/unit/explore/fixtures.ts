import type { Catalog } from "@/lib/api/hooks";
import { DATE_PRESETS, PRESET_LABELS } from "@/lib/domain/dates";
import { MetricRegistry, type CustomMetricInput } from "@/lib/domain/metrics/registry";
import { DIMENSIONS, DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { FACT_TABLES } from "@/lib/domain/schema/facts";
export function makeCatalog(custom: CustomMetricInput[] = []): {
    catalog: Catalog;
    registry: MetricRegistry;
} {
    const registry = new MetricRegistry(custom);
    const catalog: Catalog = {
        metrics: registry.list().map((m) => ({
            key: m.key,
            label: m.label,
            short: m.short,
            kind: m.kind,
            format: m.format,
            direction: m.direction,
            description: m.description,
            formula: m.formula,
            availableIn: registry.availableIn(m.key),
        })),
        dimensions: DIMENSION_KEYS.map((k) => ({ key: k, label: DIMENSIONS[k].label, kind: DIMENSIONS[k].kind, field: DIMENSIONS[k].field })),
        tables: Object.values(FACT_TABLES).map((t) => ({ id: t.id, label: t.label, fields: [...t.fields], measures: [...t.measures] })),
        presets: DATE_PRESETS.map((p) => ({ key: p, label: PRESET_LABELS[p] })),
    };
    return { catalog, registry };
}
