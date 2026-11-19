import "server-only";
import { createHash } from "node:crypto";
import type { AppSettings } from "@/lib/domain/contracts/settings";
import { sanitizeBlock, sanitizeText, wrapData } from "@/lib/domain/ai/prompt-safety";
import { humanizeEnum } from "@/lib/domain/schema/dimensions";
import type { QueryResult, QuerySpecInput } from "@/lib/domain/query/spec";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { CivilDate } from "@/lib/domain/types";
import { listSignals } from "../anomaly/service";
import { getPacingReport } from "../budget/service";
import { Lru, singleton } from "../cache";
import type { RequestContext } from "../context";
import { log } from "../log";
import { runQuery } from "../query/service";
import { getStore } from "../store";

// The account snapshot every AI feature shares as its cacheable system block. Deterministic by construction —
// stable ordering (spend desc, then id), fixed decimals, no timestamps except as_of — so identical data gives an
// identical block and the provider's prompt cache hits. Only allowlisted, aggregated fields; every string is
// sanitised; the whole block is tag-wrapped as untrusted data.

export interface SnapshotCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  bidding: string;
  dailyBudget: number | null;
  cost: number;
  conversions: number;
  convValue: number;
  clicks: number;
  impressions: number;
  cpa: number | null;
  roas: number | null;
  lostIsBudget: number | null;
}

export interface SnapshotSignal {
  id: string;
  campaignId: string;
  campaign: string;
  kind: string;
  metric: string | null;
  severity: "critical" | "warning";
  polarity: "bad" | "good";
  changePct: number;
  title: string;
  recommendation: string;
}

export interface SnapshotSearchTerm {
  term: string;
  campaignId: string;
  campaign: string;
  cost: number;
  clicks: number;
  conversions: number;
}

export interface AccountSnapshot {
  text: string;
  hash: string;
  asOf: CivilDate;
  accountId: string;
  accountName: string;
  currency: string;
  mode: "live" | "demo";
  range: { start: string; end: string; days: number };
  totals: { cost: number; conversions: number; convValue: number; clicks: number; impressions: number; cpa: number | null; roas: number | null };
  /** every campaign with data in the period (the text lists the top 40) */
  campaigns: SnapshotCampaign[];
  signals: SnapshotSignal[];
  searchTerms: SnapshotSearchTerm[];
  channels: { platform: string; cost: number; roas: number | null }[] | null;
  pacing: { month: string; mtdSpend: number; projected: number; target: number; paceRatio: number; overpacingCount: number } | null;
  settings: Pick<AppSettings, "businessContext" | "brandTerms" | "competitorTerms" | "goals">;
  warnings: string[];
}

const TOP_CAMPAIGNS = 40;
const TOP_SIGNALS = 12;
const TOP_TERMS = 20;
const CHANNELS_BUDGET_MS = 1500;

const cache = () => singleton("ai:snapshots", () => new Lru<AccountSnapshot>(20, 60_000));

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const f2 = (v: number | null) => (v === null ? "—" : v.toFixed(2));
const f1 = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const pct1 = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
/** table cells: sanitised, and pipes can't break the column layout */
const cell = (v: unknown, max = 200) => sanitizeText(v, max).replace(/\|/g, "/");

async function query(ctx: RequestContext, spec: QuerySpecInput): Promise<QueryResult> {
  return runQuery(querySpecSchema.parse(spec), ctx);
}

