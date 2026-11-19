import { describe, expect, it } from "vitest";
import type { IdeaSet } from "@/lib/domain/contracts/ai";
import type { BudgetPlan, PacingRow, PlanLine } from "@/lib/domain/contracts/budget";
import {
  applyPlanDraft,
  currentPlanMonth,
  defaultPlan,
  EMPTY_PLAN_DRAFT,
  ideaLineInput,
  inPlanIdeas,
  isPlanDraftDirty,
  lineTotal,
  monthTotals,
  pendingIdeas,
  planBody,
  planChanges,
  planDraftCount,
  withAmount,
  withFlighting,
  withMonths,
  withRemoved,
} from "@/features/budget/lib/plans";

const line = (id: string, over: Partial<PlanLine> = {}): PlanLine => ({
  id,
  kind: "campaign",
  refId: id.replace("line-", ""),
  name: id,
  monthly: { "2026-10": 13_020, "2026-11": 12_600 },
  flighting: { pattern: "even" },
  origin: "manual",
  ...over,
});

const plan = (over: Partial<BudgetPlan> = {}): BudgetPlan => ({
  id: "p1",
  name: "Q4 plan",
  accountId: "123",
  months: ["2026-10", "2026-11"],
  objective: "conv_value",
  status: "draft",
  lines: [line("line-c1"), line("line-c2", { monthly: { "2026-10": 24_180, "2026-11": 23_400 } }), line("idea-1", { kind: "draft_idea", refId: "i1", monthly: { "2026-10": 465, "2026-11": 450 }, origin: "ai_idea" })],
  version: 3,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-02T00:00:00Z",
  ...over,
});

describe("plan draft patch", () => {
  it("tracks amount edits and drops them when back to saved", () => {
    const p = plan();
    const d1 = withAmount(EMPTY_PLAN_DRAFT, p, "line-c1", "2026-10", 15_000);
    expect(d1.amounts).toEqual({ "line-c1": { "2026-10": 15_000 } });
    expect(planDraftCount(d1)).toBe(1);
    const d2 = withAmount(d1, p, "line-c1", "2026-10", 13_020);
    expect(d2.amounts).toEqual({});
    expect(isPlanDraftDirty(d2)).toBe(false);
  });

  it("tracks flighting and removals", () => {
    const p = plan();
    let d = withFlighting(EMPTY_PLAN_DRAFT, p, "line-c2", "front_loaded");
    d = withRemoved(d, "idea-1");
    expect(planDraftCount(d)).toBe(2);
    expect(withFlighting(d, p, "line-c2", "even").flighting).toEqual({});
    expect(withRemoved(d, "idea-1", false).removed).toEqual([]);
  });

  it("applies over the latest server copy, keeping lines the server added", () => {
    let d = withAmount(EMPTY_PLAN_DRAFT, plan(), "line-c1", "2026-10", 15_000);
    d = withFlighting(d, plan(), "line-c2", "back_loaded");
    d = withRemoved(d, "idea-1");
    const latest = plan({ version: 4, lines: [...plan().lines, line("idea-2", { kind: "draft_idea", refId: "i2" })] });
    const out = applyPlanDraft(latest, d);
    expect(out.lines.map((l) => l.id)).toEqual(["line-c1", "line-c2", "idea-2"]);
    expect(out.lines[0]?.monthly).toEqual({ "2026-10": 15_000, "2026-11": 12_600 });
    expect(out.lines[0]?.origin).toBe("manual");
    expect(out.lines[1]?.flighting.pattern).toBe("back_loaded");
    expect(out.version).toBe(4);
    expect(applyPlanDraft(latest, EMPTY_PLAN_DRAFT)).toBe(latest);
  });

  it("strips server fields for the PUT body", () => {
    expect(Object.keys(planBody(plan())).sort()).toEqual(["accountId", "lines", "months", "name", "objective", "status"]);
  });
});

