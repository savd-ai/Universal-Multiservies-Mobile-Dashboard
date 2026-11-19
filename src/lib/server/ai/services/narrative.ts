import "server-only";
import { narrativeSchema, type KpiFact, type Narrative, type NarrativeFacts, type NarrativeResult } from "@/lib/domain/contracts/ai";
import { demoNarrative, narrativeFactNumbers, narrativeFactTexts, shortCampaignName } from "@/lib/domain/ai/demo-engine";
import { narrativePrompt } from "@/lib/domain/ai/prompts";
import { groundingCheck, nameIds } from "@/lib/domain/ai/validators";
import { DATE_PRESETS, formatRange, PRESET_LABELS, type DatePreset } from "@/lib/domain/dates";
import { deltaSentiment, formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import { querySpecSchema, type QueryResult, type QuerySpecInput } from "@/lib/domain/query/spec";
import { listSignals } from "../../anomaly/service";
import { getPacingReport } from "../../budget/service";
import type { RequestContext } from "../../context";
import { runQuery } from "../../query/service";
import { AcceptanceError, runStructured, systemBlocks } from "../run";
import { buildSnapshot } from "../snapshot";

// Smart narrative: the SERVER computes the facts (KPI deltas vs the previous period, top signals, best-ROAS
// campaign, biggest mover, pacing); the AI only phrases them. Any number in the AI text that matches no fact
// (beyond rounding) counts as ungrounded — over 20% ungrounded → the templated narrative is returned instead. Numbers
// inside quoted names, and numbers the facts' own sentences contain, are grounded; ids in the prose become names.

const ALIASES: Record<string, DatePreset> = { "7d": "last_7d", "14d": "last_14d", "28d": "last_28d", "30d": "last_30d", "90d": "last_90d" };
const MAX_UNGROUNDED = 0.2;

export function resolveRangePreset(range: string | undefined, fallback: DatePreset = "last_30d"): DatePreset {
  if (!range) return fallback;
  const r = range.trim().toLowerCase();
  if ((DATE_PRESETS as readonly string[]).includes(r)) return r as DatePreset;
  return ALIASES[r] ?? fallback;
}

const q = (ctx: RequestContext, spec: QuerySpecInput): Promise<QueryResult> => runQuery(querySpecSchema.parse(spec), ctx);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** facts are rounded (4 decimals; money to cents) so responses and cache keys are stable */
const r4 = (v: number | null): number | null => (v === null ? null : Math.round(v * 10_000) / 10_000);
const r2 = (v: number): number => Math.round(v * 100) / 100;

const KPIS: { metric: KpiFact["metric"]; label: string }[] = [
  { metric: "cost", label: "Spend" },
  { metric: "conversions", label: "Conversions" },
  { metric: "cpa", label: "CPA" },
  { metric: "roas", label: "ROAS" },
];

export async function computeNarrativeFacts(ctx: RequestContext, preset: DatePreset, dashboardId: string | null = null): Promise<NarrativeFacts> {
  const currency = ctx.account.currency;
  const [total, byCampaign] = await Promise.all([
    q(ctx, { metrics: ["cost", "conversions", "cpa", "roas"], dateRange: { preset }, compare: "previous_period" }),
    q(ctx, { metrics: ["cost", "conversions", "roas"], dimensions: ["campaign"], dateRange: { preset }, compare: "previous_period", limit: 10_000 }),
  ]);
  const kpis: KpiFact[] = KPIS.map(({ metric, label }) => {
    const def = ctx.registry.get(metric);
    // displays come from the raw values; only the stored numbers are rounded
    const value = num(total.totals?.[metric]);
    const previous = num(total.compareTotals?.[metric]);
    const change = value !== null && previous !== null && previous !== 0 ? value / previous - 1 : null;
    const s = def ? deltaSentiment(def.direction, change) : null;
    return { metric, label, value: r4(value), previous: r4(previous), changePct: change === null ? null : Math.round(change * 1e6) / 1e6, display: formatMetricValue(def?.format ?? "number", value, { currency }), deltaDisplay: formatDelta(change), sentiment: s === "good" ? "positive" : s === "bad" ? "negative" : "neutral" };
  });

  const totalCost = num(total.totals?.cost) ?? 0;
  const minSpend = Math.max(50, totalCost * 0.01);
  const rows = byCampaign.rows.map((r) => ({ id: String(r.campaign_id ?? ""), name: String(r.campaign ?? ""), cost: num(r.cost) ?? 0, prev: num(r.cost__prev), roas: num(r.roas) }));
  const best = rows.filter((r) => r.roas !== null && r.cost >= minSpend).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0) || a.id.localeCompare(b.id))[0];
  const mover = rows.filter((r) => r.prev !== null).sort((a, b) => Math.abs(b.cost - (b.prev ?? 0)) - Math.abs(a.cost - (a.prev ?? 0)) || a.id.localeCompare(b.id))[0];

  let signals: NarrativeFacts["signals"] = [];
  try {
    signals = (await listSignals(ctx, { includeInactive: false }))
      .filter((s) => s.status === "open" && s.severity !== "info")
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1) || b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 2)
      .map((s) => ({ id: s.id, kind: s.kind, campaign: s.entity.name, shortName: shortCampaignName(s.entity.name), title: s.title, severity: s.severity === "critical" ? "critical" : "warning", metric: s.metric ?? null, changePct: r4(s.changePct) ?? 0, recommendation: s.recommendation }));
  } catch {
    /* signals are optional context */
  }

  let pacing: NarrativeFacts["pacing"] = null;
  try {
    const p = await getPacingReport(ctx);
    pacing = { month: p.month, projected: r2(p.totals.projected), target: r2(p.totals.monthlyTarget), paceRatio: r4(p.totals.paceRatio) ?? 0, overpacingCount: p.totals.overpacingCount };
  } catch {
    /* pacing is optional context */
  }

  const range = total.meta.range;
  return {
    range: { ...range, label: PRESET_LABELS[preset] ?? formatRange(range) },
    compareRange: total.meta.compareRange ?? null,
    currency,
    kpis,
    signals,
    bestRoas: best && best.roas !== null ? { campaignId: best.id, name: best.name, shortName: shortCampaignName(best.name), roas: r4(best.roas) ?? 0, cost: r2(best.cost) } : null,
    biggestMover: mover && mover.prev !== null ? { campaignId: mover.id, name: mover.name, shortName: shortCampaignName(mover.name), metric: "cost", value: r2(mover.cost), previous: r2(mover.prev), delta: r2(mover.cost - mover.prev), changePct: mover.prev !== 0 ? r4(mover.cost / mover.prev - 1) : null } : null,
    pacing,
    dashboardId,
  };
}

