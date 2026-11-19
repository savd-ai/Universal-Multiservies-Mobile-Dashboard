import { z } from "zod";
import { AI_GOALS } from "../demo/scenario";
import { CAMPAIGN_TYPES } from "../types";
import type { ChangeAction, ChangeCategory, SignalChangeContext } from "./anomaly";

// AI feature contracts. Wire schemas are PORTABLE across Anthropic/OpenAI/Gemini structured outputs: every field
// required, nullable instead of optional, enums, no min/max/length constraints, no recursion. Limits are described
// in .describe() and enforced by server-side validators (see domain/ai/validators.ts).

export const AI_PROVIDER_IDS = ["anthropic", "openai", "gemini", "demo"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const IDEA_TYPES = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"] as const;

export const campaignIdeaSchema = z.object({
  title: z.string().describe("At most 6 words"),
  type: z.enum(IDEA_TYPES),
  audience: z.string().describe("Short phrase"),
  keywords: z.array(z.string()).describe("3 short keyword or theme strings"),
  rationale: z.string().describe("One sentence that cites the account data"),
  dailyBudget: z.number().describe("USD per day"),
  impact: z.string().describe('Short expected impact, e.g. "+40 conv / mo"'),
  confidence: z.number().describe("Integer 40–95"),
  citedCampaignIds: z.array(z.string()).describe("Ids of campaigns whose data supports the idea"),
});
export type CampaignIdea = z.infer<typeof campaignIdeaSchema>;
export const ideasOutputSchema = z.object({ ideas: z.array(campaignIdeaSchema).describe("Exactly 6 ideas") });

export const ideasRequestSchema = z.object({
  goal: z.enum(AI_GOALS).default("Scale conversions"),
  testBudget: z.number().min(0).max(10_000_000).default(3000),
  context: z.string().max(1000).default(""),
});
export type IdeasRequest = z.infer<typeof ideasRequestSchema>;

export interface IdeaSet {
  id: string;
  goal: string;
  testBudget: number;
  context: string;
  ideas: (CampaignIdea & { id: string; dismissed?: boolean; inPlan?: boolean; /** added from the demo library to reach 6 ideas */ topUp?: boolean })[];
  source: AiProviderId;
  model: string | null;
  fallbackReason?: string;
  /** repairs applied by the validators (budget scaling, top-ups, dropped ids) */
  warnings?: string[];
  accountId?: string;
  mode?: "live" | "demo";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const ideaSetPatchSchema = z.object({
  ideaId: z.string().min(1).max(64),
  dismissed: z.boolean().optional(),
  inPlan: z.boolean().optional(),
});
export type IdeaSetPatch = z.infer<typeof ideaSetPatchSchema>;

const matchTypeEnum = z.enum(["Exact", "Phrase", "Broad"]);

export const blueprintSchema = z.object({
  campaignName: z.string(),
  type: z.enum(IDEA_TYPES),
  objective: z.string(),
  bidding: z.object({
    strategy: z.enum(["MAXIMIZE_CONVERSIONS", "TARGET_CPA", "MAXIMIZE_CONVERSION_VALUE", "TARGET_ROAS", "MAXIMIZE_CLICKS", "MANUAL_CPC"]),
    targetCpa: z.number().nullable(),
    targetRoas: z.number().nullable(),
  }),
  dailyBudget: z.number(),
  targeting: z.object({ locations: z.array(z.string()), languages: z.array(z.string()), audiences: z.array(z.string()), devices: z.array(z.string()).nullable(), adSchedule: z.string().nullable() }),
  adGroups: z.array(
    z.object({
      name: z.string(),
      theme: z.string(),
      keywords: z.array(z.object({ text: z.string(), matchType: matchTypeEnum })),
      negatives: z.array(z.object({ text: z.string(), matchType: matchTypeEnum })),
      rsa: z.object({
        headlines: z.array(z.string()).describe("3–15 headlines, each at most 30 characters"),
        descriptions: z.array(z.string()).describe("2–4 descriptions, each at most 90 characters"),
        path1: z.string().nullable().describe("At most 15 characters"),
        path2: z.string().nullable().describe("At most 15 characters"),
      }),
    }),
  ),
  campaignNegatives: z.array(z.object({ text: z.string(), matchType: matchTypeEnum })),
  sitelinks: z.array(z.object({ text: z.string().describe("≤ 25 characters"), line1: z.string().nullable().describe("≤ 35 characters"), line2: z.string().nullable().describe("≤ 35 characters") })),
  callouts: z.array(z.string().describe("≤ 25 characters")),
  launchChecklist: z.array(z.string()),
});
export type Blueprint = z.infer<typeof blueprintSchema>;

export const adCopySchema = z.object({
  headlines: z.array(z.object({ text: z.string().describe("≤ 30 characters"), pin: z.number().nullable(), angle: z.string() })),
  descriptions: z.array(z.object({ text: z.string().describe("≤ 90 characters"), pin: z.number().nullable() })),
  path1: z.string().nullable(),
  path2: z.string().nullable(),
});
export type AdCopy = z.infer<typeof adCopySchema>;

export const adCopyRequestSchema = z.object({
  campaignId: z.string().max(64).optional(),
  product: z.string().max(200).default(""),
  audience: z.string().max(200).default(""),
  usps: z.array(z.string().max(80)).max(10).default([]),
  keywords: z.array(z.string().max(80)).max(20).default([]),
  tone: z.enum(["confident", "friendly", "premium", "urgent"]).default("confident"),
  finalUrl: z.string().max(300).optional(),
});
export type AdCopyRequest = z.infer<typeof adCopyRequestSchema>;

export const narrativeSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.object({ text: z.string(), sentiment: z.enum(["positive", "negative", "neutral"]), refs: z.array(z.string()) })),
  nextSteps: z.array(z.string()),
});
export type Narrative = z.infer<typeof narrativeSchema>;

