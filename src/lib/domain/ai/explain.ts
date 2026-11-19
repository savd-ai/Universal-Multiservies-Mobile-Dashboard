import { changeCategory } from "../anomaly/changes";
import type { ExplainChange, ExplainFacts, Explanation } from "../contracts/ai";
import type { ChangeCategory } from "../contracts/anomaly";
import type { ChangeEvent } from "../schema/facts";

// Anomaly explanation: the server computes the observed facts (series, CPA log decomposition, segment
// contributions, related changes and the change-history verdict); the AI — or this rule library in demo mode —
// only proposes causes, checks and actions. ΔlnCPA = ΔlnCPC − ΔlnCVR holds exactly because CPA = CPC ÷ CVR with
// ratio-of-sums. Only changes made on or before the onset count as causes.

export interface WindowAgg {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conv_value?: number;
  /** lost impression share to rank (ratio of sums), when the campaign reports impression share */
  lostIsRank?: number | null;
}

const div = (a: number, b: number): number | null => (b > 0 && Number.isFinite(a) ? a / b : null);
const ln = (v: number | null): number | null => (v !== null && v > 0 ? Math.log(v) : null);
const r4 = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10_000) / 10_000);

export function windowRatios(a: WindowAgg) {
  return {
    cpa: div(a.cost, a.conversions),
    cpc: div(a.cost, a.clicks),
    cvr: div(a.conversions, a.clicks),
    ctr: div(a.clicks, a.impressions),
    lostIsRank: a.lostIsRank ?? null,
  };
}

export function logDecomposition(recent: WindowAgg, baseline: WindowAgg): NonNullable<ExplainFacts["decomposition"]> {
  const r = windowRatios(recent);
  const b = windowRatios(baseline);
  const d = (x: number | null, y: number | null) => {
    const lx = ln(x);
    const ly = ln(y);
    return lx !== null && ly !== null ? lx - ly : null;
  };
  const dlnCpa = d(r.cpa, b.cpa);
  const dlnCpc = d(r.cpc, b.cpc);
  const dlnCvr = d(r.cvr, b.cvr);
  const meaningful = dlnCpa !== null && Math.abs(dlnCpa) > 1e-6 && dlnCpc !== null && dlnCvr !== null;
  const round = (o: typeof r) => ({ cpa: r4(o.cpa), cpc: r4(o.cpc), cvr: r4(o.cvr), ctr: r4(o.ctr), lostIsRank: r4(o.lostIsRank) });
  return {
    recent: round(r),
    baseline: round(b),
    dlnCpa: r4(dlnCpa),
    dlnCpc: r4(dlnCpc),
    dlnCvr: r4(dlnCvr),
    cpcShare: meaningful ? r4((dlnCpc as number) / (dlnCpa as number)) : null,
    cvrShare: meaningful ? r4(-(dlnCvr as number) / (dlnCpa as number)) : null,
  };
}

/** Monitored-metric name → registry key and (for ratios) numerator/denominator. */
export const EXPLAIN_METRICS: Record<string, { key: string; num?: keyof WindowAgg; den?: keyof WindowAgg }> = {
  spend: { key: "cost" },
  cost: { key: "cost" },
  conversions: { key: "conversions" },
  clicks: { key: "clicks" },
  impressions: { key: "impressions" },
  cpa: { key: "cpa", num: "cost", den: "conversions" },
  ctr: { key: "ctr", num: "clicks", den: "impressions" },
  cpc: { key: "cpc", num: "cost", den: "clicks" },
  cvr: { key: "cvr", num: "conversions", den: "clicks" },
  roas: { key: "roas", num: "conv_value", den: "cost" },
};

export interface SegmentWindow {
  segment: string;
  recent: WindowAgg;
  baseline: WindowAgg;
}

/**
 * Approximate contribution of each segment to the metric change. Additive metrics compare per-day values
 * (windows differ in length); ratio metrics weight each segment's rate change by its recent volume share.
 */
