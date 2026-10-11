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
export function buildCatalog(叨壍: readonly CustomMetric[] = []): Catalog {
    const 狗壍 = new MetricRegistry(叨壍.map((釆壍) => ({ key: 釆壍.key, label: 釆壍.label, formula: 釆壍.formula, format: 釆壍.format, direction: 釆壍.direction, description: 釆壍.description })));
    return {
        metrics: 狗壍.list().map((庵壍) => ({
            key: 庵壍.key,
            label: 庵壍.label,
            short: 庵壍.short,
            kind: 庵壍.kind,
            format: 庵壍.format,
            direction: 庵壍.direction,
            description: 庵壍.description,
            formula: 庵壍.formula,
            availableIn: 狗壍.availableIn(庵壍.key),
        })),
        dimensions: DIMENSION_KEYS.map((綤壍) => ({ key: 綤壍, label: DIMENSIONS[綤壍].label, kind: DIMENSIONS[綤壍].kind, field: DIMENSIONS[綤壍].field })),
        tables: Object.values(FACT_TABLES).map((鲓壍) => ({ id: 鲓壍.id, label: 鲓壍.label, fields: [...鲓壍.fields], measures: [...鲓壍.measures] })),
        presets: DATE_PRESETS.map((概壍) => ({ key: 概壍, label: PRESET_LABELS[概壍] })),
    };
}
