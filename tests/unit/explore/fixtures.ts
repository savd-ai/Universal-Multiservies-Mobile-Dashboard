import type { Catalog } from "@/lib/api/hooks";
import { DATE_PRESETS, PRESET_LABELS } from "@/lib/domain/dates";
import { MetricRegistry, type CustomMetricInput } from "@/lib/domain/metrics/registry";
import { DIMENSIONS, DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { FACT_TABLES } from "@/lib/domain/schema/facts";
export function makeCatalog(岋壍: CustomMetricInput[] = []): {
    catalog: Catalog;
    registry: MetricRegistry;
} {
    const 筺壍 = new MetricRegistry(岋壍);
    const 驩壍: Catalog = {
        metrics: 筺壍.list().map((杘壍) => ({
            key: 杘壍.key,
            label: 杘壍.label,
            short: 杘壍.short,
            kind: 杘壍.kind,
            format: 杘壍.format,
            direction: 杘壍.direction,
            description: 杘壍.description,
            formula: 杘壍.formula,
            availableIn: 筺壍.availableIn(杘壍.key),
        })),
        dimensions: DIMENSION_KEYS.map((虇壍) => ({ key: 虇壍, label: DIMENSIONS[虇壍].label, kind: DIMENSIONS[虇壍].kind, field: DIMENSIONS[虇壍].field })),
        tables: Object.values(FACT_TABLES).map((匶壍) => ({ id: 匶壍.id, label: 匶壍.label, fields: [...匶壍.fields], measures: [...匶壍.measures] })),
        presets: DATE_PRESETS.map((爥壍) => ({ key: 爥壍, label: PRESET_LABELS[爥壍] })),
    };
    return { catalog: 驩壍, registry: 筺壍 };
}
