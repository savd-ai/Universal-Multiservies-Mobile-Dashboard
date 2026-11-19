import "server-only";
import { explanationSchema, type ExplainChange, type ExplainFacts, type ExplainResult, type Explanation } from "@/lib/domain/contracts/ai";
import type { Signal } from "@/lib/domain/contracts/anomaly";
import { EXPLAIN_METRICS, explainWithRules, logDecomposition, segmentContributions, type SegmentWindow, type WindowAgg } from "@/lib/domain/ai/explain";
import { sanitizeText, scrubUrls } from "@/lib/domain/ai/prompt-safety";
import { nameIds } from "@/lib/domain/ai/validators";
import { explainPrompt } from "@/lib/domain/ai/prompts";
import { parseChange } from "@/lib/domain/anomaly/changes";
import { addDays, diffDays } from "@/lib/domain/dates";
import { querySpecSchema, type QueryFilter, type QueryResult, type QuerySpecInput } from "@/lib/domain/query/spec";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { listSignals } from "../../anomaly/service";
import type { RequestContext } from "../../context";
import { notFound } from "../../http/errors";
import { runQuery } from "../../query/service";
import { AcceptanceError, runStructured, systemBlocks } from "../run";
import { buildSnapshot } from "../snapshot";

// Anomaly explanation. Observed facts are computed here — 28-day series, CPA log decomposition (ΔlnCPA = ΔlnCPC −
// ΔlnCVR), device/country contributions, the campaign's change events classified like the detectors do (category,
// effect, client, days before the shift; actors are never included) and the signal's change-history verdict — and
// the model only proposes causes, checks and actions. Demo: the rule library in domain/ai/explain.

/** change events sent with the facts (the verdict's change is always among them) */
const MAX_CHANGES = 12;

const q = (ctx: RequestContext, spec: QuerySpecInput): Promise<QueryResult> => runQuery(querySpecSchema.parse(spec), ctx);
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const nn = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function aggOf(row: Record<string, unknown> | undefined): WindowAgg {
  return { impressions: n(row?.impressions), clicks: n(row?.clicks), cost: n(row?.cost), conversions: n(row?.conversions), conv_value: n(row?.conv_value), lostIsRank: nn(row?.lost_is_rank) };
}

interface Windows {
  recent: { start: string; end: string };
  baseline: { start: string; end: string };
  recentDays: number;
  baselineDays: number;
}

function windowsOf(sig: Signal): Windows {
  const recent = { start: sig.window.recentStart, end: sig.window.recentEnd };
  const baseline = { start: sig.window.baselineStart ?? addDays(recent.start, -14), end: sig.window.baselineEnd ?? addDays(recent.start, -1) };
  return { recent, baseline, recentDays: diffDays(recent.start, recent.end) + 1, baselineDays: diffDays(baseline.start, baseline.end) + 1 };
}

