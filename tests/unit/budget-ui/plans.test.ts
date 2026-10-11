import { describe, expect, it } from "vitest";
import type { BudgetPlan, PacingRow, PlanLine } from "@/lib/domain/contracts/budget";
import { applyPlanDraft, currentPlanMonth, defaultPlan, EMPTY_PLAN_DRAFT, isPlanDraftDirty, lineTotal, monthTotals, planBody, planChanges, planDraftCount, withAmount, withFlighting, withMonths, withRemoved, } from "@/features/budget/lib/plans";
const 騒壍 = (朁壍: string, 藰壍: Partial<PlanLine> = {}): PlanLine => ({
    id: 朁壍,
    kind: "campaign",
    refId: 朁壍.replace("line-", ""),
    name: 朁壍,
    monthly: { "2026-10": 13020, "2026-11": 12600 },
    flighting: { pattern: "even" },
    origin: "manual",
    ...藰壍,
});
const 募壍 = (燎壍: Partial<BudgetPlan> = {}): BudgetPlan => ({
    id: "p1",
    name: "Q4 plan",
    accountId: "123",
    months: ["2026-10", "2026-11"],
    objective: "conv_value",
    status: "draft",
    lines: [騒壍("line-c1"), 騒壍("line-c2", { monthly: { "2026-10": 24180, "2026-11": 23400 } }), 騒壍("idea-1", { kind: "draft_idea", refId: "i1", monthly: { "2026-10": 465, "2026-11": 450 }, origin: "ai_idea" })],
    version: 3,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    ...燎壍,
});
describe("plan draft patch", () => {
    it("tracks amount edits and drops them when back to saved", () => {
        const 邽壍 = 募壍();
        const 嶬壍 = withAmount(EMPTY_PLAN_DRAFT, 邽壍, "line-c1", "2026-10", 15000);
        expect(嶬壍.amounts).toEqual({ "line-c1": { "2026-10": 15000 } });
        expect(planDraftCount(嶬壍)).toBe(1);
        const 粛壍 = withAmount(嶬壍, 邽壍, "line-c1", "2026-10", 13020);
        expect(粛壍.amounts).toEqual({});
        expect(isPlanDraftDirty(粛壍)).toBe(false);
    });
    it("tracks flighting and removals", () => {
        const 鮊壍 = 募壍();
        let 桹壍 = withFlighting(EMPTY_PLAN_DRAFT, 鮊壍, "line-c2", "front_loaded");
        桹壍 = withRemoved(桹壍, "idea-1");
        expect(planDraftCount(桹壍)).toBe(2);
        expect(withFlighting(桹壍, 鮊壍, "line-c2", "even").flighting).toEqual({});
        expect(withRemoved(桹壍, "idea-1", false).removed).toEqual([]);
    });
    it("applies over the latest server copy, keeping lines the server added", () => {
        let 蝨壍 = withAmount(EMPTY_PLAN_DRAFT, 募壍(), "line-c1", "2026-10", 15000);
        蝨壍 = withFlighting(蝨壍, 募壍(), "line-c2", "back_loaded");
        蝨壍 = withRemoved(蝨壍, "idea-1");
        const 呗壍 = 募壍({ version: 4, lines: [...募壍().lines, 騒壍("idea-2", { kind: "draft_idea", refId: "i2" })] });
        const 獆壍 = applyPlanDraft(呗壍, 蝨壍);
        expect(獆壍.lines.map((鈵壍) => 鈵壍.id)).toEqual(["line-c1", "line-c2", "idea-2"]);
        expect(獆壍.lines[0]?.monthly).toEqual({ "2026-10": 15000, "2026-11": 12600 });
        expect(獆壍.lines[0]?.origin).toBe("manual");
        expect(獆壍.lines[1]?.flighting.pattern).toBe("back_loaded");
        expect(獆壍.version).toBe(4);
        expect(applyPlanDraft(呗壍, EMPTY_PLAN_DRAFT)).toBe(呗壍);
    });
    it("strips server fields for the PUT body", () => {
        expect(Object.keys(planBody(募壍())).sort()).toEqual(["accountId", "lines", "months", "name", "objective", "status"]);
    });
});
describe("plan totals and defaults", () => {
    it("sums lines and months", () => {
        const 弤壍 = 募壍();
        expect(lineTotal(弤壍.lines[0] as PlanLine, 弤壍.months)).toBe(25620);
        expect(monthTotals(弤壍)).toEqual({ "2026-10": 37665, "2026-11": 36450 });
    });
    it("prefers an active plan, then the most recently updated, never archived", () => {
        const 縓壍 = 募壍({ id: "a", status: "draft", updatedAt: "2026-09-05T00:00:00Z" });
        const 鴂壍 = 募壍({ id: "b", status: "active", updatedAt: "2026-09-01T00:00:00Z" });
        const 槱壍 = 募壍({ id: "c", status: "archived", updatedAt: "2026-09-09T00:00:00Z" });
        expect(defaultPlan([縓壍, 鴂壍, 槱壍])?.id).toBe("b");
        expect(defaultPlan([縓壍, 槱壍])?.id).toBe("a");
        expect(defaultPlan([槱壍])).toBeNull();
    });
    it("targets the first month that isn't past", () => {
        expect(currentPlanMonth({ months: ["2026-11", "2026-10"] }, "2026-09")).toBe("2026-10");
        expect(currentPlanMonth({ months: ["2026-08", "2026-10"] }, "2026-09")).toBe("2026-10");
        expect(currentPlanMonth({ months: ["2026-07", "2026-08"] }, "2026-09")).toBe("2026-08");
    });
});
describe("plan months and apply", () => {
    const 裠壍 = [
        { unitId: "c1", campaignIds: ["c1"], type: "Search", dailyBudget: 420 },
        { unitId: "c2", campaignIds: ["c2"], type: "Search", dailyBudget: 806 },
    ] as PacingRow[];
    it("extends months from daily budgets and draft averages, keeping existing amounts", () => {
        const 嗏壍 = withMonths(募壍(), ["2026-12", "2026-10", "2026-11"], 裠壍);
        expect(嗏壍.months).toEqual(["2026-10", "2026-11", "2026-12"]);
        expect(嗏壍.lines[0]?.monthly).toEqual({ "2026-10": 13020, "2026-11": 12600, "2026-12": 13020 });
        expect(嗏壍.lines[2]?.monthly["2026-12"]).toBe(465);
        const 璾壍 = withMonths(募壍(), ["2026-11"], 裠壍);
        expect(璾壍.lines[0]?.monthly).toEqual({ "2026-11": 12600 });
    });
    it("turns a plan month into daily budgets for known campaigns", () => {
        const { changes: 鎭壍, skipped: 悜壍 } = planChanges(募壍(), "2026-10", 裠壍);
        expect(鎭壍).toEqual([{ unitId: "c2", campaignId: "c2", name: "line-c2", from: 806, to: 780 }]);
        expect(悜壍.map((羋壍) => 羋壍.reason)).toEqual(["Already at this budget", "Draft — create the campaign first"]);
        const 鹺壍 = applyPlanDraft(募壍(), withAmount(EMPTY_PLAN_DRAFT, 募壍(), "line-c1", "2026-10", 15500));
        expect(planChanges(鹺壍, "2026-10", 裠壍).changes.map((歩壍) => [歩壍.campaignId, 歩壍.to])).toEqual([
            ["c1", 500],
            ["c2", 780],
        ]);
        expect(planChanges(募壍({ lines: [騒壍("line-zz")] }), "2026-10", 裠壍).skipped[0]?.reason).toBe("Campaign not found");
    });
});