/** Compact, rounded facts for the model (names sanitised by the prompt wrapper). */
function factsForModel(f: NarrativeFacts): string {
  const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
  return JSON.stringify({
    range: f.range,
    currency: f.currency,
    kpis: f.kpis.map((k) => ({ ref: `kpi:${k.metric}`, label: k.label, value: round2(k.value), previous: round2(k.previous), change_pct: k.changePct === null ? null : round2(k.changePct * 100), display: k.display, delta: k.deltaDisplay })),
    signals: f.signals.map((s) => ({ ref: `signal:${s.id}`, campaign: s.shortName, title: s.title, severity: s.severity, change_pct: round2(s.changePct * 100), recommendation: s.recommendation })),
    best_roas: f.bestRoas ? { ref: `campaign:${f.bestRoas.campaignId}`, campaign: f.bestRoas.shortName, roas: round2(f.bestRoas.roas), spend: round2(f.bestRoas.cost) } : null,
    biggest_mover: f.biggestMover ? { ref: `campaign:${f.biggestMover.campaignId}`, campaign: f.biggestMover.shortName, spend: round2(f.biggestMover.value), previous_spend: round2(f.biggestMover.previous), delta: round2(f.biggestMover.delta), change_pct: f.biggestMover.changePct === null ? null : round2(f.biggestMover.changePct * 100) } : null,
    pacing: f.pacing ? { ref: "pacing", month: f.pacing.month, projected: round2(f.pacing.projected), target: round2(f.pacing.target), pace_pct: round2(f.pacing.paceRatio * 100) } : null,
  });
}

const clip = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export async function generateNarrative(ctx: RequestContext, req: { range?: string; dashboardId?: string }, signal?: AbortSignal): Promise<NarrativeResult> {
  const preset = resolveRangePreset(req.range);
  const [facts, snap] = await Promise.all([computeNarrativeFacts(ctx, preset, req.dashboardId ?? null), buildSnapshot(ctx)]);
  const factNumbers = narrativeFactNumbers(facts);
  const factTexts = narrativeFactTexts(facts);
  // campaign ids the model saw in refs: if one slips into the prose, the reader gets the name
  const names = new Map([facts.bestRoas, facts.biggestMover].flatMap((c) => (c ? [[c.campaignId, c.shortName] as const] : [])));

  const outcome = await runStructured({
    feature: "narrative",
    schema: narrativeSchema,
    schemaName: "performance_narrative",
    system: systemBlocks(snap),
    prompt: narrativePrompt(factsForModel(facts)),
    cache: { input: { facts }, snapshotHash: snap.hash },
    signal,
    accept: (n): { value: Narrative; warnings: string[] } => {
      const prose = (s: string, max: number) => clip(nameIds(s, names), max);
      const value: Narrative = {
        headline: prose(n.headline, 300),
        bullets: n.bullets.slice(0, 6).map((b) => ({ text: prose(b.text, 300), sentiment: b.sentiment, refs: b.refs.slice(0, 5).map((r) => clip(r, 80)) })),
        nextSteps: n.nextSteps.slice(0, 4).map((s) => prose(s, 240)),
      };
      if (!value.headline) throw new AcceptanceError("The AI narrative was empty.");
      const report = groundingCheck([value.headline, ...value.bullets.map((b) => b.text), ...value.nextSteps], factNumbers, factTexts);
      if (report.ratio > MAX_UNGROUNDED) throw new AcceptanceError(`The AI narrative quoted numbers that are not in your data (${report.unmatched.slice(0, 3).join(", ")}); showing the rule-based summary.`);
      return { value, warnings: report.unmatched.length ? [`${report.unmatched.length} number${report.unmatched.length === 1 ? "" : "s"} in the narrative could not be matched to the data: ${report.unmatched.slice(0, 3).join(", ")}.`] : [] };
    },
    demo: () => ({ value: demoNarrative(facts) }),
  });
  return {
    headline: outcome.value.headline,
    bullets: outcome.value.bullets.map((b) => b.text),
    bulletItems: outcome.value.bullets,
    nextSteps: outcome.value.nextSteps,
    facts,
    source: outcome.source,
    model: outcome.model,
    ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
    warnings: outcome.warnings,
    ...(outcome.cached ? { cached: true } : {}),
  };
}