export async function computeExplainFacts(ctx: RequestContext, sig: Signal): Promise<{ facts: ExplainFacts; recent: WindowAgg; baseline: WindowAgg; w: Windows }> {
  const w = windowsOf(sig);
  const campaignId = sig.scope === "campaign" ? sig.entity.id : null;
  const filters: QueryFilter[] = campaignId ? [{ dim: "campaign", op: "eq", value: campaignId }] : [];
  const base = ["impressions", "clicks", "cost", "conversions", "conv_value"];
  const [series, recentTot, baseTot, recentDev, baseDev, recentGeo, baseGeo] = await Promise.all([
    q(ctx, { metrics: ["impressions", "clicks", "cost", "conversions", "ctr", "cpc", "cvr", "cpa"], dimensions: ["date"], filters, dateRange: { start: addDays(w.recent.end, -27), end: w.recent.end }, fillGaps: true }),
    q(ctx, { metrics: [...base, "lost_is_rank"], filters, dateRange: w.recent }),
    q(ctx, { metrics: [...base, "lost_is_rank"], filters, dateRange: w.baseline }),
    q(ctx, { metrics: base, dimensions: ["device"], filters, dateRange: w.recent }).catch(() => null),
    q(ctx, { metrics: base, dimensions: ["device"], filters, dateRange: w.baseline }).catch(() => null),
    q(ctx, { metrics: base, dimensions: ["country"], filters, dateRange: w.recent }).catch(() => null),
    q(ctx, { metrics: base, dimensions: ["country"], filters, dateRange: w.baseline }).catch(() => null),
  ]);
  const recent = aggOf(recentTot.rows[0] ?? recentTot.totals ?? undefined);
  const baseline = aggOf(baseTot.rows[0] ?? baseTot.totals ?? undefined);

  const metric = sig.metric && EXPLAIN_METRICS[sig.metric] ? sig.metric : sig.kind === "tracking_break" ? "conversions" : "cost";
  const segments = (dim: "device" | "country", r: QueryResult | null, b: QueryResult | null): SegmentWindow[] => {
    if (!r || !b) return [];
    const byId = new Map(b.rows.map((row) => [String(row[`${dim}_id`] ?? row[dim] ?? ""), row]));
    return r.rows.map((row) => {
      const id = String(row[`${dim}_id`] ?? row[dim] ?? "");
      return { segment: String(row[dim] ?? id), recent: aggOf(row), baseline: aggOf(byId.get(id)) };
    });
  };
  const contributions = [...segmentContributions(metric, "device", segments("device", recentDev, baseDev), w.recentDays, w.baselineDays).slice(0, 5), ...segmentContributions(metric, "country", segments("country", recentGeo, baseGeo), w.recentDays, w.baselineDays).slice(0, 5)];

  const events = await ctx.source.getChangeEvents(ctx.accountId, { start: w.baseline.start, end: w.recent.end }).catch(() => []);
  const onset = sig.onsetDate ?? w.recent.start;
  const primaryId = sig.changeContext?.eventId;
  const related = new Map(sig.relatedChanges.map((r) => [r.eventId, r]));
  const newestFirst = (a: ChangeEvent, b: ChangeEvent) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : a.id.localeCompare(b.id));
  const scoped = events.filter((e) => !campaignId || e.campaign_id === campaignId || related.has(e.id)).sort(newestFirst);
  const picked = scoped.slice(0, MAX_CHANGES);
  const primary = scoped.find((e) => e.id === primaryId);
  if (primary && !picked.includes(primary)) picked.splice(MAX_CHANGES - 1, 1, primary);
  const changes = picked.sort(newestFirst).map((e): ExplainChange => {
    const p = parseChange(e, ctx.account.currency);
    const relevance = related.get(e.id)?.relevance;
    return {
      id: e.id,
      ts: e.ts,
      date: e.date,
      resource: e.resource_type,
      fields: e.changed_fields.slice(0, 6),
      summary: sanitizeText(scrubUrls(e.summary), 240),
      category: p.category,
      action: p.action,
      ...(p.effect ? { effect: p.effect } : {}),
      clientLabel: p.client.label,
      ...(p.client.automated ? { automated: true } : {}),
      lagDays: diffDays(e.date, onset),
      ...(relevance ? { relevance } : {}),
      ...(e.id === primaryId ? { primary: true } : {}),
    };
  });

  const facts: ExplainFacts = {
    signal: {
      id: sig.id,
      title: sig.title,
      summary: sig.summary,
      kind: sig.kind,
      metric: sig.metric ?? null,
      severity: sig.severity,
      polarity: sig.polarity,
      observed: sig.observed,
      expected: sig.expected,
      changePct: sig.changePct,
      campaignId: sig.entity.id,
      campaignName: sig.entity.name,
      window: { recentStart: w.recent.start, recentEnd: w.recent.end, baselineStart: w.baseline.start, baselineEnd: w.baseline.end },
      onsetDate: onset,
    },
    series: series.rows.map((r) => ({ date: String(r.date ?? ""), impressions: n(r.impressions), clicks: n(r.clicks), cost: n(r.cost), conversions: n(r.conversions), ctr: nn(r.ctr), cpc: nn(r.cpc), cvr: nn(r.cvr), cpa: nn(r.cpa) })),
    decomposition: logDecomposition(recent, baseline),
    contributions,
    changes,
    changeContext: sig.changeContext ?? null,
  };
  return { facts, recent, baseline, w };
}

