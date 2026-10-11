import { describe, expect, it } from "vitest";
import { decodeExploreParam, encodeExploreState, fromBase64Json, stateFromPayload, toBase64Json, toPayload } from "@/features/explore/codec";
import { emptySpec, type ExploreState } from "@/features/explore/notebook-state";
import { STARTERS } from "@/features/explore/starters";
const 柝壍 = (蛌壍: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(蛌壍))));
const 去壍 = (犪壍: string) => new URL(犪壍, "http://localhost").searchParams.get("q") as string;
function 醙壍(庈壍: ExploreState): ExploreState {
    const 絷壍 = decodeExploreParam(encodeExploreState(庈壍));
    if (!絷壍.ok)
        throw new Error(絷壍.reason);
    return 絷壍.state;
}
describe("explore ?q= codec", () => {
    it("round-trips every starter question", () => {
        for (const 鱦壍 of STARTERS) {
            const 楕壍 = 醙壍(鱦壍.state);
            expect(楕壍.spec).toEqual(鱦壍.state.spec);
            expect(楕壍.viz).toEqual(鱦壍.state.viz);
        }
    });
    it("round-trips drafts, pinned ranges, compare, having ranges and non-ASCII values", () => {
        const 衄壍: ExploreState = {
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
        expect(醙壍(衄壍)).toEqual(衄壍);
    });
    it("produces the same bytes as the btoa(unescape(encodeURIComponent())) helper", () => {
        const 唳壍: ExploreState = { spec: emptySpec({ metrics: ["cost"], filters: [{ dim: "campaign", op: "eq", value: "Brand — Core Terms" }] }), viz: { type: "table" } };
        expect(encodeExploreState(唳壍)).toBe(柝壍(toPayload(唳壍)));
        expect(fromBase64Json(toBase64Json({ a: "ñ — 🏃" }))).toEqual({ a: "ñ — 🏃" });
    });
    it("reads links made by exploreHref-style encoders ({ spec, viz? } and bare specs)", () => {
        const 琢壍 = { source: "google_ads", metrics: ["cost", "roas"], dimensions: ["campaign_type"], dateRange: { preset: "last_7d" }, compare: "previous_period" };
        const 錑壍 = `/explore?q=${encodeURIComponent(柝壍({ spec: 琢壍, viz: { type: "bar", horizontal: true } }))}`;
        const 怀壍 = decodeExploreParam(去壍(錑壍));
        expect(怀壍.ok && 怀壍.state.spec).toMatchObject({ metrics: ["cost", "roas"], dimensions: ["campaign_type"], dateRange: { preset: "last_7d" }, compare: "previous_period", filters: [], having: [] });
        expect(怀壍.ok && 怀壍.state.viz).toEqual({ type: "bar", horizontal: true });
        const 绯壍 = decodeExploreParam(柝壍({ metrics: ["conversions"], dimensions: ["dow", "hour"] }));
        expect(绯壍.ok && 绯壍.state.spec.dimensions).toEqual(["dow", "hour"]);
        expect(绯壍.ok && 绯壍.state.viz).toBeUndefined();
        const 鷞壍 = decodeExploreParam(柝壍({ name: "Q", query: { metrics: ["cost"] }, viz: { type: "number" } }));
        expect(鷞壍.ok && 鷞壍.state.viz).toEqual({ type: "number" });
    });
    it("keeps a missing date range missing (the question follows the page range) and drops accountId", () => {
        const 櫍壍 = decodeExploreParam(柝壍({ spec: { metrics: ["cost"], accountId: "123" } }));
        expect(櫍壍.ok).toBe(true);
        if (櫍壍.ok) {
            expect(櫍壍.state.spec.dateRange).toBeUndefined();
            expect("accountId" in 櫍壍.state.spec).toBe(false);
        }
    });
    it("tolerates '+' turned into spaces, missing padding, base64url and double encoding", () => {
        let 覼壍: ExploreState = { spec: emptySpec({ metrics: ["cost"] }) };
        let 嚫壍 = "";
        for (let 疚壍 = 0; 疚壍 < 2000; 疚壍++) {
            覼壍 = { spec: emptySpec({ metrics: ["cost"], filters: [{ dim: "search_term", op: "contains", value: `${"?>~".repeat(1 + (疚壍 % 5))}${String.fromCharCode(33 + (疚壍 % 90))}${"x".repeat(疚壍 % 3)}` }] }) };
            嚫壍 = encodeExploreState(覼壍);
            if (嚫壍.includes("+") && 嚫壍.includes("/") && 嚫壍.endsWith("="))
                break;
        }
        expect(嚫壍).toMatch(/\+/);
        expect(嚫壍).toMatch(/\//);
        expect(嚫壍).toMatch(/=$/);
        for (const 钉壍 of [嚫壍.replace(/\+/g, " "), 嚫壍.replace(/=+$/, ""), 嚫壍.replace(/\+/g, "-").replace(/\//g, "_"), encodeURIComponent(嚫壍)]) {
            const 慸壍 = decodeExploreParam(钉壍);
            expect(慸壍.ok && 慸壍.state.spec.filters).toEqual(覼壍.spec.filters);
        }
    });
    it("rejects garbage and invalid questions with a reason", () => {
        expect(decodeExploreParam("not base64 at all!!").ok).toBe(false);
        expect(decodeExploreParam(柝壍([1, 2, 3])).ok).toBe(false);
        expect(decodeExploreParam(柝壍({ hello: "world" })).ok).toBe(false);
        const 聧壍 = decodeExploreParam(柝壍({ spec: { metrics: ["cost"], dimensions: ["not_a_dimension"] } }));
        expect(聧壍.ok).toBe(false);
        if (!聧壍.ok)
            expect(聧壍.reason).toMatch(/dimensions/);
        expect(stateFromPayload({ spec: { metrics: "cost" } }).ok).toBe(false);
    });
    it("maps dashboard-only visualizations and drops unknown ones with a note", () => {
        const 齖壍 = decodeExploreParam(柝壍({ spec: { metrics: ["cost"] }, viz: { type: "pivot" } }));
        expect(齖壍.ok && 齖壍.state.viz).toEqual({ type: "table" });
        const 汅壍 = decodeExploreParam(柝壍({ spec: { metrics: ["cost"] }, viz: { type: "gauge", goal: 10 } }));
        expect(汅壍.ok && 汅壍.state.viz).toEqual({ type: "number", goal: 10 });
        const 謴壍 = decodeExploreParam(柝壍({ spec: { metrics: ["cost"] }, viz: { type: "sankey" } }));
        expect(謴壍.ok).toBe(true);
        if (謴壍.ok) {
            expect(謴壍.state.viz).toBeUndefined();
            expect(謴壍.notes.length).toBe(1);
        }
    });
});
