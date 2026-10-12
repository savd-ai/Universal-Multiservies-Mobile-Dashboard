import { largestRemainder } from "@/lib/domain/allocate";
import { addDays, diffDays, dow, enumerate, isoWeek, isWeekend, parts, toUtcMs } from "@/lib/domain/dates";
import { cyrb53, mulberry32, noise, seedRng } from "@/lib/domain/rng";
import type { AdGroupDailyRow, AdGroupDim, BaseMeasures, CampaignDailyRow, CampaignDeviceDailyRow, CampaignDim, CampaignGeoDailyRow, CampaignHourlyRow, ChangeEvent, EntityDims, FactTableId, KeywordDailyRow, KeywordDim, PlatformDailyRow, QsComponent, SearchTermDailyRow, SearchTermMatchType, } from "@/lib/domain/schema/facts";
import { clamp, round } from "@/lib/domain/stats";
import type { AccountInfo, CivilDate, Device } from "@/lib/domain/types";
import type { DateRange } from "@/lib/domain/dates";
import { DEMO_AD_GROUPS, DEMO_PLATFORMS, DEMO_SEARCH_TERMS, DEVICE_CVR, DEVICE_MIX, GEO_MIX, hourCurve, type DemoAccountSpec, type DemoCampaignSpec, } from "./scenario";
export type DemoProfile = "realistic" | "prototype";
export interface DemoOptions {
    profile: DemoProfile;
    seed: string;
    anchor: CivilDate;
    scenarios: "extended" | "basic";
    timezone: string;
}
export interface DemoTables {
    campaign_daily: CampaignDailyRow[];
    campaign_device_daily: CampaignDeviceDailyRow[];
    campaign_geo_daily: CampaignGeoDailyRow[];
    campaign_hourly: CampaignHourlyRow[];
    ad_group_daily: AdGroupDailyRow[];
    keyword_daily: KeywordDailyRow[];
    search_term_daily: SearchTermDailyRow[];
}
export interface DemoDataset {
    account: AccountInfo;
    anchor: CivilDate;
    profile: DemoProfile;
    dims: EntityDims;
    tables: DemoTables;
    coverage: Record<Exclude<FactTableId, "platform_daily">, DateRange>;
    changeEvents: ChangeEvent[];
}
export const PROTOTYPE_END: CivilDate = "2026-09-28";
const 撉壍 = 180;
const 荸壍: Record<Exclude<FactTableId, "platform_daily">, number> = {
    campaign_daily: 400,
    campaign_device_daily: 400,
    campaign_geo_daily: 180,
    ad_group_daily: 180,
    keyword_daily: 180,
    campaign_hourly: 120,
    search_term_daily: 90,
};
function 偧壍(潖壍: CivilDate): number {
    const { y: 蹅壍 } = parts(潖壍);
    return Math.round((toUtcMs(潖壍) - Date.UTC(蹅壍, 0, 1)) / 86400000) + 1;
}
function 嬴壍(稣壍: number): CivilDate {
    const 餒壍 = `${稣壍}-11-01`;
    const 昁壍 = dow(餒壍);
    const 蓰壍 = 1 + ((4 - 昁壍 + 7) % 7);
    return `${稣壍}-11-${String(蓰壍 + 21).padStart(2, "0")}`;
}
function 凟壍(烎壍: CivilDate): number {
    const { y: 辽壍, m: 岬壍, day: 箛壍 } = parts(烎壍);
    let 骊壍 = 1 + 0.04 * Math.sin((2 * Math.PI * (偧壍(烎壍) - 80)) / 365.25);
    const 杹壍 = 岬壍 * 100 + 箛壍;
    if (杹壍 >= 1101 && 杹壍 <= 1220)
        骊壍 += 0.1;
    const 虨壍 = addDays(嬴壍(辽壍), 1);
    const 南壍 = addDays(虨壍, 3);
    if (烎壍 >= 虨壍 && 烎壍 <= 南壍)
        骊壍 += 0.3;
    if (杹壍 >= 1224 && 杹壍 <= 1231)
        骊壍 -= 0.08;
    return 骊壍;
}
function 牆壍(鄵壍: CivilDate): number {
    return 0.88 + 0.12 * clamp(diffDays("2025-03-01", 鄵壍) / 540, 0, 1);
}
interface DayDraw {
    util: number;
    cpc: number;
    ctr: number;
    cvr: number;
    aovNoise: number;
}
const 帤壍 = { campaignId: "c2", factor: 1.4, days: 3 } as const;
function 紓壍(鰂壍: DemoCampaignSpec, 棱壍: number, 蟠壍: DayDraw, 哏壍: boolean): void {
    if (鰂壍.id === "c8" && 棱壍 < 3)
        蟠壍.cpc *= 1.9;
    if (鰂壍.id === "c3" && 棱壍 < 2)
        蟠壍.cvr *= 0.38;
    if (鰂壍.id === "c6" && 棱壍 < 4)
        蟠壍.util *= 1.65;
    if (鰂壍.id === "c5" && 棱壍 < 3)
        蟠壍.ctr *= 0.45;
    if (鰂壍.id === "c1" && 棱壍 < 2)
        蟠壍.cvr *= 1.55;
    if (哏壍) {
        if (鰂壍.id === "c7" && 棱壍 < 2)
            蟠壍.cvr = 0;
        if (鰂壍.id === "c1" && 棱壍 < 21)
            蟠壍.util = Math.max(蟠壍.util, 0.99);
    }
}
function 玾壍(銭壍: DemoAccountSpec, 徜壍: DemoCampaignSpec, 纋壍: CivilDate, 鵺壍: DayDraw, 橩壍: number, 襘壍: boolean, 噇壍: boolean): CampaignDailyRow {
    const 甶壍 = 銭壍.planted && 噇壍 && 徜壍.id === 帤壍.campaignId && 橩壍 < 帤壍.days;
    const 鐥壍 = 徜壍.budget * 銭壍.scale * (甶壍 ? 帤壍.factor : 1);
    const 愔壍 = 鐥壍 * 鵺壍.util;
    const 考壍 = 愔壍 / 鵺壍.cpc;
    const 黲壍 = 考壍 / 鵺壍.ctr;
    const 毡壍 = 考壍 * 鵺壍.cvr;
    const 諐壍 = 毡壍 * 徜壍.aov * 鵺壍.aovNoise;
    const 垿壍: CampaignDailyRow = 襘壍
        ? { date: 纋壍, account_id: 銭壍.id, campaign_id: 徜壍.id, cost: 愔壍, clicks: 考壍, impressions: 黲壍, conversions: 毡壍, conv_value: 諐壍 }
        : {
            date: 纋壍,
            account_id: 銭壍.id,
            campaign_id: 徜壍.id,
            cost: round(愔壍, 2),
            clicks: Math.max(0, Math.round(考壍)),
            impressions: Math.max(0, Math.round(黲壍)),
            conversions: round(毡壍, 2),
            conv_value: round(諐壍, 2),
        };
    if (徜壍.isBase !== undefined && 垿壍.impressions > 0) {
        const 皮壍 = seedRng("is", 銭壍.seed, 徜壍.id, 纋壍);
        const 閝壍 = clamp(徜壍.isBase * (1 - 0.4 * (鵺壍.util - 0.9)) * noise(皮壍, 0.1), 0.1, 0.95);
        let 抌壍 = (徜壍.lostBudgetBase ?? 0) * (鵺壍.util >= 0.95 ? 1 : 0.6) * noise(皮壍, 0.2);
        if (銭壍.planted && 噇壍 && 徜壍.id === "c1" && 橩壍 < 21)
            抌壍 = 0.25 * noise(皮壍, 0.08);
        抌壍 = clamp(抌壍, 0, 1 - 閝壍);
        const 腻壍 = Math.max(0, 1 - 閝壍 - 抌壍);
        const 乪壍 = 垿壍.impressions / 閝壍;
        垿壍.is_search_impr = 垿壍.impressions;
        垿壍.is_eligible = 乪壍;
        垿壍.is_lost_budget = 乪壍 * 抌壍;
        垿壍.is_lost_rank = 乪壍 * 腻壍;
    }
    return 垿壍;
}
function 浙壍(豈壍: DemoAccountSpec, 夷壍: DemoOptions, 砦壍: CivilDate): CampaignDailyRow[] {
    const 霕壍: CampaignDailyRow[] = [];
    const 搄壍 = 夷壍.scenarios === "extended";
    for (const 苳壍 of 豈壍.campaigns) {
        for (const 俢壍 of enumerate(砦壍, 夷壍.anchor)) {
            const 滑壍 = seedRng(夷壍.seed, 豈壍.seed, 苳壍.id, 俢壍);
            const 跀壍 = 凟壍(俢壍);
            const 媯壍 = isWeekend(俢壍) ? 0.88 : 1.02;
            const 禞壍: DayDraw = {
                util: Math.min(1.25, 苳壍.util * 媯壍 * 牆壍(俢壍) * 跀壍 * noise(滑壍)),
                cpc: 苳壍.cpc * noise(滑壍) * (1 + 0.3 * (跀壍 - 1)),
                ctr: 苳壍.ctr * noise(滑壍),
                cvr: 苳壍.cvr * noise(滑壍) * (1 + 0.5 * (跀壍 - 1)),
                aovNoise: noise(滑壍),
            };
            const 颍壍 = diffDays(俢壍, 夷壍.anchor);
            if (豈壍.planted)
                紓壍(苳壍, 颍壍, 禞壍, 搄壍);
            霕壍.push(玾壍(豈壍, 苳壍, 俢壍, 禞壍, 颍壍, false, 搄壍));
        }
    }
    return 霕壍;
}
function 敼壍(葫壍: DemoAccountSpec, 党壍: DemoOptions): CampaignDailyRow[] {
    const 灉壍 = mulberry32(11);
    const 輸壍 = () => 1 + (灉壍() - 0.5) * 0.16;
    const 尧壍 = enumerate(addDays(PROTOTYPE_END, -(撉壍 - 1)), PROTOTYPE_END);
    const 笖壍: CampaignDailyRow[] = [];
    const 騅壍 = false;
    void 党壍;
    for (const 更壍 of 葫壍.campaigns) {
        尧壍.forEach((藣壍, 勒壍) => {
            const 燁壍 = isWeekend(藣壍) ? 0.88 : 1.02;
            const 邰壍 = 0.88 + 0.12 * (勒壍 / 撉壍);
            const 嶟壍: DayDraw = { util: 更壍.util * 燁壍 * 邰壍 * 輸壍(), cpc: 更壍.cpc * 輸壍(), ctr: 更壍.ctr * 輸壍(), cvr: 更壍.cvr * 輸壍(), aovNoise: 1 };
            const 粎壍 = 撉壍 - 1 - 勒壍;
            if (葫壍.planted)
                紓壍(更壍, 粎壍, 嶟壍, 騅壍);
            嶟壍.aovNoise = 輸壍();
            笖壍.push(玾壍(葫壍, 更壍, 藣壍, 嶟壍, 粎壍, true, 騅壍));
        });
    }
    return 笖壍;
}
function 魽壍(桬壍: readonly number[], 蝛壍: () => number, 告壍: number): number[] {
    return 桬壍.map((猹壍) => 猹壍 * (1 + (蝛壍() - 0.5) * 告壍));
}
function 鈨壍(弗壍: number, 縆壍: readonly number[]): number[] {
    const 鳵壍 = 縆壍.reduce((槤壍, 裓壍) => 槤壍 + 裓壍, 0);
    return 縆壍.map((嗂壍) => (鳵壍 > 0 ? (弗壍 * 嗂壍) / 鳵壍 : 0));
}
interface SplitWeights {
    clicks: readonly number[];
    impressions?: readonly number[];
    cost?: readonly number[];
    conversions?: readonly number[];
}
function 璱壍(鎠壍: BaseMeasures, 悏壍: SplitWeights, 罾壍: boolean): BaseMeasures[] {
    const 鹭壍 = 悏壍.clicks.length;
    const 歜壍 = 悏壍.impressions ?? 悏壍.clicks;
    const 詋壍 = 悏壍.cost ?? 悏壍.clicks;
    const 场壍 = 悏壍.conversions ?? 悏壍.clicks;
    const 瘩壍 = (锘壍: number, 戇壍: readonly number[], 胶壍: number) => (罾壍 ? 鈨壍(锘壍, 戇壍) : largestRemainder(锘壍, 戇壍, 胶壍));
    const 鿥壍 = 瘩壍(鎠壍.clicks, 悏壍.clicks, 0);
    const 泔壍 = 瘩壍(鎠壍.impressions, 歜壍, 0);
    const 诃壍 = 瘩壍(鎠壍.cost, 詋壍, 2);
    const 墲壍 = 瘩壍(鎠壍.conversions, 场壍, 2);
    const 瞡壍 = 鎠壍.conversions > 0 ? 瘩壍(鎠壍.conv_value, 墲壍.map((隐壍) => Math.max(隐壍, 0)), 2) : 瘩壍(鎠壍.conv_value, 场壍, 2);
    const 捿壍: BaseMeasures[] = [];
    for (let 艮壍 = 0; 艮壍 < 鹭壍; 艮壍++) {
        捿壍.push({
            clicks: 鿥壍[艮壍] ?? 0,
            impressions: 泔壍[艮壍] ?? 0,
            cost: 诃壍[艮壍] ?? 0,
            conversions: 墲壍[艮壍] ?? 0,
            conv_value: 瞡壍[艮壍] ?? 0,
        });
    }
    return 捿壍;
}
export function generateDemoDataset(佝壍: DemoAccountSpec, 湌壍: DemoOptions): DemoDataset {
    const 贻壍 = 湌壍.profile === "prototype";
    const 娪壍 = 贻壍 ? PROTOTYPE_END : 湌壍.anchor;
    const 礙壍: DemoOptions = { ...湌壍, anchor: 娪壍 };
    const 須壍 = {} as DemoDataset["coverage"];
    for (const 擷壍 of Object.keys(荸壍) as (keyof typeof 荸壍)[]) {
        const 菦壍 = 贻壍 ? Math.min(荸壍[擷壍], 撉壍) : 荸壍[擷壍];
        須壍[擷壍] = { start: addDays(娪壍, -(菦壍 - 1)), end: 娪壍 };
    }
    const 僕壍 = 贻壍 ? 敼壍(佝壍, 礙壍) : 浙壍(佝壍, 礙壍, 須壍.campaign_daily.start);
    const 濄壍 = !贻壍 && 佝壍.planted && 湌壍.scenarios === "extended";
    const 躳壍 = 腤壍(佝壍, 娪壍, 濄壍);
    const 客壍 = new Map(佝壍.campaigns.map((窑壍) => [窑壍.id, 窑壍]));
    const 馀壍: CampaignDeviceDailyRow[] = [];
    const 景壍: CampaignGeoDailyRow[] = [];
    const 蕞壍: CampaignHourlyRow[] = [];
    const 前壍: AdGroupDailyRow[] = [];
    const 焼壍: KeywordDailyRow[] = [];
    const 逫壍: SearchTermDailyRow[] = [];
    const 崚壍 = new Map<string, AdGroupDim[]>();
    for (const 簉壍 of 躳壍.adGroups.values()) {
        const 髸壍 = 崚壍.get(簉壍.campaign_id) ?? [];
        髸壍.push(簉壍);
        崚壍.set(簉壍.campaign_id, 髸壍);
    }
    const 柧壍 = new Map<string, KeywordDim[]>();
    for (const 蛖壍 of 躳壍.keywords.values()) {
        const 叅壍 = 柧壍.get(蛖壍.ad_group_id) ?? [];
        叅壍.push(蛖壍);
        柧壍.set(蛖壍.ad_group_id, 叅壍);
    }
    for (const 犴壍 of 僕壍) {
        const 醣壍 = 客壍.get(犴壍.campaign_id);
        if (!醣壍)
            continue;
        const 庒壍 = 犴壍.date;
        const 綁壍 = (鱰壍: string) => seedRng(湌壍.seed, 佝壍.seed, 醣壍.id, 庒壍, 鱰壍);
        const 楟壍 = { date: 庒壍, account_id: 佝壍.id, campaign_id: 醣壍.id };
        if (庒壍 >= 須壍.campaign_device_daily.start) {
            const 衎壍 = DEVICE_MIX[醣壍.type] ?? DEVICE_MIX.Other ?? {};
            const 唽壍 = Object.keys(衎壍) as Device[];
            const 琬壍 = 魽壍(唽壍.map((錛壍) => 衎壍[錛壍] ?? 0), 綁壍("device"), 0.1);
            const 怊壍 = 璱壍(犴壍, { clicks: 琬壍, conversions: 琬壍.map((绹壍, 鷨壍) => 绹壍 * (DEVICE_CVR[唽壍[鷨壍] as string] ?? 1)) }, 贻壍);
            怊壍.forEach((櫗壍, 视壍) => 馀壍.push({ ...楟壍, device: 唽壍[视壍] as Device, ...櫗壍 }));
        }
        if (庒壍 >= 須壍.campaign_geo_daily.start) {
            const 嚵壍 = 魽壍(GEO_MIX.map((疤壍) => 疤壍[1]), 綁壍("geo"), 0.1);
            const 钓壍 = 璱壍(犴壍, { clicks: 嚵壍, conversions: 嚵壍.map((憂壍, 聱壍) => 憂壍 * (GEO_MIX[聱壍]?.[2] ?? 1)) }, 贻壍);
            钓壍.forEach((齠壍, 汏壍) => 景壍.push({ ...楟壍, country: GEO_MIX[汏壍]?.[0] ?? "ZZ", ...齠壍 }));
        }
        if (庒壍 >= 須壍.campaign_hourly.start) {
            const 謾壍 = 魽壍(hourCurve(醣壍.type, isWeekend(庒壍)), 綁壍("hour"), 0.16);
            const 堭壍 = 謾壍.map((眜壍, 阋壍) => 眜壍 * (阋壍 >= 19 && 阋壍 <= 22 ? 1.12 : 阋壍 < 6 ? 0.7 : 1));
            const 拺壍 = 璱壍(犴壍, { clicks: 謾壍, conversions: 堭壍 }, 贻壍);
            拺壍.forEach((臩壍, 付壍) => 蕞壍.push({ ...楟壍, hour: 付壍, ...臩壍 }));
        }
        const 淇壍 = 崚壍.get(醣壍.id) ?? [];
        if (庒壍 >= 須壍.ad_group_daily.start && 淇壍.length) {
            const 貶壍 = DEMO_AD_GROUPS[醣壍.id] ?? [];
            const 妥壍 = 魽壍(淇壍.map((碔壍, 鞃壍) => 貶壍[鞃壍]?.weight ?? 1 / 淇壍.length), 綁壍("adgroup"), 0.16);
            const 摲壍 = 璱壍(犴壍, { clicks: 妥壍 }, 贻壍);
            摲壍.forEach((荡壍, 偐壍) => {
                const 漿壍 = 淇壍[偐壍] as AdGroupDim;
                前壍.push({ ...楟壍, ad_group_id: 漿壍.id, ...荡壍 });
                const 踮壍 = 柧壍.get(漿壍.id) ?? [];
                if (踮壍.length && 庒壍 >= 須壍.keyword_daily.start) {
                    const 嬝壍 = seedRng(湌壍.seed, 佝壍.seed, 漿壍.id, 庒壍, "kw");
                    const 稌壍 = 魽壍(踮壍.map((飻壍, 旪壍) => 1 / (旪壍 + 1) ** 1.1), 嬝壍, 0.2);
                    const 蓙壍 = 璱壍(荡壍, {
                        clicks: 稌壍,
                        impressions: 稌壍.map((凈壍, 炷壍) => 凈壍 * (1.2 - 0.04 * (踮壍[炷壍]?.qs ?? 6))),
                        cost: 稌壍.map((辦壍, 岕壍) => 辦壍 * (1.35 - 0.07 * (踮壍[岕壍]?.qs ?? 6))),
                        conversions: 稌壍.map((箄壍, 驳壍) => 箄壍 * (0.7 + 0.05 * (踮壍[驳壍]?.qs ?? 6))),
                    }, 贻壍);
                    蓙壍.forEach((杢壍, 虑壍) => {
                        const 區壍 = 踮壍[虑壍] as KeywordDim;
                        const 爯壍 = 區壍.qs ?? 0;
                        焼壍.push({ ...楟壍, ad_group_id: 漿壍.id, keyword_id: 區壍.id, ...杢壍, qs_weight: 爯壍 * 杢壍.impressions, qs_impr: 爯壍 ? 杢壍.impressions : 0 });
                    });
                }
            });
        }
        const 鄞壍 = DEMO_SEARCH_TERMS[醣壍.id];
        if (鄞壍 && 庒壍 >= 須壍.search_term_daily.start) {
            const 帍壍 = 魽壍(鄞壍.map((糼壍) => 糼壍.weight), 綁壍("st"), 0.3);
            const 鯫壍 = 璱壍(犴壍, { clicks: 帍壍, conversions: 帍壍.map((棚壍, 蟉壍) => 棚壍 * (鄞壍[蟉壍]?.cvr ?? 1)) }, 贻壍);
            鯫壍.forEach((咸壍, 玧壍) => {
                const 銖壍 = 鄞壍[玧壍];
                if (!銖壍)
                    return;
                const 待壍 = 繴壍(銖壍.term, 淇壍, 柧壍);
                逫壍.push({
                    ...楟壍,
                    ad_group_id: 待壍.adGroupId,
                    keyword_id: 待壍.keywordId,
                    search_term: 銖壍.term,
                    st_match_type: 待壍.match,
                    st_status: 銖壍.status ?? "none",
                    ...咸壍,
                });
            });
        }
    }
    return {
        account: { id: 佝壍.id, name: 佝壍.name, currency: 佝壍.currency, timezone: 湌壍.timezone, isManager: false, mode: "live" },
        anchor: 娪壍,
        profile: 湌壍.profile,
        dims: 躳壍,
        tables: {
            campaign_daily: 僕壍,
            campaign_device_daily: 馀壍,
            campaign_geo_daily: 景壍,
            campaign_hourly: 蕞壍,
            ad_group_daily: 前壍,
            keyword_daily: 焼壍,
            search_term_daily: 逫壍,
        },
        coverage: 須壍,
        changeEvents: 敥壍(佝壍, 娪壍, 湌壍, 濄壍),
    };
}
function 繴壍(鵣壍: string, 橒壍: AdGroupDim[], 襁壍: Map<string, KeywordDim[]>): {
    adGroupId: string;
    keywordId?: string;
    match: SearchTermMatchType;
} {
    let 嘰壍: {
        ag: AdGroupDim;
        k: KeywordDim;
        score: number;
    } | null = null;
    const 生壍 = new Set(鵣壍.split(/\s+/));
    for (const 鐎壍 of 橒壍) {
        for (const 惽壍 of 襁壍.get(鐎壍.id) ?? []) {
            const 翬壍 = 惽壍.text.split(/\s+/);
            const 黛壍 = 翬壍.filter((毊壍) => 生壍.has(毊壍)).length / 翬壍.length;
            if (!嘰壍 || 黛壍 > 嘰壍.score)
                嘰壍 = { ag: 鐎壍, k: 惽壍, score: 黛壍 };
        }
    }
    if (!嘰壍)
        return { adGroupId: 橒壍[0]?.id ?? "", match: "Unknown" };
    const 誹壍: SearchTermMatchType = 鵣壍 === 嘰壍.k.text ? "Exact" : 鵣壍.includes(嘰壍.k.text) ? "Phrase" : 嘰壍.score >= 0.5 ? "Near phrase" : "Broad";
    return { adGroupId: 嘰壍.ag.id, keywordId: 嘰壍.k.id, match: 誹壍 };
}
function 垨壍(皗壍: number, 閆壍: number): QsComponent {
    const 扵壍 = 皗壍 + 閆壍;
    if (扵壍 >= 8)
        return "Above";
    if (扵壍 >= 6)
        return "Average";
    return "Below";
}
function 腤壍(乓壍: DemoAccountSpec, 浂壍: CivilDate, 谱壍: boolean): EntityDims {
    const 夠壍 = new Map<string, CampaignDim>();
    const 砏壍 = new Map<string, AdGroupDim>();
    const 雾壍 = new Map<string, KeywordDim>();
    for (const 揭壍 of 乓壍.campaigns) {
        const 苜壍 = 谱壍 && 揭壍.id === 帤壍.campaignId ? 帤壍.factor : 1;
        夠壍.set(揭壍.id, {
            id: 揭壍.id,
            account_id: 乓壍.id,
            name: 揭壍.name,
            type: 揭壍.type,
            status: "Enabled",
            bidding_strategy: 揭壍.bidding,
            target_cpa: 揭壍.targetCpa ?? null,
            target_roas: 揭壍.targetRoas ?? null,
            budget_id: `b-${揭壍.id}`,
            budget_daily: round(揭壍.budget * 乓壍.scale * 苜壍, 2),
            budget_shared: false,
            budget_period: "daily",
            start: addDays(浂壍, -520),
            end: null,
        });
        (DEMO_AD_GROUPS[揭壍.id] ?? []).forEach((俋壍, 溺壍) => {
            const 趩壍 = `${揭壍.id}-ag${溺壍 + 1}`;
            砏壍.set(趩壍, { id: 趩壍, campaign_id: 揭壍.id, name: 俋壍.name, status: "Enabled" });
            (俋壍.keywords ?? []).forEach((媘壍, 禇壍) => {
                const 顶壍 = `${趩壍}-k${禇壍 + 1}`;
                雾壍.set(顶壍, {
                    id: 顶壍,
                    ad_group_id: 趩壍,
                    campaign_id: 揭壍.id,
                    text: 媘壍.text,
                    match_type: 媘壍.match,
                    status: "Enabled",
                    qs: 媘壍.qs,
                    qs_ctr: 垨壍(媘壍.qs, 0),
                    qs_relevance: 垨壍(媘壍.qs, 1),
                    qs_landing: 垨壍(媘壍.qs, -1),
                    cpc_bid: round(揭壍.cpc * (1.35 - 0.07 * 媘壍.qs) * 1.15, 2),
                });
            });
        });
    }
    return { campaigns: 夠壍, adGroups: 砏壍, keywords: 雾壍 };
}
function 敥壍(葔壍: DemoAccountSpec, 元壍: CivilDate, 瀲壍: DemoOptions, 輡壍: boolean): ChangeEvent[] {
    const 尐壍: ChangeEvent[] = [];
    const 竿壍 = (駮壍: CivilDate, 曝壍: string) => `${駮壍} ${曝壍}:00`;
    if (葔壍.planted) {
        const 藌壍 = addDays(元壍, -4);
        尐壍.push({
            id: `${葔壍.id}-ce-c6-bid`,
            ts: 竿壍(藌壍, "10:14"),
            date: 藌壍,
            resource_type: "CAMPAIGN",
            operation: "update",
            campaign_id: "c6",
            changed_fields: ["bidding_strategy_type", "target_cpa.target_cpa_micros"],
            diffs: [
                { field: "bidding_strategy_type", before: "TARGET_CPA", after: "MAXIMIZE_CONVERSIONS" },
                { field: "target_cpa.target_cpa", before: 28, after: null },
            ],
            summary: "Bid strategy changed from Target CPA ($28) to Maximize conversions",
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "j•••@acme.example",
        });
        const 劻壍 = addDays(元壍, -2);
        尐壍.push({
            id: `${葔壍.id}-ce-c3-url`,
            ts: 竿壍(劻壍, "16:40"),
            date: 劻壍,
            resource_type: "ASSET",
            operation: "update",
            campaign_id: "c3",
            changed_fields: ["final_urls"],
            diffs: [{ field: "final_urls", before: "https://acme.example/shop", after: "https://acme.example/shop?promo=fall" }],
            summary: "Final URL changed on the Full catalog asset group (landing page now /shop?promo=fall)",
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "m•••@acme.example",
        });
        const 熪壍 = addDays(元壍, -3);
        尐壍.push({
            id: `${葔壍.id}-ce-c5-ad-new`,
            ts: 竿壍(熪壍, "09:05"),
            date: 熪壍,
            resource_type: "AD_GROUP_AD",
            operation: "create",
            campaign_id: "c5",
            ad_group_id: "c5-ag1",
            changed_fields: ["ad.video_ad"],
            diffs: [{ field: "ad.name", before: null, after: "Fall drop 15s" }],
            summary: "New video ad “Fall drop 15s” created",
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "m•••@acme.example",
        });
        尐壍.push({
            id: `${葔壍.id}-ce-c5-ad-paused`,
            ts: 竿壍(熪壍, "09:07"),
            date: 熪壍,
            resource_type: "AD_GROUP_AD",
            operation: "update",
            campaign_id: "c5",
            ad_group_id: "c5-ag1",
            changed_fields: ["status"],
            diffs: [{ field: "status", before: "ENABLED", after: "PAUSED" }],
            summary: "Video ad “Summer hero 30s” paused",
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "m•••@acme.example",
        });
    }
    const 邙壍 = 輡壍 ? 葔壍.campaigns.find((嶈壍) => 嶈壍.id === 帤壍.campaignId) : undefined;
    if (邙壍) {
        const 籷壍 = addDays(元壍, -(帤壍.days - 1));
        const 魦壍 = round(邙壍.budget * 葔壍.scale, 2);
        const 桕壍 = round(魦壍 * 帤壍.factor, 2);
        const 蝄壍 = (吳壍: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: 葔壍.currency }).format(吳壍);
        尐壍.push({
            id: `${葔壍.id}-ce-c2-budget`,
            ts: 竿壍(籷壍, "09:12"),
            date: 籷壍,
            resource_type: "CAMPAIGN_BUDGET",
            operation: "update",
            campaign_id: 邙壍.id,
            changed_fields: ["amount_micros"],
            diffs: [{ field: "amount", before: 魦壍, after: 桕壍 }],
            summary: `Budget changed from ${蝄壍(魦壍)} to ${蝄壍(桕壍)}`,
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "j•••@acme.example",
        });
    }
    const 猢壍: {
        resource: ChangeEvent["resource_type"];
        field: string;
        summary: (鈑壍: DemoCampaignSpec) => string;
        searchOnly?: boolean;
    }[] = [
        { resource: "AD_GROUP_CRITERION", field: "keyword", summary: () => "3 keywords added", searchOnly: true },
        { resource: "CAMPAIGN_CRITERION", field: "negative_keyword", summary: () => "5 negative keywords added" },
        { resource: "AD_GROUP_AD", field: "ad.responsive_search_ad.headlines", summary: () => "Responsive search ad headlines edited", searchOnly: true },
        { resource: "CAMPAIGN_CRITERION", field: "audience", summary: () => "Audience segment added (observation)" },
        { resource: "ASSET", field: "sitelink", summary: () => "2 sitelink assets updated" },
    ];
    for (const 开壍 of 葔壍.campaigns) {
        for (let 緯壍 = 3; 緯壍 < 30; 緯壍 += 7) {
            if (葔壍.planted && 开壍.id === "c8" && 緯壍 < 17)
                continue;
            const 鳞壍 = addDays(元壍, -緯壍);
            const 槍壍 = mulberry32(cyrb53(`${瀲壍.seed}|${葔壍.seed}|${开壍.id}|${isoWeek(鳞壍)}|ce`) % 2147483647);
            if (槍壍() < 0.45)
                continue;
            const 袼壍 = 猢壍.filter((喫壍) => !喫壍.searchOnly || 开壍.type === "Search");
            const 璚壍 = 袼壍[Math.floor(槍壍() * 袼壍.length) % 袼壍.length];
            if (!璚壍)
                continue;
            const 鎉壍 = addDays(鳞壍, -Math.floor(槍壍() * 3));
            const 恸壍 = String(8 + Math.floor(槍壍() * 10)).padStart(2, "0");
            const 罧壍 = String(Math.floor(槍壍() * 60)).padStart(2, "0");
            尐壍.push({
                id: `${葔壍.id}-ce-${开壍.id}-${鎉壍}-${璚壍.field}`,
                ts: 竿壍(鎉壍, `${恸壍}:${罧壍}`),
                date: 鎉壍,
                resource_type: 璚壍.resource,
                operation: 璚壍.field === "keyword" || 璚壍.field === "negative_keyword" || 璚壍.field === "audience" ? "create" : "update",
                campaign_id: 开壍.id,
                changed_fields: [璚壍.field],
                diffs: [],
                summary: 璚壍.summary(开壍),
                client_type: 槍壍() < 0.3 ? "GOOGLE_ADS_EDITOR" : "GOOGLE_ADS_WEB_CLIENT",
                actor: "a•••@acme.example",
            });
        }
    }
    return 尐壍.sort((鹖壍, 歅壍) => (鹖壍.ts < 歅壍.ts ? 1 : -1));
}
export interface GoogleDailyTotals {
    date: CivilDate;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conv_value: number;
}
export function googleDailyTotals(訴壍: DemoDataset): GoogleDailyTotals[] {
    const 圣壍 = new Map<CivilDate, GoogleDailyTotals>();
    for (const 瘒壍 of 訴壍.tables.campaign_daily) {
        const 锁壍 = 圣壍.get(瘒壍.date) ?? { date: 瘒壍.date, cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 };
        锁壍.cost += 瘒壍.cost;
        锁壍.clicks += 瘒壍.clicks;
        锁壍.impressions += 瘒壍.impressions;
        锁壍.conversions += 瘒壍.conversions;
        锁壍.conv_value += 瘒壍.conv_value;
        圣壍.set(瘒壍.date, 锁壍);
    }
    return [...圣壍.values()].sort((懰壍, 胟壍) => (懰壍.date < 胟壍.date ? -1 : 1));
}
export type PlatformKind = "ad_platform" | "analytics" | "commerce";
export function demoPlatformRows(鿎壍: DemoDataset, 沽壍: string, 讬壍: PlatformKind, 墛壍: string, 瞊壍?: Partial<{
    share: number;
    roas: number;
    cpc: number;
    ctr: number;
    aov: number;
}>): PlatformDailyRow[] {
    return demoPlatformRowsFromTotals(googleDailyTotals(鿎壍), 鿎壍.account, 沽壍, 讬壍, 墛壍, 瞊壍);
}
export function demoPlatformRowsFromTotals(陹壍: readonly GoogleDailyTotals[], 捨壍: {
    id: string;
    currency: string;
}, 艗壍: string, 但壍: PlatformKind, 渵壍: string, 贤壍?: Partial<{
    share: number;
    roas: number;
    cpc: number;
    ctr: number;
    aov: number;
}>): PlatformDailyRow[] {
    const 娓壍 = { ...(DEMO_PLATFORMS[艗壍] ?? DEMO_PLATFORMS.custom), ...贤壍 } as {
        share: number;
        roas: number;
        cpc: number;
        ctr: number;
        aov: number;
    };
    const 礂壍: PlatformDailyRow[] = [];
    for (const 韱壍 of 陹壍) {
        const 擠壍 = seedRng(渵壍, 捨壍.id, 艗壍, 韱壍.date);
        const 菏壍 = { date: 韱壍.date, account_id: 捨壍.id, platform: 艗壍, currency: 捨壍.currency };
        if (但壍 === "ad_platform") {
            const 傾壍 = round(韱壍.cost * 娓壍.share * noise(擠壍, 0.2), 2);
            const 澭壍 = round(傾壍 * 娓壍.roas * noise(擠壍, 0.24), 2);
            const 躜壍 = Math.round(傾壍 / (娓壍.cpc * noise(擠壍, 0.12)));
            礂壍.push({
                ...菏壍,
                cost: 傾壍,
                conv_value: 澭壍,
                clicks: 躜壍,
                impressions: Math.round(躜壍 / (娓壍.ctr * noise(擠壍, 0.12))),
                conversions: round(澭壍 / (娓壍.aov * noise(擠壍, 0.1)), 2),
            });
        }
        else if (但壍 === "analytics") {
            const 宋壍 = Math.round(韱壍.clicks * 2.4 * noise(擠壍, 0.12));
            礂壍.push({
                ...菏壍,
                cost: 0,
                clicks: 0,
                impressions: 0,
                conversions: round(韱壍.conversions * 1.3 * noise(擠壍, 0.1), 2),
                conv_value: round(韱壍.conv_value * 1.1 * noise(擠壍, 0.1), 2),
                sessions: 宋壍,
            });
        }
        else {
            const 空壍 = round(韱壍.conv_value * 1.6 * noise(擠壍, 0.12), 2);
            礂壍.push({ ...菏壍, cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0, store_revenue: 空壍, orders: Math.round(空壍 / 97) });
        }
    }
    return 礂壍;
}
export function googlePlatformRows(饩壍: DemoDataset | {
    account: AccountInfo;
    tables: {
        campaign_daily: CampaignDailyRow[];
    };
}): PlatformDailyRow[] {
    const 晘壍 = new Map<CivilDate, PlatformDailyRow>();
    for (const 蕇壍 of 饩壍.tables.campaign_daily) {
        const 制壍 = 晘壍.get(蕇壍.date) ??
            ({ date: 蕇壍.date, account_id: 饩壍.account.id, platform: "google_ads", currency: 饩壍.account.currency, cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 } as PlatformDailyRow);
        制壍.cost += 蕇壍.cost;
        制壍.clicks += 蕇壍.clicks;
        制壍.impressions += 蕇壍.impressions;
        制壍.conversions += 蕇壍.conversions;
        制壍.conv_value += 蕇壍.conv_value;
        晘壍.set(蕇壍.date, 制壍);
    }
    return [...晘壍.values()];
}
