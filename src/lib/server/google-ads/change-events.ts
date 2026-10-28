import "server-only";
import { isCivilDate } from "@/lib/domain/dates";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { biddingStrategyLabel, changedResourceKey, changeOperation, changeResourceType, humanizeEnum, matchType, resourceLabel } from "./enums";
import { at, idFromResourceName, isRecord, text, toNumber, type GoogleAdsRow } from "./json";
type DiffValue = string | number | null;
type Diff = ChangeEvent["diffs"][number];
const MAX_FIELDS = 50;
const MAX_DIFFS = 20;
const MAX_VALUE = 200;
export interface ChangeEventContext {
    accountId: string;
    currency: string;
    budgetCampaigns?: ReadonlyMap<string, readonly string[]>;
}
export function maskEmail(email: string | undefined): string | undefined {
    const e = email?.trim();
    if (!e)
        return undefined;
    const atSign = e.indexOf("@");
    if (atSign <= 0)
        return `${e.charAt(0)}•••`;
    return `${e.charAt(0)}•••${e.slice(atSign)}`;
}
const snake = (path: string): string => path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camelSegments = (path: string): string[] => path.split(".").map((seg) => seg.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase()));
function changedPaths(value: unknown): string[] {
    const raw = typeof value === "string" ? value.split(",") : isRecord(value) && Array.isArray(value.paths) ? value.paths.filter((p): p is string => typeof p === "string") : [];
    return [...new Set(raw.map((p) => snake(p.trim())).filter(Boolean))].slice(0, MAX_FIELDS);
}
function valueAt(entity: unknown, path: string): unknown {
    let cur = entity;
    for (const key of camelSegments(path)) {
        if (!isRecord(cur))
            return undefined;
        cur = cur[key];
    }
    return cur;
}
const clip = (s: string): string => (s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s);
function display(value: unknown, micros: boolean): DiffValue {
    if (value === undefined || value === null)
        return null;
    if (micros) {
        const n = toNumber(value);
        return n === null ? null : n / 1000000;
    }
    if (typeof value === "number")
        return value;
    if (typeof value === "string")
        return clip(value);
    if (typeof value === "boolean")
        return value ? "true" : "false";
    if (Array.isArray(value))
        return clip(value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", "));
    return clip(JSON.stringify(value));
}
function diffFor(path: string, before: unknown, after: unknown): Diff {
    const micros = path.endsWith("_micros");
    return { field: micros ? path.slice(0, -"_micros".length) : path, before: display(valueAt(before, path), micros), after: display(valueAt(after, path), micros) };
}
function money(value: DiffValue, currency: string): string {
    if (typeof value !== "number")
        return "—";
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
    }
    catch {
        return `${value.toFixed(2)} ${currency}`;
    }
}
const percent = (value: DiffValue): string => (typeof value === "number" ? `${Math.round(value * 100)}%` : "—");
const quoted = (value: unknown): string => (typeof value === "string" && value ? ` “${clip(value)}”` : "");
interface SummaryInput {
    apiType: string;
    operation: ChangeEvent["operation"];
    paths: string[];
    diffs: Diff[];
    after: unknown;
    currency: string;
}
function change(what: string, d: Diff, fmt: (v: DiffValue) => string): string {
    if (d.before === null)
        return `${what} set to ${fmt(d.after)}`;
    if (d.after === null)
        return `${what} cleared`;
    return `${what} changed from ${fmt(d.before)} to ${fmt(d.after)}`;
}
const STATUS_VERB: Record<string, string> = { ENABLED: "enabled", PAUSED: "paused", REMOVED: "removed" };
function summarize(s: SummaryInput): string {
    const has = (p: string) => s.paths.some((x) => x === p || x.startsWith(`${p}.`));
    const diff = (...fields2: string[]) => s.diffs.find((d) => fields2.includes(d.field));
    const label = resourceLabel(s.apiType);
    const cash = (v: DiffValue) => money(v, s.currency);
    const statusDiff = diff("status");
    const statusVerb = typeof statusDiff?.after === "string" ? STATUS_VERB[statusDiff.after] : undefined;
    const finalUrl = has("final_urls") || has("ad.final_urls");
    if (s.apiType === "CAMPAIGN") {
        if (s.operation === "create")
            return `Campaign${quoted(at(s.after, "name"))} created`;
        if (s.operation === "remove")
            return "Campaign removed";
        const bid = diff("bidding_strategy_type");
        if (bid && typeof bid.after === "string") {
            return typeof bid.before === "string" ? `Bid strategy changed from ${biddingStrategyLabel(bid.before)} to ${biddingStrategyLabel(bid.after)}` : `Bid strategy changed to ${biddingStrategyLabel(bid.after)}`;
        }
        const cpa = diff("target_cpa.target_cpa", "maximize_conversions.target_cpa");
        if (cpa)
            return change("Target CPA", cpa, cash);
        const roas = diff("target_roas.target_roas", "maximize_conversion_value.target_roas");
        if (roas)
            return change("Target ROAS", roas, percent);
        if (statusVerb)
            return `Campaign ${statusVerb}`;
        const name = diff("name");
        if (name && typeof name.after === "string")
            return `Campaign renamed to “${name.after}”`;
        const endDate = diff("end_date_time");
        if (endDate)
            return typeof endDate.after === "string" ? `Campaign end date changed to ${endDate.after.slice(0, 10)}` : "Campaign end date removed";
        const startDate = diff("start_date_time");
        if (startDate && typeof startDate.after === "string")
            return `Campaign start date changed to ${startDate.after.slice(0, 10)}`;
        if (has("campaign_budget"))
            return "Campaign moved to a different budget";
    }
    if (s.apiType === "CAMPAIGN_BUDGET") {
        const amount = diff("amount");
        if (amount)
            return change("Budget", amount, cash);
        const total = diff("total_amount");
        if (total)
            return change("Total budget", total, cash);
        if (s.operation === "create")
            return "Budget created";
    }
    if (s.apiType === "AD_GROUP") {
        if (s.operation === "create")
            return `Ad group${quoted(at(s.after, "name"))} created`;
        if (s.operation === "remove")
            return "Ad group removed";
        if (statusVerb)
            return `Ad group ${statusVerb}`;
        const bid = diff("cpc_bid");
        if (bid)
            return change("Ad group default bid", bid, cash);
        const cpa = diff("target_cpa");
        if (cpa)
            return change("Ad group target CPA", cpa, cash);
        const name = diff("name");
        if (name && typeof name.after === "string")
            return `Ad group renamed to “${name.after}”`;
    }
    if (s.apiType === "AD_GROUP_AD" || s.apiType === "AD") {
        const adType = at(s.after, s.apiType === "AD" ? "type" : "ad.type");
        const adName = at(s.after, s.apiType === "AD" ? "name" : "ad.name");
        if (s.operation === "create")
            return typeof adName === "string" && adName ? `New ad “${clip(adName)}” created` : typeof adType === "string" ? `New ${humanizeEnum(adType).toLowerCase()} created` : "New ad created";
        if (s.operation === "remove")
            return "Ad removed";
        if (statusVerb)
            return `Ad ${statusVerb}`;
        if (finalUrl)
            return "Final URL changed";
        if (has("responsive_search_ad.headlines") || has("ad.responsive_search_ad.headlines"))
            return "Responsive search ad headlines edited";
        if (has("responsive_search_ad.descriptions") || has("ad.responsive_search_ad.descriptions"))
            return "Responsive search ad descriptions edited";
    }
    if (s.apiType === "AD_GROUP_CRITERION" || s.apiType === "CAMPAIGN_CRITERION") {
        const keyword = at(s.after, "keyword.text");
        const negative = at(s.after, "negative") === true || s.apiType === "CAMPAIGN_CRITERION";
        if (s.operation === "create" && typeof keyword === "string") {
            const match = at(s.after, "keyword.matchType");
            return negative ? `Negative keyword “${clip(keyword)}” added` : `Keyword “${clip(keyword)}” added${typeof match === "string" ? ` (${matchType(match)} match)` : ""}`;
        }
        if (s.operation === "create" && has("location"))
            return "Location target added";
        if (s.operation === "remove")
            return s.apiType === "CAMPAIGN_CRITERION" ? "Campaign targeting criterion removed" : "Keyword or targeting criterion removed";
        if (statusVerb)
            return `Keyword ${statusVerb}`;
        const bid = diff("cpc_bid");
        if (bid)
            return change("Keyword bid", bid, cash);
        if (finalUrl)
            return "Final URL changed";
        const modifier = diff("bid_modifier");
        if (modifier)
            return change("Bid adjustment", modifier, (v) => (typeof v === "number" ? `${v >= 1 ? "+" : ""}${Math.round((v - 1) * 100)}%` : "—"));
    }
    if (finalUrl)
        return "Final URL changed";
    const verb = s.operation === "create" ? "created" : s.operation === "remove" ? "removed" : "updated";
    const fields = s.operation === "update" && s.paths.length ? ` (${s.paths.slice(0, 3).join(", ")}${s.paths.length > 3 ? ", …" : ""})` : "";
    return `${label} ${verb}${fields}`;
}
export function toChangeEvent(row: GoogleAdsRow, ctx: ChangeEventContext): ChangeEvent | null {
    const ts = text(row, "changeEvent.changeDateTime")?.slice(0, 19);
    const date = ts?.slice(0, 10);
    if (!ts || !date || !isCivilDate(date))
        return null;
    const apiType = text(row, "changeEvent.changeResourceType") ?? "UNSPECIFIED";
    const operation = changeOperation(text(row, "changeEvent.resourceChangeOperation"));
    const paths = changedPaths(at(row, "changeEvent.changedFields"));
    const key = changedResourceKey(apiType);
    const before = at(row, `changeEvent.oldResource.${key}`);
    const after = at(row, `changeEvent.newResource.${key}`);
    const diffs = paths.slice(0, MAX_DIFFS).map((p) => diffFor(p, before, after));
    const changed = text(row, "changeEvent.changeResourceName");
    let campaignId = idFromResourceName(text(row, "changeEvent.campaign")) ?? (apiType === "CAMPAIGN" ? idFromResourceName(changed) : undefined);
    if (!campaignId && apiType === "CAMPAIGN_BUDGET") {
        const budgetId = idFromResourceName(changed);
        const owners = budgetId ? ctx.budgetCampaigns?.get(budgetId) : undefined;
        if (owners?.length === 1)
            campaignId = owners[0];
    }
    const adGroupId = idFromResourceName(text(row, "changeEvent.adGroup")) ?? (apiType === "AD_GROUP" ? idFromResourceName(changed) : undefined);
    const eventId = idFromResourceName(text(row, "changeEvent.resourceName")) ?? `${ts}~${changed ?? apiType}`;
    return {
        id: `${ctx.accountId}-ce-${eventId}`,
        ts,
        date,
        resource_type: changeResourceType(apiType),
        operation,
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        changed_fields: paths,
        diffs,
        summary: summarize({ apiType, operation, paths, diffs, after, currency: ctx.currency }),
        client_type: text(row, "changeEvent.clientType"),
        actor: maskEmail(text(row, "changeEvent.userEmail")),
    };
}
