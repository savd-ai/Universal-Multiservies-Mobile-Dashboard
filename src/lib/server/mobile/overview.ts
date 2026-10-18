import "server-only";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import type { MobileOverview, MobileSignalItem } from "@/lib/domain/contracts/mobile";
import { ratioKpis, type PortfolioKpis } from "@/lib/domain/contracts/portfolio";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { describeBlankReason, isDemoReason } from "@/lib/domain/types";
import { getAnomalyFeed } from "../anomaly/service";
import { getPacingReport } from "../budget/service";
import type { RequestContext } from "../context";
import { log } from "../log";
import { runQuery } from "../query/service";

const BASE_MEASURES = ["cost", "conversions", "conv_value", "clicks", "impressions"];
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

function kpisOf(totals: Record<string, number | null> | undefined): PortfolioKpis | null {
  if (!totals) return null;
  const value = (key: string) => totals[key] ?? 0;
  return ratioKpis({ cost: value("cost"), conversions: value("conversions"), convValue: value("conv_value"), clicks: value("clicks"), impressions: value("impressions") });
}

export function mobileSignal(signal: SignalView): MobileSignalItem {
  return {
    id: signal.id,
    title: signal.title,
    summary: signal.summary,
    recommendation: signal.recommendation,
    entityName: signal.entity.name,
    entityType: signal.entity.type ?? null,
    severity: signal.severity,
    polarity: signal.polarity,
    status: signal.status,
    observed: signal.observed,
    expected: signal.expected,
    changePct: signal.changePct,
    format: signal.format,
    firstSeenAt: signal.firstSeenAt ?? null,
    evidence: signal.evidence.slice(0, 6),
    series: signal.series.slice(-30),
  };
}

/**
 * Everything the phone's first screen needs in one round trip: KPI totals vs the previous period (ratios of sums
 * from the query engine), spend and conversions per day, month pacing and the open signals. Pacing and signals are
 * best-effort: a failure there leaves them empty instead of failing the screen.
 */
export async function mobileOverview(ctx: RequestContext, preset: MobileOverview["range"]["preset"] = "last_7d"): Promise<MobileOverview> {
  const spec = (dimensions: string[], compare: "none" | "previous_period") =>
    querySpecSchema.parse({ source: "google_ads", metrics: BASE_MEASURES, dimensions, dateRange: { preset }, compare, totals: true, fillGaps: dimensions.length > 0 });
  const [totals, daily, pacing, feed] = await Promise.all([
    runQuery(spec([], "previous_period"), ctx),
    runQuery(spec(["date"], "none"), ctx),
    getPacingReport(ctx).catch((error) => (log.warn("Mobile overview: pacing unavailable", { error: String(error) }), null)),
    getAnomalyFeed(ctx, { includeInactive: false }).catch((error) => (log.warn("Mobile overview: signals unavailable", { error: String(error) }), null)),
  ]);
  const open = (feed?.signals ?? []).filter((signal) => signal.status === "open");
  const counts = { critical: 0, warning: 0, opportunity: 0 };
  for (const signal of open) {
    if (signal.polarity === "good" || signal.severity === "info") counts.opportunity += 1;
    else if (signal.severity === "critical") counts.critical += 1;
    else counts.warning += 1;
  }
  const top = [...open].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.score - a.score).slice(0, 5).map(mobileSignal);
  return {
    account: { id: ctx.accountId, name: ctx.account.name, currency: ctx.account.currency, timezone: ctx.account.timezone },
    accounts: ctx.accounts.filter((account) => !account.isManager).map((account) => ({ id: account.id, name: account.name })),
    mode: ctx.source.mode,
    demo: isDemoReason(ctx.source.reason),
    reasonText: ctx.source.mode === "live" ? null : describeBlankReason(ctx.source.reason),
    dataThrough: ctx.dataThrough,
    range: { preset, start: totals.meta.range.start, end: totals.meta.range.end, compareStart: totals.meta.compareRange?.start ?? null, compareEnd: totals.meta.compareRange?.end ?? null },
    kpis: kpisOf(totals.totals) ?? ratioKpis({ cost: 0, conversions: 0, convValue: 0, clicks: 0, impressions: 0 }),
    previous: kpisOf(totals.compareTotals),
    daily: daily.rows.map((row) => ({ date: String(row.date), cost: Number(row.cost ?? 0), conversions: Number(row.conversions ?? 0) })),
    pacing: pacing
      ? {
          monthLabel: pacing.monthLabel,
          mtdSpend: pacing.totals.mtdSpend,
          projected: pacing.totals.projected,
          target: pacing.totals.monthlyTarget,
          ratio: pacing.totals.monthlyTarget > 0 ? pacing.totals.projected / pacing.totals.monthlyTarget : null,
          overpacing: pacing.totals.overpacingCount,
          underpacing: pacing.totals.underpacingCount,
        }
      : null,
    signals: { ...counts, top },
  };
}
