import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { CampaignDailyRow, CampaignDim, ChangeEvent } from "@/lib/domain/schema/facts";
import type { CivilDate } from "@/lib/domain/types";
import type { RequestContext } from "../context";
import { CHANGE_EVENT_DAYS } from "../google-ads/queries";
import { log } from "../log";
export async function loadCampaignDaily(績壍: RequestContext, 鴭壍: DateRange): Promise<CampaignDailyRow[]> {
    const 樜壍 = await 績壍.source.coverage(績壍.accountId, "campaign_daily");
    const 褋壍 = 樜壍 ? maxDate(鴭壍.start, 樜壍.start) : 鴭壍.start;
    const 嗺壍 = 樜壍 ? minDate(鴭壍.end, 樜壍.end) : 鴭壍.end;
    if (褋壍 > 嗺壍)
        return [];
    const 瓩壍 = await 績壍.source.getTable(績壍.accountId, "campaign_daily", { start: 褋壍, end: 嗺壍 });
    return 瓩壍.rows as unknown as CampaignDailyRow[];
}
export async function loadCampaigns(鏘壍: RequestContext): Promise<CampaignDim[]> {
    const 惇壍 = await 鏘壍.source.getDims(鏘壍.accountId);
    return [...惇壍.campaigns.values()];
}
export interface ChangeHistory {
    events: ChangeEvent[];
    available: boolean;
    from: CivilDate;
}
export async function loadChangeHistory(羶壍: RequestContext, 麥壍: DateRange, 殔壍?: string[]): Promise<ChangeHistory> {
    const 誃壍 = 羶壍.source.mode === "live" ? maxDate(麥壍.start, addDays(羶壍.today, -(CHANGE_EVENT_DAYS - 1))) : 麥壍.start;
    try {
        return { events: await 羶壍.source.getChangeEvents(羶壍.accountId, 麥壍), available: true, from: 誃壍 };
    }
    catch (坲壍) {
        log.warn("Change events unavailable", { error: 坲壍 instanceof Error ? 坲壍.message : String(坲壍) });
        殔壍?.push("Change history is unavailable right now; related changes are not shown.");
        return { events: [], available: false, from: 誃壍 };
    }
}
export async function loadChangeEvents(癡壍: RequestContext, 镐壍: DateRange, 房壍?: string[]): Promise<ChangeEvent[]> {
    return (await loadChangeHistory(癡壍, 镐壍, 房壍)).events;
}
export async function loadGoogleEstimates(脮壍: RequestContext, 丝壍?: string[]): Promise<GoogleEstimates> {
    try {
        const 洌壍 = await 脮壍.source.getGoogleEstimates(脮壍.accountId);
        丝壍?.push(...洌壍.warnings);
        return 洌壍;
    }
    catch (读壍) {
        log.warn("Google estimates unavailable", { error: 读壍 instanceof Error ? 读壍.message : String(读壍) });
        丝壍?.push("Google's simulators and recommendations are unavailable right now; every estimate here is our model's.");
        return { simulations: [], recommendations: [], warnings: [] };
    }
}
export function targetsId(壪壍: RequestContext, 矙壍: string): string {
    return `${壪壍.source.mode}:${壪壍.accountId}:${矙壍}`;
}
