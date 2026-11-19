import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { CampaignDailyRow, CampaignDim, ChangeEvent } from "@/lib/domain/schema/facts";
import type { CivilDate } from "@/lib/domain/types";
import type { RequestContext } from "../context";
import { CHANGE_EVENT_DAYS } from "../google-ads/queries";
import { log } from "../log";

// Data access shared by the analytics services (budget, anomalies, campaigns): raw campaign_daily rows clamped
// to the source's coverage, campaign dimensions (with demo overlays), and change events and Google's estimates that
// never throw.

export async function loadCampaignDaily(ctx: RequestContext, range: DateRange): Promise<CampaignDailyRow[]> {
  const cov = await ctx.source.coverage(ctx.accountId, "campaign_daily");
  const start = cov ? maxDate(range.start, cov.start) : range.start;
  const end = cov ? minDate(range.end, cov.end) : range.end;
  if (start > end) return [];
  const slice = await ctx.source.getTable(ctx.accountId, "campaign_daily", { start, end });
  return slice.rows as unknown as CampaignDailyRow[];
}

export async function loadCampaigns(ctx: RequestContext): Promise<CampaignDim[]> {
  const dims = await ctx.source.getDims(ctx.accountId);
  return [...dims.campaigns.values()];
}

export interface ChangeHistory {
  events: ChangeEvent[];
  /** false when the change log could not be read (signals then never claim "no recent changes") */
  available: boolean;
  /** first day the log covers: Google Ads answers change_event for the last 30 days only */
  from: CivilDate;
}

/** Change events for a range plus whether (and from when) the change log could be read; never throws. */
export async function loadChangeHistory(ctx: RequestContext, range: DateRange, warnings?: string[]): Promise<ChangeHistory> {
  const from = ctx.source.mode === "live" ? maxDate(range.start, addDays(ctx.today, -(CHANGE_EVENT_DAYS - 1))) : range.start;
  try {
    return { events: await ctx.source.getChangeEvents(ctx.accountId, range), available: true, from };
  } catch (err) {
    log.warn("Change events unavailable", { error: err instanceof Error ? err.message : String(err) });
    warnings?.push("Change history is unavailable right now; related changes are not shown.");
    return { events: [], available: false, from };
  }
}

/** Change events for a range; failures degrade to an empty list plus a warning. */
export async function loadChangeEvents(ctx: RequestContext, range: DateRange, warnings?: string[]): Promise<ChangeEvent[]> {
  return (await loadChangeHistory(ctx, range, warnings)).events;
}

/**
 * Google's campaign simulations and budget recommendations. The source's own partial-failure notes are added to
 * `warnings`; a total failure degrades to empty estimates plus a warning (our model then answers alone).
 */
export async function loadGoogleEstimates(ctx: RequestContext, warnings?: string[]): Promise<GoogleEstimates> {
  try {
    const estimates = await ctx.source.getGoogleEstimates(ctx.accountId);
    warnings?.push(...estimates.warnings);
    return estimates;
  } catch (err) {
    log.warn("Google estimates unavailable", { error: err instanceof Error ? err.message : String(err) });
    warnings?.push("Google's simulators and recommendations are unavailable right now; every estimate here is our model's.");
    return { simulations: [], recommendations: [], warnings: [] };
  }
}

/** Store id of a month's budget targets (partitioned by mode and account). */
export function targetsId(ctx: RequestContext, month: string): string {
  return `${ctx.source.mode}:${ctx.accountId}:${month}`;
}