export function segmentContributions(metric: string, dimension: "device" | "country", segments: readonly SegmentWindow[], recentDays: number, baselineDays: number): ExplainFacts["contributions"] {
  const def = EXPLAIN_METRICS[metric] ?? EXPLAIN_METRICS.cost;
  if (!def) return [];
  const rd = Math.max(1, recentDays);
  const bd = Math.max(1, baselineDays);
  const value = (a: WindowAgg, days: number): number | null => {
    if (def.num && def.den) return div(Number(a[def.num] ?? 0), Number(a[def.den] ?? 0));
    return Number(a[def.key as keyof WindowAgg] ?? 0) / days;
  };
  const totalDen = def.den ? segments.reduce((s, x) => s + Number(x.recent[def.den as keyof WindowAgg] ?? 0), 0) : 0;
  const effects = segments.map((s) => {
    const rv = value(s.recent, rd);
    const bv = value(s.baseline, bd);
    let effect: number | null = null;
    if (rv !== null && bv !== null) {
      effect = def.den ? (totalDen > 0 ? Number(s.recent[def.den] ?? 0) / totalDen : 0) * (rv - bv) : rv - bv;
    }
    return { s, rv, bv, effect };
  });
  const totalEffect = effects.reduce((sum, e) => sum + (e.effect ?? 0), 0);
  return effects
    .map((e) => ({
      dimension,
      segment: e.s.segment,
      recent: r4(e.rv),
      baseline: r4(e.bv),
      changePct: e.rv !== null && e.bv !== null && e.bv !== 0 ? r4(e.rv / e.bv - 1) : null,
      share: e.effect !== null && Math.abs(totalEffect) > 1e-9 ? r4(e.effect / totalEffect) : null,
    }))
    .sort((a, b) => Math.abs(b.share ?? 0) - Math.abs(a.share ?? 0) || a.segment.localeCompare(b.segment));
}

// ── Rule library (demo engine) ─────────────────────────────────────────────────────────────────────────

type Cause = Explanation["possibleCauses"][number];
type Action = Explanation["actions"][number];