export const explanationSchema = z.object({
  possibleCauses: z.array(z.object({ cause: z.string(), likelihood: z.enum(["high", "medium", "low"]), evidence: z.array(z.string()), checks: z.array(z.string()) })),
  actions: z.array(z.object({ action: z.string(), rationale: z.string(), risk: z.enum(["low", "medium", "high"]) })),
  confidenceNote: z.string(),
});
export type Explanation = z.infer<typeof explanationSchema>;

export const negativeVerdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      term: z.string(),
      verdict: z.enum(["negative", "keep", "review"]),
      matchType: z.enum(["Exact", "Phrase"]),
      level: z.enum(["ad_group", "campaign", "account_list"]),
      reason: z.string(),
    }),
  ),
});
export type NegativeVerdicts = z.infer<typeof negativeVerdictsSchema>;

export type NegativeRuleId = "high_cost_no_conv" | "clicks_no_conv" | "modifier" | "competitor" | "low_ctr" | "ngram";

export interface NegativeCandidate {
  /** stable id: `t:{campaign}:{adGroup}:{term}` or `n:{ngram}` */
  id?: string;
  kind?: "term" | "ngram";
  term: string;
  /** the keyword to add as a negative (the modifier, competitor name, n-gram or the term itself) */
  negativeText?: string;
  /** which rules flagged it */
  rules?: NegativeRuleId[];
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  reasons: string[];
  suggestedMatch: "Exact" | "Phrase";
  suggestedLevel: "ad_group" | "campaign" | "account_list";
  monthlySavings: number;
  verdict?: "negative" | "keep" | "review";
  aiReason?: string;
}

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(12).default([]),
  context: z
    .object({
      page: z.string().max(64).optional(),
      dashboardId: z.string().max(64).optional(),
      campaignId: z.string().max(64).optional(),
      range: z.string().max(32).optional(),
      /** the viewer's comparison mode and campaign-type filter (enums only — safe to put in the prompt) */
      compare: z.enum(["prev", "yoy", "off", "previous_period", "previous_year", "none"]).optional(),
      types: z.array(z.enum(CAMPAIGN_TYPES)).max(8).optional(),
    })
    .default({}),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ChatChart {
  id: string;
  title: string;
  type: "line" | "bar" | "area" | "table" | "kpi" | "donut";
  query: unknown;
}

