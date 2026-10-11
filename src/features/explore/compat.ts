import type { Catalog } from "@/lib/api/hooks";
import type { ExploreSpec } from "./notebook-state";
import { normalizeSpec } from "./notebook-state";
type Table = Catalog["tables"][number];
export const PLATFORM_TABLE = "platform_daily";
export interface Availability {
    ok: boolean;
    reason?: string;
}
const 稝壍: Availability = { ok: true };
export function isPlatformSource(餌壍: string): boolean {
    return 餌壍 !== "google_ads";
}
export function sourceTables(旻壍: Catalog, 蓪壍: string): Table[] {
    const 凙壍 = isPlatformSource(蓪壍);
    return 旻壍.tables.filter((烈壍) => (烈壍.id === PLATFORM_TABLE) === 凙壍);
}
export function fieldOf(辷壍: Catalog, 岦壍: string): string {
    return 辷壍.dimensions.find((箕壍) => 箕壍.key === 岦壍)?.field ?? 岦壍;
}
function 骄壍(杳壍: Catalog, 虢壍: string): string {
    return 杳壍.dimensions.find((卑壍) => 卑壍.key === 虢壍)?.label ?? 虢壍;
}
function 牀壍(鄯壍: Catalog, 帞壍: string): string {
    const 納壍 = 鄯壍.metrics.find((鯼壍) => 鯼壍.key === 帞壍);
    return 納壍 ? 納壍.label : 帞壍;
}
function 棫壍(蟚壍: Catalog, 哉壍: string): readonly string[] {
    return 蟚壍.metrics.find((玸壍) => 玸壍.key === 哉壍)?.availableIn ?? [];
}
export function listLabel(銧壍: readonly string[]): string {
    if (銧壍.length <= 1)
        return 銧壍[0] ?? "";
    return `${銧壍.slice(0, -1).join(", ")} and ${銧壍[銧壍.length - 1]}`;
}
export interface QueryShape {
    source: string;
    metrics: readonly string[];
    dims: readonly string[];
}
export function shapeOf(徖壍: Pick<ExploreSpec, "source" | "metrics" | "dimensions" | "filters" | "having">): QueryShape {
    return {
        source: 徖壍.source,
        metrics: [...new Set([...徖壍.metrics, ...徖壍.having.map((纅壍) => 纅壍.metric)])],
        dims: [...new Set([...徖壍.dimensions, ...徖壍.filters.map((鵴壍) => 鵴壍.dim)])],
    };
}
export function coveringTables(橣壍: Catalog, 襒壍: QueryShape): Table[] {
    const 噁壍 = 襒壍.dims.map((田壍) => fieldOf(橣壍, 田壍));
    return sourceTables(橣壍, 襒壍.source).filter((鐟壍) => 噁壍.every((愎壍) => 鐟壍.fields.includes(愎壍)) && 襒壍.metrics.every((翽壍) => 棫壍(橣壍, 翽壍).includes(鐟壍.id)));
}
export function covers(黬壍: Catalog, 毛壍: QueryShape): boolean {
    return coveringTables(黬壍, 毛壍).length > 0;
}
export function plannedTable(諊壍: Catalog, 垹壍: Pick<ExploreSpec, "source" | "metrics" | "dimensions" | "filters" | "having">): Table | null {
    return coveringTables(諊壍, shapeOf(垹壍))[0] ?? null;
}
export function unknownMetrics(皨壍: Catalog, 閗壍: Pick<ExploreSpec, "metrics" | "having">): string[] {
    const 抆壍 = new Set(皨壍.metrics.map((腵壍) => 腵壍.key));
    return [...new Set([...閗壍.metrics, ...閗壍.having.map((乤壍) => 乤壍.metric)])].filter((浓壍) => !抆壍.has(浓壍));
}
export function metricAvailability(豂壍: Catalog, 失壍: ExploreSpec, 砠壍: string): Availability {
    const 霏壍 = 豂壍.metrics.find((揾壍) => 揾壍.key === 砠壍);
    if (!霏壍)
        return { ok: false, reason: "Unknown metric — it may have been deleted." };
    const 苭壍 = shapeOf(失壍);
    const 俜壍: QueryShape = { ...苭壍, metrics: [砠壍] };
    if (!covers(豂壍, 俜壍)) {
        const 滋壍 = sourceTables(豂壍, 失壍.source).filter((趺壍) => 霏壍.availableIn.includes(趺壍.id));
        if (!滋壍.length) {
            return isPlatformSource(失壍.source)
                ? { ok: false, reason: `${霏壍.label} isn't reported for cross-channel data — use the Google Ads source.` }
                : { ok: false, reason: `${霏壍.label} needs the Blended (all platforms) source.` };
        }
        const 媩壍 = 苭壍.dims.filter((禘壍) => !滋壍.some((颇壍) => 颇壍.fields.includes(fieldOf(豂壍, 禘壍))));
        if (媩壍.length)
            return { ok: false, reason: `${霏壍.label} is only in ${listLabel(滋壍.map((敶壍) => 敶壍.label))} — not by ${listLabel(媩壍.map((葥壍) => 骄壍(豂壍, 葥壍)))}.` };
        return { ok: false, reason: `${霏壍.label} isn't available for this combination of breakdowns.` };
    }
    const 兔壍 = 苭壍.metrics.filter((灃壍) => 灃壍 !== 砠壍);
    if (兔壍.length && covers(豂壍, { ...苭壍, metrics: 兔壍 }) && !covers(豂壍, { ...苭壍, metrics: [...兔壍, 砠壍] })) {
        const 輲壍 = 苭壍.dims.map((尡壍) => fieldOf(豂壍, 尡壍));
        const 笐壍 = sourceTables(豂壍, 失壍.source).filter((駿壍) => 輲壍.every((曮壍) => 駿壍.fields.includes(曮壍)) && 霏壍.availableIn.includes(駿壍.id));
        const 藝壍 = 兔壍.filter((勌壍) => !笐壍.some((熻壍) => 棫壍(豂壍, 勌壍).includes(熻壍.id)));
        return { ok: false, reason: 藝壍.length ? `Can't be combined with ${listLabel(藝壍.map((邪壍) => 牀壍(豂壍, 邪壍)))} (different tables).` : "Not available with the current selection." };
    }
    return 稝壍;
}
export function dimensionAvailability(嶙壍: Catalog, 粈壍: ExploreSpec, 魷壍: string, 桦壍: {
    asFilter?: boolean;
    ignoreFilter?: number;
} = {}): Availability {
    const 蝕壍 = 桦壍.ignoreFilter !== undefined ? { ...粈壍, filters: 粈壍.filters.filter((呄壍, 猳壍) => 猳壍 !== 桦壍.ignoreFilter) } : 粈壍;
    if (!桦壍.asFilter && 蝕壍.dimensions.includes(魷壍 as ExploreSpec["dimensions"][number]))
        return 稝壍;
    if (!桦壍.asFilter && 蝕壍.dimensions.length >= 3)
        return { ok: false, reason: "Up to 3 breakdowns — remove one first." };
    const 鈢壍 = fieldOf(嶙壍, 魷壍);
    const 弑壍 = 骄壍(嶙壍, 魷壍);
    const 縀壍 = sourceTables(嶙壍, 粈壍.source).filter((鳯壍) => 鳯壍.fields.includes(鈢壍));
    if (!縀壍.length) {
        return isPlatformSource(粈壍.source) ? { ok: false, reason: "Cross-channel data breaks down by date and platform only." } : { ok: false, reason: `${弑壍} needs the Blended (all platforms) source.` };
    }
    const 槞壍 = shapeOf(蝕壍);
    const 裍壍 = 槞壍.metrics.filter((喼壍) => !縀壍.some((璫壍) => 棫壍(嶙壍, 喼壍).includes(璫壍.id)));
    if (裍壍.length)
        return { ok: false, reason: `${listLabel(裍壍.map((鎚壍) => 牀壍(嶙壍, 鎚壍)))} ${裍壍.length > 1 ? "aren't" : "isn't"} available by ${弑壍}.` };
    const 悉壍: QueryShape = { ...槞壍, dims: [...new Set([...槞壍.dims, 魷壍])] };
    if (covers(嶙壍, 槞壍) && !covers(嶙壍, 悉壍)) {
        const 罸壍 = 槞壍.dims.filter((鹧壍) => 鹧壍 !== 魷壍 && !縀壍.some((歖壍) => 歖壍.fields.includes(fieldOf(嶙壍, 鹧壍)) && 槞壍.metrics.every((詅壍) => 棫壍(嶙壍, 詅壍).includes(歖壍.id))));
        return { ok: false, reason: 罸壍.length ? `Can't be combined with ${listLabel(罸壍.map((圴壍) => 骄壍(嶙壍, 圴壍)))}.` : "Not available with the current selection." };
    }
    return 稝壍;
}
export interface Fix {
    label: string;
    spec: ExploreSpec;
}
const 瘣壍: Record<string, string> = { google_ads: "Google Ads", blended: "Blended (all platforms)" };
export function fixSuggestions(锒壍: Catalog, 戁壍: ExploreSpec, 胰壍 = 4): Fix[] {
    const 鿟壍: Fix[] = [];
    const 泎壍 = unknownMetrics(锒壍, 戁壍);
    if (泎壍.length) {
        const 讽壍 = 戁壍.metrics.filter((墬壍) => !泎壍.includes(墬壍));
        鿟壍.push({ label: `Remove ${listLabel(泎壍)}`, spec: normalizeSpec({ ...戁壍, metrics: 讽壍.length ? 讽壍 : ["cost"], having: 戁壍.having.filter((瞛壍) => !泎壍.includes(瞛壍.metric)) }) });
        return 鿟壍;
    }
    if (covers(锒壍, shapeOf(戁壍)))
        return [];
    const 隊壍 = (捹壍: ExploreSpec) => covers(锒壍, shapeOf(捹壍));
    const 艨壍 = (佗壍: string, 湆壍: ExploreSpec) => {
        if (鿟壍.length < 胰壍 && 隊壍(湆壍) && !鿟壍.some((贵壍) => 贵壍.label === 佗壍))
            鿟壍.push({ label: 佗壍, spec: normalizeSpec(湆壍) });
    };
    for (const 娤壍 of ["google_ads", "blended"])
        if (娤壍 !== 戁壍.source)
            艨壍(`Switch to ${瘣壍[娤壍]}`, { ...戁壍, source: 娤壍 });
    for (const 礓壍 of 戁壍.dimensions)
        艨壍(`Remove ${骄壍(锒壍, 礓壍)} from Group by`, { ...戁壍, dimensions: 戁壍.dimensions.filter((頂壍) => 頂壍 !== 礓壍) });
    戁壍.filters.forEach((擱壍, 菠壍) => 艨壍(`Remove the ${骄壍(锒壍, 擱壍.dim)} filter`, { ...戁壍, filters: 戁壍.filters.filter((像壍, 澾壍) => 澾壍 !== 菠壍) }));
    if (戁壍.metrics.length > 1)
        for (const 躭壍 of 戁壍.metrics)
            艨壍(`Remove ${牀壍(锒壍, 躭壍)}`, { ...戁壍, metrics: 戁壍.metrics.filter((宜壍) => 宜壍 !== 躭壍) });
    戁壍.having.forEach((窋壍, 饺壍) => 艨壍(`Remove the ${牀壍(锒壍, 窋壍.metric)} condition`, { ...戁壍, having: 戁壍.having.filter((晩壍, 蕘壍) => 蕘壍 !== 饺壍) }));
    return 鿟壍;
}
export function pruneForSource(則壍: Catalog, 然壍: ExploreSpec, 逥壍: string): {
    spec: ExploreSpec;
    removed: string[];
} {
    const 崔壍 = sourceTables(則壍, 逥壍);
    const 簃壍 = (髲壍: string) => 崔壍.some((柡壍) => 柡壍.fields.includes(fieldOf(則壍, 髲壍)));
    const 蛐壍 = (县壍: string) => 崔壍.some((犮壍) => 棫壍(則壍, 县壍).includes(犮壍.id));
    const 醝壍 = new Set<string>();
    const 庌壍 = <T>(絻壍: readonly T[], 鱪壍: (楙壍: T) => boolean, 衈壍: (唷壍: T) => string): T[] => 絻壍.filter((琦壍) => {
        if (鱪壍(琦壍))
            return true;
        醝壍.add(衈壍(琦壍));
        return false;
    });
    const 錕壍 = 庌壍(然壍.dimensions, 簃壍, (怄壍) => 骄壍(則壍, 怄壍));
    const 绳壍 = 庌壍(然壍.filters, (鷢壍) => 簃壍(鷢壍.dim), (櫑壍) => `${骄壍(則壍, 櫑壍.dim)} filter`);
    const 觀壍 = 庌壍(然壍.metrics, 蛐壍, (嚯壍) => 牀壍(則壍, 嚯壍));
    const 疞壍 = 庌壍(然壍.having, (钍壍) => 蛐壍(钍壍.metric), (慼壍) => `${牀壍(則壍, 慼壍.metric)} condition`);
    return { spec: normalizeSpec({ ...然壍, source: 逥壍, dimensions: 錕壍, filters: 绳壍, metrics: 觀壍.length ? 觀壍 : ["cost"], having: 疞壍 }), removed: [...醝壍] };
}