/** The model sees summaries, not the full 28-day series (the chart already shows it). Actors are never included, and
 *  neither are internal ids: the model names the campaign by its name (it once wrote "campaign c8"). */
function factsForModel(f: ExplainFacts): string {
  const ctx = f.changeContext;
  const { id: _id, campaignId: _campaignId, ...signal } = f.signal;
  return JSON.stringify({
    signal: { ...signal, title: sanitizeText(f.signal.title, 200), summary: sanitizeText(scrubUrls(f.signal.summary), 400), campaignName: sanitizeText(f.signal.campaignName) },
    decomposition: f.decomposition,
    contributions: f.contributions.map((c) => ({ ...c, segment: sanitizeText(c.segment, 60) })),
    changes: f.changes.map((c) => ({
      date: c.date,
      resource: c.resource,
      category: c.category ?? null,
      effect: c.effect ? sanitizeText(c.effect, 120) : null,
      fields: c.fields,
      summary: c.summary,
      client: c.clientLabel ?? null,
      automated: c.automated ?? false,
      lagDays: c.lagDays ?? null,
      relevance: c.relevance ?? null,
      primary: c.primary ?? false,
    })),
    changeContext: ctx ? { verdict: ctx.verdict, note: sanitizeText(scrubUrls(ctx.note), 300), lagDays: ctx.lagDays ?? null, learning: ctx.learning ?? null } : null,
    last7days: f.series.slice(-7),
  });
}

const clip = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export async function explainForSignal(ctx: RequestContext, sig: Signal, signal?: AbortSignal): Promise<ExplainResult> {
  const [{ facts, recent, baseline, w }, snap] = await Promise.all([computeExplainFacts(ctx, sig), buildSnapshot(ctx)]);
  const outcome = await runStructured({
    feature: "explain",
    schema: explanationSchema,
    schemaName: "anomaly_explanation",
    system: systemBlocks(snap),
    prompt: explainPrompt(factsForModel(facts)),
    cache: { input: { id: sig.id, facts: { ...facts, series: facts.series.slice(-7) } }, snapshotHash: snap.hash },
    signal,
    accept: (e): { value: Explanation } => {
      // an id from the account snapshot that slips into the prose is replaced by the campaign's name
      const names = new Map([[facts.signal.campaignId, facts.signal.campaignName]]);
      const prose = (s: string, max: number) => clip(nameIds(s, names), max);
      const value: Explanation = {
        possibleCauses: e.possibleCauses.slice(0, 4).map((c) => ({ cause: prose(c.cause, 120), likelihood: c.likelihood, evidence: c.evidence.slice(0, 4).map((x) => prose(x, 240)), checks: c.checks.slice(0, 4).map((x) => prose(x, 200)) })),
        actions: e.actions.slice(0, 5).map((a) => ({ action: prose(a.action, 160), rationale: prose(a.rationale, 240), risk: a.risk })),
        confidenceNote: prose(e.confidenceNote, 300),
      };
      if (!value.possibleCauses.length) throw new AcceptanceError("The AI explanation listed no possible causes.");
      return { value };
    },
    demo: () => ({ value: explainWithRules({ facts, recent, baseline, recentDays: w.recentDays, baselineDays: w.baselineDays }) }),
  });
  return { facts, ai: outcome.value, source: outcome.source, model: outcome.model, ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}), warnings: outcome.warnings, ...(outcome.cached ? { cached: true } : {}) };
}

export async function explainSignal(ctx: RequestContext, id: string, signal?: AbortSignal): Promise<ExplainResult> {
  const sig = (await listSignals(ctx)).find((s) => s.id === id);
  if (!sig) throw notFound("Signal");
  return explainForSignal(ctx, sig, signal);
}
