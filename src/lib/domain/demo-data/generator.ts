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
const PROTOTYPE_DAYS = 180;
const HISTORY_DAYS: Record<Exclude<FactTableId, "platform_daily">, number> = {
    campaign_daily: 400,
    campaign_device_daily: 400,
    campaign_geo_daily: 180,
    ad_group_daily: 180,
    keyword_daily: 180,
    campaign_hourly: 120,
    search_term_daily: 90,
};
function dayOfYear(d: CivilDate): number {
    const { y } = parts(d);
    return Math.round((toUtcMs(d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}
function thanksgiving(y: number): CivilDate {
    const nov1 = `${y}-11-01`;
    const w = dow(nov1);
    const firstThu = 1 + ((4 - w + 7) % 7);
    return `${y}-11-${String(firstThu + 21).padStart(2, "0")}`;
}
function seasonFactor(d: CivilDate): number {
    const { y, m, day } = parts(d);
    let s = 1 + 0.04 * Math.sin((2 * Math.PI * (dayOfYear(d) - 80)) / 365.25);
    const md = m * 100 + day;
    if (md >= 1101 && md <= 1220)
        s += 0.1;
    const bf = addDays(thanksgiving(y), 1);
    const cm = addDays(bf, 3);
    if (d >= bf && d <= cm)
        s += 0.3;
    if (md >= 1224 && md <= 1231)
        s -= 0.08;
    return s;
}
function trendFactor(d: CivilDate): number {
    return 0.88 + 0.12 * clamp(diffDays("2025-03-01", d) / 540, 0, 1);
}
interface DayDraw {
    util: number;
    cpc: number;
    ctr: number;
    cvr: number;
    aovNoise: number;
}
const BUDGET_RAISE = { campaignId: "c2", factor: 1.4, days: 3 } as const;
function applyPlanted(c: DemoCampaignSpec, back: number, draw: DayDraw, extended: boolean): void {
    if (c.id === "c8" && back < 3)
        draw.cpc *= 1.9;
    if (c.id === "c3" && back < 2)
        draw.cvr *= 0.38;
    if (c.id === "c6" && back < 4)
        draw.util *= 1.65;
    if (c.id === "c5" && back < 3)
        draw.ctr *= 0.45;
    if (c.id === "c1" && back < 2)
        draw.cvr *= 1.55;
    if (extended) {
        if (c.id === "c7" && back < 2)
            draw.cvr = 0;
        if (c.id === "c1" && back < 21)
            draw.util = Math.max(draw.util, 0.99);
    }
}
function buildCampaignRow(acct: DemoAccountSpec, c: DemoCampaignSpec, d: CivilDate, draw: DayDraw, back: number, exact: boolean, extended: boolean): CampaignDailyRow {
    const raised = acct.planted && extended && c.id === BUDGET_RAISE.campaignId && back < BUDGET_RAISE.days;
    const budget = c.budget * acct.scale * (raised ? BUDGET_RAISE.factor : 1);
    const costRaw = budget * draw.util;
    const clicksRaw = costRaw / draw.cpc;
    const imprRaw = clicksRaw / draw.ctr;
    const convRaw = clicksRaw * draw.cvr;
    const valueRaw = convRaw * c.aov * draw.aovNoise;
    const row: CampaignDailyRow = exact
        ? { date: d, account_id: acct.id, campaign_id: c.id, cost: costRaw, clicks: clicksRaw, impressions: imprRaw, conversions: convRaw, conv_value: valueRaw }
        : {
            date: d,
            account_id: acct.id,
            campaign_id: c.id,
            cost: round(costRaw, 2),
            clicks: Math.max(0, Math.round(clicksRaw)),
            impressions: Math.max(0, Math.round(imprRaw)),
            conversions: round(convRaw, 2),
            conv_value: round(valueRaw, 2),
        };
    if (c.isBase !== undefined && row.impressions > 0) {
        const r = seedRng("is", acct.seed, c.id, d);
        const is = clamp(c.isBase * (1 - 0.4 * (draw.util - 0.9)) * noise(r, 0.1), 0.1, 0.95);
        let lostBudget = (c.lostBudgetBase ?? 0) * (draw.util >= 0.95 ? 1 : 0.6) * noise(r, 0.2);
        if (acct.planted && extended && c.id === "c1" && back < 21)
            lostBudget = 0.25 * noise(r, 0.08);
        lostBudget = clamp(lostBudget, 0, 1 - is);
        const lostRank = Math.max(0, 1 - is - lostBudget);
        const eligible = row.impressions / is;
        row.is_search_impr = row.impressions;
        row.is_eligible = eligible;
        row.is_lost_budget = eligible * lostBudget;
        row.is_lost_rank = eligible * lostRank;
    }
    return row;
}
function realisticCampaignRows(acct: DemoAccountSpec, opts: DemoOptions, start: CivilDate): CampaignDailyRow[] {
    const out: CampaignDailyRow[] = [];
    const extended = opts.scenarios === "extended";
    for (const c of acct.campaigns) {
        for (const d of enumerate(start, opts.anchor)) {
            const r = seedRng(opts.seed, acct.seed, c.id, d);
            const s = seasonFactor(d);
            const wk = isWeekend(d) ? 0.88 : 1.02;
            const draw: DayDraw = {
                util: Math.min(1.25, c.util * wk * trendFactor(d) * s * noise(r)),
                cpc: c.cpc * noise(r) * (1 + 0.3 * (s - 1)),
                ctr: c.ctr * noise(r),
                cvr: c.cvr * noise(r) * (1 + 0.5 * (s - 1)),
                aovNoise: noise(r),
            };
            const back = diffDays(d, opts.anchor);
            if (acct.planted)
                applyPlanted(c, back, draw, extended);
            out.push(buildCampaignRow(acct, c, d, draw, back, false, extended));
        }
    }
    return out;
}
function prototypeCampaignRows(acct: DemoAccountSpec, opts: DemoOptions): CampaignDailyRow[] {
    const r = mulberry32(11);
    const n = () => 1 + (r() - 0.5) * 0.16;
    const dates = enumerate(addDays(PROTOTYPE_END, -(PROTOTYPE_DAYS - 1)), PROTOTYPE_END);
    const out: CampaignDailyRow[] = [];
    const extended = false;
    void opts;
    for (const c of acct.campaigns) {
        dates.forEach((d, i) => {
            const wk = isWeekend(d) ? 0.88 : 1.02;
            const trend = 0.88 + 0.12 * (i / PROTOTYPE_DAYS);
            const draw: DayDraw = { util: c.util * wk * trend * n(), cpc: c.cpc * n(), ctr: c.ctr * n(), cvr: c.cvr * n(), aovNoise: 1 };
            const back = PROTOTYPE_DAYS - 1 - i;
            if (acct.planted)
                applyPlanted(c, back, draw, extended);
            draw.aovNoise = n();
            out.push(buildCampaignRow(acct, c, d, draw, back, true, extended));
        });
    }
    return out;
}
function jitter(weights: readonly number[], r: () => number, spread: number): number[] {
    return weights.map((w) => w * (1 + (r() - 0.5) * spread));
}
function proportional(total: number, weights: readonly number[]): number[] {
    const s = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (s > 0 ? (total * w) / s : 0));
}
interface SplitWeights {
    clicks: readonly number[];
    impressions?: readonly number[];
    cost?: readonly number[];
    conversions?: readonly number[];
}
function splitMeasures(row: BaseMeasures, w: SplitWeights, exact: boolean): BaseMeasures[] {
    const n = w.clicks.length;
    const imprW = w.impressions ?? w.clicks;
    const costW = w.cost ?? w.clicks;
    const convW = w.conversions ?? w.clicks;
    const split = (total: number, weights: readonly number[], decimals: number) => (exact ? proportional(total, weights) : largestRemainder(total, weights, decimals));
    const clicks = split(row.clicks, w.clicks, 0);
    const impressions = split(row.impressions, imprW, 0);
    const cost = split(row.cost, costW, 2);
    const conversions = split(row.conversions, convW, 2);
    const value = row.conversions > 0 ? split(row.conv_value, conversions.map((c) => Math.max(c, 0)), 2) : split(row.conv_value, convW, 2);
    const out: BaseMeasures[] = [];
    for (let i = 0; i < n; i++) {
        out.push({
            clicks: clicks[i] ?? 0,
            impressions: impressions[i] ?? 0,
            cost: cost[i] ?? 0,
            conversions: conversions[i] ?? 0,
            conv_value: value[i] ?? 0,
        });
    }
    return out;
}
export function generateDemoDataset(acct: DemoAccountSpec, opts: DemoOptions): DemoDataset {
    const exact = opts.profile === "prototype";
    const anchor = exact ? PROTOTYPE_END : opts.anchor;
    const effectiveOpts: DemoOptions = { ...opts, anchor };
    const coverage = {} as DemoDataset["coverage"];
    for (const t of Object.keys(HISTORY_DAYS) as (keyof typeof HISTORY_DAYS)[]) {
        const days = exact ? Math.min(HISTORY_DAYS[t], PROTOTYPE_DAYS) : HISTORY_DAYS[t];
        coverage[t] = { start: addDays(anchor, -(days - 1)), end: anchor };
    }
    const campaignRows = exact ? prototypeCampaignRows(acct, effectiveOpts) : realisticCampaignRows(acct, effectiveOpts, coverage.campaign_daily.start);
    const budgetRaised = !exact && acct.planted && opts.scenarios === "extended";
    const dims = buildDims(acct, anchor, budgetRaised);
    const specById = new Map(acct.campaigns.map((c) => [c.id, c]));
    const device: CampaignDeviceDailyRow[] = [];
    const geo: CampaignGeoDailyRow[] = [];
    const hourly: CampaignHourlyRow[] = [];
    const adGroup: AdGroupDailyRow[] = [];
    const keyword: KeywordDailyRow[] = [];
    const searchTerm: SearchTermDailyRow[] = [];
    const adGroupsByCampaign = new Map<string, AdGroupDim[]>();
    for (const ag of dims.adGroups.values()) {
        const list = adGroupsByCampaign.get(ag.campaign_id) ?? [];
        list.push(ag);
        adGroupsByCampaign.set(ag.campaign_id, list);
    }
    const keywordsByAdGroup = new Map<string, KeywordDim[]>();
    for (const k of dims.keywords.values()) {
        const list = keywordsByAdGroup.get(k.ad_group_id) ?? [];
        list.push(k);
        keywordsByAdGroup.set(k.ad_group_id, list);
    }
    for (const row of campaignRows) {
        const c = specById.get(row.campaign_id);
        if (!c)
            continue;
        const d = row.date;
        const key = (part: string) => seedRng(opts.seed, acct.seed, c.id, d, part);
        const base = { date: d, account_id: acct.id, campaign_id: c.id };
        if (d >= coverage.campaign_device_daily.start) {
            const mix = DEVICE_MIX[c.type] ?? DEVICE_MIX.Other ?? {};
            const devices = Object.keys(mix) as Device[];
            const w = jitter(devices.map((dv) => mix[dv] ?? 0), key("device"), 0.1);
            const parts2 = splitMeasures(row, { clicks: w, conversions: w.map((x, i) => x * (DEVICE_CVR[devices[i] as string] ?? 1)) }, exact);
            parts2.forEach((m, i) => device.push({ ...base, device: devices[i] as Device, ...m }));
        }
        if (d >= coverage.campaign_geo_daily.start) {
            const w = jitter(GEO_MIX.map((g) => g[1]), key("geo"), 0.1);
            const parts2 = splitMeasures(row, { clicks: w, conversions: w.map((x, i) => x * (GEO_MIX[i]?.[2] ?? 1)) }, exact);
            parts2.forEach((m, i) => geo.push({ ...base, country: GEO_MIX[i]?.[0] ?? "ZZ", ...m }));
        }
        if (d >= coverage.campaign_hourly.start) {
            const curve = jitter(hourCurve(c.type, isWeekend(d)), key("hour"), 0.16);
            const convCurve = curve.map((x, h) => x * (h >= 19 && h <= 22 ? 1.12 : h < 6 ? 0.7 : 1));
            const parts2 = splitMeasures(row, { clicks: curve, conversions: convCurve }, exact);
            parts2.forEach((m, h) => hourly.push({ ...base, hour: h, ...m }));
        }
        const ags = adGroupsByCampaign.get(c.id) ?? [];
        if (d >= coverage.ad_group_daily.start && ags.length) {
            const agSpecs = DEMO_AD_GROUPS[c.id] ?? [];
            const w = jitter(ags.map((_, i) => agSpecs[i]?.weight ?? 1 / ags.length), key("adgroup"), 0.16);
            const agParts = splitMeasures(row, { clicks: w }, exact);
            agParts.forEach((m, i) => {
                const ag = ags[i] as AdGroupDim;
                adGroup.push({ ...base, ad_group_id: ag.id, ...m });
                const kws = keywordsByAdGroup.get(ag.id) ?? [];
                if (kws.length && d >= coverage.keyword_daily.start) {
                    const kr = seedRng(opts.seed, acct.seed, ag.id, d, "kw");
                    const kwW = jitter(kws.map((_, j) => 1 / (j + 1) ** 1.1), kr, 0.2);
                    const kwParts = splitMeasures(m, {
                        clicks: kwW,
                        impressions: kwW.map((x, j) => x * (1.2 - 0.04 * (kws[j]?.qs ?? 6))),
                        cost: kwW.map((x, j) => x * (1.35 - 0.07 * (kws[j]?.qs ?? 6))),
                        conversions: kwW.map((x, j) => x * (0.7 + 0.05 * (kws[j]?.qs ?? 6))),
                    }, exact);
                    kwParts.forEach((km, j) => {
                        const k = kws[j] as KeywordDim;
                        const qs = k.qs ?? 0;
                        keyword.push({ ...base, ad_group_id: ag.id, keyword_id: k.id, ...km, qs_weight: qs * km.impressions, qs_impr: qs ? km.impressions : 0 });
                    });
                }
            });
        }
        const terms = DEMO_SEARCH_TERMS[c.id];
        if (terms && d >= coverage.search_term_daily.start) {
            const w = jitter(terms.map((t) => t.weight), key("st"), 0.3);
            const stParts = splitMeasures(row, { clicks: w, conversions: w.map((x, i) => x * (terms[i]?.cvr ?? 1)) }, exact);
            stParts.forEach((m, i) => {
                const t = terms[i];
                if (!t)
                    return;
                const placement = termPlacement(t.term, ags, keywordsByAdGroup);
                searchTerm.push({
                    ...base,
                    ad_group_id: placement.adGroupId,
                    keyword_id: placement.keywordId,
                    search_term: t.term,
                    st_match_type: placement.match,
                    st_status: t.status ?? "none",
                    ...m,
                });
            });
        }
    }
    return {
        account: { id: acct.id, name: acct.name, currency: acct.currency, timezone: opts.timezone, isManager: false, mode: "live" },
        anchor,
        profile: opts.profile,
        dims,
        tables: {
            campaign_daily: campaignRows,
            campaign_device_daily: device,
            campaign_geo_daily: geo,
            campaign_hourly: hourly,
            ad_group_daily: adGroup,
            keyword_daily: keyword,
            search_term_daily: searchTerm,
        },
        coverage,
        changeEvents: buildChangeEvents(acct, anchor, opts, budgetRaised),
    };
}
function termPlacement(term: string, ags: AdGroupDim[], keywordsByAdGroup: Map<string, KeywordDim[]>): {
    adGroupId: string;
    keywordId?: string;
    match: SearchTermMatchType;
} {
    let best: {
        ag: AdGroupDim;
        k: KeywordDim;
        score: number;
    } | null = null;
    const words = new Set(term.split(/\s+/));
    for (const ag of ags) {
        for (const k of keywordsByAdGroup.get(ag.id) ?? []) {
            const kw = k.text.split(/\s+/);
            const overlap = kw.filter((x) => words.has(x)).length / kw.length;
            if (!best || overlap > best.score)
                best = { ag, k, score: overlap };
        }
    }
    if (!best)
        return { adGroupId: ags[0]?.id ?? "", match: "Unknown" };
    const match: SearchTermMatchType = term === best.k.text ? "Exact" : term.includes(best.k.text) ? "Phrase" : best.score >= 0.5 ? "Near phrase" : "Broad";
    return { adGroupId: best.ag.id, keywordId: best.k.id, match };
}
function qsComponent(qs: number, offset: number): QsComponent {
    const v = qs + offset;
    if (v >= 8)
        return "Above";
    if (v >= 6)
        return "Average";
    return "Below";
}
function buildDims(acct: DemoAccountSpec, anchor: CivilDate, budgetRaised: boolean): EntityDims {
    const campaigns = new Map<string, CampaignDim>();
    const adGroups = new Map<string, AdGroupDim>();
    const keywords = new Map<string, KeywordDim>();
    for (const c of acct.campaigns) {
        const raise = budgetRaised && c.id === BUDGET_RAISE.campaignId ? BUDGET_RAISE.factor : 1;
        campaigns.set(c.id, {
            id: c.id,
            account_id: acct.id,
            name: c.name,
            type: c.type,
            status: "Enabled",
            bidding_strategy: c.bidding,
            target_cpa: c.targetCpa ?? null,
            target_roas: c.targetRoas ?? null,
            budget_id: `b-${c.id}`,
            budget_daily: round(c.budget * acct.scale * raise, 2),
            budget_shared: false,
            budget_period: "daily",
            start: addDays(anchor, -520),
            end: null,
        });
        (DEMO_AD_GROUPS[c.id] ?? []).forEach((ag, i) => {
            const agId = `${c.id}-ag${i + 1}`;
            adGroups.set(agId, { id: agId, campaign_id: c.id, name: ag.name, status: "Enabled" });
            (ag.keywords ?? []).forEach((k, j) => {
                const kId = `${agId}-k${j + 1}`;
                keywords.set(kId, {
                    id: kId,
                    ad_group_id: agId,
                    campaign_id: c.id,
                    text: k.text,
                    match_type: k.match,
                    status: "Enabled",
                    qs: k.qs,
                    qs_ctr: qsComponent(k.qs, 0),
                    qs_relevance: qsComponent(k.qs, 1),
                    qs_landing: qsComponent(k.qs, -1),
                    cpc_bid: round(c.cpc * (1.35 - 0.07 * k.qs) * 1.15, 2),
                });
            });
        });
    }
    return { campaigns, adGroups, keywords };
}
function buildChangeEvents(acct: DemoAccountSpec, anchor: CivilDate, opts: DemoOptions, budgetRaised: boolean): ChangeEvent[] {
    const events: ChangeEvent[] = [];
    const at = (d: CivilDate, hhmm: string) => `${d} ${hhmm}:00`;
    if (acct.planted) {
        const d6 = addDays(anchor, -4);
        events.push({
            id: `${acct.id}-ce-c6-bid`,
            ts: at(d6, "10:14"),
            date: d6,
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
        const d3 = addDays(anchor, -2);
        events.push({
            id: `${acct.id}-ce-c3-url`,
            ts: at(d3, "16:40"),
            date: d3,
            resource_type: "ASSET",
            operation: "update",
            campaign_id: "c3",
            changed_fields: ["final_urls"],
            diffs: [{ field: "final_urls", before: "https://acme.example/shop", after: "https://acme.example/shop?promo=fall" }],
            summary: "Final URL changed on the Full catalog asset group (landing page now /shop?promo=fall)",
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "m•••@acme.example",
        });
        const d5 = addDays(anchor, -3);
        events.push({
            id: `${acct.id}-ce-c5-ad-new`,
            ts: at(d5, "09:05"),
            date: d5,
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
        events.push({
            id: `${acct.id}-ce-c5-ad-paused`,
            ts: at(d5, "09:07"),
            date: d5,
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
    const raisedSpec = budgetRaised ? acct.campaigns.find((c) => c.id === BUDGET_RAISE.campaignId) : undefined;
    if (raisedSpec) {
        const d2 = addDays(anchor, -(BUDGET_RAISE.days - 1));
        const before = round(raisedSpec.budget * acct.scale, 2);
        const after = round(before * BUDGET_RAISE.factor, 2);
        const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: acct.currency }).format(v);
        events.push({
            id: `${acct.id}-ce-c2-budget`,
            ts: at(d2, "09:12"),
            date: d2,
            resource_type: "CAMPAIGN_BUDGET",
            operation: "update",
            campaign_id: raisedSpec.id,
            changed_fields: ["amount_micros"],
            diffs: [{ field: "amount", before, after }],
            summary: `Budget changed from ${money(before)} to ${money(after)}`,
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "j•••@acme.example",
        });
    }
    const templates: {
        resource: ChangeEvent["resource_type"];
        field: string;
        summary: (c: DemoCampaignSpec) => string;
        searchOnly?: boolean;
    }[] = [
        { resource: "AD_GROUP_CRITERION", field: "keyword", summary: () => "3 keywords added", searchOnly: true },
        { resource: "CAMPAIGN_CRITERION", field: "negative_keyword", summary: () => "5 negative keywords added" },
        { resource: "AD_GROUP_AD", field: "ad.responsive_search_ad.headlines", summary: () => "Responsive search ad headlines edited", searchOnly: true },
        { resource: "CAMPAIGN_CRITERION", field: "audience", summary: () => "Audience segment added (observation)" },
        { resource: "ASSET", field: "sitelink", summary: () => "2 sitelink assets updated" },
    ];
    for (const c of acct.campaigns) {
        for (let back = 3; back < 30; back += 7) {
            if (acct.planted && c.id === "c8" && back < 17)
                continue;
            const d = addDays(anchor, -back);
            const r = mulberry32(cyrb53(`${opts.seed}|${acct.seed}|${c.id}|${isoWeek(d)}|ce`) % 2147483647);
            if (r() < 0.45)
                continue;
            const eligible = templates.filter((t2) => !t2.searchOnly || c.type === "Search");
            const t = eligible[Math.floor(r() * eligible.length) % eligible.length];
            if (!t)
                continue;
            const day = addDays(d, -Math.floor(r() * 3));
            const hh = String(8 + Math.floor(r() * 10)).padStart(2, "0");
            const mm = String(Math.floor(r() * 60)).padStart(2, "0");
            events.push({
                id: `${acct.id}-ce-${c.id}-${day}-${t.field}`,
                ts: at(day, `${hh}:${mm}`),
                date: day,
                resource_type: t.resource,
                operation: t.field === "keyword" || t.field === "negative_keyword" || t.field === "audience" ? "create" : "update",
                campaign_id: c.id,
                changed_fields: [t.field],
                diffs: [],
                summary: t.summary(c),
                client_type: r() < 0.3 ? "GOOGLE_ADS_EDITOR" : "GOOGLE_ADS_WEB_CLIENT",
                actor: "a•••@acme.example",
            });
        }
    }
    return events.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}
export interface GoogleDailyTotals {
    date: CivilDate;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conv_value: number;
}
export function googleDailyTotals(ds: DemoDataset): GoogleDailyTotals[] {
    const byDate = new Map<CivilDate, GoogleDailyTotals>();
    for (const r of ds.tables.campaign_daily) {
        const t = byDate.get(r.date) ?? { date: r.date, cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 };
        t.cost += r.cost;
        t.clicks += r.clicks;
        t.impressions += r.impressions;
        t.conversions += r.conversions;
        t.conv_value += r.conv_value;
        byDate.set(r.date, t);
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
export type PlatformKind = "ad_platform" | "analytics" | "commerce";
export function demoPlatformRows(ds: DemoDataset, platformId: string, kind: PlatformKind, seed: string, override?: Partial<{
    share: number;
    roas: number;
    cpc: number;
    ctr: number;
    aov: number;
}>): PlatformDailyRow[] {
    return demoPlatformRowsFromTotals(googleDailyTotals(ds), ds.account, platformId, kind, seed, override);
}
export function demoPlatformRowsFromTotals(google: readonly GoogleDailyTotals[], account: {
    id: string;
    currency: string;
}, platformId: string, kind: PlatformKind, seed: string, override?: Partial<{
    share: number;
    roas: number;
    cpc: number;
    ctr: number;
    aov: number;
}>): PlatformDailyRow[] {
    const spec = { ...(DEMO_PLATFORMS[platformId] ?? DEMO_PLATFORMS.custom), ...override } as {
        share: number;
        roas: number;
        cpc: number;
        ctr: number;
        aov: number;
    };
    const out: PlatformDailyRow[] = [];
    for (const g of google) {
        const r = seedRng(seed, account.id, platformId, g.date);
        const base = { date: g.date, account_id: account.id, platform: platformId, currency: account.currency };
        if (kind === "ad_platform") {
            const cost = round(g.cost * spec.share * noise(r, 0.2), 2);
            const value = round(cost * spec.roas * noise(r, 0.24), 2);
            const clicks = Math.round(cost / (spec.cpc * noise(r, 0.12)));
            out.push({
                ...base,
                cost,
                conv_value: value,
                clicks,
                impressions: Math.round(clicks / (spec.ctr * noise(r, 0.12))),
                conversions: round(value / (spec.aov * noise(r, 0.1)), 2),
            });
        }
        else if (kind === "analytics") {
            const sessions = Math.round(g.clicks * 2.4 * noise(r, 0.12));
            out.push({
                ...base,
                cost: 0,
                clicks: 0,
                impressions: 0,
                conversions: round(g.conversions * 1.3 * noise(r, 0.1), 2),
                conv_value: round(g.conv_value * 1.1 * noise(r, 0.1), 2),
                sessions,
            });
        }
        else {
            const storeRevenue = round(g.conv_value * 1.6 * noise(r, 0.12), 2);
            out.push({ ...base, cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0, store_revenue: storeRevenue, orders: Math.round(storeRevenue / 97) });
        }
    }
    return out;
}
export function googlePlatformRows(ds: DemoDataset | {
    account: AccountInfo;
    tables: {
        campaign_daily: CampaignDailyRow[];
    };
}): PlatformDailyRow[] {
    const byDate = new Map<CivilDate, PlatformDailyRow>();
    for (const r of ds.tables.campaign_daily) {
        const t = byDate.get(r.date) ??
            ({ date: r.date, account_id: ds.account.id, platform: "google_ads", currency: ds.account.currency, cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 } as PlatformDailyRow);
        t.cost += r.cost;
        t.clicks += r.clicks;
        t.impressions += r.impressions;
        t.conversions += r.conversions;
        t.conv_value += r.conv_value;
        byDate.set(r.date, t);
    }
    return [...byDate.values()];
}