const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`);
const rel = (a: number | null, b: number | null) => (a !== null && b !== null && b !== 0 ? a / b - 1 : null);

export interface RuleInput {
  facts: ExplainFacts;
  recent: WindowAgg;
  baseline: WindowAgg;
  recentDays: number;
  baselineDays: number;
}

const RESOURCE_TYPES: ReadonlySet<string> = new Set(["CAMPAIGN", "CAMPAIGN_BUDGET", "AD_GROUP", "AD_GROUP_AD", "AD_GROUP_CRITERION", "CAMPAIGN_CRITERION", "ASSET"]);
const resourceType = (r: string): ChangeEvent["resource_type"] => (RESOURCE_TYPES.has(r) ? (r as ChangeEvent["resource_type"]) : "OTHER");

/** The change's category from the facts, or classified from its resource and fields (older cached facts). */
function categoryOf(c: ExplainChange): ChangeCategory {
  return c.category ?? changeCategory({ resource_type: resourceType(c.resource), operation: "update", changed_fields: c.fields, diffs: [], summary: c.summary });
}

/** Deterministic causes/checks/actions from server facts (prototype recommendations, generalised). */
export function explainWithRules(input: RuleInput): Explanation {
  const { facts } = input;
  const d = facts.decomposition;
  const causes: Cause[] = [];
  const actions: Action[] = [];
  const verdict = facts.changeContext ?? null;
  // Timing: only changes on or before the onset can be causes; later ones are context.
  const onset = facts.signal.onsetDate ?? facts.signal.window.recentStart;
  const changes = facts.changes.filter((c) => c.date <= onset);
  const later = facts.changes.filter((c) => c.date > onset);
  const inCategory = (...cats: ChangeCategory[]) => changes.filter((c) => cats.includes(categoryOf(c)));
  const adChanges = inCategory("creative");
  const bidChanges = inCategory("bidding", "bid_target");
  const urlChanges = inCategory("landing");
  const budgetChanges = inCategory("budget");
  const statusChanges = inCategory("status");
  const cpcUp = rel(d?.recent.cpc ?? null, d?.baseline.cpc ?? null);
  const ctrChg = rel(d?.recent.ctr ?? null, d?.baseline.ctr ?? null);
  const cvrChg = rel(d?.recent.cvr ?? null, d?.baseline.cvr ?? null);
  const cpaChg = rel(d?.recent.cpa ?? null, d?.baseline.cpa ?? null);
  const rankUp = d?.recent.lostIsRank !== null && d?.recent.lostIsRank !== undefined && d.baseline.lostIsRank !== null ? d.recent.lostIsRank - d.baseline.lostIsRank : null;
  const perDay = (a: WindowAgg, days: number, k: "clicks" | "conversions" | "cost") => a[k] / Math.max(1, days);
  const baseClicks = perDay(input.baseline, input.baselineDays, "clicks");
  const clicksNormal = perDay(input.recent, input.recentDays, "clicks") >= 0.5 * baseClicks;
  const convBase = perDay(input.baseline, input.baselineDays, "conversions");
  // Days in the recent window with normal traffic but zero conversions.
  const zeroDays = facts.series.filter((p) => p.date >= facts.signal.window.recentStart && p.date <= facts.signal.window.recentEnd && p.conversions <= 0 && p.clicks >= 0.5 * baseClicks).length;
  const convGone = facts.signal.kind === "tracking_break" || (convBase >= 1 && (perDay(input.recent, input.recentDays, "conversions") <= 0.1 * convBase || zeroDays >= 2));
  const spendUp = rel(perDay(input.recent, input.recentDays, "cost"), perDay(input.baseline, input.baselineDays, "cost"));
  const convChg = rel(perDay(input.recent, input.recentDays, "conversions"), convBase);
  const clicksChg = rel(perDay(input.recent, input.recentDays, "clicks"), baseClicks);
  const ev = (...xs: (string | false | null | undefined)[]) => xs.filter((x): x is string => !!x);
  const changeEv = (list: ExplainFacts["changes"]) => list.slice(0, 2).map((c) => `${c.date}: ${c.summary}`);
  const primary = facts.changes.find((c) => c.primary) ?? null;
  const settled = verdict?.verdict === "expected" || verdict?.verdict === "learning";

  // The server's change-history verdict reframes everything else: an intended effect or a learning period.
  if (verdict?.verdict === "expected") {
    causes.push({ cause: "Expected effect of a recent change", likelihood: "high", evidence: ev(verdict.note, primary && `${primary.date}: ${primary.summary}`), checks: ["Confirm the change was intended", "Check that CPA and ROAS hold at the new level over the next week"] });
    actions.push({ action: "No fix needed — monitor efficiency at the new level", rationale: "The shift is what the change was meant to do.", risk: "low" });
  }
  if (verdict?.verdict === "learning") {
    causes.push({ cause: "Bid-strategy learning period", likelihood: "high", evidence: ev(verdict.note, primary && `${primary.date}: ${primary.summary}`, verdict.learning && `Day ${verdict.learning.day} of about ${verdict.learning.days}`), checks: ["Compare with the same weekdays before the change", "Avoid further bid, target or budget edits until learning ends — they restart it"] });
    actions.push({ action: "Wait for the learning period to end before changing bids or targets", rationale: "Smart Bidding needs about a week of data after a strategy or target change.", risk: "low" });
  }

  if (convGone && clicksNormal) {
    causes.push({ cause: "Conversion tracking break", likelihood: "high", evidence: ev(zeroDays ? `${zeroDays} of ${input.recentDays} recent days had 0 conversions with normal traffic` : "Conversions fell to ~0", `Clicks/day ${pct(rel(perDay(input.recent, input.recentDays, "clicks"), baseClicks))} vs baseline`), checks: ["Check conversion action status and Tag Assistant for the purchase tag", "Look for checkout errors or Merchant Center disapprovals", "Confirm no conversion action was removed or set to secondary"] });
    actions.push({ action: "Fix tracking before touching bids or budgets", rationale: "Smart bidding is optimising on missing conversions and will cut bids if this persists.", risk: "low" });
  }
  if (cpcUp !== null && cpcUp > 0.1) {
    const auction = rankUp !== null && rankUp > 0.02;
    causes.push({ cause: auction ? "Auction pressure from competitors" : "Rising CPCs (auction or bid changes)", likelihood: auction ? "high" : "medium", evidence: ev(`CPC ${pct(cpcUp)} vs baseline`, auction && `Lost IS (rank) up ${(Number(rankUp) * 100).toFixed(1)} pts`, d?.cpcShare !== null && d?.cpcShare !== undefined && `CPC explains ${Math.round(d.cpcShare * 100)}% of the CPA change`), checks: ["Review Auction insights for new or more aggressive competitors", "Check search terms for new expensive queries"] });
    actions.push({ action: "Add a tCPA ceiling or bid cap", rationale: "Limits how far CPC pressure can push CPA up.", risk: "low" });
    actions.push({ action: "Pause the lowest Quality Score keywords", rationale: "Low QS keywords pay the highest CPCs for the same position.", risk: "medium" });
  }
  const strategySwitch = bidChanges.some((c) => categoryOf(c) === "bidding");
  if (spendUp !== null && spendUp > 0.2 && bidChanges.length && !settled) {
    causes.push({ cause: strategySwitch ? "Bid strategy switch" : "Bid or target change", likelihood: "high", evidence: ev(`Spend/day ${pct(spendUp)} vs baseline`, ...changeEv(bidChanges)), checks: ["Confirm the new bid strategy and its targets in change history", "Compare spend with the daily budget (up to 2× on a single day is allowed)"] });
    actions.push({ action: "Revert to the previous strategy or set an explicit target", rationale: "Maximize-type strategies spend the whole budget while they learn.", risk: "medium" });
    actions.push({ action: "Cap the daily budget until performance stabilises", rationale: "Contains overspend during the learning period.", risk: "low" });
  }
  // Bid or target moves behind an efficiency shift (spend jumps are covered above).
  const targetMoves = inCategory("bid_target").filter((c) => c.action === "raised" || c.action === "lowered");
  if (targetMoves.length && !settled && !(spendUp !== null && spendUp > 0.2) && cpaChg !== null && Math.abs(cpaChg) > 0.15) {
    causes.push({ cause: "Bid or target change", likelihood: "high", evidence: ev(`CPA ${pct(cpaChg)} vs baseline`, ...changeEv(targetMoves)), checks: ["Compare the new target with the CPA / ROAS the campaign actually achieves", "Check how many days the change has had to settle"] });
    actions.push({ action: "Move the target back towards its previous value if results don't recover", rationale: "A target far from achieved performance throttles volume or overspends.", risk: "medium" });
  }
  // Spend follows the daily budget.
  const budgetUp = budgetChanges.filter((c) => c.action === "raised");
  const budgetDown = budgetChanges.filter((c) => c.action === "lowered");
  if (budgetUp.length && !settled && spendUp !== null && spendUp > 0.15) {
    causes.push({ cause: "Budget increase", likelihood: "high", evidence: ev(`Spend/day ${pct(spendUp)} vs baseline`, ...changeEv(budgetUp)), checks: ["Confirm the new daily budget is intended", "Check that CPA and ROAS hold at the higher spend"] });
    actions.push({ action: "Keep the higher budget only while efficiency holds", rationale: "Extra budget buys extra volume, usually at a somewhat higher marginal CPA.", risk: "low" });
  }
  if (budgetDown.length && !settled && ((spendUp !== null && spendUp < -0.15) || (convChg !== null && convChg < -0.15))) {
    causes.push({ cause: "Budget cut", likelihood: "high", evidence: ev(spendUp !== null && `Spend/day ${pct(spendUp)} vs baseline`, ...changeEv(budgetDown)), checks: ["Confirm the lower budget is intended", "Check lost impression share (budget)"] });
    actions.push({ action: "Restore the budget if the lower volume isn't wanted", rationale: "Volume follows the daily budget on budget-limited campaigns.", risk: "low" });
  }
  // Paused or newly enabled campaigns and ad groups.
  const paused = statusChanges.filter((c) => c.action === "paused" || c.action === "removed");
  const enabled = statusChanges.filter((c) => c.action === "enabled" || c.action === "added");
  if (paused.length && !settled && (facts.signal.kind === "zero_delivery" || (spendUp !== null && spendUp < -0.15) || (convChg !== null && convChg < -0.15))) {
    causes.push({ cause: "Paused campaign or ad group", likelihood: "high", evidence: ev(...changeEv(paused)), checks: ["Check what was paused and whether that was intended"] });
    actions.push({ action: "Re-enable what was paused if it wasn't intended", rationale: "Paused items stop serving immediately.", risk: "low" });
  }
  if (enabled.length && !settled && spendUp !== null && spendUp > 0.15) {
    causes.push({ cause: "Newly enabled campaign or ad group", likelihood: "medium", evidence: ev(`Spend/day ${pct(spendUp)} vs baseline`, ...changeEv(enabled)), checks: ["Check what was enabled and the budget it draws on"] });
    actions.push({ action: "Watch CPA while the new items ramp up", rationale: "New or re-enabled items often start less efficient.", risk: "low" });
  }
  if (ctrChg !== null && ctrChg < -0.15) {
    const creative = adChanges.length > 0;
    causes.push({ cause: creative ? "Creative change" : "Creative fatigue or placement drift", likelihood: creative ? "high" : "medium", evidence: ev(`CTR ${pct(ctrChg)} vs baseline`, ...changeEv(adChanges)), checks: creative ? ["Compare the new ad's CTR with the paused/previous ad", "Check ad strength and asset ratings"] : ["Check frequency and placement reports for new low-CTR placements", "Review asset performance ratings"] });
    actions.push({ action: creative ? "Restore the previous ad or rotate fresh assets" : "Rotate new assets and review placement exclusions", rationale: "CTR collapse usually comes from the creative or where it runs.", risk: "low" });
  }
  if (cvrChg !== null && cvrChg < -0.15 && !convGone) {
    const lp = urlChanges.length > 0;
    causes.push({ cause: lp ? "Landing page change" : "Landing page or offer issue", likelihood: lp ? "high" : "medium", evidence: ev(`Conversion rate ${pct(cvrChg)} vs baseline`, d?.cvrShare !== null && d?.cvrShare !== undefined && `CVR explains ${Math.round(d.cvrShare * 100)}% of the CPA change`, ...changeEv(urlChanges)), checks: lp ? ["Open the new final URL on mobile and desktop; check load time and errors", "Confirm promo parameters didn't break tracking"] : ["Check site speed, stock and pricing changes", "Compare conversion rate by device"] });
    actions.push({ action: lp ? "Roll back the final URL change or A/B test it with an experiment" : "Audit the landing page and offer", rationale: "Traffic quality is unchanged when CPC holds but conversion rate drops.", risk: "low" });
  }
  // New keywords change the traffic mix; negatives can block converting searches; targeting changes who sees the ads.
  const newKeywords = inCategory("keywords").filter((c) => !c.action || c.action === "added");
  if (newKeywords.length && ((cpcUp !== null && cpcUp > 0.1) || (cvrChg !== null && cvrChg < -0.15) || (spendUp !== null && spendUp > 0.2))) {
    causes.push({ cause: "New keywords changed the traffic mix", likelihood: "medium", evidence: ev(...changeEv(newKeywords)), checks: ["Review the search terms the new keywords matched", "Compare CPC and conversion rate of the new keywords with the rest"] });
    actions.push({ action: "Add negatives or pause new keywords that bring poor traffic", rationale: "New keywords, broad match especially, often match expensive or irrelevant searches.", risk: "low" });
  }
  const negatives = inCategory("negatives").filter((c) => !c.action || c.action === "added");
  if (negatives.length && !settled && ((convChg !== null && convChg < -0.15) || (clicksChg !== null && clicksChg < -0.15))) {
    causes.push({ cause: "Negative keywords blocking converting searches", likelihood: "medium", evidence: ev(convChg !== null && `Conversions/day ${pct(convChg)} vs baseline`, ...changeEv(negatives)), checks: ["Check which search terms the new negatives exclude", "Look for excluded terms that converted before"] });
    actions.push({ action: "Remove negatives that blocked converting searches", rationale: "An overly broad negative cuts good traffic along with the bad.", risk: "low" });
  }
  const targeting = inCategory("targeting");
  if (targeting.length && ((spendUp !== null && Math.abs(spendUp) > 0.2) || (ctrChg !== null && Math.abs(ctrChg) > 0.15) || (cvrChg !== null && Math.abs(cvrChg) > 0.15))) {
    causes.push({ cause: "Targeting change", likelihood: "medium", evidence: ev(...changeEv(targeting)), checks: ["Compare performance by location, audience and device before and after the change", "Check whether an observation audience was switched to targeting"] });
    actions.push({ action: "Revert or narrow the targeting change if performance doesn't recover", rationale: "Targeting decides who sees the ads, and with it CTR and conversion rate.", risk: "low" });
  }
  if (verdict?.verdict === "no_recent_changes") {
    causes.push({ cause: "External factors (competitors, seasonality, market)", likelihood: "medium", evidence: ev("No account changes in the 14 days before the shift"), checks: ["Review Auction insights for new or more aggressive competitors", "Check seasonality, promotions and market news", "Check the site and conversion tracking"] });
    actions.push({ action: "Check Auction insights and the site before changing the campaign", rationale: "Nothing changed in the account, so the cause is most likely outside it.", risk: "low" });
  }
  if (facts.signal.polarity === "good" && verdict?.verdict !== "expected") {
    causes.unshift({ cause: "Genuine efficiency improvement", likelihood: "medium", evidence: ev(`${facts.signal.title}`), checks: ["Make sure conversions are not double-counted", "Check that the gain holds for several days"] });
    actions.unshift({ action: "Shift budget toward this campaign while efficiency holds", rationale: "Positive deviations are the cheapest growth available.", risk: "low" });
  }
  const top = facts.contributions.find((c) => c.share !== null && Math.abs(c.share) >= 0.5);
  if (top && causes[0]) causes[0].evidence.push(`${top.segment} (${top.dimension}) accounts for ${Math.round(Math.abs(top.share ?? 0) * 100)}% of the change`);
  if (!causes.length) {
    causes.push({ cause: "Normal volatility, seasonality or low volume", likelihood: "low", evidence: ev(facts.signal.summary), checks: ["Compare with the same weekday last week", "Check promotions, holidays and stock changes"] });
    actions.push({ action: "Monitor for 2–3 more days before acting", rationale: "No rule points to a clear cause yet.", risk: "low" });
  }
  const afterNote = later.length ? ` ${later.length === 1 ? "One change was" : `${later.length} changes were`} made after the shift began and ${later.length === 1 ? "is" : "are"} not treated as a cause.` : "";
  return { possibleCauses: causes.slice(0, 4), actions: actions.slice(0, 5), confidenceNote: `Rule-based explanation from server-computed facts; observed numbers come from your data, causes are hypotheses to check.${afterNote}` };
}