async function withBudget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms)));
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function buildSnapshot(ctx: RequestContext): Promise<AccountSnapshot> {
  const store = getStore();
  const settings = await store.settings.get();
  const settingsKey = createHash("sha256")
    .update(JSON.stringify([settings.businessContext, settings.brandTerms, settings.competitorTerms, settings.goals]))
    .digest("hex")
    .slice(0, 12);
  const key = `${ctx.source.mode}|${ctx.accountId}|${ctx.today}|${ctx.dataThrough}|${settingsKey}|${ctx.registry.keys().size}`;
  const hit = cache().get(key);
  if (hit) return hit;

  const warnings: string[] = [];
  const dims = await ctx.source.getDims(ctx.accountId);
  const byCampaign = await query(ctx, { metrics: ["cost", "conversions", "conv_value", "clicks", "impressions", "cpa", "roas", "lost_is_budget"], dimensions: ["campaign"], dateRange: { preset: "last_30d" }, limit: 10_000 });
  const campaigns: SnapshotCampaign[] = byCampaign.rows
    .map((r) => {
      const id = String(r.campaign_id ?? "");
      const d = dims.campaigns.get(id);
      return {
        id,
        name: String(r.campaign ?? d?.name ?? id),
        type: d?.type ?? "Other",
        status: d?.status ?? "Enabled",
        bidding: d ? humanizeEnum(d.bidding_strategy) : "—",
        dailyBudget: d?.budget_daily ?? null,
        cost: num(r.cost),
        conversions: num(r.conversions),
        convValue: num(r.conv_value),
        clicks: num(r.clicks),
        impressions: num(r.impressions),
        cpa: numOrNull(r.cpa),
        roas: numOrNull(r.roas),
        lostIsBudget: numOrNull(r.lost_is_budget),
      };
    })
    .sort((a, b) => b.cost - a.cost || a.id.localeCompare(b.id));
  const t = byCampaign.totals ?? {};
  const totals = { cost: num(t.cost), conversions: num(t.conversions), convValue: num(t.conv_value), clicks: num(t.clicks), impressions: num(t.impressions), cpa: numOrNull(t.cpa), roas: numOrNull(t.roas) };

  let signals: SnapshotSignal[] = [];
  try {
    signals = (await listSignals(ctx, { includeInactive: false }))
      .filter((s) => s.status === "open" && s.severity !== "info")
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, TOP_SIGNALS)
      .map((s) => ({
        id: s.id,
        campaignId: s.entity.id,
        campaign: s.entity.name,
        kind: s.kind,
        metric: s.metric ?? null,
        severity: s.severity === "critical" ? "critical" : "warning",
        polarity: s.polarity,
        changePct: s.changePct,
        title: s.title,
        recommendation: s.recommendation,
      }));
  } catch (err) {
    warnings.push("Anomaly signals are unavailable right now.");
    log.warn("AI snapshot: listSignals failed", { error: err instanceof Error ? err.message : String(err) });
  }

  let searchTerms: SnapshotSearchTerm[] = [];
  try {
    const st = await query(ctx, { metrics: ["cost", "clicks", "conversions"], dimensions: ["search_term", "campaign"], dateRange: { preset: "last_30d" }, sort: [{ key: "cost", dir: "desc" }], limit: TOP_TERMS });
    searchTerms = st.rows.map((r) => ({ term: String(r.search_term ?? ""), campaignId: String(r.campaign_id ?? ""), campaign: String(r.campaign ?? ""), cost: num(r.cost), clicks: num(r.clicks), conversions: num(r.conversions) })).sort((a, b) => b.cost - a.cost || a.term.localeCompare(b.term));
  } catch {
    warnings.push("Search terms are unavailable for this account.");
  }

  let channels: AccountSnapshot["channels"] = null;
  try {
    const blended = await withBudget(query(ctx, { source: "blended", metrics: ["cost", "roas"], dimensions: ["platform"], dateRange: { preset: "last_30d" } }), CHANNELS_BUDGET_MS);
    if (blended && blended.rows.length > 1) channels = blended.rows.map((r) => ({ platform: String(r.platform ?? r.platform_id ?? ""), cost: num(r.cost), roas: numOrNull(r.roas) })).sort((a, b) => b.cost - a.cost || a.platform.localeCompare(b.platform));
  } catch {
    /* cross-channel summary is optional */
  }

  let pacing: AccountSnapshot["pacing"] = null;
  try {
    const p = await getPacingReport(ctx);
    pacing = { month: p.month, mtdSpend: p.totals.mtdSpend, projected: p.totals.projected, target: p.totals.monthlyTarget, paceRatio: p.totals.paceRatio, overpacingCount: p.totals.overpacingCount };
  } catch {
    /* budget pacing is optional (service may be unavailable) */
  }

  const goals = settings.goals;
  const lines: string[] = [
    `as_of: ${ctx.dataThrough}`,
    `account: ${cell(ctx.account.name, 120)} | id: ${ctx.accountId} | currency: ${ctx.account.currency} | data: ${ctx.source.mode}`,
    `business: ${sanitizeBlock(settings.businessContext, 600).replace(/\n+/g, " ")}`,
    `brand_terms: ${settings.brandTerms.map((b) => cell(b, 60)).join(", ") || "none"}`,
    `competitor_terms: ${settings.competitorTerms.map((c) => cell(c, 60)).join(", ") || "none"}`,
    `goals: monthly_conversions ${goals.monthlyConversions ?? "—"} | monthly_revenue ${goals.monthlyRevenue ?? "—"} | target_cpa ${goals.targetCpa ?? "—"} | target_roas ${goals.targetRoas ?? "—"}`,
    `period: ${byCampaign.meta.range.start}..${byCampaign.meta.range.end} (${byCampaign.meta.range.days} days)`,
    `totals: spend ${f2(totals.cost)} | conv ${f1(totals.conversions)} | value ${f2(totals.convValue)} | cpa ${f2(totals.cpa)} | roas ${f2(totals.roas)} | clicks ${Math.round(totals.clicks)} | impr ${Math.round(totals.impressions)}`,
    "campaigns (id | name | type | status | bidding | daily_budget | spend | conv | cpa | roas | lost_is_budget):",
    ...campaigns.slice(0, TOP_CAMPAIGNS).map((c) => [c.id, cell(c.name), c.type, c.status, c.bidding, f2(c.dailyBudget), f2(c.cost), f1(c.conversions), f2(c.cpa), f2(c.roas), pct1(c.lostIsBudget)].join(" | ")),
  ];
  const rest = campaigns.slice(TOP_CAMPAIGNS);
  if (rest.length) {
    const cost = rest.reduce((s, c) => s + c.cost, 0);
    const conv = rest.reduce((s, c) => s + c.conversions, 0);
    lines.push(`other_campaigns: ${rest.length} | spend ${f2(cost)} | conv ${f1(conv)}`);
  }
  lines.push("open_signals (id | campaign | kind | metric | severity | change):");
  lines.push(...(signals.length ? signals.map((s) => [cell(s.id, 120), cell(s.campaign), s.kind, s.metric ?? "—", s.severity, `${s.changePct >= 0 ? "+" : ""}${(s.changePct * 100).toFixed(1)}%`].join(" | ")) : ["none"]));
  lines.push("top_search_terms_30d (term | campaign | spend | clicks | conv):");
  lines.push(...(searchTerms.length ? searchTerms.map((s) => [cell(s.term, 120), cell(s.campaign), f2(s.cost), Math.round(s.clicks), f1(s.conversions)].join(" | ")) : ["none"]));
  if (channels) {
    lines.push("channels_30d (platform | spend | roas):");
    lines.push(...channels.map((c) => [cell(c.platform, 60), f2(c.cost), f2(c.roas)].join(" | ")));
  }
  if (pacing) lines.push(`pacing: ${pacing.month} | mtd ${f2(pacing.mtdSpend)} | projected ${f2(pacing.projected)} | target ${f2(pacing.target)} | pace ${f2(pacing.paceRatio)} | overpacing ${pacing.overpacingCount}`);

  const text = wrapData("account_data", lines.join("\n"));
  const snapshot: AccountSnapshot = {
    text,
    hash: createHash("sha256").update(text).digest("hex").slice(0, 16),
    asOf: ctx.dataThrough,
    accountId: ctx.accountId,
    accountName: ctx.account.name,
    currency: ctx.account.currency,
    mode: ctx.source.mode,
    range: byCampaign.meta.range,
    totals,
    campaigns,
    signals,
    searchTerms,
    channels,
    pacing,
    settings: { businessContext: settings.businessContext, brandTerms: settings.brandTerms, competitorTerms: settings.competitorTerms, goals: settings.goals },
    warnings,
  };
  cache().set(key, snapshot);
  return snapshot;
}
