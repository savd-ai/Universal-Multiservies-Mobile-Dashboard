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
function addInto(t: DayTotals, r: Partial<DayTotals>): void {
    t.cost += r.cost ?? 0;
    t.clicks += r.clicks ?? 0;
    t.impressions += r.impressions ?? 0;
    t.conversions += r.conversions ?? 0;
    t.conv_value += r.conv_value ?? 0;
    t.is_search_impr += r.is_search_impr ?? 0;
    t.is_eligible += r.is_eligible ?? 0;
    t.is_lost_budget += r.is_lost_budget ?? 0;
    t.is_lost_rank += r.is_lost_rank ?? 0;
}
export function buildCampaignSeries(rows: readonly CampaignDailyRow[], campaigns: readonly CampaignDim[], start: CivilDate, end: CivilDate): Map<string, EntitySeries> {
    const dates = enumerate(start, end);
    const index = new Map(dates.map((d, i) => [d, i]));
    const out = new Map<string, EntitySeries>();
    for (const c of campaigns) {
        const days = dates.map((d) => (c.start && d < c.start ? null : emptyDay()));
        out.set(c.id, { id: c.id, name: c.name, type: c.type, campaign: c, dates, days });
    }
    for (const r of rows) {
        const s = out.get(r.campaign_id);
        const i = index.get(r.date);
        if (!s || i === undefined)
            continue;
        const day = s.days[i] ?? emptyDay();
        addInto(day, r);
        s.days[i] = day;
    }
    return out;
}
export function combineSeries(id: string, name: string, parts: readonly EntitySeries[], dates: CivilDate[]): EntitySeries {
    const days: (DayTotals | null)[] = dates.map(() => null);
    for (const p of parts) {
        p.days.forEach((d, i) => {
            if (!d)
                return;
            const t = days[i] ?? emptyDay();
            addInto(t, d);
            days[i] = t;
        });
    }
    return { id, name, dates, days };
}
export interface WindowSum extends DayTotals {
    n: number;
}
export function sumWindow(s: EntitySeries, value: number, to: number): WindowSum {
    const t: WindowSum = { ...emptyDay(), n: 0 };
    for (let i = Math.max(0, value); i <= Math.min(s.days.length - 1, to); i++) {
        const d = s.days[i];
        if (!d)
            continue;
        addInto(t, d);
        t.n++;
    }
    return t;
}
export interface MonitoredDef {
    key: MonitoredMetric;
    label: string;
    format: MetricFormat;
    badUp: boolean;
    daily(d: DayTotals): number | null;
    display(d: DayTotals): number | null;
    window(w: WindowSum): number | null;
    volume: "clicks" | "impr" | "conv";
}
const perDay = (v: number, w: WindowSum) => (w.n > 0 ? v / w.n : null);
export const MONITORED: Record<MonitoredMetric, MonitoredDef> = {
    spend: { key: "spend", label: "Spend", format: "money", badUp: true, daily: (d) => d.cost, display: (d) => d.cost, window: (w) => perDay(w.cost, w), volume: "clicks" },
    conversions: { key: "conversions", label: "Conversions", format: "decimal", badUp: false, daily: (d) => d.conversions, display: (d) => d.conversions, window: (w) => perDay(w.conversions, w), volume: "conv" },
    cpa: {
        key: "cpa",
        label: "CPA",
        format: "money",
        badUp: true,
        daily: (d) => d.cost / Math.max(d.conversions, 0.1),
        display: (d) => (d.conversions > 0 ? d.cost / d.conversions : null),
        window: (w) => (w.n > 0 ? w.cost / Math.max(w.conversions, 0.1) : null),
        volume: "conv",
    },
    ctr: {
        key: "ctr",
        label: "CTR",
        format: "percent",
        badUp: false,
        daily: (d) => (d.impressions > 0 ? d.clicks / d.impressions : null),
        display: (d) => (d.impressions > 0 ? d.clicks / d.impressions : null),
        window: (w) => (w.impressions > 0 ? w.clicks / w.impressions : null),
        volume: "impr",
    },
    cpc: {
        key: "cpc",
        label: "CPC",
        format: "money",
        badUp: true,
        daily: (d) => (d.clicks > 0 ? d.cost / d.clicks : null),
        display: (d) => (d.clicks > 0 ? d.cost / d.clicks : null),
        window: (w) => (w.clicks > 0 ? w.cost / w.clicks : null),
        volume: "clicks",
    },
    cvr: {
        key: "cvr",
        label: "Conv. rate",
        format: "percent",
        badUp: false,
        daily: (d) => (d.clicks > 0 ? d.conversions / d.clicks : null),
        display: (d) => (d.clicks > 0 ? d.conversions / d.clicks : null),
        window: (w) => (w.clicks > 0 ? w.conversions / w.clicks : null),
        volume: "conv",
    },
    roas: {
        key: "roas",
        label: "ROAS",
        format: "ratio",
        badUp: false,
        daily: (d) => (d.cost > 0 ? d.conv_value / d.cost : null),
        display: (d) => (d.cost > 0 ? d.conv_value / d.cost : null),
        window: (w) => (w.cost > 0 ? w.conv_value / w.cost : null),
        volume: "conv",
    },
};
export function dailyValues(s: EntitySeries, def: MonitoredDef, value: number, to: number): number[] {
    const out: number[] = [];
    for (let i = Math.max(0, value); i <= Math.min(s.days.length - 1, to); i++) {
        const d = s.days[i];
        if (!d)
            continue;
        const v = def.daily(d);
        if (v !== null && Number.isFinite(v))
            out.push(v);
    }
    return out;
}
export function displaySeries(s: EntitySeries, value: (d: DayTotals) => number | null, n = 24): {
    date: CivilDate;
    value: number | null;
}[] {
    const start = Math.max(0, s.dates.length - n);
    const out: {
        date: CivilDate;
        value: number | null;
    }[] = [];
    for (let i = start; i < s.dates.length; i++) {
        const d = s.days[i];
        const v = d ? value(d) : null;
        out.push({ date: s.dates[i] as CivilDate, value: v !== null && Number.isFinite(v) ? v : null });
    }
    return out;
}
export function firstDataIndex(s: EntitySeries): number {
    const i = s.days.findIndex((d) => d !== null);
    return i < 0 ? s.days.length : i;
}
export function dateAt(s: EntitySeries, i: number): CivilDate {
    return s.dates[Math.max(0, Math.min(s.dates.length - 1, i))] ?? addDays(s.dates[0] ?? "1970-01-01", i);
}
