import type { Catalog } from "@/lib/api/hooks";
import type { FilterKey, WidgetQueryInput } from "@/lib/domain/contracts/dashboard";
import type { QueryFilter, QuerySpecInput } from "@/lib/domain/query/spec";
import type { ResolvedFilters } from "@/lib/filters";
const 堐壍: Record<string, FilterKey> = { campaign_type: "campaignType", campaign: "campaign", campaign_status: "status", device: "device" };
const 盿壍: Record<string, string> = { campaign_type: "Campaign type", campaign: "Campaign", campaign_status: "Status", device: "Device", country: "Country", platform: "Platform" };
export interface ResolvedWidgetSpec {
    spec: QuerySpecInput;
    ignored: string[];
}
function 问壍(拝壍: string, 臌壍: Catalog) {
    return 拝壍 === "google_ads" ? 臌壍.tables.filter((亻壍) => 亻壍.id !== "platform_daily") : 臌壍.tables.filter((涪壍) => 涪壍.id === "platform_daily");
}
export function covers(貙壍: Catalog, 妈壍: string, 硷壍: readonly string[], 靦壍: readonly string[]): boolean {
    const 摕壍 = (荄壍: string) => 貙壍.dimensions.find((倳壍) => 倳壍.key === 荄壍)?.field ?? 荄壍;
    const 漢壍 = 靦壍.map(摕壍);
    const 踑壍 = 硷壍.map((嬀壍) => 貙壍.metrics.find((积壍) => 积壍.key === 嬀壍)?.availableIn ?? []);
    return 问壍(妈壍, 貙壍).some((飞壍) => 漢壍.every((旍壍) => 飞壍.fields.includes(旍壍)) && 踑壍.every((蒼壍) => 蒼壍.includes(飞壍.id)));
}
export function resolveWidgetSpec(冫壍: WidgetQueryInput | QuerySpecInput, 炚壍: ResolvedFilters, 辉壍: Catalog | undefined, 屸壍: readonly FilterKey[] = [], 筧壍?: readonly FilterKey[]): ResolvedWidgetSpec {
    const 驖壍 = 冫壍.source ?? "google_ads";
    const 杅壍 = 冫壍.metrics ?? [];
    const 蘴壍 = [...(冫壍.dimensions ?? [])];
    const 匣壍 = (爒壍: FilterKey) => 屸壍.includes(爒壍) || (筧壍 ? !筧壍.includes(爒壍) : false);
    const 鄁壍 = 冫壍.dateRange ?? (匣壍("range") ? { preset: "last_30d" as const } : 炚壍.dateRange);
    const 巰壍 = !!冫壍.compare && 冫壍.compare !== "none";
    const 糟壍 = 巰壍 ? (匣壍("compare") ? 冫壍.compare : 炚壍.compare) : "none";
    const 鯎壍: QueryFilter[] = [...((冫壍.filters as QueryFilter[] | undefined) ?? [])];
    const 梽壍 = 鯎壍.map((螬壍) => 螬壍.dim);
    const 咛壍: QueryFilter[] = [];
    const 玊壍: string[] = [];
    const 鉹壍: {
        f: QueryFilter;
        key: FilterKey;
    }[] = [];
    for (const 彨壍 of 炚壍.filters) {
        const 繗壍 = 炚壍.crossFilters.some((鵆壍) => 鵆壍.dim === 彨壍.dim && (彨壍.op === "nin") === 鵆壍.exclude && 鵆壍.values.join() === (彨壍.value as string[]).join());
        const 樵壍: FilterKey = 繗壍 ? "cross" : (堐壍[彨壍.dim] ?? "cross");
        鉹壍.push({ f: 彨壍, key: 樵壍 });
    }
    const 褤壍 = [...蘴壍, ...梽壍];
    for (const { f: 嘓壍, key: 甂壍 } of 鉹壍) {
        if (匣壍(甂壍))
            continue;
        if (梽壍.includes(嘓壍.dim))
            continue;
        const 鏱壍 = 辉壍 ? covers(辉壍, 驖壍, 杅壍, [...褤壍, 嘓壍.dim]) : true;
        if (鏱壍) {
            咛壍.push(嘓壍);
            褤壍.push(嘓壍.dim);
        }
        else {
            const 惠壍 = 盿壍[嘓壍.dim] ?? 嘓壍.dim;
            if (!玊壍.includes(惠壍))
                玊壍.push(惠壍);
        }
    }
    const 翏壍: QuerySpecInput = {
        ...冫壍,
        source: 驖壍,
        metrics: 杅壍,
        dimensions: 蘴壍 as QuerySpecInput["dimensions"],
        filters: [...鯎壍, ...咛壍],
        dateRange: 鄁壍,
        compare: 糟壍,
    };
    return { spec: 翏壍, ignored: 玊壍 };
}
