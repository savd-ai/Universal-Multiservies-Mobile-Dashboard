import type { BudgetTargetsBody, BudgetTargetsView, PacingRow } from "@/lib/domain/contracts/budget";
export interface TargetDraft {
    targets: Readonly<Record<string, number>>;
    locks: Readonly<Record<string, boolean>>;
}
export interface SavedTargets {
    targets: Readonly<Record<string, number>>;
    locks: Readonly<Record<string, boolean>>;
}
export const EMPTY_DRAFT: TargetDraft = { targets: {}, locks: {} };
export function savedTargetsOf(rows: readonly Pick<PacingRow, "unitId" | "monthlyTarget" | "locked">[], view?: Pick<BudgetTargetsView, "targets" | "locks">): SavedTargets {
    const targets: Record<string, number> = {};
    const locks: Record<string, boolean> = {};
    for (const r of rows) {
        targets[r.unitId] = view?.targets[r.unitId] ?? r.monthlyTarget;
        locks[r.unitId] = view ? !!view.locks[r.unitId] : !!r.locked;
    }
    return { targets, locks };
}
const EPS = 0.005;
const same = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && Math.abs(a - b) < EPS;
function without<T>(rec: Readonly<Record<string, T>>, key: string): Record<string, T> {
    const next = { ...rec };
    delete next[key];
    return next;
}
export function withTarget(draft: TargetDraft, unitId: string, value: number, saved: number | undefined): TargetDraft {
    const targets = same(value, saved) ? without(draft.targets, unitId) : { ...draft.targets, [unitId]: value };
    return { ...draft, targets };
}
export function withLock(draft: TargetDraft, unitId: string, locked: boolean, saved: boolean | undefined): TargetDraft {
    const locks = locked === !!saved ? without(draft.locks, unitId) : { ...draft.locks, [unitId]: locked };
    return { ...draft, locks };
}
export function draftFromValues(values: Readonly<Record<string, number>>, saved: SavedTargets, base: TargetDraft = EMPTY_DRAFT): TargetDraft {
    let next: TargetDraft = { targets: {}, locks: base.locks };
    for (const [id, v] of Object.entries(values))
        next = withTarget(next, id, v, saved.targets[id]);
    return next;
}
export function isDirty(draft: TargetDraft | null | undefined): boolean {
    return !!draft && (Object.keys(draft.targets).length > 0 || Object.keys(draft.locks).length > 0);
}
export function draftChangeCount(draft: TargetDraft | null | undefined): {
    targets: number;
    locks: number;
    total: number;
} {
    const targets = draft ? Object.keys(draft.targets).length : 0;
    const locks = draft ? Object.keys(draft.locks).length : 0;
    return { targets, locks, total: targets + locks };
}
export function effectiveTargets(saved: SavedTargets, draft: TargetDraft | null | undefined): Record<string, number> {
    return { ...saved.targets, ...(draft?.targets ?? {}) };
}
export function effectiveLocks(saved: SavedTargets, draft: TargetDraft | null | undefined): Record<string, boolean> {
    return { ...saved.locks, ...(draft?.locks ?? {}) };
}
export function draftTotals(saved: SavedTargets, draft: TargetDraft | null | undefined): {
    before: number;
    after: number;
} {
    const sum = (r: Readonly<Record<string, number>>) => Object.values(r).reduce((s, v) => s + v, 0);
    return { before: sum(saved.targets), after: sum(effectiveTargets(saved, draft)) };
}
export function targetsBody(month: string, defaults: Readonly<Record<string, number>>, targets: Readonly<Record<string, number>>, locks: Readonly<Record<string, boolean>>): BudgetTargetsBody {
    const outTargets: Record<string, number> = {};
    for (const [id, v] of Object.entries(targets)) {
        if (!Number.isFinite(v) || v < 0)
            continue;
        if (!same(v, defaults[id]))
            outTargets[id] = Math.round(v * 100) / 100;
    }
    const outLocks: Record<string, boolean> = {};
    for (const [id, on] of Object.entries(locks))
        if (on)
            outLocks[id] = true;
    return { month, targets: outTargets, locks: outLocks };
}
