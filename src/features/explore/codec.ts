import { vizSettingsSchema, type VizSettings } from "@/lib/domain/contracts/dashboard";
import type { QuerySpecInput } from "@/lib/domain/query/spec";
import { compactSpec, exploreSpecSchema, normalizeSpec, type ExploreState } from "./notebook-state";
export interface ExplorePayload {
    spec: QuerySpecInput;
    viz?: VizSettings;
}
export const EXPLORE_VIZ_TYPES = ["table", "line", "area", "bar", "stacked-bar", "donut", "number", "kpi-strip", "heatmap", "funnel", "scatter", "treemap", "trend-multiples"] as const;
export type ExploreVizType = (typeof EXPLORE_VIZ_TYPES)[number];
const SUPPORTED = new Set<string>(EXPLORE_VIZ_TYPES);
const LEGACY_VIZ: Record<string, ExploreVizType> = { pivot: "table", "geo-table": "table", gauge: "number", "progress-goal": "number" };
export function normalizeVizType(text: string): ExploreVizType | null {
    if (SUPPORTED.has(text))
        return text as ExploreVizType;
    return LEGACY_VIZ[text] ?? null;
}
export function toBase64Json(value: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}
export function fromBase64Json(raw: string): unknown {
    let s = raw.trim();
    if (/%[0-9a-f]{2}/i.test(s))
        s = decodeURIComponent(s);
    s = s.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4)
        s += "=";
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export function toPayload(state: ExploreState): ExplorePayload {
    const spec = compactSpec(normalizeSpec(state.spec));
    return state.viz ? { spec, viz: state.viz } : { spec };
}
export function encodeExploreState(state: ExploreState): string {
    return toBase64Json(toPayload(state));
}
export type DecodeResult = {
    ok: true;
    state: ExploreState;
    notes: string[];
} | {
    ok: false;
    reason: string;
};
function extract(payload: unknown): {
    spec: unknown;
    viz: unknown;
} | null {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return null;
    const o = payload as Record<string, unknown>;
    if (o.spec && typeof o.spec === "object")
        return { spec: o.spec, viz: o.viz };
    if (o.query && typeof o.query === "object")
        return { spec: o.query, viz: o.viz };
    if (Array.isArray(o.metrics))
        return { spec: o, viz: undefined };
    return null;
}
export function stateFromPayload(payload: unknown): DecodeResult {
    const parts = extract(payload);
    if (!parts)
        return { ok: false, reason: "The link doesn't contain a question." };
    const parsed = exploreSpecSchema.safeParse(parts.spec);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return { ok: false, reason: issue ? `${issue.path.join(".") || "spec"}: ${issue.message}` : "Invalid question" };
    }
    const notes: string[] = [];
    let viz: VizSettings | undefined;
    if (parts.viz !== undefined && parts.viz !== null) {
        const v = vizSettingsSchema.safeParse(parts.viz);
        const selected = v.success ? normalizeVizType(v.data.type) : null;
        if (v.success && selected)
            viz = { ...v.data, type: selected };
        else
            notes.push("The visualization wasn't recognised, so one is suggested instead.");
    }
    return { ok: true, state: { spec: normalizeSpec(parsed.data), viz }, notes };
}
export function decodeExploreParam(raw: string): DecodeResult {
    let payload: unknown;
    try {
        payload = fromBase64Json(raw);
    }
    catch {
        return { ok: false, reason: "The link is not a valid Explore question." };
    }
    return stateFromPayload(payload);
}
