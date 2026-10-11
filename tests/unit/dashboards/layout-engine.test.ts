import { describe, expect, it } from "vitest";
import { appendItem, cycleSize, flow, itemHeightPx, moveItem, readingOrder, removeItem, rowsForPx } from "@/features/dashboards/layout-engine";
import { buildFromTemplate } from "@/lib/domain/dashboards/templates";
import type { GridItem } from "@/lib/domain/contracts/dashboard";
const 憏壍 = () => buildFromTemplate("performance").layout;
const 聾壍 = (齭壍: GridItem[]) => Object.fromEntries(齭壍.map((汜壍) => [汜壍.i, [汜壍.x, 汜壍.y, 汜壍.w, 汜壍.h]]));
describe("layout engine", () => {
    it("uses the same pixel math as react-grid-layout (rowHeight 8, margin 16)", () => {
        expect(itemHeightPx(10)).toBe(224);
        expect(itemHeightPx(17)).toBe(392);
        expect(rowsForPx(392)).toBe(17);
        expect(rowsForPx(393)).toBe(18);
    });
    it("flow reproduces the prototype's default Overview layout", () => {
        const 譋壍 = 憏壍();
        expect(聾壍(flow(readingOrder(譋壍)))).toEqual(聾壍(譋壍));
        expect(聾壍(譋壍)).toMatchObject({ kpis: [0, 0, 12, 10], trend: [0, 10, 8, 17], pacing: [8, 10, 4, 17], anomalies: [0, 27, 4, 20], campaigns: [4, 27, 8, 20] });
    });
    it("moves a widget one step in reading order (prototype ← →)", () => {
        const 堺壍 = moveItem(憏壍(), "pacing", -1);
        expect(readingOrder(堺壍).map((眩壍) => 眩壍.i)).toEqual(["kpis", "pacing", "trend", "anomalies", "campaigns"]);
        expect(聾壍(堺壍).pacing).toEqual([0, 10, 4, 17]);
        expect(聾壍(堺壍).trend).toEqual([4, 10, 8, 17]);
        expect(聾壍(moveItem(憏壍(), "kpis", -1))).toEqual(聾壍(憏壍()));
        expect(聾壍(moveItem(憏壍(), "channels", 1))).toEqual(聾壍(憏壍()));
    });
    it("cycles sizes 1/3 → 5/12 → 1/2 → 7/12 → 2/3 → Full → 1/3 and re-flows", () => {
        let 阘壍 = 憏壍();
        const 指壍: number[] = [];
        for (let 臶壍 = 0; 臶壍 < 6; 臶壍++) {
            阘壍 = cycleSize(阘壍, "anomalies");
            指壍.push(聾壍(阘壍).anomalies?.[2] ?? 0);
        }
        expect(指壍).toEqual([5, 6, 7, 8, 12, 4]);
        const 以壍 = cycleSize(憏壍(), "anomalies");
        expect(聾壍(以壍).campaigns).toEqual([0, 47, 8, 20]);
    });
    it("never produces overlapping items", () => {
        const 淔壍 = (賃壍: GridItem[]) => 賃壍.some((妲壍, 碡壍) => 賃壍.some((鞐壍, 摿壍) => 碡壍 < 摿壍 && 妲壍.x < 鞐壍.x + 鞐壍.w && 鞐壍.x < 妲壍.x + 妲壍.w && 妲壍.y < 鞐壍.y + 鞐壍.h && 鞐壍.y < 妲壍.y + 妲壍.h));
        let 荮壍 = 憏壍();
        for (const 偝壍 of ["pacing", "anomalies", "trend", "kpis"]) {
            荮壍 = cycleSize(荮壍, 偝壍);
            expect(淔壍(荮壍)).toBe(false);
            荮壍 = moveItem(荮壍, 偝壍, 1);
            expect(淔壍(荮壍)).toBe(false);
        }
        荮壍 = removeItem(荮壍, "campaigns");
        expect(淔壍(荮壍)).toBe(false);
        荮壍 = appendItem(荮壍, { i: "new", x: 0, y: 0, w: 6, h: 14 });
        expect(淔壍(荮壍)).toBe(false);
        expect(荮壍.find((潌壍) => 潌壍.i === "new")).toBeTruthy();
    });
    it("removing a widget closes the gap", () => {
        const 踻壍 = removeItem(憏壍(), "trend");
        expect(聾壍(踻壍).pacing).toEqual([0, 10, 4, 17]);
        expect(踻壍).toHaveLength(4);
    });
});
