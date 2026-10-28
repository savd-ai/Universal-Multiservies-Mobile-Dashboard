import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { CampaignDailyRow, CampaignDim, ChangeEvent } from "@/lib/domain/schema/facts";
import type { CivilDate } from "@/lib/domain/types";
import type { RequestContext } from "../context";
import { CHANGE_EVENT_DAYS } from "../google-ads/queries";
import { log } from "../log";
export async function loadCampaignDaily(ctx: RequestContext, range: DateRange): Promise<CampaignDailyRow[]> {
    const cov = await ctx.source.coverage(ctx.accountId, "campaign_daily");
    const start = cov ? maxDate(range.start, cov.start) : range.start;
    const end = cov ? minDate(range.end, cov.end) : range.end;
    if (start > end)
        return [];
    const slice = await ctx.source.getTable(ctx.accountId, "campaign_daily", { start, end });
    return slice.rows as unknown as CampaignDailyRow[];
}
export async function loadCampaigns(ctx: RequestContext): Promise<CampaignDim[]> {
    const dims = await ctx.source.getDims(ctx.accountId);
    return [...dims.campaigns.values()];
}
export interface ChangeHistory {
    events: ChangeEvent[];
    available: boolean;
    from: CivilDate;
}
export async function loadChangeHistory(ctx: RequestContext, range: DateRange, warnings?: string[]): Promise<ChangeHistory> {
    const selected = ctx.source.mode === "live" ? maxDate(range.start, addDays(ctx.today, -(CHANGE_EVENT_DAYS - 1))) : range.start;
    try {
        return { events: await ctx.source.getChangeEvents(ctx.accountId, range), available: true, from: selected };
    }
    catch (err) {
        log.warn("Change events unavailable", { error: err instanceof Error ? err.message : String(err) });
        warnings?.push("Change history is unavailable right now; related changes are not shown.");
        return { events: [], available: false, from: selected };
    }
}
export async function loadChangeEvents(ctx: RequestContext, range: DateRange, warnings?: string[]): Promise<ChangeEvent[]> {
    return (await loadChangeHistory(ctx, range, warnings)).events;
}
export async function loadGoogleEstimates(ctx: RequestContext, warnings?: string[]): Promise<GoogleEstimates> {
    try {
        const estimates = await ctx.source.getGoogleEstimates(ctx.accountId);
        warnings?.push(...estimates.warnings);
        return estimates;
    }
    catch (err) {
        log.warn("Google estimates unavailable", { error: err instanceof Error ? err.message : String(err) });
        warnings?.push("Google's simulators and recommendations are unavailable right now; every estimate here is our model's.");
        return { simulations: [], recommendations: [], warnings: [] };
    }
}
export function targetsId(ctx: RequestContext, month: string): string {
    return `${ctx.source.mode}:${ctx.accountId}:${month}`;
}
