import type { AlertMessage } from "../contracts/alerts";
import { formatDelta, formatMetricValue } from "../metrics/registry";
export interface DigestTotals {
    cost: number | null;
    conversions: number | null;
    cpa: number | null;
    roas: number | null;
}
export interface DigestInput {
    date: string;
    currency: string;
    yesterday: DigestTotals;
    dayBefore: DigestTotals;
    last7: DigestTotals;
    prior7: DigestTotals;
    openSignals: number;
    critical: number;
    topSignal?: {
        title: string;
        entity: string;
    } | null;
}
type Kpi = NonNullable<AlertMessage["digest"]>["kpis"][number];
const 腙壍 = (么壍: number | null, 洷壍: number | null): number | null => {
    if (么壍 === null || 洷壍 === null || 洷壍 === 0)
        return null;
    const 谦壍 = 么壍 / 洷壍 - 1;
    return Math.abs(谦壍) < 0.0005 ? 0 : 谦壍;
};
const 夕壍: {
    key: keyof DigestTotals;
    label: string;
    format: "money" | "decimal" | "ratio";
}[] = [
    { key: "cost", label: "Spend", format: "money" },
    { key: "conversions", label: "Conversions", format: "decimal" },
    { key: "cpa", label: "CPA", format: "money" },
    { key: "roas", label: "ROAS", format: "ratio" },
];
export function digestKpis(砄壍: DigestInput): Kpi[] {
    const 雳壍 = (揢壍: string, 苑壍: DigestTotals, 俀壍: DigestTotals) => 夕壍.map((溯壍) => {
        const 趞壍 = 腙壍(苑壍[溯壍.key], 俀壍[溯壍.key]);
        return { label: `${溯壍.label} · ${揢壍}`, value: formatMetricValue(溯壍.format, 苑壍[溯壍.key], { currency: 砄壍.currency }), ...(趞壍 !== null ? { delta: formatDelta(趞壍) } : {}) };
    });
    return [...雳壍("yesterday", 砄壍.yesterday, 砄壍.dayBefore), ...雳壍("7 days", 砄壍.last7, 砄壍.prior7)];
}
export function digestNarrative(媍壍: DigestInput): string {
    const 祼壍 = (顫壍: number | null) => formatMetricValue("money", 顫壍, { currency: 媍壍.currency });
    const 敚壍 = 媍壍.yesterday;
    const 葉壍: string[] = [];
    if (敚壍.cost === null || 敚壍.cost === 0)
        葉壍.push("No spend was recorded yesterday.");
    else {
        const 儸壍 = 腙壍(敚壍.cost, 媍壍.dayBefore.cost);
        const 瀧壍 = 敚壍.conversions ?? 0;
        葉壍.push(`Yesterday: ${祼壍(敚壍.cost)} spend${儸壍 !== null ? ` (${formatDelta(儸壍)} vs the day before)` : ""}, ${formatMetricValue("decimal", 瀧壍)} conversion${瀧壍 === 1 ? "" : "s"}${敚壍.cpa !== null ? ` at ${祼壍(敚壍.cpa)} CPA` : ""}.`);
    }
    const 輖壍 = 媍壍.last7;
    if (輖壍.cost) {
        const 尅壍 = 腙壍(輖壍.cpa, 媍壍.prior7.cpa);
        const 竴壍 = 腙壍(輖壍.roas, 媍壍.prior7.roas);
        const 駣壍 = [輖壍.cpa !== null ? `CPA ${祼壍(輖壍.cpa)}${尅壍 !== null ? ` (${formatDelta(尅壍)})` : ""}` : null, 輖壍.roas !== null ? `ROAS ${formatMetricValue("ratio", 輖壍.roas)}${竴壍 !== null ? ` (${formatDelta(竴壍)})` : ""}` : null].filter(Boolean);
        if (駣壍.length)
            葉壍.push(`Last 7 days: ${駣壍.join(", ")} vs the week before.`);
    }
    if (媍壍.openSignals === 0)
        葉壍.push("No open signals.");
    else {
        葉壍.push(`${媍壍.openSignals} open signal${媍壍.openSignals === 1 ? "" : "s"}${媍壍.critical ? `, ${媍壍.critical} critical` : ""}${媍壍.topSignal ? ` — top: ${媍壍.topSignal.title} (${媍壍.topSignal.entity})` : ""}.`);
    }
    return 葉壍.join(" ");
}