describe("plan totals and defaults", () => {
  it("sums lines and months", () => {
    const p = plan();
    expect(lineTotal(p.lines[0] as PlanLine, p.months)).toBe(25_620);
    expect(monthTotals(p)).toEqual({ "2026-10": 37_665, "2026-11": 36_450 });
    expect(monthTotals(p, (l) => l.kind === "draft_idea")).toEqual({ "2026-10": 465, "2026-11": 450 });
  });

  it("prefers an active plan, then the most recently updated, never archived", () => {
    const a = plan({ id: "a", status: "draft", updatedAt: "2026-09-05T00:00:00Z" });
    const b = plan({ id: "b", status: "active", updatedAt: "2026-09-01T00:00:00Z" });
    const c = plan({ id: "c", status: "archived", updatedAt: "2026-09-09T00:00:00Z" });
    expect(defaultPlan([a, b, c])?.id).toBe("b");
    expect(defaultPlan([a, c])?.id).toBe("a");
    expect(defaultPlan([c])).toBeNull();
  });

  it("targets the first month that isn't past", () => {
    expect(currentPlanMonth({ months: ["2026-11", "2026-10"] }, "2026-09")).toBe("2026-10");
    expect(currentPlanMonth({ months: ["2026-08", "2026-10"] }, "2026-09")).toBe("2026-10");
    expect(currentPlanMonth({ months: ["2026-07", "2026-08"] }, "2026-09")).toBe("2026-08");
  });
});

describe("AI idea drafts", () => {
  const set = (id: string, ideas: Partial<IdeaSet["ideas"][number]>[]): IdeaSet =>
    ({ id, ideas: ideas.map((i, n) => ({ id: `${id}-${n}`, title: `Idea ${n}`, type: "Search", dailyBudget: 15, rationale: "Because", ...i })) }) as unknown as IdeaSet;

  it("collects in-plan ideas across sets, once per id, skipping dismissed", () => {
    const sets = [set("s2", [{ inPlan: true }, { inPlan: false }, { inPlan: true, dismissed: true }]), set("s1", [{ id: "s2-0", inPlan: true }, { inPlan: true }])];
    const ideas = inPlanIdeas(sets);
    expect(ideas.map((i) => [i.id, i.setId])).toEqual([
      ["s2-0", "s2"],
      ["s1-1", "s1"],
    ]);
  });

  it("finds ideas without a draft line and builds the line input", () => {
    const ideas = inPlanIdeas([set("s", [{ id: "i1", inPlan: true }, { id: "i3", inPlan: true, dailyBudget: 25, title: "Feed-only PMax", type: "PMax" }, { id: "i4", inPlan: true, dailyBudget: 0 }])]);
    const pending = pendingIdeas(ideas, plan());
    expect(pending.map((i) => i.id)).toEqual(["i3"]);
    expect(ideaLineInput(pending[0] as (typeof pending)[number])).toEqual({ kind: "draft_idea", refId: "i3", name: "Feed-only PMax", campaignType: "PMax", dailyBudget: 25, notes: "Because" });
    expect(pendingIdeas(ideas, null).map((i) => i.id)).toEqual(["i1", "i3"]);
  });
});

describe("plan months and apply", () => {
  const rows = [
    { unitId: "c1", campaignIds: ["c1"], type: "Search", dailyBudget: 420 },
    { unitId: "c2", campaignIds: ["c2"], type: "Search", dailyBudget: 806 },
  ] as PacingRow[];

  it("extends months from daily budgets and draft averages, keeping existing amounts", () => {
    const out = withMonths(plan(), ["2026-12", "2026-10", "2026-11"], rows);
    expect(out.months).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(out.lines[0]?.monthly).toEqual({ "2026-10": 13_020, "2026-11": 12_600, "2026-12": 13_020 });
    expect(out.lines[2]?.monthly["2026-12"]).toBe(465);
    const shrunk = withMonths(plan(), ["2026-11"], rows);
    expect(shrunk.lines[0]?.monthly).toEqual({ "2026-11": 12_600 });
  });

  it("turns a plan month into daily budgets for known campaigns", () => {
    const { changes, skipped } = planChanges(plan(), "2026-10", rows);
    // c1: 13,020 / 31 = 420 = its daily budget; c2: 24,180 / 31 = 780 vs 806 today
    expect(changes).toEqual([{ unitId: "c2", campaignId: "c2", name: "line-c2", from: 806, to: 780 }]);
    expect(skipped.map((s) => s.reason)).toEqual(["Already at this budget", "AI idea — create the campaign first"]);
    const edited = applyPlanDraft(plan(), withAmount(EMPTY_PLAN_DRAFT, plan(), "line-c1", "2026-10", 15_500));
    expect(planChanges(edited, "2026-10", rows).changes.map((c) => [c.campaignId, c.to])).toEqual([
      ["c1", 500],
      ["c2", 780],
    ]);
    expect(planChanges(plan({ lines: [line("line-zz")] }), "2026-10", rows).skipped[0]?.reason).toBe("Campaign not found");
  });
});
