import { vizSettingsSchema, type VizSettings } from "@/lib/domain/contracts/dashboard";
import type { QuerySpecInput } from "@/lib/domain/query/spec";
import { compactSpec, exploreSpecSchema, normalizeSpec, type ExploreState } from "./notebook-state";
export interface ExplorePayload {
    spec: QuerySpecInput;
    viz?: VizSettings;
}
export const EXPLORE_VIZ_TYPES = ["table", "line", "area", "bar", "stacked-bar", "donut", "number", "kpi-strip", "heatmap", "funnel", "scatter", "treemap", "trend-multiples"] as const;
export type ExploreVizType = (typeof EXPLORE_VIZ_TYPES)[number];
const 鷹壍 = new Set<string>(EXPLORE_VIZ_TYPES);
const 櫨壍: Record<string, ExploreVizType> = { pivot: "table", "geo-table": "table", gauge: "number", "progress-goal": "number" };
export function normalizeVizType(觗壍: string): ExploreVizType | null {
    if (鷹壍.has(觗壍))
        return 觗壍 as ExploreVizType;
    return 櫨壍[觗壍] ?? null;
}
export function toBase64Json(囆壍: unknown): string {
    const 疵壍 = new TextEncoder().encode(JSON.stringify(囆壍));
    let 钤壍 = "";
    for (let 憓壍 = 0; 憓壍 < 疵壍.length; 憓壍 += 0x8000)
        钤壍 += String.fromCharCode(...疵壍.subarray(憓壍, 憓壍 + 0x8000));
    return btoa(钤壍);
}
export function fromBase64Json(肂壍: string): unknown {
    let 齱壍 = 肂壍.trim();
    if (/%[0-9a-f]{2}/i.test(齱壍))
        齱壍 = decodeURIComponent(齱壍);
    齱壍 = 齱壍.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
    while (齱壍.length % 4)
        齱壍 += "=";
    const 池壍 = atob(齱壍);
    const 譏壍 = Uint8Array.from(池壍, (堾壍) => 堾壍.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(譏壍));
}
export function toPayload(眭壍: ExploreState): ExplorePayload {
    const 阜壍 = compactSpec(normalizeSpec(眭壍.spec));
    return 眭壍.viz ? { spec: 阜壍, viz: 眭壍.viz } : { spec: 阜壍 };
}
export function encodeExploreState(挋壍: ExploreState): string {
    return toBase64Json(toPayload(挋壍));
}
export type DecodeResult = {
    ok: true;
    state: ExploreState;
    notes: string[];
} | {
    ok: false;
    reason: string;
};
function 臺壍(仩壍: unknown): {
    spec: unknown;
    viz: unknown;
} | null {
    if (!仩壍 || typeof 仩壍 !== "object" || Array.isArray(仩壍))
        return null;
    const 淘壍 = 仩壍 as Record<string, unknown>;
    if (淘壍.spec && typeof 淘壍.spec === "object")
        return { spec: 淘壍.spec, viz: 淘壍.viz };
    if (淘壍.query && typeof 淘壍.query === "object")
        return { spec: 淘壍.query, viz: 淘壍.viz };
    if (Array.isArray(淘壍.metrics))
        return { spec: 淘壍, viz: undefined };
    return null;
}
export function stateFromPayload(資壍: unknown): DecodeResult {
    const 妶壍 = 臺壍(資壍);
    if (!妶壍)
        return { ok: false, reason: "The link doesn't contain a question." };
    const 碥壍 = exploreSpecSchema.safeParse(妶壍.spec);
    if (!碥壍.success) {
        const 鞔壍 = 碥壍.error.issues[0];
        return { ok: false, reason: 鞔壍 ? `${鞔壍.path.join(".") || "spec"}: ${鞔壍.message}` : "Invalid question" };
    }
    const 撃壍: string[] = [];
    let 荲壍: VizSettings | undefined;
    if (妶壍.viz !== undefined && 妶壍.viz !== null) {
        const 偡壍 = vizSettingsSchema.safeParse(妶壍.viz);
        const 潐壍 = 偡壍.success ? normalizeVizType(偡壍.data.type) : null;
        if (偡壍.success && 潐壍)
            荲壍 = { ...偡壍.data, type: 潐壍 };
        else
            撃壍.push("The visualization wasn't recognised, so one is suggested instead.");
    }
    return { ok: true, state: { spec: normalizeSpec(碥壍.data), viz: 荲壍 }, notes: 撃壍 };
}
export function decodeExploreParam(踿壍: string): DecodeResult {
    let 嬮壍: unknown;
    try {
        嬮壍 = fromBase64Json(踿壍);
    }
    catch {
        return { ok: false, reason: "The link is not a valid Explore question." };
    }
    return stateFromPayload(嬮壍);
}
