import "server-only";
import type { ApiRange, CampaignDetail, CampaignListResponse, CampaignListRow, CampaignMetrics, ChangeEventsResponse, ChangeImpactMetric, ChangeImpactResult } from "@/lib/domain/contracts/actions";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { addDays, enumerate, minDate, type CompareMode, type DatePreset } from "@/lib/domain/dates";
import { additiveContributions, logDecomposition, ratioContributions, type DriverContribution, type DriversSummary, type LogDecomposition, type Totals } from "@/lib/domain/insights/drivers";
import { querySpecSchema, type QueryFilter, type QueryResult, type QueryRow, type QuerySource, type QuerySpecInput } from "@/lib/domain/query/spec";
import { humanizeEnum, type DimensionKey } from "@/lib/domain/schema/dimensions";
import type { CampaignDailyRow, SearchTermMatchType, SearchTermStatus } from "@/lib/domain/schema/facts";
import { mean, round, welchT } from "@/lib/domain/stats";
import type { CivilDate, Severity } from "@/lib/domain/types";
import { listSignals } from "./anomaly/service";
import { getPacingReport } from "./budget/service";
import { loadCampaignDaily, loadCampaigns, loadChangeEvents } from "./budget/data";
import type { RequestContext } from "./context";
import { googleAdsConfig } from "./env/config";
import { AppError, notFound } from "./http/errors";
import { log } from "./log";
import { runQuery } from "./query/service";
const 怞壍 = ["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa", "roas", "conv_value", "cvr"] as const;
const 缍壍: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export interface RangeQuery {
    range?: DatePreset;
    start?: CivilDate;
    end?: CivilDate;
    compare?: CompareMode;
}
export function deepLink(鷼壍: string, 櫫壍: string): string {
    return googleAdsConfig()
        .uiUrlTemplate.replace(/\{campaignId\}/g, encodeURIComponent(櫫壍))
        .replace(/\{customerId\}/g, encodeURIComponent(鷼壍));
}
const 觚壍 = (囉壍: RangeQuery): QuerySpecInput["dateRange"] => (囉壍.start && 囉壍.end ? { start: 囉壍.start, end: 囉壍.end } : { preset: 囉壍.range ?? "last_30d" });
const 疸壍 = (钧壍: unknown): number => (typeof 钧壍 === "number" && Number.isFinite(钧壍) ? 钧壍 : 0);
const 憖壍 = (肅壍: unknown): number | null => (typeof 肅壍 === "number" && Number.isFinite(肅壍) ? 肅壍 : null);
function 齴壍(汣壍: Record<string, unknown> | undefined, 譒壍 = ""): CampaignMetrics {
    const 塁壍 = (眰壍: string) => 汣壍?.[`${眰壍}${譒壍}`];
    return {
        cost: round(疸壍(塁壍("cost")), 2),
        impressions: 疸壍(塁壍("impressions")),
        clicks: 疸壍(塁壍("clicks")),
        ctr: 憖壍(塁壍("ctr")),
        cpc: 憖壍(塁壍("cpc")),
        conversions: round(疸壍(塁壍("conversions")), 2),
        cpa: 憖壍(塁壍("cpa")),
        roas: 憖壍(塁壍("roas")),
        conv_value: round(疸壍(塁壍("conv_value")), 2),
        cvr: 憖壍(塁壍("cvr")),
    };
}
const 队壍 = (): CampaignMetrics => 齴壍(undefined);
function 挎壍(臽壍: QueryResult): ApiRange {
    const 们壍 = 臽壍.meta.range;
    return { start: 们壍.start, end: 们壍.end, days: 们壍.days, compare: 臽壍.meta.compareRange ? { start: 臽壍.meta.compareRange.start, end: 臽壍.meta.compareRange.end } : undefined };
}
async function 淛壍(賊壍: RequestContext, 妹壍: string[]): Promise<SignalView[]> {
    try {
        return await listSignals(賊壍);
    }
    catch (碨壍) {
        log.warn("Signals unavailable for campaigns", { error: 碨壍 instanceof Error ? 碨壍.message : String(碨壍) });
        妹壍.push("Anomaly signals are unavailable right now.");
        return [];
    }
}
function 鞗壍(撆壍: readonly CampaignDailyRow[], 荵壍: readonly CivilDate[]): Map<string, number[]> {
    const 偤壍 = new Map(荵壍.map((潓壍, 蹂壍) => [潓壍, 蹂壍]));
    const 嬱壍 = new Map<string, number[]>();
    for (const 稠壍 of 撆壍) {
        const 餏壍 = 偤壍.get(稠壍.date);
        if (餏壍 === undefined)
            continue;
        let 旾壍 = 嬱壍.get(稠壍.campaign_id);
        if (!旾壍) {
            旾壍 = new Array<number>(荵壍.length).fill(0);
            嬱壍.set(稠壍.campaign_id, 旾壍);
        }
        旾壍[餏壍] = round((旾壍[餏壍] as number) + 稠壍.cost, 2);
    }
    return 嬱壍;
}
export async function listCampaigns(蓭壍: RequestContext, 凜壍: RangeQuery): Promise<CampaignListResponse> {
    const 烋壍: string[] = [];
    const 辺壍 = querySpecSchema.parse({ metrics: [...怞壍], dimensions: ["campaign"], dateRange: 觚壍(凜壍), compare: 凜壍.compare ?? "none", limit: 10000 });
    const [岩壍, 箘壍, 骇壍] = await Promise.all([runQuery(辺壍, 蓭壍), loadCampaigns(蓭壍), 淛壍(蓭壍, 烋壍)]);
    烋壍.push(...岩壍.meta.warnings);
    const 杶壍 = 挎壍(岩壍);
    const 虥壍 = enumerate(杶壍.start, 杶壍.end);
    const 協壍 = 鞗壍(await loadCampaignDaily(蓭壍, { start: 杶壍.start, end: 杶壍.end }), 虥壍);
    const 牃壍 = new Map(岩壍.rows.map((鄲壍) => [String(鄲壍.campaign_id ?? ""), 鄲壍]));
    const 帡壍 = new Map<string, {
        severity: Severity;
        count: number;
    }>();
    for (const 紐壍 of 骇壍) {
        if (紐壍.status !== "open")
            continue;
        const 鯿壍 = 帡壍.get(紐壍.entity.id);
        帡壍.set(紐壍.entity.id, { severity: !鯿壍 || 缍壍[紐壍.severity] > 缍壍[鯿壍.severity] ? 紐壍.severity : 鯿壍.severity, count: (鯿壍?.count ?? 0) + 1 });
    }
    const 森壍 = 辺壍.compare !== "none";
    const 蟝壍: CampaignListRow[] = 箘壍
        .filter((哌壍) => 哌壍.status !== "Removed" || 牃壍.has(哌壍.id))
        .map((玻壍) => {
        const 銪壍 = 牃壍.get(玻壍.id);
        return {
            id: 玻壍.id,
            name: 玻壍.name,
            type: 玻壍.type,
            status: 玻壍.status,
            biddingStrategy: 玻壍.bidding_strategy,
            biddingLabel: humanizeEnum(玻壍.bidding_strategy),
            dailyBudget: 玻壍.budget_daily,
            budgetShared: 玻壍.budget_shared,
            budgetId: 玻壍.budget_id ?? undefined,
            simulated: 玻壍.simulated,
            metrics: 銪壍 ? 齴壍(銪壍) : 队壍(),
            prev: 森壍 ? (銪壍 ? 齴壍(銪壍, "__prev") : 队壍()) : undefined,
            spark: 協壍.get(玻壍.id) ?? new Array<number>(虥壍.length).fill(0),
            worstSeverity: 帡壍.get(玻壍.id)?.severity ?? null,
            signalCount: 帡壍.get(玻壍.id)?.count ?? 0,
            deepLink: deepLink(蓭壍.accountId, 玻壍.id),
        };
    })
        .sort((徙壍, 纈壍) => 纈壍.metrics.cost - 徙壍.metrics.cost || 徙壍.name.localeCompare(纈壍.name));
    return {
        rows: 蟝壍,
        totals: { ...齴壍(岩壍.totals ?? undefined), dailyBudget: round(嘭壍(箘壍), 2), count: 蟝壍.length },
        prevTotals: 森壍 ? 齴壍(岩壍.compareTotals ?? undefined) : undefined,
        range: 杶壍,
        mode: 蓭壍.source.mode,
        currency: 蓭壍.account.currency,
        warnings: [...new Set(烋壍)],
    };
}
async function 鵷壍(橦壍: RequestContext, 襕壍: QuerySpecInput, 噄壍: string[], 申壍: string): Promise<QueryResult | null> {
    try {
        const 鐢壍 = await runQuery(querySpecSchema.parse(襕壍), 橦壍);
        噄壍.push(...鐢壍.meta.warnings.map((愑壍) => `${申壍}: ${愑壍}`));
        return 鐢壍;
    }
    catch (耀壍) {
        噄壍.push(`${申壍} are unavailable: ${耀壍 instanceof Error ? 耀壍.message : "query failed"}`);
        return null;
    }
}
const 黯壍 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export async function getCampaignDetail(毞壍: RequestContext, 諍壍: string, 垼壍: RangeQuery): Promise<CampaignDetail> {
    const 皫壍: string[] = [];
    const 閚壍 = await 毞壍.source.getDims(毞壍.accountId);
    const 抉壍 = 閚壍.campaigns.get(諍壍);
    if (!抉壍)
        throw notFound("Campaign");
    const 腸壍 = [{ dim: "campaign" as const, op: "eq" as const, value: 諍壍 }];
    const 乧壍 = 觚壍(垼壍);
    const 浖壍 = await runQuery(querySpecSchema.parse({ metrics: [...怞壍], dimensions: [], filters: 腸壍, dateRange: 乧壍, compare: 垼壍.compare ?? "previous_period" }), 毞壍);
    皫壍.push(...浖壍.meta.warnings);
    const 豅壍 = 挎壍(浖壍);
    const [头壍, 砣壍, 霒壍, 搁壍, 苰壍, 俟壍, 滎壍, 趽壍, 媬壍] = await Promise.all([
        鵷壍(毞壍, { metrics: [...怞壍], dimensions: ["device"], filters: 腸壍, dateRange: 乧壍 }, 皫壍, "Devices"),
        鵷壍(毞壍, { metrics: [...怞壍], dimensions: ["ad_group"], filters: 腸壍, dateRange: 乧壍 }, 皫壍, "Ad groups"),
        鵷壍(毞壍, { metrics: [...怞壍, "avg_qs"], dimensions: ["keyword"], filters: 腸壍, dateRange: 乧壍 }, 皫壍, "Keywords"),
        鵷壍(毞壍, { metrics: [...怞壍], dimensions: ["search_term", "st_status", "st_match_type"], filters: 腸壍, dateRange: 乧壍, sort: [{ key: "cost", dir: "desc" }], limit: 50 }, 皫壍, "Search terms"),
        鵷壍(毞壍, { metrics: ["conversions", "clicks", "cost"], dimensions: ["dow", "hour"], filters: 腸壍, dateRange: 乧壍 }, 皫壍, "Hour × weekday"),
        loadCampaignDaily(毞壍, { start: 豅壍.start, end: 豅壍.end }),
        淛壍(毞壍, 皫壍),
        getPacingReport(毞壍).catch(() => null),
        loadChangeEvents(毞壍, { start: addDays(毞壍.dataThrough, -29), end: 毞壍.dataThrough }, 皫壍),
    ]);
    const 禛壍 = new Map<CivilDate, CampaignDetail["daily"][number]>();
    for (const 颊壍 of enumerate(豅壍.start, 豅壍.end))
        禛壍.set(颊壍, { date: 颊壍, cost: 0, conversions: 0, clicks: 0, impressions: 0, conv_value: 0 });
    for (const 敹壍 of 俟壍) {
        if (敹壍.campaign_id !== 諍壍)
            continue;
        const 葨壍 = 禛壍.get(敹壍.date);
        if (!葨壍)
            continue;
        葨壍.cost = round(葨壍.cost + 敹壍.cost, 2);
        葨壍.conversions = round(葨壍.conversions + 敹壍.conversions, 2);
        葨壍.clicks += 敹壍.clicks;
        葨壍.impressions += 敹壍.impressions;
        葨壍.conv_value = round(葨壍.conv_value + 敹壍.conv_value, 2);
    }
    const 兗壍 = 趽壍?.rows.find((灆壍) => 灆壍.campaignIds.includes(諍壍)) ?? null;
    const 輵壍 = new Set([諍壍, ...(兗壍 ? [兗壍.unitId] : [])]);
    const 尤壍 = () => 黯壍.map(() => new Array<number>(24).fill(0));
    const 笓壍 = { dows: 黯壍, hours: Array.from({ length: 24 }, (騂壍, 曱壍) => 曱壍), conversions: 尤壍(), clicks: 尤壍(), cost: 尤壍() };
    for (const 藠壍 of 苰壍?.rows ?? []) {
        const 勏壍 = Number(藠壍.dow_id) - 1;
        const 熾壍 = Number(藠壍.hour);
        if (!(勏壍 >= 0 && 勏壍 < 7 && 熾壍 >= 0 && 熾壍 < 24))
            continue;
        (笓壍.conversions[勏壍] as number[])[熾壍] = round(疸壍(藠壍.conversions), 2);
        (笓壍.clicks[勏壍] as number[])[熾壍] = 疸壍(藠壍.clicks);
        (笓壍.cost[勏壍] as number[])[熾壍] = round(疸壍(藠壍.cost), 2);
    }
    return {
        campaign: { ...抉壍, biddingLabel: humanizeEnum(抉壍.bidding_strategy) },
        deepLink: deepLink(毞壍.accountId, 諍壍),
        range: 豅壍,
        kpis: 齴壍(浖壍.totals ?? undefined),
        prev: 浖壍.compareTotals ? 齴壍(浖壍.compareTotals) : undefined,
        daily: [...禛壍.values()],
        budgetLine: [...禛壍.keys()].map((邭壍) => ({ date: 邭壍, value: 抉壍.budget_daily })),
        signals: 滎壍.filter((嶜壍) => 輵壍.has(嶜壍.entity.id) && 嶜壍.status !== "resolved"),
        pacing: 兗壍,
        devices: (头壍?.rows ?? []).map((粋壍) => ({ device: String(粋壍.device ?? ""), ...齴壍(粋壍) })),
        adGroups: (砣壍?.rows ?? []).map((魺壍) => {
            const 桩壍 = String(魺壍.ad_group_id ?? "");
            return { id: 桩壍, name: String(魺壍.ad_group ?? 桩壍), status: 閚壍.adGroups.get(桩壍)?.status ?? "Enabled", ...齴壍(魺壍) };
        }),
        keywords: (霒壍?.rows ?? []).map((蝘壍: QueryRow) => {
            const 呇壍 = String(蝘壍.keyword_id ?? "");
            const 猶壍 = 閚壍.keywords.get(呇壍);
            const 鈥壍 = 猶壍?.ad_group_id ?? "";
            return {
                id: 呇壍,
                adGroupId: 鈥壍,
                adGroupName: 閚壍.adGroups.get(鈥壍)?.name ?? 鈥壍,
                text: 猶壍?.text ?? String(蝘壍.keyword ?? 呇壍),
                matchType: 猶壍?.match_type ?? "Broad",
                status: 猶壍?.status ?? "Enabled",
                qs: 猶壍?.qs ?? null,
                qsCtr: 猶壍?.qs_ctr ?? null,
                qsRelevance: 猶壍?.qs_relevance ?? null,
                qsLanding: 猶壍?.qs_landing ?? null,
                cpcBid: 猶壍?.cpc_bid ?? null,
                avgQs: 憖壍(蝘壍.avg_qs),
                ...齴壍(蝘壍),
            };
        }),
        searchTerms: (搁壍?.rows ?? []).map((弔壍) => ({ term: String(弔壍.search_term ?? ""), status: String(弔壍.st_status ?? "none") as SearchTermStatus, matchType: String(弔壍.st_match_type ?? "Unknown") as SearchTermMatchType, ...齴壍(弔壍) })),
        hourDow: 笓壍,
        changes: 媬壍.filter((縃壍) => 縃壍.campaign_id === 諍壍),
        mode: 毞壍.source.mode,
        currency: 毞壍.account.currency,
        warnings: [...new Set(皫壍)],
    };
}
const 鳲壍 = 14;
export async function changeImpact(槡壍: RequestContext, 裐壍: string, 喿壍: string): Promise<ChangeImpactResult> {
    const 璮壍 = await loadCampaigns(槡壍);
    if (!璮壍.some((鎝壍) => 鎝壍.id === 裐壍))
        throw notFound("Campaign");
    const 悌壍 = await loadChangeEvents(槡壍, { start: addDays(槡壍.dataThrough, -119), end: 槡壍.dataThrough });
    const 罻壍 = 悌壍.find((鹪壍) => 鹪壍.id === 喿壍 && (!鹪壍.campaign_id || 鹪壍.campaign_id === 裐壍));
    if (!罻壍)
        throw notFound("Change event");
    const 歙壍 = { start: addDays(罻壍.date, -鳲壍), end: addDays(罻壍.date, -1) };
    const 詈壍 = minDate(addDays(罻壍.date, 鳲壍), 槡壍.dataThrough);
    const 圷壍 = { start: addDays(罻壍.date, 1), end: 詈壍 };
    const 瘦壍 = (await loadCampaignDaily(槡壍, { start: 歙壍.start, end: 詈壍 > 罻壍.date ? 詈壍 : 罻壍.date })).filter((锕壍) => 锕壍.campaign_id === 裐壍);
    const 戄壍 = new Map<CivilDate, CampaignDailyRow>();
    for (const 胳壍 of 瘦壍)
        戄壍.set(胳壍.date, 胳壍);
    const 鿢壍 = (泑壍: {
        start: CivilDate;
        end: CivilDate;
    }) => (泑壍.start <= 泑壍.end ? enumerate(泑壍.start, 泑壍.end) : []);
    const 诀壍 = (墯壍: CivilDate) => 戄壍.get(墯壍) ?? { cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 };
    const 瞞壍 = 鿢壍(歙壍);
    const 隍壍 = 鿢壍(圷壍);
    const 捼壍: {
        metric: ChangeImpactMetric["metric"];
        label: string;
        format: ChangeImpactMetric["format"];
        daily: (艫壍: ReturnType<typeof 诀壍>) => number | null;
        total: (佚壍: CivilDate[]) => number | null;
    }[] = [
        { metric: "cost", label: "Spend / day", format: "money", daily: (湉壍) => 湉壍.cost, total: (贸壍) => (贸壍.length ? mean(贸壍.map((娧壍) => 诀壍(娧壍).cost)) : null) },
        { metric: "conversions", label: "Conversions / day", format: "decimal", daily: (礖壍) => 礖壍.conversions, total: (項壍) => (項壍.length ? mean(項壍.map((擴壍) => 诀壍(擴壍).conversions)) : null) },
        {
            metric: "cpa",
            label: "CPA",
            format: "money",
            daily: (菣壍) => (菣壍.conversions > 0 ? 菣壍.cost / 菣壍.conversions : null),
            total: (僒壍) => {
                const 濁壍 = 僒壍.reduce((躰壍, 実壍) => 躰壍 + 诀壍(実壍).cost, 0);
                const 窎壍 = 僒壍.reduce((饽壍, 晬壍) => 饽壍 + 诀壍(晬壍).conversions, 0);
                return 窎壍 > 0 ? 濁壍 / 窎壍 : null;
            },
        },
        {
            metric: "ctr",
            label: "CTR",
            format: "percent",
            daily: (蕛壍) => (蕛壍.impressions > 0 ? 蕛壍.clicks / 蕛壍.impressions : null),
            total: (削壍) => {
                const 焹壍 = 削壍.reduce((逨壍, 崗壍) => 逨壍 + 诀壍(崗壍).clicks, 0);
                const 簆壍 = 削壍.reduce((髵壍, 柤壍) => 髵壍 + 诀壍(柤壍).impressions, 0);
                return 簆壍 > 0 ? 焹壍 / 簆壍 : null;
            },
        },
    ];
    const 蛓壍: ChangeImpactMetric[] = 捼壍.map((参壍) => {
        const 犱壍 = 瞞壍.map((醠壍) => 参壍.daily(诀壍(醠壍))).filter((序壍): 序壍 is number => 序壍 !== null);
        const 絾壍 = 隍壍.map((鱭壍) => 参壍.daily(诀壍(鱭壍))).filter((楜壍): 楜壍 is number => 楜壍 !== null);
        const 衋壍 = welchT(絾壍, 犱壍);
        const 唺壍 = 参壍.total(瞞壍);
        const 琩壍 = 参壍.total(隍壍);
        return {
            metric: 参壍.metric,
            label: 参壍.label,
            format: 参壍.format,
            before: 唺壍 === null ? null : round(唺壍, 4),
            after: 琩壍 === null ? null : round(琩壍, 4),
            deltaPct: 唺壍 && 琩壍 !== null ? round(琩壍 / 唺壍 - 1, 4) : null,
            t: round(衋壍.t, 3),
            df: round(衋壍.df, 1),
            p: round(衋壍.p, 4),
            significant: 衋壍.p < 0.05 && 絾壍.length >= 2 && 犱壍.length >= 2,
        };
    });
    const 錘壍 = 隍壍.length === 0
        ? "The change is too recent — there is no complete day after it yet."
        : 隍壍.length < 7
            ? `Only ${隍壍.length} day${隍壍.length === 1 ? "" : "s"} of data after the change; treat the comparison as preliminary.`
            : undefined;
    return { event: 罻壍, before: { ...歙壍, days: 瞞壍.length }, after: { ...圷壍, days: 隍壍.length }, metrics: 蛓壍, note: 錘壍 };
}
export async function listChangeEvents(怇壍: RequestContext, 绶壍: {
    start?: CivilDate;
    end?: CivilDate;
    campaignId?: string;
}): Promise<ChangeEventsResponse> {
    const 鷥壍: string[] = [];
    const 櫔壍 = 绶壍.end ?? 怇壍.dataThrough;
    let 觃壍 = 绶壍.start ?? addDays(櫔壍, -29);
    if (觃壍 > 櫔壍)
        觃壍 = 櫔壍;
    if (怇壍.source.mode === "live") {
        const 嚲壍 = addDays(怇壍.today, -29);
        if (觃壍 < 嚲壍) {
            觃壍 = 嚲壍;
            鷥壍.push("Google Ads keeps change history for the last 30 days only; earlier changes are not available.");
        }
    }
    const 疡壍 = (await loadChangeEvents(怇壍, { start: 觃壍, end: 櫔壍 }, 鷥壍)).filter((钐壍) => !绶壍.campaignId || 钐壍.campaign_id === 绶壍.campaignId);
    return { events: 疡壍, range: { start: 觃壍, end: 櫔壍 }, warnings: 鷥壍 };
}
export interface DriversRequest {
    metric: string;
    dimension: DimensionKey;
    dateRange: QuerySpecInput["dateRange"];
    compare: "previous_period" | "previous_year";
    filters: QueryFilter[];
    source: QuerySource;
    limit: number;
}
export interface DriversResponse {
    metric: string;
    label: string;
    format: string;
    dimension: DimensionKey;
    kind: "additive" | "ratio" | "other";
    range: ApiRange;
    total: DriversSummary;
    contributions: DriverContribution[];
    decomposition: LogDecomposition | null;
    warnings: string[];
}
const 慿壍 = ["cost", "impressions", "clicks", "conversions", "conv_value"] as const;
export async function computeDrivers(聮壍: RequestContext, 齝壍: DriversRequest): Promise<DriversResponse> {
    const 汌壍 = 聮壍.registry.get(齝壍.metric);
    if (!汌壍)
        throw new AppError("VALIDATION_ERROR", `Unknown metric "${齝壍.metric}"`);
    const 謻壍: string[] = [];
    const 堪壍 = (眙壍: string) => (慿壍 as readonly string[]).includes(眙壍);
    let 阈壍: DriversResponse["kind"] = "other";
    let 拷壍: string | null = null;
    let 臦壍: string | null = null;
    let 仕壍 = 1;
    if (汌壍.kind === "base" && 堪壍(汌壍.key))
        阈壍 = "additive";
    else if (汌壍.kind === "derived" && 汌壍.deps.length === 2 && 堪壍(汌壍.deps[0] as string) && 堪壍(汌壍.deps[1] as string)) {
        阈壍 = "ratio";
        拷壍 = 汌壍.deps[0] as string;
        臦壍 = 汌壍.deps[1] as string;
        const 淄壍 = /^(\d+(?:\.\d+)?) \* /.exec(汌壍.formula ?? "");
        仕壍 = 淄壍 ? Number(淄壍[1]) : 1;
    }
    const 貳壍 = [...new Set([汌壍.key, ...(拷壍 && 臦壍 ? [拷壍, 臦壍] : []), ...慿壍])].slice(0, 12);
    const 妢壍 = await runQuery(querySpecSchema.parse({ source: 齝壍.source, metrics: 貳壍, dimensions: [齝壍.dimension], filters: 齝壍.filters, dateRange: 齝壍.dateRange, compare: 齝壍.compare, limit: 10000 }), 聮壍);
    謻壍.push(...妢壍.meta.warnings);
    const 碑壍 = (鞀壍: QueryRow) => String(鞀壍[`${齝壍.dimension}_id`] ?? 鞀壍[齝壍.dimension] ?? "");
    const 摯壍 = (荞壍: QueryRow) => String(荞壍[齝壍.dimension] ?? 碑壍(荞壍));
    const 偍壍 = (漼壍: string) => 橏壍(妢壍.totals?.[漼壍]);
    const 踫壍 = (嬚壍: string) => 橏壍(妢壍.compareTotals?.[嬚壍]);
    let 稉壍: {
        total: DriversSummary;
        contributions: DriverContribution[];
    };
    if (阈壍 === "additive") {
        const 飸壍 = 妢壍.rows.map((旧壍) => ({ id: 碑壍(旧壍), label: 摯壍(旧壍), current: 橏壍(旧壍[汌壍.key]), previous: 橏壍(旧壍[`${汌壍.key}__prev`]) }));
        const 蓖壍 = 踫壍(汌壍.key) - 飸壍.reduce((凅壍, 炴壍) => 凅壍 + 炴壍.previous, 0);
        if (Math.abs(蓖壍) > 1e-6)
            飸壍.push({ id: "__not_in_period__", label: "Not active in this period", current: 0, previous: 蓖壍 });
        稉壍 = additiveContributions(飸壍);
    }
    else if (阈壍 === "ratio" && 拷壍 && 臦壍) {
        const 辣壍 = 拷壍;
        const 岒壍 = 臦壍;
        const 箁壍 = 妢壍.rows.map((驰壍) => ({ id: 碑壍(驰壍), label: 摯壍(驰壍), num1: 橏壍(驰壍[辣壍]), den1: 橏壍(驰壍[岒壍]), num0: 橏壍(驰壍[`${辣壍}__prev`]), den0: 橏壍(驰壍[`${岒壍}__prev`]) }));
        const 束壍 = 踫壍(辣壍) - 箁壍.reduce((虎壍, 匽壍) => 虎壍 + 匽壍.num0, 0);
        const 爬壍 = 踫壍(岒壍) - 箁壍.reduce((鄛壍, 帊壍) => 鄛壍 + 帊壍.den0, 0);
        if (Math.abs(束壍) > 1e-6 || Math.abs(爬壍) > 1e-6)
            箁壍.push({ id: "__not_in_period__", label: "Not active in this period", num1: 0, den1: 0, num0: 束壍, den0: 爬壍 });
        const 糹壍 = ratioContributions(箁壍, 仕壍);
        if (糹壍)
            稉壍 = 糹壍;
        else {
            謻壍.push(`${汌壍.label} is undefined in one of the periods (no ${岒壍}); showing raw differences.`);
            稉壍 = additiveContributions(妢壍.rows.map((鯨壍) => ({ id: 碑壍(鯨壍), label: 摯壍(鯨壍), current: 橏壍(鯨壍[汌壍.key]), previous: 橏壍(鯨壍[`${汌壍.key}__prev`]) })));
        }
    }
    else {
        謻壍.push(`${汌壍.label} is not additive; contributions are raw differences per ${齝壍.dimension} and do not sum to the total change.`);
        const 棗壍 = additiveContributions(妢壍.rows.map((蟆壍) => ({ id: 碑壍(蟆壍), label: 摯壍(蟆壍), current: 橏壍(蟆壍[汌壍.key]), previous: 橏壍(蟆壍[`${汌壍.key}__prev`]) })));
        const 咵壍 = 妢壍.totals?.[汌壍.key] ?? null;
        const 玤壍 = 妢壍.compareTotals?.[汌壍.key] ?? null;
        稉壍 = { total: { current: 咵壍, previous: 玤壍, delta: 咵壍 !== null && 玤壍 !== null ? 咵壍 - 玤壍 : null, deltaPct: 咵壍 !== null && 玤壍 ? 咵壍 / 玤壍 - 1 : null }, contributions: 棗壍.contributions.map((銓壍) => ({ ...銓壍, share: null })) };
    }
    const 徂壍 = (繱壍: (鵠壍: string) => number): Totals => ({ cost: 繱壍("cost"), impressions: 繱壍("impressions"), clicks: 繱壍("clicks"), conversions: 繱壍("conversions"), conv_value: 繱壍("conv_value") });
    return {
        metric: 汌壍.key,
        label: 汌壍.label,
        format: 汌壍.format,
        dimension: 齝壍.dimension,
        kind: 阈壍,
        range: 挎壍(妢壍),
        total: 稉壍.total,
        contributions: 稉壍.contributions.slice(0, 齝壍.limit),
        decomposition: logDecomposition(汌壍.key, 徂壍(偍壍), 徂壍(踫壍)),
        warnings: [...new Set(謻壍)],
    };
}
const 橏壍 = (褾壍: unknown): number => (typeof 褾壍 === "number" && Number.isFinite(褾壍) ? 褾壍 : 0);
function 嘭壍(甜壍: {
    status: string;
    budget_daily: number | null;
    budget_id?: string | null;
    budget_shared?: boolean;
}[]): number {
    const 鐋壍 = new Set<string>();
    let 惺壍 = 0;
    for (const 翩壍 of 甜壍) {
        if (翩壍.status !== "Enabled" || 翩壍.budget_daily === null)
            continue;
        if (翩壍.budget_shared && 翩壍.budget_id) {
            if (鐋壍.has(翩壍.budget_id))
                continue;
            鐋壍.add(翩壍.budget_id);
        }
        惺壍 += 翩壍.budget_daily;
    }
    return 惺壍;
}
