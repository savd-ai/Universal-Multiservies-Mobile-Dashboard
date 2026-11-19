import "server-only";
import { negativeVerdictsSchema, type NegativeCandidate, type NegativesResult } from "@/lib/domain/contracts/ai";
import { aggregateSearchTerms, applyVerdicts, findNegativeCandidates, withDemoVerdicts } from "@/lib/domain/ai/negatives";
import { sanitizeText } from "@/lib/domain/ai/prompt-safety";
import { negativesPrompt } from "@/lib/domain/ai/prompts";
import { rangeDays, resolvePreset } from "@/lib/domain/dates";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { RequestContext } from "../../context";
import { runQuery } from "../../query/service";
import { runStructured, systemBlocks } from "../run";
import { buildSnapshot } from "../snapshot";
import { resolveRangePreset } from "./narrative";

// Negative-keyword assistant: rules over search terms find the candidates (cost/clicks with no conversions,
// irrelevant modifiers, competitor terms, low CTR, wasteful n-grams; brand and converting terms protected); the
// model may only classify those candidates (≤ 100, tag-wrapped). Demo/unclassified: rule-based verdicts.

const AI_CANDIDATES = 100;

export async function suggestNegatives(ctx: RequestContext, req: { range?: string; campaignId?: string }, signal?: AbortSignal): Promise<NegativesResult> {
  const preset = resolveRangePreset(req.range);
  const range = resolvePreset(preset, ctx.today);
  const days = rangeDays(range);
  const [slice, dims, byCampaign, snap] = await Promise.all([
    ctx.source.getTable(ctx.accountId, "search_term_daily", range),
    ctx.source.getDims(ctx.accountId),
    runQuery(querySpecSchema.parse({ metrics: ["cost", "conversions", "clicks", "impressions", "ctr", "cpa"], dimensions: ["campaign"], dateRange: { preset }, limit: 10_000 }), ctx),
    buildSnapshot(ctx),
  ]);
  const rows = slice.grain === "daily" ? slice.rows.filter((r) => typeof r.date !== "string" || (r.date >= range.start && r.date <= range.end)) : slice.rows;
  const campaignCtr = new Map(byCampaign.rows.map((r) => [String(r.campaign_id ?? ""), typeof r.ctr === "number" ? r.ctr : null]));
  const accountCpa = typeof byCampaign.totals?.cpa === "number" ? byCampaign.totals.cpa : null;
  const campaigns = new Map([...dims.campaigns.values()].map((c) => [c.id, { name: c.name, type: c.type }]));
  const { candidates, thresholds } = findNegativeCandidates({
    terms: aggregateSearchTerms(rows),
    campaigns,
    campaignCtr,
    accountCpa,
    brandTerms: snap.settings.brandTerms,
    competitorTerms: snap.settings.competitorTerms,
    rangeDays: days,
    campaignId: req.campaignId,
  });

  const forAi = candidates.slice(0, AI_CANDIDATES);
  const table = forAi.map((c) => [sanitizeText(c.term, 120).replace(/\|/g, "/"), sanitizeText(c.campaignName, 120).replace(/\|/g, "/"), c.cost.toFixed(2), c.clicks, c.conversions.toFixed(1), c.reasons.join("; ")].join(" | "));
  const outcome = await runStructured({
    feature: "negatives",
    schema: negativeVerdictsSchema,
    schemaName: "negative_verdicts",
    system: systemBlocks(snap),
    prompt: negativesPrompt(["term | campaign | cost | clicks | conv | rule reasons", ...table].join("\n"), snap.settings.brandTerms),
    cache: { input: { preset, campaignId: req.campaignId ?? null, ids: forAi.map((c) => `${c.id}:${c.cost}`) }, snapshotHash: snap.hash },
    signal,
    accept: (v) => {
      const merged = applyVerdicts(forAi, v.verdicts);
      const warnings: string[] = [];
      if (merged.unknown) warnings.push(`Ignored ${merged.unknown} AI verdict${merged.unknown === 1 ? "" : "s"} for terms that were not candidates.`);
      if (merged.unclassified) warnings.push(`${merged.unclassified} candidate${merged.unclassified === 1 ? " was" : "s were"} not classified by the AI and use the rule-based verdict.`);
      return { value: [...merged.candidates, ...withDemoVerdicts(candidates.slice(AI_CANDIDATES))], warnings };
    },
    demo: () => ({ value: withDemoVerdicts(candidates) }),
  });

  const list: NegativeCandidate[] = outcome.value;
  const savings = list.filter((c) => c.verdict === "negative").reduce((s, c) => s + c.monthlySavings, 0);
  return {
    candidates: list,
    range: { start: range.start, end: range.end, days },
    thresholds,
    totals: { candidates: list.length, monthlySavings: Math.round(savings * 100) / 100 },
    source: outcome.source,
    model: outcome.model,
    ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
    warnings: [...outcome.warnings, ...(slice.rows.length ? [] : ["No search-term data for this range."])],
    ...(outcome.cached ? { cached: true } : {}),
  };
}