export interface AiStatus {
  provider: AiProviderId;
  model: string | null;
  configured: AiProviderId[];
  reason?: string;
  fallbacksEnabled: boolean;
  /** the provider's own fallback model (Gemini), when it has one */
  fallbackModel?: string | null;
}

// ── Response envelopes (additive) ─────────────────────────────────────────────────────────────────────

/** Every AI response says who produced it. `source: "demo"` + `fallbackReason` when the demo engine answered. */
export interface AiMeta {
  source: AiProviderId;
  model: string | null;
  fallbackReason?: string;
  warnings: string[];
  /** served from the 1 h result cache */
  cached?: boolean;
}

export interface AiStatusResponse extends AiStatus {
  limits: { perMinute: number; burst: number; daily: number; maxConcurrency: number; timeoutMs: number };
  /** AI requests this client can make right now (min of the minute bucket and the daily cap); null = not limited (demo engine) */
  remaining: number | null;
  remainingDetail: { minute: number | null; daily: number | null };
  effort: Record<string, "low" | "medium" | "high">;
}

/** One ad asset line with Google Ads length/policy validation. */
export interface AdTextLine {
  text: string;
  length: number;
  limit: number;
  ok: boolean;
  issues: string[];
}

export interface AdCopyResult extends AiMeta {
  headlines: (AdTextLine & { pin: number | null; angle: string })[];
  descriptions: (AdTextLine & { pin: number | null })[];
  path1: AdTextLine | null;
  path2: AdTextLine | null;
}

/** A campaign idea sent by the client (request side, so it carries real limits). */
export const ideaInputSchema = z.object({
  title: z.string().min(1).max(120),
  type: z.enum(IDEA_TYPES),
  audience: z.string().max(200).default(""),
  keywords: z.array(z.string().max(80)).max(10).default([]),
  rationale: z.string().max(500).default(""),
  dailyBudget: z.number().min(0).max(1_000_000).default(50),
  impact: z.string().max(80).default(""),
  confidence: z.number().min(0).max(100).default(60),
  citedCampaignIds: z.array(z.string().max(64)).max(20).default([]),
});

export const blueprintRequestSchema = z.object({
  ideaSetId: z.string().max(64).optional(),
  ideaId: z.string().max(64).optional(),
  idea: ideaInputSchema.optional(),
  finalUrl: z.string().max(300).optional(),
  format: z.enum(["json", "editor"]).optional(),
});
export type BlueprintRequest = z.infer<typeof blueprintRequestSchema>;

export interface BlueprintResult extends AiMeta {
  blueprint: Blueprint;
  /** per-line checks keyed by `adGroups.{i}.headlines.{j}`, `sitelinks.{i}.text`, `callouts.{i}` … */
  checks: Record<string, AdTextLine>;
  idea: { title: string; type: (typeof IDEA_TYPES)[number]; dailyBudget: number };
}

export const narrativeRequestSchema = z.object({
  range: z.string().max(32).optional(),
  dashboardId: z.string().max(64).optional(),
});

