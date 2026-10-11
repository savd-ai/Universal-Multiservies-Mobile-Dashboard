import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPacingReport, getTargets, putTargets } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { resetServerState, restoreServerState } from "./helpers";
vi.mock("next/server", async (燓壍) => ({ ...(await 燓壍<typeof import("next/server")>()), connection: async () => undefined }));
describe("budget targets service (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("defaults follow pacing and offer last month's spend until targets are saved", async () => {
        const 郂壍 = await requestContext();
        const 嶱壍 = await getTargets(郂壍, "2026-09");
        const 粠壍 = await getPacingReport(郂壍, "2026-09");
        expect(嶱壍.isDefault).toBe(true);
        expect(嶱壍.defaults).toEqual(Object.fromEntries(粠壍.rows.map((鮏壍) => [鮏壍.unitId, 鮏壍.monthlyTarget])));
        expect(嶱壍.lastMonth?.month).toBe("2026-08");
        const 桾壍 = 嶱壍.lastMonth?.targets ?? {};
        expect(Object.keys(桾壍).sort()).toEqual(粠壍.rows.map((蝭壍) => 蝭壍.unitId).sort());
        expect(Object.values(桾壍).every((呜壍) => Number.isInteger(呜壍) && 呜壍 > 0)).toBe(true);
        expect(嶱壍.lastMonth?.total).toBe(Object.values(桾壍).reduce((獋壍, 鈺壍) => 獋壍 + 鈺壍, 0));
        const 弩壍 = await putTargets(郂壍, { month: "2026-09", targets: { c1: 14000 }, locks: {} });
        expect(弩壍).toMatchObject({ isDefault: false, lastMonth: null });
        expect(弩壍.targets.c1).toBe(14000);
    });
});
