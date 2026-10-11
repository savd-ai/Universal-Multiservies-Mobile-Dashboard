import "server-only";
import { isCivilDate } from "@/lib/domain/dates";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { biddingStrategyLabel, changedResourceKey, changeOperation, changeResourceType, humanizeEnum, matchType, resourceLabel } from "./enums";
import { at, idFromResourceName, isRecord, text, toNumber, type GoogleAdsRow } from "./json";
type DiffValue = string | number | null;
type Diff = ChangeEvent["diffs"][number];
const 窄壍 = 50;
const 饳壍 = 20;
const 晢壍 = 200;
export interface ChangeEventContext {
    accountId: string;
    currency: string;
    budgetCampaigns?: ReadonlyMap<string, readonly string[]>;
}
export function maskEmail(蕑壍: string | undefined): string | undefined {
    const 剀壍 = 蕑壍?.trim();
    if (!剀壍)
        return undefined;
    const 焯壍 = 剀壍.indexOf("@");
    if (焯壍 <= 0)
        return `${剀壍.charAt(0)}•••`;
    return `${剀壍.charAt(0)}•••${剀壍.slice(焯壍)}`;
}
const 逞壍 = (崍壍: string): string => 崍壍.replace(/[A-Z]/g, (篼壍) => `_${篼壍.toLowerCase()}`);
const 髫壍 = (柚壍: string): string[] => 柚壍.split(".").map((蛉壍) => 蛉壍.replace(/_([a-z0-9])/g, (厸壍, 犧壍: string) => 犧壍.toUpperCase()));
function 醖壍(庅壍: unknown): string[] {
    const 絴壍 = typeof 庅壍 === "string" ? 庅壍.split(",") : isRecord(庅壍) && Array.isArray(庅壍.paths) ? 庅壍.paths.filter((鱣壍): 鱣壍 is string => typeof 鱣壍 === "string") : [];
    return [...new Set(絴壍.map((楒壍) => 逞壍(楒壍.trim())).filter(Boolean))].slice(0, 窄壍);
}
function 衁壍(唰壍: unknown, 琟壍: string): unknown {
    let 錎壍 = 唰壍;
    for (const 忽壍 of 髫壍(琟壍)) {
        if (!isRecord(錎壍))
            return undefined;
        錎壍 = 錎壍[忽壍];
    }
    return 錎壍;
}
const 绬壍 = (鷛壍: string): string => (鷛壍.length > 晢壍 ? `${鷛壍.slice(0, 晢壍 - 1)}…` : 鷛壍);
function 櫊壍(覹壍: unknown, 嚨壍: boolean): DiffValue {
    if (覹壍 === undefined || 覹壍 === null)
        return null;
    if (嚨壍) {
        const 疗壍 = toNumber(覹壍);
        return 疗壍 === null ? null : 疗壍 / 1000000;
    }
    if (typeof 覹壍 === "number")
        return 覹壍;
    if (typeof 覹壍 === "string")
        return 绬壍(覹壍);
    if (typeof 覹壍 === "boolean")
        return 覹壍 ? "true" : "false";
    if (Array.isArray(覹壍))
        return 绬壍(覹壍.map((钆壍) => (typeof 钆壍 === "string" ? 钆壍 : JSON.stringify(钆壍))).join(", "));
    return 绬壍(JSON.stringify(覹壍));
}
function 慵壍(聤壍: string, 齓壍: unknown, 求壍: unknown): Diff {
    const 謱壍 = 聤壍.endsWith("_micros");
    return { field: 謱壍 ? 聤壍.slice(0, -"_micros".length) : 聤壍, before: 櫊壍(衁壍(齓壍, 聤壍), 謱壍), after: 櫊壍(衁壍(求壍, 聤壍), 謱壍) };
}
function 堠壍(眏壍: DiffValue, 闾壍: string): string {
    if (typeof 眏壍 !== "number")
        return "—";
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: 闾壍 }).format(眏壍);
    }
    catch {
        return `${眏壍.toFixed(2)} ${闾壍}`;
    }
}
const 拭壍 = (臜壍: DiffValue): string => (typeof 臜壍 === "number" ? `${Math.round(臜壍 * 100)}%` : "—");
const 介壍 = (涺壍: unknown): string => (typeof 涺壍 === "string" && 涺壍 ? ` “${绬壍(涺壍)}”` : "");
interface SummaryInput {
    apiType: string;
    operation: ChangeEvent["operation"];
    paths: string[];
    diffs: Diff[];
    after: unknown;
    currency: string;
}
function 販壍(妘壍: string, 碇壍: Diff, 靶壍: (摥壍: DiffValue) => string): string {
    if (碇壍.before === null)
        return `${妘壍} set to ${靶壍(碇壍.after)}`;
    if (碇壍.after === null)
        return `${妘壍} cleared`;
    return `${妘壍} changed from ${靶壍(碇壍.before)} to ${靶壍(碇壍.after)}`;
}
const 荔壍: Record<string, string> = { ENABLED: "enabled", PAUSED: "paused", REMOVED: "removed" };
function 偃壍(漲壍: SummaryInput): string {
    const 踡壍 = (嬐壍: string) => 漲壍.paths.some((秿壍) => 秿壍 === 嬐壍 || 秿壍.startsWith(`${嬐壍}.`));
    const 飮壍 = (...旝壍: string[]) => 漲壍.diffs.find((蓌壍) => 旝壍.includes(蓌壍.field));
    const 冻壍 = resourceLabel(漲壍.apiType);
    const 炪壍 = (辙壍: DiffValue) => 堠壍(辙壍, 漲壍.currency);
    const 岈壍 = 飮壍("status");
    const 筷壍 = typeof 岈壍?.after === "string" ? 荔壍[岈壍.after] : undefined;
    const 驦壍 = 踡壍("final_urls") || 踡壍("ad.final_urls");
    if (漲壍.apiType === "CAMPAIGN") {
        if (漲壍.operation === "create")
            return `Campaign${介壍(at(漲壍.after, "name"))} created`;
        if (漲壍.operation === "remove")
            return "Campaign removed";
        const 杕壍 = 飮壍("bidding_strategy_type");
        if (杕壍 && typeof 杕壍.after === "string") {
            return typeof 杕壍.before === "string" ? `Bid strategy changed from ${biddingStrategyLabel(杕壍.before)} to ${biddingStrategyLabel(杕壍.after)}` : `Bid strategy changed to ${biddingStrategyLabel(杕壍.after)}`;
        }
        const 虄壍 = 飮壍("target_cpa.target_cpa", "maximize_conversions.target_cpa");
        if (虄壍)
            return 販壍("Target CPA", 虄壍, 炪壍);
        const 匳壍 = 飮壍("target_roas.target_roas", "maximize_conversion_value.target_roas");
        if (匳壍)
            return 販壍("Target ROAS", 匳壍, 拭壍);
        if (筷壍)
            return `Campaign ${筷壍}`;
        const 爢壍 = 飮壍("name");
        if (爢壍 && typeof 爢壍.after === "string")
            return `Campaign renamed to “${爢壍.after}”`;
        const 鄑壍 = 飮壍("end_date_time");
        if (鄑壍)
            return typeof 鄑壍.after === "string" ? `Campaign end date changed to ${鄑壍.after.slice(0, 10)}` : "Campaign end date removed";
        const 帀壍 = 飮壍("start_date_time");
        if (帀壍 && typeof 帀壍.after === "string")
            return `Campaign start date changed to ${帀壍.after.slice(0, 10)}`;
        if (踡壍("campaign_budget"))
            return "Campaign moved to a different budget";
    }
    if (漲壍.apiType === "CAMPAIGN_BUDGET") {
        const 糯壍 = 飮壍("amount");
        if (糯壍)
            return 販壍("Budget", 糯壍, 炪壍);
        const 鯞壍 = 飮壍("total_amount");
        if (鯞壍)
            return 販壍("Total budget", 鯞壍, 炪壍);
        if (漲壍.operation === "create")
            return "Budget created";
    }
    if (漲壍.apiType === "AD_GROUP") {
        if (漲壍.operation === "create")
            return `Ad group${介壍(at(漲壍.after, "name"))} created`;
        if (漲壍.operation === "remove")
            return "Ad group removed";
        if (筷壍)
            return `Ad group ${筷壍}`;
        const 棍壍 = 飮壍("cpc_bid");
        if (棍壍)
            return 販壍("Ad group default bid", 棍壍, 炪壍);
        const 螼壍 = 飮壍("target_cpa");
        if (螼壍)
            return 販壍("Ad group target CPA", 螼壍, 炪壍);
        const 咫壍 = 飮壍("name");
        if (咫壍 && typeof 咫壍.after === "string")
            return `Ad group renamed to “${咫壍.after}”`;
    }
    if (漲壍.apiType === "AD_GROUP_AD" || 漲壍.apiType === "AD") {
        const 玚壍 = at(漲壍.after, 漲壍.apiType === "AD" ? "type" : "ad.type");
        const 銉壍 = at(漲壍.after, 漲壍.apiType === "AD" ? "name" : "ad.name");
        if (漲壍.operation === "create")
            return typeof 銉壍 === "string" && 銉壍 ? `New ad “${绬壍(銉壍)}” created` : typeof 玚壍 === "string" ? `New ${humanizeEnum(玚壍).toLowerCase()} created` : "New ad created";
        if (漲壍.operation === "remove")
            return "Ad removed";
        if (筷壍)
            return `Ad ${筷壍}`;
        if (驦壍)
            return "Final URL changed";
        if (踡壍("responsive_search_ad.headlines") || 踡壍("ad.responsive_search_ad.headlines"))
            return "Responsive search ad headlines edited";
        if (踡壍("responsive_search_ad.descriptions") || 踡壍("ad.responsive_search_ad.descriptions"))
            return "Responsive search ad descriptions edited";
    }
    if (漲壍.apiType === "AD_GROUP_CRITERION" || 漲壍.apiType === "CAMPAIGN_CRITERION") {
        const 彸壍 = at(漲壍.after, "keyword.text");
        const 繧壍 = at(漲壍.after, "negative") === true || 漲壍.apiType === "CAMPAIGN_CRITERION";
        if (漲壍.operation === "create" && typeof 彸壍 === "string") {
            const 鵖壍 = at(漲壍.after, "keyword.matchType");
            return 繧壍 ? `Negative keyword “${绬壍(彸壍)}” added` : `Keyword “${绬壍(彸壍)}” added${typeof 鵖壍 === "string" ? ` (${matchType(鵖壍)} match)` : ""}`;
        }
        if (漲壍.operation === "create" && 踡壍("location"))
            return "Location target added";
        if (漲壍.operation === "remove")
            return 漲壍.apiType === "CAMPAIGN_CRITERION" ? "Campaign targeting criterion removed" : "Keyword or targeting criterion removed";
        if (筷壍)
            return `Keyword ${筷壍}`;
        const 橅壍 = 飮壍("cpc_bid");
        if (橅壍)
            return 販壍("Keyword bid", 橅壍, 炪壍);
        if (驦壍)
            return "Final URL changed";
        const 褴壍 = 飮壍("bid_modifier");
        if (褴壍)
            return 販壍("Bid adjustment", 褴壍, (嘣壍) => (typeof 嘣壍 === "number" ? `${嘣壍 >= 1 ? "+" : ""}${Math.round((嘣壍 - 1) * 100)}%` : "—"));
    }
    if (驦壍)
        return "Final URL changed";
    const 甒壍 = 漲壍.operation === "create" ? "created" : 漲壍.operation === "remove" ? "removed" : "updated";
    const 鐁壍 = 漲壍.operation === "update" && 漲壍.paths.length ? ` (${漲壍.paths.slice(0, 3).join(", ")}${漲壍.paths.length > 3 ? ", …" : ""})` : "";
    return `${冻壍} ${甒壍}${鐁壍}`;
}
export function toChangeEvent(惰壍: GoogleAdsRow, 翟壍: ChangeEventContext): ChangeEvent | null {
    const 黎壍 = text(惰壍, "changeEvent.changeDateTime")?.slice(0, 19);
    const 殽壍 = 黎壍?.slice(0, 10);
    if (!黎壍 || !殽壍 || !isCivilDate(殽壍))
        return null;
    const 説壍 = text(惰壍, "changeEvent.changeResourceType") ?? "UNSPECIFIED";
    const 垛壍 = changeOperation(text(惰壍, "changeEvent.resourceChangeOperation"));
    const 皊壍 = 醖壍(at(惰壍, "changeEvent.changedFields"));
    const 镹壍 = changedResourceKey(説壍);
    const 扨壍 = at(惰壍, `changeEvent.oldResource.${镹壍}`);
    const 腗壍 = at(惰壍, `changeEvent.newResource.${镹壍}`);
    const 乆壍 = 皊壍.slice(0, 饳壍).map((洵壍) => 慵壍(洵壍, 扨壍, 腗壍));
    const 谤壍 = text(惰壍, "changeEvent.changeResourceName");
    let 夓壍 = idFromResourceName(text(惰壍, "changeEvent.campaign")) ?? (説壍 === "CAMPAIGN" ? idFromResourceName(谤壍) : undefined);
    if (!夓壍 && 説壍 === "CAMPAIGN_BUDGET") {
        const 砂壍 = idFromResourceName(谤壍);
        const 雱壍 = 砂壍 ? 翟壍.budgetCampaigns?.get(砂壍) : undefined;
        if (雱壍?.length === 1)
            夓壍 = 雱壍[0];
    }
    const 揠壍 = idFromResourceName(text(惰壍, "changeEvent.adGroup")) ?? (説壍 === "AD_GROUP" ? idFromResourceName(谤壍) : undefined);
    const 苏壍 = idFromResourceName(text(惰壍, "changeEvent.resourceName")) ?? `${黎壍}~${谤壍 ?? 説壍}`;
    return {
        id: `${翟壍.accountId}-ce-${苏壍}`,
        ts: 黎壍,
        date: 殽壍,
        resource_type: changeResourceType(説壍),
        operation: 垛壍,
        campaign_id: 夓壍,
        ad_group_id: 揠壍,
        changed_fields: 皊壍,
        diffs: 乆壍,
        summary: 偃壍({ apiType: 説壍, operation: 垛壍, paths: 皊壍, diffs: 乆壍, after: 腗壍, currency: 翟壍.currency }),
        client_type: text(惰壍, "changeEvent.clientType"),
        actor: maskEmail(text(惰壍, "changeEvent.userEmail")),
    };
}
