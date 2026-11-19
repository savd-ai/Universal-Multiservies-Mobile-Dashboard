import type { AnomalySettings, Signal, ThresholdRule } from "../contracts/anomaly";
import type { PacingReport } from "../contracts/budget";
import { addDays, enumerate } from "../dates";
import type { MetricRegistry } from "../metrics/registry";
import type { CampaignDailyRow, CampaignDim, ChangeEvent } from "../schema/facts";
import type { CivilDate, Mode } from "../types";
import { correlateChanges } from "./correlate";
import {
  detectBudgetLimited,
  detectPacing,
  detectRobust,
  detectSeasonal,
  detectThreshold,
  detectTrackingBreak,
  detectZeroDelivery,
  detectZscore,
  evaluateRule,
  ruleEntities,
  type DetectorContext,
} from "./detectors";
import { absorbSymptoms, mergeSignals, sortSignals } from "./merge";
import { buildCampaignSeries, combineSeries, dateAt, type EntitySeries } from "./series";

// Anomaly detection entry point (pure): rows + dims + settings → merged signals, explained by the change history
// (correlate.ts: related changes, expected / learning / likely-cause verdicts), sorted.

/** campaign_daily history the detectors need (robust/seasonal baselines, pacing month, threshold windows). */
export const DETECTION_LOOKBACK_DAYS = 100;
/** Change events the correlation reads: the 14 quiet days before onsets of up to 30-day rule windows. */
export const CHANGE_HISTORY_DAYS = 45;

export interface DetectionInput {
  accountId: string;
  accountName: string;
  mode: Mode;
  currency: string;
  dataThrough: CivilDate;
  /** ISO timestamp of this run */
  now: string;
  settings: AnomalySettings;
  campaigns: readonly CampaignDim[];
  rows: readonly CampaignDailyRow[];
  changeEvents?: readonly ChangeEvent[];
  /** false when the change log could not be loaded — "no recent changes" is then never claimed (default: changeEvents given) */
  changeHistoryAvailable?: boolean;
  /** first day the change log covers (live: the last 30 days) — "no recent changes" needs its whole 14-day window */
  changeHistoryFrom?: CivilDate;
  pacing?: PacingReport | null;
  registry?: MetricRegistry;
  /** discount the freshest day for conversion metrics (live data restates for a few days) */
  conversionLag?: boolean;
}

export interface DetectionResult {
  signals: Signal[];
  warnings: string[];
}

/** Paused / removed / ended / excluded campaigns are not monitored. */
export function isMonitorable(c: CampaignDim | undefined, settings: AnomalySettings, dataThrough: CivilDate): boolean {
  if (!c) return false;
  if (c.status !== "Enabled") return false;
  if (settings.excludeCampaignIds.includes(c.id)) return false;
  if (c.end && c.end < dataThrough) return false;
  return true;
}

interface Prepared {
  ctx: DetectorContext;
  all: Map<string, EntitySeries>;
  monitorable: EntitySeries[];
  account: EntitySeries;
  dates: CivilDate[];
}

function prepare(input: DetectionInput): Prepared {
  const start = addDays(input.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1));
  const all = buildCampaignSeries(input.rows, input.campaigns, start, input.dataThrough);
  const monitorable = [...all.values()].filter((s) => isMonitorable(s.campaign, input.settings, input.dataThrough));
  const dates = enumerate(start, input.dataThrough);
  const account = combineSeries(input.accountId, input.accountName, [...all.values()], dates);
  const ctx: DetectorContext = {
    accountId: input.accountId,
    accountName: input.accountName,
    mode: input.mode,
    currency: input.currency,
    dataThrough: input.dataThrough,
    now: input.now,
    settings: input.settings,
    conversionLag: input.conversionLag ?? false,
    registry: input.registry,
  };
  return { ctx, all, monitorable, account, dates };
}

export function detectSignals(input: DetectionInput): DetectionResult {
  const { ctx, all, monitorable, account, dates } = prepare(input);
  const warnings: string[] = [];
  const raw: Signal[] = [];
  if (!dates.length) return { signals: [], warnings };
  detectZscore(ctx, monitorable, raw);
  detectRobust(ctx, monitorable, raw);
  detectSeasonal(ctx, monitorable, raw);
  detectThreshold(ctx, monitorable, account, raw, warnings);
  detectPacing(ctx, input.pacing, all, dates, new Set(monitorable.map((s) => s.id)), raw);
  detectTrackingBreak(ctx, monitorable, raw);
  // An account-wide break (the conversion tag stopped firing) spreads thin over many campaigns, so no single campaign
  // may clear the baseline guard (seen on a live account with 70 campaigns): check the account total too, unless a
  // campaign-level break already explains it.
  if (!raw.some((s) => s.kind === "tracking_break")) detectTrackingBreak(ctx, [account], raw);
  detectZeroDelivery(ctx, monitorable, raw);
  detectBudgetLimited(ctx, monitorable, [...all.values()], raw);

  const unitCampaigns = new Map((input.pacing?.rows ?? []).filter((r) => r.unitId.startsWith("budget:")).map((r) => [r.unitId, r.campaignIds] as const));
  const merged = absorbSymptoms(mergeSignals(raw), ctx.accountId);
  const correlated = correlateChanges(merged, input.changeEvents ?? [], {
    settings: input.settings.changeHistory,
    available: input.changeHistoryAvailable ?? input.changeEvents !== undefined,
    from: input.changeHistoryFrom,
    currency: input.currency,
    unitCampaigns,
  });
  return { signals: sortSignals(correlated), warnings };
}

/** Rule editor preview: the days in the last `days` on which a rule would have fired. */
export function previewThresholdRule(input: DetectionInput, rule: ThresholdRule, days = 30): { date: CivilDate; hits: { entityId: string; entityName: string; observed: number }[] }[] {
  const { monitorable, account } = prepare(input);
  if (!input.registry) return [];
  const entities = ruleEntities(rule, monitorable, account);
  const out: { date: CivilDate; hits: { entityId: string; entityName: string; observed: number }[] }[] = [];
  const last = account.days.length - 1;
  for (let end = Math.max(0, last - days + 1); end <= last; end++) {
    const hits: { entityId: string; entityName: string; observed: number }[] = [];
    for (const s of entities) {
      const hit = evaluateRule(rule, s, input.registry, end);
      if (hit) hits.push({ entityId: s === account ? input.accountId : s.id, entityName: s.name, observed: hit.observed });
    }
    out.push({ date: dateAt(account, end), hits });
  }
  return out;
}

export { AUTO_RESOLVE_AFTER, applySignalAction, joinSignals, planEvaluation, resolvedView } from "./lifecycle";
