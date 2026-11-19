import { DATE_PRESETS, PRESET_LABELS } from "@/lib/domain/dates";
import { DIMENSIONS, DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { FACT_TABLES } from "@/lib/domain/schema/facts";
import { metricRegistry } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Semantic layer for the question builder, widget config and AI chat planner.
export const GET = route({}, async () => {
  const registry = await metricRegistry();
  return {
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
    tables: Object.values(FACT_TABLES).map((t) => ({ id: t.id, label: t.label, fields: t.fields, measures: t.measures })),
    presets: DATE_PRESETS.map((p) => ({ key: p, label: PRESET_LABELS[p] })),
  };
});
