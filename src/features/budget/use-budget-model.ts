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
    update: (month: string, fn: (d: TargetDraft) => TargetDraft) => void;
}
export function useTargetDrafts(): TargetDraftStore & {
    anyDirty: boolean;
} {
    const [drafts, setDrafts] = useState<Record<string, TargetDraft>>({});
    const update = useCallback((month: string, fn: (d: TargetDraft) => TargetDraft) => {
        setDrafts((all) => {
            const next = fn(all[month] ?? EMPTY_DRAFT);
            const copy = { ...all };
            if (isDirty(next))
                copy[month] = next;
            else
                delete copy[month];
            return copy;
        });
    }, []);
    return { drafts, update, anyDirty: Object.keys(drafts).length > 0 };
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
    setTarget: (unitId: string, value: number) => void;
    setLock: (unitId: string, locked: boolean) => void;
    replaceTargets: (values: Readonly<Record<string, number>>) => void;
    discard: () => void;
    save: () => void;
    saveValues: (values: Readonly<Record<string, number>>, message: string) => void;
}
export function useBudgetModel(month: string | null, store: TargetDraftStore): BudgetModel {
    const status = useStatus();
    const currency = status.data?.account.currency ?? "USD";
    const pacing = usePacing(month ?? undefined);
    const report = pacing.data ?? null;
    const shown = report?.month ?? month ?? "";
    const requestedTargets = useBudgetTargets(month);
    const shownTargets = useBudgetTargets(shown || null);
    const targetsView = [shownTargets.data, requestedTargets.data].find((t) => t?.month === shown);
    const thresholds = usePacingThresholds();
    const saveMut = useSaveTargets();
    const draft = store.drafts[shown];
    const saved = useMemo(() => savedTargetsOf(report?.rows ?? [], targetsView), [report, targetsView]);
    const locks = useMemo(() => effectiveLocks(saved, draft), [saved, draft]);
    const views = useMemo(() => {
        if (!report)
            return [];
        return report.rows.map((r) => derivePacingRow(r, report, {
            target: draft?.targets[r.unitId] ?? saved.targets[r.unitId] ?? r.monthlyTarget,
            savedTarget: saved.targets[r.unitId] ?? r.monthlyTarget,
            locked: locks[r.unitId] ?? false,
            savedLocked: saved.locks[r.unitId] ?? false,
            thresholds,
            currency,
        }));
    }, [report, draft, saved, locks, thresholds, currency]);
    const totals = useMemo(() => pacingTotals(views), [views]);
    const { update } = store;
    const setTarget = useCallback((unitId: string, value: number) => update(shown, (d) => withTarget(d, unitId, value, saved.targets[unitId])), [update, shown, saved]);
    const setLock = useCallback((unitId: string, locked: boolean) => update(shown, (d) => withLock(d, unitId, locked, saved.locks[unitId])), [update, shown, saved]);
    const replaceTargets = useCallback((values: Readonly<Record<string, number>>) => update(shown, (d) => draftFromValues(values, saved, d)), [update, shown, saved]);
    const discard = useCallback(() => update(shown, () => EMPTY_DRAFT), [update, shown]);
    const put = (month2: string, targets: Record<string, number>, lockMap: Record<string, boolean>, opts: {
        restore?: TargetDraft;
        message: string;
        undo?: {
            targets: Record<string, number>;
            locks: Record<string, boolean>;
        };
    }) => {
        if (!targetsView)
            return;
        const defaults = targetsView.defaults;
        saveMut.mutate(targetsBody(month2, defaults, targets, lockMap), {
            onSuccess: () => {
                const undo = opts.undo;
                toast(opts.message, undo ? { action: { label: "Undo", onClick: () => saveMut.mutate(targetsBody(month2, defaults, undo.targets, undo.locks), { onSuccess: () => toast("Targets restored") }) } } : {});
            },
            onError: (e) => {
                const restore = opts.restore;
                if (restore)
                    update(month2, () => restore);
                toast((e as Error).message || "Couldn't save the targets", { tone: "crit" });
            },
        });
    };
    const save = () => {
        if (!report || !targetsView || !isDirty(draft))
            return;
        const d = draft as TargetDraft;
        const n = draftChangeCount(d).total;
        update(shown, () => EMPTY_DRAFT);
        put(shown, effectiveTargets(saved, d), effectiveLocks(saved, d), { restore: d, message: `Saved ${n} change${n === 1 ? "" : "s"} to ${monthLabel(shown)} targets`, undo: { targets: { ...saved.targets }, locks: { ...saved.locks } } });
    };
    const saveValues = (values: Readonly<Record<string, number>>, message: string) => {
        if (!report || !targetsView)
            return;
        const d = draft;
        update(shown, () => EMPTY_DRAFT);
        put(shown, { ...saved.targets, ...values }, effectiveLocks(saved, d), { restore: d, message, undo: { targets: { ...saved.targets }, locks: { ...saved.locks } } });
    };
    return {
        month: shown,
        report,
        targetsView,
        error: pacing.error,
        retry: () => void pacing.refetch(),
        refetching: !!report && (pacing.isPlaceholderData || pacing.isFetching),
        currency,
        thresholds,
        saved,
        draft,
        dirty: isDirty(draft),
        views,
        totals,
        locks,
        saving: saveMut.isPending,
        setTarget,
        setLock,
        replaceTargets,
        discard,
        save,
        saveValues,
    };
}
