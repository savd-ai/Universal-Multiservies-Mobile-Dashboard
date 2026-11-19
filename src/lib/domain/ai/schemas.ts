import { z } from "zod";
import { adCopySchema, blueprintSchema, explanationSchema, ideasOutputSchema, narrativeSchema, negativeVerdictsSchema } from "../contracts/ai";
import { DATE_PRESETS } from "../dates";
import { BUILTIN_METRICS } from "../metrics/registry";
import { FILTER_OPS } from "../query/spec";
import { DIMENSION_KEYS } from "../schema/dimensions";

// Wire schemas that are built per request (chat plan) or used for repair rounds, plus the portability walker the
// tests run over every output schema: all fields required, nullable instead of optional, enums, no
// min/max/length constraints, no recursion, object nesting ≤ 5.

export const CHART_TYPES = ["line", "bar", "area", "table", "kpi", "donut"] as const;
export const CHAT_INTENTS = ["query", "clarify"] as const;
/** `between` needs a tuple, which is not portable; the planner uses two conditions instead. */
export const PLAN_HAVING_OPS = ["gt", "gte", "lt", "lte", "eq", "neq"] as const;

type NonEmpty = [string, ...string[]];
const nonEmpty = (xs: readonly string[], fallback: string): NonEmpty => (xs.length ? ([...xs] as NonEmpty) : [fallback]);

/** Step-1 plan for Ask-your-data. Enums come from the live registry (incl. custom cm_* metrics). */
export function buildChatPlanSchema(metricKeys: readonly string[]) {
  const metric = z.enum(nonEmpty(metricKeys, "cost"));
  const dimension = z.enum(DIMENSION_KEYS);
  const sortKey = z.enum(nonEmpty([...metricKeys, ...DIMENSION_KEYS], "cost"));
  return z.object({
    intent: z.enum(CHAT_INTENTS).describe("query = answer with data; clarify = the question cannot be answered from ad performance data"),
    clarification: z.string().nullable().describe("When intent is clarify: one short question back to the user; otherwise null"),
    queries: z
      .array(
        z.object({
          title: z.string().describe("Short chart title"),
          chart: z.enum(CHART_TYPES),
          source: z.enum(["google_ads", "blended"]).describe("blended = cross-channel (dimensions date/platform only)"),
          metrics: z.array(metric).describe("1–6 metric keys"),
          dimensions: z.array(dimension).describe("0–3 dimensions; none = one KPI total"),
          dateRange: z
            .object({
              preset: z.enum(DATE_PRESETS).nullable(),
              start: z.string().nullable().describe("YYYY-MM-DD when preset is null"),
              end: z.string().nullable().describe("YYYY-MM-DD when preset is null"),
            })
            .describe("Use a preset when one fits"),
          compare: z.enum(["none", "previous_period", "previous_year"]),
          filters: z.array(
            z.object({
              dim: dimension,
              op: z.enum(FILTER_OPS),
              value: z.string().nullable().describe("For eq/neq/contains/ncontains/starts_with"),
              values: z.array(z.string()).nullable().describe("For in/nin"),
            }),
          ),
          having: z.array(z.object({ metric, op: z.enum(PLAN_HAVING_OPS), value: z.number().describe("Percent metrics as fractions (5% = 0.05)") })),
          sort: z.array(z.object({ key: sortKey, dir: z.enum(["asc", "desc"]) })),
          limit: z.number().nullable().describe("Rows to return, 1–50; null for all"),
        }),
      )
      .describe("1–3 queries"),
    suggestions: z.array(z.string()).describe("2–3 short follow-up questions"),
  });
}
export type ChatPlanWire = z.infer<ReturnType<typeof buildChatPlanSchema>>;
export type ChatPlanQueryWire = ChatPlanWire["queries"][number];

/** One low-effort repair round: the model rewrites only the lines it is given. */
export const shortenLinesSchema = z.object({
  lines: z.array(z.object({ id: z.string(), text: z.string().describe("Rewritten line within its limit") })),
});
export type ShortenLines = z.infer<typeof shortenLinesSchema>;

/** Every structured-output schema the AI layer sends to a provider (the portability test walks all of them). */
export function wireSchemas(): Record<string, z.ZodType> {
  return {
    ideas: ideasOutputSchema,
    blueprint: blueprintSchema,
    adCopy: adCopySchema,
    narrative: narrativeSchema,
    explanation: explanationSchema,
    negatives: negativeVerdictsSchema,
    chatPlan: buildChatPlanSchema(BUILTIN_METRICS.map((m) => m.key).concat("cm_example")),
    shortenLines: shortenLinesSchema,
  };
}

// ── Portability walker ─────────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_KEYWORDS = ["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems", "pattern", "multipleOf", "minProperties", "maxProperties", "uniqueItems"];
const MAX_OBJECT_DEPTH = 5;

type Json = { [k: string]: unknown };
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Problems that would make a JSON schema non-portable across Anthropic / OpenAI strict / Gemini. */
export function schemaPortabilityIssues(schema: unknown): string[] {
  const issues: string[] = [];
  const visit = (node: unknown, path: string, depth: number): void => {
    if (!isObj(node)) return;
    if ("$ref" in node || "$defs" in node || "definitions" in node) issues.push(`${path}: $ref/$defs (reuse or recursion) is not portable`);
    for (const k of FORBIDDEN_KEYWORDS) if (k in node) issues.push(`${path}: "${k}" constraint`);
    const types = Array.isArray(node.type) ? node.type : node.type !== undefined ? [node.type] : [];
    const isObject = types.includes("object");
    const d = isObject ? depth + 1 : depth;
    if (isObject) {
      if (d > MAX_OBJECT_DEPTH) issues.push(`${path}: object nesting ${d} > ${MAX_OBJECT_DEPTH}`);
      const props = isObj(node.properties) ? node.properties : {};
      const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
      for (const key of Object.keys(props)) if (!required.has(key)) issues.push(`${path}.${key}: optional (use nullable)`);
      if (node.additionalProperties !== false) issues.push(`${path}: additionalProperties must be false`);
      for (const [key, child] of Object.entries(props)) visit(child, `${path}.${key}`, d);
    }
    if (node.items !== undefined) visit(node.items, `${path}[]`, d);
    for (const k of ["anyOf", "oneOf", "allOf"] as const) {
      const variants = node[k];
      if (Array.isArray(variants)) variants.forEach((v, i) => visit(v, `${path}<${k}${i}>`, depth));
    }
  };
  visit(schema, "$", 0);
  return issues;
}
