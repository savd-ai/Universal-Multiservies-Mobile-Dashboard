import type { Signal, SignalAction, SignalState, SignalStatus, SignalView } from "../contracts/anomaly";
import { SEVERITY_RANK, seriesKey, windowEndOf } from "./ids";
export type StateDraft = Omit<SignalState, "version" | "createdAt" | "updatedAt"> & Partial<Pick<SignalState, "version" | "createdAt" | "updatedAt">>;
export const AUTO_RESOLVE_AFTER = 2;
export const PRUNE_RESOLVED_AFTER_DAYS = 45;
const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : Number.NaN);
export function addHoursIso(iso: string, hours: number): string {
    return new Date(ms(iso) + hours * 3600000).toISOString();
}
export function snapshotOf(s: Signal): Omit<Signal, "series"> {
    const { series: _series, ...rest } = s;
    return rest;
}
export function isSnoozeExpired(state: Pick<SignalState, "status" | "snoozedUntil">, nowIso: string): boolean {
    if (state.status !== "snoozed")
        return false;
    const until = ms(state.snoozedUntil);
    return !Number.isFinite(until) || until <= ms(nowIso);
}
export function transition(state: StateDraft, to: SignalStatus, by: "user" | "system", nowIso: string): StateDraft {
    if (state.status === to)
        return state;
    const { snoozedUntil, resolvedAt, ...rest } = state;
    const next: StateDraft = { ...rest, status: to, history: [...state.history, { at: nowIso, from: state.status, to, by }] };
    if (to === "snoozed" && snoozedUntil)
        next.snoozedUntil = snoozedUntil;
    if (to === "resolved")
        next.resolvedAt = nowIso;
    else if (resolvedAt && to !== "open")
        next.resolvedAt = resolvedAt;
    return next;
}
export function applySignalAction(state: StateDraft, action: SignalAction, nowIso: string): StateDraft {
    let next: StateDraft;
    switch (action.action) {
        case "acknowledge":
            next = transition(state, "acknowledged", "user", nowIso);
            break;
        case "snooze": {
            const base = state.status === "snoozed" ? { ...state, history: [...state.history, { at: nowIso, from: state.status, to: "snoozed" as const, by: "user" as const }] } : transition(state, "snoozed", "user", nowIso);
            next = { ...base, snoozedUntil: addHoursIso(nowIso, action.hours) };
            break;
        }
        case "resolve":
            next = transition(state, "resolved", "user", nowIso);
            break;
        case "reopen":
            next = { ...transition(state, "open", "user", nowIso), missedEvaluations: 0 };
            break;
    }
    const note = "note" in action ? action.note?.trim() : undefined;
    if (note)
        next = { ...next, notes: [...next.notes, { at: nowIso, text: note }] };
    return next;
}
export function addNote(state: StateDraft, text: string, nowIso: string): StateDraft {
    return { ...state, notes: [...state.notes, { at: nowIso, text: text.trim() }] };
}
export interface StateIndex {
    byId: Map<string, SignalState>;
    earlier(signal: Pick<Signal, "id" | "window">): SignalState[];
}
export function indexStates(states: readonly SignalState[]): StateIndex {
    const byId = new Map<string, SignalState>();
    const bySeries = new Map<string, SignalState[]>();
    for (const st of states) {
        byId.set(st.id, st);
        const k = seriesKey(st.id);
        const list = bySeries.get(k) ?? [];
        list.push(st);
        bySeries.set(k, list);
    }
    for (const list of bySeries.values())
        list.sort((a, b) => (windowEndOf(b.id) ?? "").localeCompare(windowEndOf(a.id) ?? ""));
    return {
        byId,
        earlier: (signal) => (bySeries.get(seriesKey(signal.id)) ?? []).filter((st) => st.id !== signal.id && (windowEndOf(st.id) ?? "") < signal.window.recentEnd),
    };
}
export interface Resolution {
    status: SignalStatus;
    snoozedUntil?: string;
    notes: {
        at: string;
        text: string;
    }[];
    firstSeenAt?: string;
    history?: SignalState["history"];
    isNew: boolean;
    escalated: boolean;
}
const lastBy = (st: SignalState) => st.history[st.history.length - 1]?.by;
export function resolveSignalState(signal: Signal, exact: SignalState | undefined, previous: SignalState | undefined, nowIso: string): Resolution {
    if (exact) {
        let status = exact.status;
        if (isSnoozeExpired(exact, nowIso))
            status = "open";
        const escalated = SEVERITY_RANK[signal.severity] > SEVERITY_RANK[exact.lastSeverity];
        let isNew = false;
        if (status === "resolved" && lastBy(exact) === "system") {
            if (exact.supersededBy) {
                status = exact.history[exact.history.length - 1]?.from === "acknowledged" ? "acknowledged" : "open";
            }
            else {
                status = "open";
                isNew = true;
            }
        }
        if (escalated && (status === "acknowledged" || status === "resolved"))
            status = "open";
        return { status, snoozedUntil: status === "snoozed" ? exact.snoozedUntil : undefined, notes: exact.notes, firstSeenAt: exact.firstSeenAt, history: exact.history, isNew, escalated: escalated && status === "open" };
    }
    if (previous) {
        const prevStatus = isSnoozeExpired(previous, nowIso) ? "open" : previous.status;
        const escalated = SEVERITY_RANK[signal.severity] > SEVERITY_RANK[previous.lastSeverity];
        const carried = { notes: previous.notes, firstSeenAt: previous.firstSeenAt, history: previous.history };
        if (prevStatus === "snoozed")
            return { status: "snoozed", snoozedUntil: previous.snoozedUntil, ...carried, isNew: false, escalated: false };
        if (prevStatus === "acknowledged" && !escalated)
            return { status: "acknowledged", ...carried, isNew: false, escalated: false };
        if (prevStatus === "resolved" && !previous.supersededBy)
            return { status: "open", ...carried, isNew: true, escalated: false };
        return { status: "open", ...carried, isNew: false, escalated };
    }
    return { status: "open", notes: [], isNew: true, escalated: false };
}
function lifecycleFields(history: SignalState["history"] | undefined, firstSeenAt: string | undefined): Pick<SignalView, "history" | "statusChangedAt"> {
    if (!history?.length)
        return firstSeenAt ? { statusChangedAt: firstSeenAt } : {};
    const recent = history.slice(-20);
    return { history: recent, statusChangedAt: recent[recent.length - 1]?.at ?? firstSeenAt };
}
export function toView(signal: Signal, r: Resolution): SignalView {
    return { ...signal, status: r.status, snoozedUntil: r.snoozedUntil, notes: r.notes, firstSeenAt: r.firstSeenAt, ...lifecycleFields(r.history, r.firstSeenAt) };
}
export function joinSignals(signals: readonly Signal[], states: readonly SignalState[], nowIso: string): SignalView[] {
    const index = indexStates(states);
    return signals.map((s) => toView(s, resolveSignalState(s, index.byId.get(s.id), index.earlier(s)[0], nowIso)));
}
export function initialDraft(signal: Signal, scope: string, index: StateIndex, nowIso: string): StateDraft {
    const exact = index.byId.get(signal.id);
    if (exact)
        return exact;
    const r = resolveSignalState(signal, undefined, index.earlier(signal)[0], nowIso);
    return {
        id: signal.id,
        scopeKey: scope,
        status: r.status,
        snoozedUntil: r.snoozedUntil,
        firstSeenAt: r.firstSeenAt ?? nowIso,
        lastSeenAt: nowIso,
        lastSeverity: signal.severity,
        notes: r.notes,
        history: [],
        missedEvaluations: 0,
        snapshot: snapshotOf(signal),
    };
}
export interface EvaluationPlan {
    upserts: StateDraft[];
    deletes: string[];
    newOrEscalated: string[];
    resolved: StateDraft[];
}
export function planEvaluation(signals: readonly Signal[], states: readonly SignalState[], scope: string, nowIso: string, opts: {
    autoResolveAfter?: number;
    pruneAfterDays?: number;
} = {}): EvaluationPlan {
    const autoResolveAfter = opts.autoResolveAfter ?? AUTO_RESOLVE_AFTER;
    const pruneMs = (opts.pruneAfterDays ?? PRUNE_RESOLVED_AFTER_DAYS) * 86400000;
    const index = indexStates(states);
    const plan: EvaluationPlan = { upserts: [], deletes: [], newOrEscalated: [], resolved: [] };
    const seen = new Set<string>();
    const superseded = new Map<string, string>();
    for (const signal of signals) {
        seen.add(signal.id);
        const exact = index.byId.get(signal.id);
        const earlier = index.earlier(signal);
        const r = resolveSignalState(signal, exact, earlier[0], nowIso);
        let draft: StateDraft = { ...initialDraft(signal, scope, index, nowIso), ...(exact ? {} : { status: "open" as const }) };
        if (draft.supersededBy) {
            const { supersededBy: _gone, ...rest } = draft;
            draft = rest;
        }
        if (draft.status !== r.status)
            draft = transition(draft, r.status, "system", nowIso);
        if (r.status === "snoozed" && r.snoozedUntil)
            draft.snoozedUntil = r.snoozedUntil;
        draft = { ...draft, lastSeenAt: nowIso, lastSeverity: signal.severity, missedEvaluations: 0, snapshot: snapshotOf(signal) };
        plan.upserts.push(draft);
        if ((r.isNew || r.escalated) && r.status === "open")
            plan.newOrEscalated.push(signal.id);
        for (const prev of earlier)
            if (!prev.supersededBy)
                superseded.set(prev.id, signal.id);
    }
    const now = ms(nowIso);
    for (const st of states) {
        if (seen.has(st.id))
            continue;
        const successor = superseded.get(st.id);
        if (successor) {
            const p = { ...transition(st, "resolved", "system", nowIso), supersededBy: successor };
            plan.upserts.push(p);
            continue;
        }
        if (st.status === "resolved" || st.supersededBy) {
            const at = ms(st.resolvedAt ?? st.updatedAt);
            if (Number.isFinite(at) && now - at > pruneMs)
                plan.deletes.push(st.id);
            continue;
        }
        const missed = (st.missedEvaluations ?? 0) + 1;
        if (missed >= autoResolveAfter) {
            const p = { ...transition(st, "resolved", "system", nowIso), missedEvaluations: missed };
            plan.upserts.push(p);
            plan.resolved.push(p);
        }
        else
            plan.upserts.push({ ...st, missedEvaluations: missed });
    }
    return plan;
}
export function resolvedView(st: StateDraft): SignalView | null {
    if (!st.snapshot)
        return null;
    return { ...st.snapshot, series: [], status: "resolved", notes: st.notes, firstSeenAt: st.firstSeenAt, ...lifecycleFields(st.history, st.firstSeenAt) };
}
