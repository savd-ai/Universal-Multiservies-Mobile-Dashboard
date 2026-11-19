import type { ChatChart } from "../contracts/ai";
import { isCivilDate } from "../dates";
import type { MetricRegistry } from "../metrics/registry";
import { planQuery, QueryError } from "../query/engine";
import { querySpecSchema, type QueryFilter, type QuerySpec, type QuerySpecInput } from "../query/spec";
import type { CivilDate } from "../types";
import type { ChatPlanQueryWire } from "./schemas";

// Step-1 plans arrive in a flattened, portable shape (nullable dateRange parts, value|values filters). This turns
// each query into a real QuerySpec and runs the same validation as the query engine, so only runnable queries
// reach runQuery. Pure.

export const MAX_PLAN_QUERIES = 3;
export const MAX_ROWS_TO_MODEL = 50;
export const MAX_ROWS_TO_UI = 200;

export interface PlannedQuery {
  title: string;
  chart: ChatChart["type"];
  spec: QuerySpec;
}

export function wireToSpecInput(q: ChatPlanQueryWire): QuerySpecInput {
  const dr = q.dateRange;
  const dateRange = dr.preset ? { preset: dr.preset } : dr.start && dr.end && isCivilDate(dr.start) && isCivilDate(dr.end) ? { start: dr.start, end: dr.end } : { preset: "last_30d" as const };
  const filters: QueryFilter[] = [];
  for (const f of q.filters) {
    const list = f.values?.filter((v) => v.trim()) ?? [];
    if ((f.op === "in" || f.op === "nin") && list.length) filters.push({ dim: f.dim, op: f.op, value: list.slice(0, 200) });
    else if (f.value !== null && f.value.trim()) filters.push({ dim: f.dim, op: f.op === "in" ? "eq" : f.op === "nin" ? "neq" : f.op, value: f.value.trim() });
    else if (list.length) filters.push({ dim: f.dim, op: "in", value: list.slice(0, 200) });
  }
  const limit = typeof q.limit === "number" && Number.isFinite(q.limit) ? Math.min(10_000, Math.max(1, Math.round(q.limit))) : undefined;
  return {
    source: q.source,
    metrics: [...new Set(q.metrics)].slice(0, 12),
    dimensions: [...new Set(q.dimensions)].slice(0, 3),
    filters: filters.slice(0, 10),
    having: q.having.slice(0, 5).map((h) => ({ metric: h.metric, op: h.op, value: h.value })),
    dateRange,
    compare: q.compare,
    ...(q.sort.length ? { sort: q.sort.slice(0, 3) } : {}),
    ...(limit ? { limit } : {}),
    ...(q.dimensions.length === 1 && q.dimensions[0] === "date" ? { fillGaps: true } : {}),
  };
}

/** Validate a spec exactly as the query engine would; returns the parsed spec or a readable error. */
export function validateSpec(input: QuerySpecInput, ctx: { today: CivilDate; registry: MetricRegistry }): { spec: QuerySpec } | { error: string } {
  const parsed = querySpecSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join("; ") };
  try {
    planQuery(parsed.data, ctx);
    return { spec: parsed.data };
  } catch (err) {
    return { error: err instanceof QueryError ? err.message : "Invalid query" };
  }
}

export function validatePlan(queries: readonly ChatPlanQueryWire[], ctx: { today: CivilDate; registry: MetricRegistry }): { valid: PlannedQuery[]; errors: { index: number; title: string; error: string }[] } {
  const valid: PlannedQuery[] = [];
  const errors: { index: number; title: string; error: string }[] = [];
  queries.slice(0, MAX_PLAN_QUERIES).forEach((q, index) => {
    const title = q.title.replace(/\s+/g, " ").trim().slice(0, 120) || `Query ${index + 1}`;
    const r = validateSpec(wireToSpecInput(q), ctx);
    if ("spec" in r) valid.push({ title, chart: q.chart, spec: r.spec });
    else errors.push({ index, title, error: r.error });
  });
  return { valid, errors };
}
