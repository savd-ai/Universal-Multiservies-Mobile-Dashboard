import { describe, expect, it } from "vitest";
import { draftChangeCount, draftFromValues, draftTotals, EMPTY_DRAFT, effectiveLocks, effectiveTargets, isDirty, targetsBody, withLock, withTarget, type SavedTargets } from "@/features/budget/lib/drafts";
const saved: SavedTargets = { targets: { c1: 12600, c2: 23400, c3: 37500 }, locks: { c3: true } };
describe("target draft diffing", () => {
    it("records an edit and clears it when the value returns to the saved one", () => {
        const d1 = withTarget(EMPTY_DRAFT, "c1", 14000, saved.targets.c1);
        expect(d1.targets).toEqual({ c1: 14000 });
        expect(isDirty(d1)).toBe(true);
        const d2 = withTarget(d1, "c1", 12600, saved.targets.c1);
        expect(d2.targets).toEqual({});
        expect(isDirty(d2)).toBe(false);
    });
    it("treats sub-cent differences as unchanged", () => {
        expect(withTarget(EMPTY_DRAFT, "c1", 12600.001, 12600).targets).toEqual({});
    });
    it("does not mutate the previous draft", () => {
        const d1 = withTarget(EMPTY_DRAFT, "c1", 14000, 12600);
        const d2 = withTarget(d1, "c2", 20000, 23400);
        expect(d1.targets).toEqual({ c1: 14000 });
        expect(d2.targets).toEqual({ c1: 14000, c2: 20000 });
        expect(EMPTY_DRAFT.targets).toEqual({});
    });
    it("diffs locks against the saved lock", () => {
        const d1 = withLock(EMPTY_DRAFT, "c1", true, saved.locks.c1);
        expect(d1.locks).toEqual({ c1: true });
        const d2 = withLock(d1, "c3", false, saved.locks.c3);
        expect(d2.locks).toEqual({ c1: true, c3: false });
        expect(withLock(d2, "c1", false, saved.locks.c1).locks).toEqual({ c3: false });
        expect(effectiveLocks(saved, d2)).toEqual({ c1: true, c3: false });
    });
    it("builds a draft from a full set of values, keeping only real changes and lock edits", () => {
        const base = withLock(EMPTY_DRAFT, "c2", true, false);
        const d = draftFromValues({ c1: 12600, c2: 11700, c3: 43500 }, saved, base);
        expect(d.targets).toEqual({ c2: 11700, c3: 43500 });
        expect(d.locks).toEqual({ c2: true });
        expect(draftChangeCount(d)).toEqual({ targets: 2, locks: 1, total: 3 });
    });
    it("computes effective values and totals", () => {
        const d = withTarget(EMPTY_DRAFT, "c2", 25000, 23400);
        expect(effectiveTargets(saved, d)).toEqual({ c1: 12600, c2: 25000, c3: 37500 });
        expect(draftTotals(saved, d)).toEqual({ before: 73500, after: 75100 });
        expect(draftTotals(saved, null)).toEqual({ before: 73500, after: 73500 });
    });
    it("PUT body keeps only non-default targets and true locks", () => {
        const defaults = { c1: 12600, c2: 23400, c3: 37500 };
        const body = targetsBody("2026-09", defaults, { c1: 12600, c2: 25000.004, c3: 37500 }, { c1: false, c3: true });
        expect(body).toEqual({ month: "2026-09", targets: { c2: 25000 }, locks: { c3: true } });
    });
    it("PUT body drops invalid amounts", () => {
        expect(targetsBody("2026-09", {}, { c1: -1, c2: Number.NaN, c3: 50 }, {}).targets).toEqual({ c3: 50 });
    });
});
