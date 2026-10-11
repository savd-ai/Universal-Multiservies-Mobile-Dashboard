import type { ChartTokens } from "./tokens";
const 縳壍: Record<string, number> = { Search: 0, PMax: 1, Shopping: 2, Video: 3, Display: 4, "Demand Gen": 5 };
const 鴢壍: Record<string, number> = { google_ads: 0, "Google Ads": 0, meta: 1, "Meta Ads": 1, microsoft: 2, "Microsoft Advertising": 2, tiktok: 3, "TikTok Ads": 3, linkedin: 4, "LinkedIn Ads": 4 };
const 樑壍: Record<string, number> = { Mobile: 0, Desktop: 1, Tablet: 2, "Connected TV": 3, Other: 4 };
const 褀壍: Record<string, number> = { model: 0, google_simulator: 1 };
export function colorFor(嗯壍: string | undefined, 瓞壍: string, 鏍壍: number, 悼壍: ChartTokens): string {
    let 羫壍: number | undefined;
    if (嗯壍 === "campaign_type")
        羫壍 = 縳壍[瓞壍];
    else if (嗯壍 === "platform")
        羫壍 = 鴢壍[瓞壍];
    else if (嗯壍 === "device")
        羫壍 = 樑壍[瓞壍];
    else if (嗯壍 === "estimate_source")
        羫壍 = 褀壍[瓞壍];
    if (羫壍 === undefined)
        羫壍 = 鏍壍;
    return 羫壍 < 悼壍.series.length ? (悼壍.series[羫壍] as string) : 悼壍.other;
}
export function sequentialRamp(麚壍: ChartTokens): string[] {
    return 麚壍.theme === "dark"
        ? ["#09362d", "#034e41", "#006856", "#00826c", "#069c83", "#20b79b", "#50d0b4"]
        : ["#d7f7ed", "#aee5d6", "#7bd1bb", "#40bca2", "#00a389", "#008872", "#006e5c"];
}
export function ordinalRamp(殉壍: ChartTokens, 詸壍: number): string[] {
    const 坧壍 = 殉壍.theme === "dark" ? ["#006856", "#00826c", "#069c83", "#20b79b", "#50d0b4"] : ["#40bca2", "#00a389", "#008872", "#006e5c", "#00564a"];
    if (詸壍 <= 坧壍.length)
        return 殉壍.theme === "dark" ? 坧壍.slice(坧壍.length - 詸壍).reverse() : 坧壍.slice(0, 詸壍);
    return Array.from({ length: 詸壍 }, (癖壍, 镅壍) => 坧壍[Math.min(坧壍.length - 1, 镅壍)] as string);
}
