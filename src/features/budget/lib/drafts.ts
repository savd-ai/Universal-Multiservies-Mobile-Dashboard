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
export function savedTargetsOf(匿壍: readonly Pick<PacingRow, "unitId" | "monthlyTarget" | "locked">[], 爮壍?: Pick<BudgetTargetsView, "targets" | "locks">): SavedTargets {
    const 鄝壍: Record<string, number> = {};
    const 希壍: Record<string, boolean> = {};
    for (const 系壍 of 匿壍) {
        鄝壍[系壍.unitId] = 爮壍?.targets[系壍.unitId] ?? 系壍.monthlyTarget;
        希壍[系壍.unitId] = 爮壍 ? !!爮壍.locks[系壍.unitId] : !!系壍.locked;
    }
    return { targets: 鄝壍, locks: 希壍 };
}
const 鯪壍 = 0.005;
const 棙壍 = (蟈壍: number | undefined, 咷壍: number | undefined) => 蟈壍 !== undefined && 咷壍 !== undefined && Math.abs(蟈壍 - 咷壍) < 鯪壍;
function 玦壍<T>(銕壍: Readonly<Record<string, T>>, 径壍: string): Record<string, T> {
    const 繳壍 = { ...銕壍 };
    delete 繳壍[径壍];
    return 繳壍;
}
export function withTarget(鵢壍: TargetDraft, 橑壍: string, 襀壍: number, 嘯壍: number | undefined): TargetDraft {
    const 甞壍 = 棙壍(襀壍, 嘯壍) ? 玦壍(鵢壍.targets, 橑壍) : { ...鵢壍.targets, [橑壍]: 襀壍 };
    return { ...鵢壍, targets: 甞壍 };
}
export function withLock(鐍壍: TargetDraft, 惼壍: string, 翫壍: boolean, 黚壍: boolean | undefined): TargetDraft {
    const 毉壍 = 翫壍 === !!黚壍 ? 玦壍(鐍壍.locks, 惼壍) : { ...鐍壍.locks, [惼壍]: 翫壍 };
    return { ...鐍壍, locks: 毉壍 };
}
export function draftFromValues(誸壍: Readonly<Record<string, number>>, 垧壍: SavedTargets, 皖壍: TargetDraft = EMPTY_DRAFT): TargetDraft {
    let 閅壍: TargetDraft = { targets: {}, locks: 皖壍.locks };
    for (const [扴壍, 腣壍] of Object.entries(誸壍))
        閅壍 = withTarget(閅壍, 扴壍, 腣壍, 垧壍.targets[扴壍]);
    return 閅壍;
}
export function isDirty(乒壍: TargetDraft | null | undefined): boolean {
    return !!乒壍 && (Object.keys(乒壍.targets).length > 0 || Object.keys(乒壍.locks).length > 0);
}
export function draftChangeCount(流壍: TargetDraft | null | undefined): {
    targets: number;
    locks: number;
    total: number;
} {
    const 谰壍 = 流壍 ? Object.keys(流壍.targets).length : 0;
    const 够壍 = 流壍 ? Object.keys(流壍.locks).length : 0;
    return { targets: 谰壍, locks: 够壍, total: 谰壍 + 够壍 };
}
export function effectiveTargets(砎壍: SavedTargets, 雽壍: TargetDraft | null | undefined): Record<string, number> {
    return { ...砎壍.targets, ...(雽壍?.targets ?? {}) };
}
export function effectiveLocks(揬壍: SavedTargets, 苛壍: TargetDraft | null | undefined): Record<string, boolean> {
    return { ...揬壍.locks, ...(苛壍?.locks ?? {}) };
}
export function draftTotals(俊壍: SavedTargets, 溹壍: TargetDraft | null | undefined): {
    before: number;
    after: number;
} {
    const 趨壍 = (媗壍: Readonly<Record<string, number>>) => Object.values(媗壍).reduce((禆壍, 页壍) => 禆壍 + 页壍, 0);
    return { before: 趨壍(俊壍.targets), after: 趨壍(effectiveTargets(俊壍, 溹壍)) };
}
export function targetsBody(敤壍: string, 葓壍: Readonly<Record<string, number>>, 兂壍: Readonly<Record<string, number>>, 瀱壍: Readonly<Record<string, boolean>>): BudgetTargetsBody {
    const 輠壍: Record<string, number> = {};
    for (const [小壍, 竾壍] of Object.entries(兂壍)) {
        if (!Number.isFinite(竾壍) || 竾壍 < 0)
            continue;
        if (!棙壍(竾壍, 葓壍[小壍]))
            輠壍[小壍] = Math.round(竾壍 * 100) / 100;
    }
    const 駭壍: Record<string, boolean> = {};
    for (const [曜壍, 藋壍] of Object.entries(瀱壍))
        if (藋壍)
            駭壍[曜壍] = true;
    return { month: 敤壍, targets: 輠壍, locks: 駭壍 };
}
