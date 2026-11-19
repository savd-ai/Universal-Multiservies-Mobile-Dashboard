import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simulateAction } from "@/lib/server/actions/simulate";
import { budgetExport, getPacingReport, getTargets, putTargets } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { resetServerState, restoreServerState } from "./helpers";

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));

// Targets service on the demo account: the defaults are pacing's (a paused campaign's is what it already spent), the
// "use last month's spend" suggestion is there until targets are saved, and the exports applied in Google Ads leave
// out paused defaults and $0 budgets.

describe("budget targets service (demo)", () => {
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

  it("a paused campaign's default is its spend so far, and it stays out of the Editor CSV", async () => {
    await simulateAction(await requestContext(), { type: "campaign.pause", campaignIds: ["c8"] });
    const ctx = await requestContext();
    const row = (await getPacingReport(ctx, "2026-09")).rows.find((r) => r.unitId === "c8");
    expect(row).toMatchObject({ paused: true, status: "paused", recommendedDaily: null });
    expect(row?.monthlyTarget).toBeCloseTo(row?.mtdSpend ?? -1, 2);
    const view = await getTargets(ctx, "2026-09");
    expect(view.defaults.c8).toBe(row?.monthlyTarget);
    expect(view.lastMonth?.targets.c8).toBeUndefined();

    const editor = await budgetExport(ctx, { month: "2026-09", from: "targets", format: "editor" });
    expect(editor.body).not.toContain(",c8,");
    expect(editor.warnings).toContain(`${row?.name}: paused, no monthly target set; not included.`);
    // a saved target for the paused campaign is a plan: it is exported
    await putTargets(ctx, { month: "2026-09", targets: { c8: 9000 }, locks: {} });
    expect((await budgetExport(ctx, { month: "2026-09", from: "targets", format: "editor" })).body).toContain(",c8,300.00,");
    // the detailed CSV lists every row
    expect((await budgetExport(ctx, { month: "2026-09", from: "targets", format: "csv" })).body).toContain("c8");
  });
});
