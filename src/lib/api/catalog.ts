import type { CustomMetric } from "@/lib/domain/contracts/dashboard";
import { DATE_PRESETS, PRESET_LABELS } from "@/lib/domain/dates";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { DIMENSIONS, DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { FACT_TABLES } from "@/lib/domain/schema/facts";
export interface CatalogMetric {
    key: string;
    label: string;
    short: string;
    kind: "base" | "derived" | "custom";
    format: "money" | "number" | "decimal" | "percent" | "ratio";
    direction: "up_good" | "down_good" | "neutral";
    description: string;
    formula?: string;
    availableIn: string[];
}
export interface Catalog {
    metrics: CatalogMetric[];
    dimensions: {
        key: string;
        label: string;
        kind: string;
        field: string;
    }[];
    tables: {
        id: string;
        label: string;
        fields: string[];
        measures: string[];
    }[];
    presets: {
        key: string;
        label: string;
    }[];
}
export function buildCatalog(s: readonly CustomMetric[] = []): Catalog {
    const env = new MetricRegistry(s.map((s2) => ({ key: s2.key, label: s2.label, formula: s2.formula, format: s2.format, direction: s2.direction, description: s2.description })));
    return {
        metrics: env.list().map((listItem) => ({
            key: listItem.key,
            label: listItem.label,
            short: listItem.short,
            kind: listItem.kind,
            format: listItem.format,
            direction: listItem.direction,
            description: listItem.description,
            formula: listItem.formula,
            availableIn: env.availableIn(listItem.key),
        })),
        dimensions: DIMENSION_KEYS.map((g) => ({ key: g, label: DIMENSIONS[g].label, kind: DIMENSIONS[g].kind, field: DIMENSIONS[g].field })),
        tables: Object.values(FACT_TABLES).map((value) => ({ id: value.id, label: value.label, fields: [...value.fields], measures: [...value.measures] })),
        presets: DATE_PRESETS.map((toRuntime) => ({ key: toRuntime, label: PRESET_LABELS[toRuntime] })),
    };
}
