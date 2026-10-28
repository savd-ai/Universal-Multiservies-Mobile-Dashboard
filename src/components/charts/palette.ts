import type { ChartTokens } from "./tokens";
const CAMPAIGN_TYPE_SLOT: Record<string, number> = { Search: 0, PMax: 1, Shopping: 2, Video: 3, Display: 4, "Demand Gen": 5 };
const PLATFORM_SLOT: Record<string, number> = { google_ads: 0, "Google Ads": 0, meta: 1, "Meta Ads": 1, microsoft: 2, "Microsoft Advertising": 2, tiktok: 3, "TikTok Ads": 3, linkedin: 4, "LinkedIn Ads": 4 };
const DEVICE_SLOT: Record<string, number> = { Mobile: 0, Desktop: 1, Tablet: 2, "Connected TV": 3, Other: 4 };
const ESTIMATE_SOURCE_SLOT: Record<string, number> = { model: 0, google_simulator: 1 };
export function colorFor(dimension: string | undefined, value: string, index: number, t: ChartTokens): string {
    let slot: number | undefined;
    if (dimension === "campaign_type")
        slot = CAMPAIGN_TYPE_SLOT[value];
    else if (dimension === "platform")
        slot = PLATFORM_SLOT[value];
    else if (dimension === "device")
        slot = DEVICE_SLOT[value];
    else if (dimension === "estimate_source")
        slot = ESTIMATE_SOURCE_SLOT[value];
    if (slot === undefined)
        slot = index;
    return slot < t.series.length ? (t.series[slot] as string) : t.other;
}
export function sequentialRamp(t: ChartTokens): string[] {
    return t.theme === "dark"
        ? ["#09362d", "#034e41", "#006856", "#00826c", "#069c83", "#20b79b", "#50d0b4"]
        : ["#d7f7ed", "#aee5d6", "#7bd1bb", "#40bca2", "#00a389", "#008872", "#006e5c"];
}
export function ordinalRamp(t: ChartTokens, n: number): string[] {
    const ramp = t.theme === "dark" ? ["#006856", "#00826c", "#069c83", "#20b79b", "#50d0b4"] : ["#40bca2", "#00a389", "#008872", "#006e5c", "#00564a"];
    if (n <= ramp.length)
        return t.theme === "dark" ? ramp.slice(ramp.length - n).reverse() : ramp.slice(0, n);
    return Array.from({ length: n }, (_, i) => ramp[Math.min(ramp.length - 1, i)] as string);
}
