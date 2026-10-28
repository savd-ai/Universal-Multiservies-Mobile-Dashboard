import { describe, expect, it } from "vitest";
import { appendItem, cycleSize, flow, itemHeightPx, moveItem, readingOrder, removeItem, rowsForPx } from "@/features/dashboards/layout-engine";
import { buildFromTemplate } from "@/lib/domain/dashboards/templates";
import type { GridItem } from "@/lib/domain/contracts/dashboard";
const performance = () => buildFromTemplate("performance").layout;
const pos = (l: GridItem[]) => Object.fromEntries(l.map((i) => [i.i, [i.x, i.y, i.w, i.h]]));
describe("layout engine", () => {
    it("uses the same pixel math as react-grid-layout (rowHeight 8, margin 16)", () => {
        expect(itemHeightPx(10)).toBe(224);
        expect(itemHeightPx(17)).toBe(392);
        expect(rowsForPx(392)).toBe(17);
        expect(rowsForPx(393)).toBe(18);
    });
    it("flow reproduces the prototype's default Overview layout", () => {
        const l = performance();
        expect(pos(flow(readingOrder(l)))).toEqual(pos(l));
        expect(pos(l)).toMatchObject({ kpis: [0, 0, 12, 10], trend: [0, 10, 8, 17], pacing: [8, 10, 4, 17], anomalies: [0, 27, 4, 20], campaigns: [4, 27, 8, 20] });
    });
    it("moves a widget one step in reading order (prototype ← →)", () => {
        const moved = moveItem(performance(), "pacing", -1);
        expect(readingOrder(moved).map((i) => i.i)).toEqual(["kpis", "pacing", "trend", "anomalies", "campaigns"]);
        expect(pos(moved).pacing).toEqual([0, 10, 4, 17]);
        expect(pos(moved).trend).toEqual([4, 10, 8, 17]);
        expect(pos(moveItem(performance(), "kpis", -1))).toEqual(pos(performance()));
        expect(pos(moveItem(performance(), "channels", 1))).toEqual(pos(performance()));
    });
    it("cycles sizes 1/3 → 5/12 → 1/2 → 7/12 → 2/3 → Full → 1/3 and re-flows", () => {
        let l = performance();
        const widths: number[] = [];
        for (let k = 0; k < 6; k++) {
            l = cycleSize(l, "anomalies");
            widths.push(pos(l).anomalies?.[2] ?? 0);
        }
        expect(widths).toEqual([5, 6, 7, 8, 12, 4]);
        const five = cycleSize(performance(), "anomalies");
        expect(pos(five).campaigns).toEqual([0, 47, 8, 20]);
    });
    it("never produces overlapping items", () => {
        const overlaps = (l2: GridItem[]) => l2.some((a, i) => l2.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
        let l = performance();
        for (const id of ["pacing", "anomalies", "trend", "kpis"]) {
            l = cycleSize(l, id);
            expect(overlaps(l)).toBe(false);
            l = moveItem(l, id, 1);
            expect(overlaps(l)).toBe(false);
        }
        l = removeItem(l, "campaigns");
        expect(overlaps(l)).toBe(false);
        l = appendItem(l, { i: "new", x: 0, y: 0, w: 6, h: 14 });
        expect(overlaps(l)).toBe(false);
        expect(l.find((i) => i.i === "new")).toBeTruthy();
    });
    it("removing a widget closes the gap", () => {
        const l = removeItem(performance(), "trend");
        expect(pos(l).pacing).toEqual([0, 10, 4, 17]);
        expect(l).toHaveLength(4);
    });
});
