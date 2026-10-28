import { describe, expect, it } from "vitest";
import { decodeExploreParam, encodeExploreState, fromBase64Json, stateFromPayload, toBase64Json, toPayload } from "@/features/explore/codec";
import { emptySpec, type ExploreState } from "@/features/explore/notebook-state";
import { STARTERS } from "@/features/explore/starters";
const legacyEncode = (value: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
const fromHref = (href: string) => new URL(href, "http://localhost").searchParams.get("q") as string;
function roundTrip(state: ExploreState): ExploreState {
    const r = decodeExploreParam(encodeExploreState(state));
    if (!r.ok)
        throw new Error(r.reason);
    return r.state;
}
describe("explore ?q= codec", () => {
    it("round-trips every starter question", () => {
        for (const s of STARTERS) {
            const back = roundTrip(s.state);
            expect(back.spec).toEqual(s.state.spec);
            expect(back.viz).toEqual(s.state.viz);
        }
    });
    it("round-trips drafts, pinned ranges, compare, having ranges and non-ASCII values", () => {
        const state: ExploreState = {
            spec: emptySpec({
                source: "google_ads",
                metrics: [],
                dimensions: ["date", "platform_campaign"],
                filters: [{ dim: "platform_campaign", op: "in", value: ["Brand — Core Terms", "Giày chạy bộ 🏃"] }],
                having: [{ metric: "cpa", op: "between", value: [10, 25.5] }],
                dateRange: { start: "2026-09-01", end: "2026-09-14" },
                compare: "previous_year",
                sort: [{ key: "date", dir: "asc" }],
                limit: 50,
                totals: false,
            }),
            viz: { type: "line", showLegend: true },
        };
        expect(roundTrip(state)).toEqual(state);
    });
    it("produces the same bytes as the btoa(unescape(encodeURIComponent())) helper", () => {
        const state: ExploreState = { spec: emptySpec({ metrics: ["cost"], filters: [{ dim: "campaign", op: "eq", value: "Brand — Core Terms" }] }), viz: { type: "table" } };
        expect(encodeExploreState(state)).toBe(legacyEncode(toPayload(state)));
        expect(fromBase64Json(toBase64Json({ a: "ñ — 🏃" }))).toEqual({ a: "ñ — 🏃" });
    });
    it("reads links made by exploreHref-style encoders ({ spec, viz? } and bare specs)", () => {
        const spec = { source: "google_ads", metrics: ["cost", "roas"], dimensions: ["campaign_type"], dateRange: { preset: "last_7d" }, compare: "previous_period" };
        const href = `/explore?q=${encodeURIComponent(legacyEncode({ spec, viz: { type: "bar", horizontal: true } }))}`;
        const r = decodeExploreParam(fromHref(href));
        expect(r.ok && r.state.spec).toMatchObject({ metrics: ["cost", "roas"], dimensions: ["campaign_type"], dateRange: { preset: "last_7d" }, compare: "previous_period", filters: [], having: [] });
        expect(r.ok && r.state.viz).toEqual({ type: "bar", horizontal: true });
        const bare = decodeExploreParam(legacyEncode({ metrics: ["conversions"], dimensions: ["dow", "hour"] }));
        expect(bare.ok && bare.state.spec.dimensions).toEqual(["dow", "hour"]);
        expect(bare.ok && bare.state.viz).toBeUndefined();
        const saved = decodeExploreParam(legacyEncode({ name: "Q", query: { metrics: ["cost"] }, viz: { type: "number" } }));
        expect(saved.ok && saved.state.viz).toEqual({ type: "number" });
    });
    it("keeps a missing date range missing (the question follows the page range) and drops accountId", () => {
        const r = decodeExploreParam(legacyEncode({ spec: { metrics: ["cost"], accountId: "123" } }));
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.state.spec.dateRange).toBeUndefined();
            expect("accountId" in r.state.spec).toBe(false);
        }
    });
    it("tolerates '+' turned into spaces, missing padding, base64url and double encoding", () => {
        let state: ExploreState = { spec: emptySpec({ metrics: ["cost"] }) };
        let raw = "";
        for (let i = 0; i < 2000; i++) {
            state = { spec: emptySpec({ metrics: ["cost"], filters: [{ dim: "search_term", op: "contains", value: `${"?>~".repeat(1 + (i % 5))}${String.fromCharCode(33 + (i % 90))}${"x".repeat(i % 3)}` }] }) };
            raw = encodeExploreState(state);
            if (raw.includes("+") && raw.includes("/") && raw.endsWith("="))
                break;
        }
        expect(raw).toMatch(/\+/);
        expect(raw).toMatch(/\//);
        expect(raw).toMatch(/=$/);
        for (const variant of [raw.replace(/\+/g, " "), raw.replace(/=+$/, ""), raw.replace(/\+/g, "-").replace(/\//g, "_"), encodeURIComponent(raw)]) {
            const r = decodeExploreParam(variant);
            expect(r.ok && r.state.spec.filters).toEqual(state.spec.filters);
        }
    });
    it("rejects garbage and invalid questions with a reason", () => {
        expect(decodeExploreParam("not base64 at all!!").ok).toBe(false);
        expect(decodeExploreParam(legacyEncode([1, 2, 3])).ok).toBe(false);
        expect(decodeExploreParam(legacyEncode({ hello: "world" })).ok).toBe(false);
        const bad = decodeExploreParam(legacyEncode({ spec: { metrics: ["cost"], dimensions: ["not_a_dimension"] } }));
        expect(bad.ok).toBe(false);
        if (!bad.ok)
            expect(bad.reason).toMatch(/dimensions/);
        expect(stateFromPayload({ spec: { metrics: "cost" } }).ok).toBe(false);
    });
    it("maps dashboard-only visualizations and drops unknown ones with a note", () => {
        const pivot = decodeExploreParam(legacyEncode({ spec: { metrics: ["cost"] }, viz: { type: "pivot" } }));
        expect(pivot.ok && pivot.state.viz).toEqual({ type: "table" });
        const gauge = decodeExploreParam(legacyEncode({ spec: { metrics: ["cost"] }, viz: { type: "gauge", goal: 10 } }));
        expect(gauge.ok && gauge.state.viz).toEqual({ type: "number", goal: 10 });
        const unknown = decodeExploreParam(legacyEncode({ spec: { metrics: ["cost"] }, viz: { type: "sankey" } }));
        expect(unknown.ok).toBe(true);
        if (unknown.ok) {
            expect(unknown.state.viz).toBeUndefined();
            expect(unknown.notes.length).toBe(1);
        }
    });
});
