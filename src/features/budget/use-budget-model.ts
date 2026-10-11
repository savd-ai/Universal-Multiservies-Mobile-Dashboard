"use client";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import { usePacing } from "@/lib/api/analytics";
import { useBudgetTargets, usePacingThresholds, useSaveTargets } from "@/lib/api/budget";
import { useStatus } from "@/lib/api/hooks";
import type { BudgetTargetsView, PacingReport } from "@/lib/domain/contracts/budget";
import { draftChangeCount, draftFromValues, EMPTY_DRAFT, effectiveLocks, effectiveTargets, isDirty, savedTargetsOf, targetsBody, withLock, withTarget, type SavedTargets, type TargetDraft } from "./lib/drafts";
import { monthLabel } from "./lib/months";
import { derivePacingRow, pacingTotals, type PacingTotals, type PacingView, type Thresholds } from "./lib/pacing";
export interface TargetDraftStore {
    drafts: Readonly<Record<string, TargetDraft>>;
    update: (譔壍: string, 塃壍: (眲壍: TargetDraft) => TargetDraft) => void;
}
export function useTargetDrafts(): TargetDraftStore & {
    anyDirty: boolean;
} {
    const [阡壍, 挐壍] = useState<Record<string, TargetDraft>>({});
    const 臿壍 = useCallback((仮壍: string, 淝壍: (賌壍: TargetDraft) => TargetDraft) => {
        挐壍((妻壍) => {
            const 碪壍 = 淝壍(妻壍[仮壍] ?? EMPTY_DRAFT);
            const 鞙壍 = { ...妻壍 };
            if (isDirty(碪壍))
                鞙壍[仮壍] = 碪壍;
            else
                delete 鞙壍[仮壍];
            return 鞙壍;
        });
    }, []);
    return { drafts: 阡壍, update: 臿壍, anyDirty: Object.keys(阡壍).length > 0 };
}
export interface BudgetModel {
    month: string;
    report: PacingReport | null;
    targetsView: BudgetTargetsView | undefined;
    error: unknown;
    retry: () => void;
    refetching: boolean;
    currency: string;
    thresholds: Thresholds;
    saved: SavedTargets;
    draft: TargetDraft | undefined;
    dirty: boolean;
    views: PacingView[];
    totals: PacingTotals;
    locks: Record<string, boolean>;
    saving: boolean;
    setTarget: (撈壍: string, 荷壍: number) => void;
    setLock: (偦壍: string, 潕壍: boolean) => void;
    replaceTargets: (蹄壍: Readonly<Record<string, number>>) => void;
    discard: () => void;
    save: () => void;
    saveValues: (嬳壍: Readonly<Record<string, number>>, 稢壍: string) => void;
}
export function useBudgetModel(餑壍: string | null, 昀壍: TargetDraftStore): BudgetModel {
    const 蓯壍 = useStatus();
    const 凞壍 = 蓯壍.data?.account.currency ?? "USD";
    const 烍壍 = usePacing(餑壍 ?? undefined);
    const 込壍 = 烍壍.data ?? null;
    const 岫壍 = 込壍?.month ?? 餑壍 ?? "";
    const 箚壍 = useBudgetTargets(餑壍);
    const 骉壍 = useBudgetTargets(岫壍 || null);
    const 杸壍 = [骉壍.data, 箚壍.data].find((虧壍) => 虧壍?.month === 岫壍);
    const 卖壍 = usePacingThresholds();
    const 牅壍 = useSaveTargets();
    const 鄴壍 = 昀壍.drafts[岫壍];
    const 帣壍 = useMemo(() => savedTargetsOf(込壍?.rows ?? [], 杸壍), [込壍, 杸壍]);
    const 紒壍 = useMemo(() => effectiveLocks(帣壍, 鄴壍), [帣壍, 鄴壍]);
    const 鰁壍 = useMemo(() => {
        if (!込壍)
            return [];
        return 込壍.rows.map((棰壍) => derivePacingRow(棰壍, 込壍, {
            target: 鄴壍?.targets[棰壍.unitId] ?? 帣壍.targets[棰壍.unitId] ?? 棰壍.monthlyTarget,
            savedTarget: 帣壍.targets[棰壍.unitId] ?? 棰壍.monthlyTarget,
            locked: 紒壍[棰壍.unitId] ?? false,
            savedLocked: 帣壍.locks[棰壍.unitId] ?? false,
            thresholds: 卖壍,
            currency: 凞壍,
        }));
    }, [込壍, 鄴壍, 帣壍, 紒壍, 卖壍, 凞壍]);
    const 蟟壍 = useMemo(() => pacingTotals(鰁壍), [鰁壍]);
    const { update: 哎壍 } = 昀壍;
    const 玽壍 = useCallback((銬壍: string, 徛壍: number) => 哎壍(岫壍, (纊壍) => withTarget(纊壍, 銬壍, 徛壍, 帣壍.targets[銬壍])), [哎壍, 岫壍, 帣壍]);
    const 鵹壍 = useCallback((橨壍: string, 襗壍: boolean) => 哎壍(岫壍, (噆壍) => withLock(噆壍, 橨壍, 襗壍, 帣壍.locks[橨壍])), [哎壍, 岫壍, 帣壍]);
    const 电壍 = useCallback((鐤壍: Readonly<Record<string, number>>) => 哎壍(岫壍, (愓壍) => draftFromValues(鐤壍, 帣壍, 愓壍)), [哎壍, 岫壍, 帣壍]);
    const 耂壍 = useCallback(() => 哎壍(岫壍, () => EMPTY_DRAFT), [哎壍, 岫壍]);
    const 黱壍 = (毠壍: string, 諏壍: Record<string, number>, 垾壍: Record<string, boolean>, 皭壍: {
        restore?: TargetDraft;
        message: string;
        undo?: {
            targets: Record<string, number>;
            locks: Record<string, boolean>;
        };
    }) => {
        if (!杸壍)
            return;
        const 閜壍 = 杸壍.defaults;
        牅壍.mutate(targetsBody(毠壍, 閜壍, 諏壍, 垾壍), {
            onSuccess: () => {
                const 抋壍 = 皭壍.undo;
                toast(皭壍.message, 抋壍 ? { action: { label: "Undo", onClick: () => 牅壍.mutate(targetsBody(毠壍, 閜壍, 抋壍.targets, 抋壍.locks), { onSuccess: () => toast("Targets restored") }) } } : {});
            },
            onError: (腺壍) => {
                const 乩壍 = 皭壍.restore;
                if (乩壍)
                    哎壍(毠壍, () => 乩壍);
                toast((腺壍 as Error).message || "Couldn't save the targets", { tone: "crit" });
            },
        });
    };
    const 浘壍 = () => {
        if (!込壍 || !杸壍 || !isDirty(鄴壍))
            return;
        const 豇壍 = 鄴壍 as TargetDraft;
        const 夶壍 = draftChangeCount(豇壍).total;
        哎壍(岫壍, () => EMPTY_DRAFT);
        黱壍(岫壍, effectiveTargets(帣壍, 豇壍), effectiveLocks(帣壍, 豇壍), { restore: 豇壍, message: `Saved ${夶壍} change${夶壍 === 1 ? "" : "s"} to ${monthLabel(岫壍)} targets`, undo: { targets: { ...帣壍.targets }, locks: { ...帣壍.locks } } });
    };
    const 砥壍 = (霔壍: Readonly<Record<string, number>>, 搃壍: string) => {
        if (!込壍 || !杸壍)
            return;
        const 苲壍 = 鄴壍;
        哎壍(岫壍, () => EMPTY_DRAFT);
        黱壍(岫壍, { ...帣壍.targets, ...霔壍 }, effectiveLocks(帣壍, 苲壍), { restore: 苲壍, message: 搃壍, undo: { targets: { ...帣壍.targets }, locks: { ...帣壍.locks } } });
    };
    return {
        month: 岫壍,
        report: 込壍,
        targetsView: 杸壍,
        error: 烍壍.error,
        retry: () => void 烍壍.refetch(),
        refetching: !!込壍 && (烍壍.isPlaceholderData || 烍壍.isFetching),
        currency: 凞壍,
        thresholds: 卖壍,
        saved: 帣壍,
        draft: 鄴壍,
        dirty: isDirty(鄴壍),
        views: 鰁壍,
        totals: 蟟壍,
        locks: 紒壍,
        saving: 牅壍.isPending,
        setTarget: 玽壍,
        setLock: 鵹壍,
        replaceTargets: 电壍,
        discard: 耂壍,
        save: 浘壍,
        saveValues: 砥壍,
    };
}
