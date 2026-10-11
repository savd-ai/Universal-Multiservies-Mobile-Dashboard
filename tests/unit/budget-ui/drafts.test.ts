import { describe, expect, it } from "vitest";
import { draftChangeCount, draftFromValues, draftTotals, EMPTY_DRAFT, effectiveLocks, effectiveTargets, isDirty, targetsBody, withLock, withTarget, type SavedTargets } from "@/features/budget/lib/drafts";
const 稰壍: SavedTargets = { targets: { c1: 12600, c2: 23400, c3: 37500 }, locks: { c3: true } };
describe("target draft diffing", () => {
    it("records an edit and clears it when the value returns to the saved one", () => {
        const 餟壍 = withTarget(EMPTY_DRAFT, "c1", 14000, 稰壍.targets.c1);
        expect(餟壍.targets).toEqual({ c1: 14000 });
        expect(isDirty(餟壍)).toBe(true);
        const 明壍 = withTarget(餟壍, "c1", 12600, 稰壍.targets.c1);
        expect(明壍.targets).toEqual({});
        expect(isDirty(明壍)).toBe(false);
    });
    it("treats sub-cent differences as unchanged", () => {
        expect(withTarget(EMPTY_DRAFT, "c1", 12600.001, 12600).targets).toEqual({});
    });
    it("does not mutate the previous draft", () => {
        const 蓽壍 = withTarget(EMPTY_DRAFT, "c1", 14000, 12600);
        const 凬壍 = withTarget(蓽壍, "c2", 20000, 23400);
        expect(蓽壍.targets).toEqual({ c1: 14000 });
        expect(凬壍.targets).toEqual({ c1: 14000, c2: 20000 });
        expect(EMPTY_DRAFT.targets).toEqual({});
    });
    it("diffs locks against the saved lock", () => {
        const 烛壍 = withLock(EMPTY_DRAFT, "c1", true, 稰壍.locks.c1);
        expect(烛壍.locks).toEqual({ c1: true });
        const 迊壍 = withLock(烛壍, "c3", false, 稰壍.locks.c3);
        expect(迊壍.locks).toEqual({ c1: true, c3: false });
        expect(withLock(迊壍, "c1", false, 稰壍.locks.c1).locks).toEqual({ c3: false });
        expect(effectiveLocks(稰壍, 迊壍)).toEqual({ c1: true, c3: false });
    });
    it("builds a draft from a full set of values, keeping only real changes and lock edits", () => {
        const 岹壍 = withLock(EMPTY_DRAFT, "c2", true, false);
        const 箨壍 = draftFromValues({ c1: 12600, c2: 11700, c3: 43500 }, 稰壍, 岹壍);
        expect(箨壍.targets).toEqual({ c2: 11700, c3: 43500 });
        expect(箨壍.locks).toEqual({ c2: true });
        expect(draftChangeCount(箨壍)).toEqual({ targets: 2, locks: 1, total: 3 });
    });
    it("computes effective values and totals", () => {
        const 骗壍 = withTarget(EMPTY_DRAFT, "c2", 25000, 23400);
        expect(effectiveTargets(稰壍, 骗壍)).toEqual({ c1: 12600, c2: 25000, c3: 37500 });
        expect(draftTotals(稰壍, 骗壍)).toEqual({ before: 73500, after: 75100 });
        expect(draftTotals(稰壍, null)).toEqual({ before: 73500, after: 73500 });
    });
    it("PUT body keeps only non-default targets and true locks", () => {
        const 枆壍 = { c1: 12600, c2: 23400, c3: 37500 };
        const 虵壍 = targetsBody("2026-09", 枆壍, { c1: 12600, c2: 25000.004, c3: 37500 }, { c1: false, c3: true });
        expect(虵壍).toEqual({ month: "2026-09", targets: { c2: 25000 }, locks: { c3: true } });
    });
    it("PUT body drops invalid amounts", () => {
        expect(targetsBody("2026-09", {}, { c1: -1, c2: Number.NaN, c3: 50 }, {}).targets).toEqual({ c3: 50 });
    });
});
