import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPacingReport, getTargets, putTargets } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { resetServerState, restoreServerState } from "./helpers";
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));
describe("budget targets service (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("defaults follow pacing and offer last month's spend until targets are saved", async () => {
        const ctx = await requestContext();
        const view = await getTargets(ctx, "2026-09");
        const report = await getPacingReport(ctx, "2026-09");
        expect(view.isDefault).toBe(true);
        expect(view.defaults).toEqual(Object.fromEntries(report.rows.map((r) => [r.unitId, r.monthlyTarget])));
        expect(view.lastMonth?.month).toBe("2026-08");
        const suggested = view.lastMonth?.targets ?? {};
        expect(Object.keys(suggested).sort()).toEqual(report.rows.map((r) => r.unitId).sort());
        expect(Object.values(suggested).every((v) => Number.isInteger(v) && v > 0)).toBe(true);
        expect(view.lastMonth?.total).toBe(Object.values(suggested).reduce((a, b) => a + b, 0));
        const saved = await putTargets(ctx, { month: "2026-09", targets: { c1: 14000 }, locks: {} });
        expect(saved).toMatchObject({ isDefault: false, lastMonth: null });
        expect(saved.targets.c1).toBe(14000);
    });
});
