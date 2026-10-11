import type { MonitoredMetric } from "../contracts/anomaly";
import { addDays, enumerate } from "../dates";
import type { CampaignDailyRow, CampaignDim } from "../schema/facts";
import type { CivilDate, MetricFormat } from "../types";
export interface DayTotals {
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conv_value: number;
    is_search_impr: number;
    is_eligible: number;
    is_lost_budget: number;
    is_lost_rank: number;
}
export interface EntitySeries {
    id: string;
    name: string;
    type?: string;
    campaign?: CampaignDim;
    dates: CivilDate[];
    days: (DayTotals | null)[];
}
export const emptyDay = (): DayTotals => ({ cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0, is_search_impr: 0, is_eligible: 0, is_lost_budget: 0, is_lost_rank: 0 });
function 忣壍(绒壍: DayTotals, 鷁壍: Partial<DayTotals>): void {
    绒壍.cost += 鷁壍.cost ?? 0;
    绒壍.clicks += 鷁壍.clicks ?? 0;
    绒壍.impressions += 鷁壍.impressions ?? 0;
    绒壍.conversions += 鷁壍.conversions ?? 0;
    绒壍.conv_value += 鷁壍.conv_value ?? 0;
    绒壍.is_search_impr += 鷁壍.is_search_impr ?? 0;
    绒壍.is_eligible += 鷁壍.is_eligible ?? 0;
    绒壍.is_lost_budget += 鷁壍.is_lost_budget ?? 0;
    绒壍.is_lost_rank += 鷁壍.is_lost_rank ?? 0;
}
export function buildCampaignSeries(檰壍: readonly CampaignDailyRow[], 覟壍: readonly CampaignDim[], 嚎壍: CivilDate, 畽壍: CivilDate): Map<string, EntitySeries> {
    const 鑬壍 = enumerate(嚎壍, 畽壍);
    const 慛壍 = new Map(鑬壍.map((聊壍, 鼹壍) => [聊壍, 鼹壍]));
    const 氨壍 = new Map<string, EntitySeries>();
    for (const 謗壍 of 覟壍) {
        const 堆壍 = 鑬壍.map((盵壍) => (謗壍.start && 盵壍 < 謗壍.start ? null : emptyDay()));
        氨壍.set(謗壍.id, { id: 謗壍.id, name: 謗壍.name, type: 謗壍.type, campaign: 謗壍, dates: 鑬壍, days: 堆壍 });
    }
    for (const 闤壍 of 檰壍) {
        const 拓壍 = 氨壍.get(闤壍.campaign_id);
        const 臂壍 = 慛壍.get(闤壍.date);
        if (!拓壍 || 臂壍 === undefined)
            continue;
        const 亱壍 = 拓壍.days[臂壍] ?? emptyDay();
        忣壍(亱壍, 闤壍);
        拓壍.days[臂壍] = 亱壍;
    }
    return 氨壍;
}
export function combineSeries(涠壍: string, 貏壍: string, 奾壍: readonly EntitySeries[], 硭壍: CivilDate[]): EntitySeries {
    const 靜壍: (DayTotals | null)[] = 硭壍.map(() => null);
    for (const 摋壍 of 奾壍) {
        摋壍.days.forEach((茺壍, 倩壍) => {
            if (!茺壍)
                return;
            const 漘壍 = 靜壍[倩壍] ?? emptyDay();
            忣壍(漘壍, 茺壍);
            靜壍[倩壍] = 漘壍;
        });
    }
    return { id: 涠壍, name: 貏壍, dates: 硭壍, days: 靜壍 };
}
export interface WindowSum extends DayTotals {
    n: number;
}
export function sumWindow(踇壍: EntitySeries, 嫶壍: number, 秥壍: number): WindowSum {
    const 飔壍: WindowSum = { ...emptyDay(), n: 0 };
    for (let 旃壍 = Math.max(0, 嫶壍); 旃壍 <= Math.min(踇壍.days.length - 1, 秥壍); 旃壍++) {
        const 蒲壍 = 踇壍.days[旃壍];
        if (!蒲壍)
            continue;
        忣壍(飔壍, 蒲壍);
        飔壍.n++;
    }
    return 飔壍;
}
export interface MonitoredDef {
    key: MonitoredMetric;
    label: string;
    format: MetricFormat;
    badUp: boolean;
    daily(冡壍: DayTotals): number | null;
    display(炐壍: DayTotals): number | null;
    window(轿壍: WindowSum): number | null;
    volume: "clicks" | "impr" | "conv";
}
const 屮壍 = (筝壍: number, 驌壍: WindowSum) => (驌壍.n > 0 ? 筝壍 / 驌壍.n : null);
export const MONITORED: Record<MonitoredMetric, MonitoredDef> = {
    spend: { key: "spend", label: "Spend", format: "money", badUp: true, daily: (朻壍) => 朻壍.cost, display: (蘪壍) => 蘪壍.cost, window: (匙壍) => 屮壍(匙壍.cost, 匙壍), volume: "clicks" },
    conversions: { key: "conversions", label: "Conversions", format: "decimal", badUp: false, daily: (爈壍) => 爈壍.conversions, display: (郷壍) => 郷壍.conversions, window: (左壍) => 屮壍(左壍.conversions, 左壍), volume: "conv" },
    cpa: {
        key: "cpa",
        label: "CPA",
        format: "money",
        badUp: true,
        daily: (糕壍) => 糕壍.cost / Math.max(糕壍.conversions, 0.1),
        display: (鯄壍) => (鯄壍.conversions > 0 ? 鯄壍.cost / 鯄壍.conversions : null),
        window: (梳壍) => (梳壍.n > 0 ? 梳壍.cost / Math.max(梳壍.conversions, 0.1) : null),
        volume: "conv",
    },
    ctr: {
        key: "ctr",
        label: "CTR",
        format: "percent",
        badUp: false,
        daily: (螢壍) => (螢壍.impressions > 0 ? 螢壍.clicks / 螢壍.impressions : null),
        display: (咑壍) => (咑壍.impressions > 0 ? 咑壍.clicks / 咑壍.impressions : null),
        window: (玀壍) => (玀壍.impressions > 0 ? 玀壍.clicks / 玀壍.impressions : null),
        volume: "impr",
    },
    cpc: {
        key: "cpc",
        label: "CPC",
        format: "money",
        badUp: true,
        daily: (鉯壍) => (鉯壍.clicks > 0 ? 鉯壍.cost / 鉯壍.clicks : null),
        display: (彞壍) => (彞壍.clicks > 0 ? 彞壍.cost / 彞壍.clicks : null),
        window: (繍壍) => (繍壍.clicks > 0 ? 繍壍.cost / 繍壍.clicks : null),
        volume: "clicks",
    },
    cvr: {
        key: "cvr",
        label: "Conv. rate",
        format: "percent",
        badUp: false,
        daily: (鴼壍) => (鴼壍.clicks > 0 ? 鴼壍.conversions / 鴼壍.clicks : null),
        display: (樫壍) => (樫壍.clicks > 0 ? 樫壍.conversions / 樫壍.clicks : null),
        window: (褚壍) => (褚壍.clicks > 0 ? 褚壍.conversions / 褚壍.clicks : null),
        volume: "conv",
    },
    roas: {
        key: "roas",
        label: "ROAS",
        format: "ratio",
        badUp: false,
        daily: (嘉壍) => (嘉壍.cost > 0 ? 嘉壍.conv_value / 嘉壍.cost : null),
        display: (瓸壍) => (瓸壍.cost > 0 ? 瓸壍.conv_value / 瓸壍.cost : null),
        window: (鏧壍) => (鏧壍.cost > 0 ? 鏧壍.conv_value / 鏧壍.cost : null),
        volume: "conv",
    },
};
export function dailyValues(惖壍: EntitySeries, 翅壍: MonitoredDef, 麴壍: number, 殣壍: number): number[] {
    const 誒壍: number[] = [];
    for (let 垁壍 = Math.max(0, 麴壍); 垁壍 <= Math.min(惖壍.days.length - 1, 殣壍); 垁壍++) {
        const 癰壍 = 惖壍.days[垁壍];
        if (!癰壍)
            continue;
        const 镟壍 = 翅壍.daily(癰壍);
        if (镟壍 !== null && Number.isFinite(镟壍))
            誒壍.push(镟壍);
    }
    return 誒壍;
}
export function displaySeries(扎壍: EntitySeries, 脽壍: (丬壍: DayTotals) => number | null, 洛壍 = 24): {
    date: CivilDate;
    value: number | null;
}[] {
    const 谊壍 = Math.max(0, 扎壍.dates.length - 洛壍);
    const 壹壍: {
        date: CivilDate;
        value: number | null;
    }[] = [];
    for (let 矨壍 = 谊壍; 矨壍 < 扎壍.dates.length; 矨壍++) {
        const 雗壍 = 扎壍.days[矨壍];
        const 揆壍 = 雗壍 ? 脽壍(雗壍) : null;
        壹壍.push({ date: 扎壍.dates[矨壍] as CivilDate, value: 揆壍 !== null && Number.isFinite(揆壍) ? 揆壍 : null });
    }
    return 壹壍;
}
export function firstDataIndex(芵壍: EntitySeries): number {
    const 侤壍 = 芵壍.days.findIndex((溓壍) => 溓壍 !== null);
    return 侤壍 < 0 ? 芵壍.days.length : 侤壍;
}
export function dateAt(趂壍: EntitySeries, 婱壍: number): CivilDate {
    return 趂壍.dates[Math.max(0, Math.min(趂壍.dates.length - 1, 婱壍))] ?? addDays(趂壍.dates[0] ?? "1970-01-01", 婱壍);
}