export interface KpiFact {
  metric: "cost" | "conversions" | "cpa" | "roas";
  label: string;
  value: number | null;
  previous: number | null;
  /** relative change (0.12 = +12%) */
  changePct: number | null;
  display: string;
  deltaDisplay: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface NarrativeFacts {
  range: { start: string; end: string; days: number; label: string };
  compareRange: { start: string; end: string } | null;
  currency: string;
  kpis: KpiFact[];
  signals: { id: string; kind: string; campaign: string; shortName: string; title: string; severity: "critical" | "warning"; metric: string | null; changePct: number; recommendation: string }[];
  bestRoas: { campaignId: string; name: string; shortName: string; roas: number; cost: number } | null;
  biggestMover: { campaignId: string; name: string; shortName: string; metric: "cost"; value: number; previous: number; delta: number; changePct: number | null } | null;
  pacing: { month: string; projected: number; target: number; paceRatio: number; overpacingCount: number } | null;
  dashboardId: string | null;
}

export interface NarrativeResult extends AiMeta {
  headline: string;
  /** render-ready bullet texts */
  bullets: string[];
  /** the same bullets with sentiment and fact refs (kpi:cost, signal:<id>, campaign:<id>, pacing) */
  bulletItems: Narrative["bullets"];
  nextSteps: string[];
  facts: NarrativeFacts;
}

export interface ExplainChange {
  id: string;
  ts: string;
  date: string;
  resource: string;
  fields: string[];
  summary: string;
  category?: ChangeCategory;
  action?: ChangeAction;
  /** "Budget +40% ($780 → $1,092)", "Target CPA ($28) → Maximize conversions", … */
  effect?: string;
  clientLabel?: string;
  automated?: boolean;
  /** days before the shift began (negative = after it began) */
  lagDays?: number;
  relevance?: "high" | "medium" | "low";
  /** the change the signal's change context points to */
  primary?: boolean;
}

export interface ExplainFacts {
  signal: { id: string; title: string; summary: string; kind: string; metric: string | null; severity: string; polarity: "bad" | "good"; observed: number; expected: number; changePct: number; campaignId: string; campaignName: string; window: { recentStart: string; recentEnd: string; baselineStart: string; baselineEnd: string }; onsetDate?: string };
  /** daily series over the last 28 days */
  series: { date: string; impressions: number; clicks: number; cost: number; conversions: number; ctr: number | null; cpc: number | null; cvr: number | null; cpa: number | null }[];
  /** ΔlnCPA = ΔlnCPC − ΔlnCVR (recent window vs baseline) */
  decomposition: { recent: { cpa: number | null; cpc: number | null; cvr: number | null; ctr: number | null; lostIsRank: number | null }; baseline: { cpa: number | null; cpc: number | null; cvr: number | null; ctr: number | null; lostIsRank: number | null }; dlnCpa: number | null; dlnCpc: number | null; dlnCvr: number | null; cpcShare: number | null; cvrShare: number | null } | null;
  contributions: { dimension: "device" | "country"; segment: string; recent: number | null; baseline: number | null; changePct: number | null; share: number | null }[];
  /** the campaign's change events in the baseline + recent windows (never the actor) */
  changes: ExplainChange[];
  /** the server's change-history verdict for the signal (expected, learning, likely cause, no recent changes, …) */
  changeContext?: SignalChangeContext | null;
}

export interface ExplainResult {
  facts: ExplainFacts;
  ai: Explanation | null;
  source: AiProviderId;
  model: string | null;
  fallbackReason?: string;
  warnings: string[];
  cached?: boolean;
}

export const negativesRequestSchema = z.object({
  range: z.string().max(32).optional(),
  campaignId: z.string().max(64).optional(),
});

export interface NegativesResult extends AiMeta {
  candidates: NegativeCandidate[];
  range: { start: string; end: string; days: number };
  thresholds: { accountCpa: number | null; costThreshold: number; clicksThreshold: number; lowCtrFactor: number; minImpressions: number };
  totals: { candidates: number; monthlySavings: number };
}

// ── Ask-your-data SSE contract ───────────────────────────────────────────────────────────────────────

export interface ChatPlanQuery {
  id: string;
  title: string;
  chart: ChatChart["type"];
  /** a validated QuerySpec (input form) */
  query: unknown;
}

export type ChatEvent =
  | { event: "meta"; data: { provider: AiProviderId; model: string | null; mode: "ai" | "demo"; dataMode: "live" | "demo"; fallbackReason?: string } }
  | { event: "plan"; data: { intent: "query" | "clarify"; queries: ChatPlanQuery[]; planner: "ai" | "nl-lite"; notes?: string[] } }
  | { event: "result"; data: { index: number; chart: ChatChart; result: unknown } }
  | { event: "delta"; data: { text: string } }
  | { event: "notice"; data: { message: string } }
  | { event: "suggestions"; data: { prompts: string[] } }
  | { event: "done"; data: { model: string | null } }
  | { event: "error"; data: { code: string; message: string } };
