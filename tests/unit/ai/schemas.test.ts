import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildChatPlanSchema, schemaPortabilityIssues, wireSchemas } from "@/lib/domain/ai/schemas";
import { wireToSpecInput } from "@/lib/domain/ai/chat-plan";

// Every structured-output schema must work on Anthropic, OpenAI strict mode and Gemini alike: all fields
// required, nullable instead of optional, enums, no min/max/length, no recursion, object nesting ≤ 5.

describe("wire schema portability", () => {
  for (const [name, schema] of Object.entries(wireSchemas())) {
    it(`${name} is portable`, () => {
      expect(schemaPortabilityIssues(z.toJSONSchema(schema))).toEqual([]);
    });
  }

  it("the walker flags constraints, optional fields, recursion and deep nesting", () => {
    const constrained = z.object({ a: z.string().min(1), b: z.number().max(3), c: z.array(z.string()).max(2), d: z.string().optional(), e: z.int() });
    const text = schemaPortabilityIssues(z.toJSONSchema(constrained)).join("\n");
    for (const k of ["minLength", "maximum", "maxItems", "optional", "minimum"]) expect(text).toContain(k);

    const Tree = z.object({
      name: z.string(),
      get children() {
        return z.array(Tree);
      },
    });
    expect(schemaPortabilityIssues(z.toJSONSchema(Tree)).join("\n")).toMatch(/\$ref/);

    const deep = z.object({ a: z.object({ b: z.object({ c: z.object({ d: z.object({ e: z.object({ f: z.string() }) }) }) }) }) });
    expect(schemaPortabilityIssues(z.toJSONSchema(deep)).join("\n")).toMatch(/nesting 6/);
  });

  it("the chat plan schema is built per request from the registry (custom metrics included)", () => {
    const schema = buildChatPlanSchema(["cost", "roas", "cm_margin"]);
    const json = JSON.stringify(z.toJSONSchema(schema));
    expect(json).toContain("cm_margin");
    const plan = schema.parse({
      intent: "query",
      clarification: null,
      queries: [
        {
          title: "Margin by campaign",
          chart: "bar",
          source: "google_ads",
          metrics: ["cm_margin", "cost"],
          dimensions: ["campaign"],
          dateRange: { preset: null, start: "2026-09-01", end: "2026-09-28" },
          compare: "none",
          filters: [{ dim: "campaign_type", op: "in", value: null, values: ["Search", "PMax"] }],
          having: [],
          sort: [{ key: "cm_margin", dir: "desc" }],
          limit: 5,
        },
      ],
      suggestions: [],
    });
    const q = plan.queries[0];
    if (!q) throw new Error("missing query");
    expect(wireToSpecInput(q)).toMatchObject({ metrics: ["cm_margin", "cost"], dateRange: { start: "2026-09-01", end: "2026-09-28" }, filters: [{ dim: "campaign_type", op: "in", value: ["Search", "PMax"] }], limit: 5 });
    expect(() => schema.parse({ ...plan, queries: [{ ...q, metrics: ["not_a_metric"] }] })).toThrow();
  });
});
