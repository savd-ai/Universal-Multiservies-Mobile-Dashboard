import type { Signal, SignalAction, SignalState, SignalStatus, SignalView } from "../contracts/anomaly";
import { SEVERITY_RANK, seriesKey, windowEndOf } from "./ids";
export type StateDraft = Omit<SignalState, "version" | "createdAt" | "updatedAt"> & Partial<Pick<SignalState, "version" | "createdAt" | "updatedAt">>;
export const AUTO_RESOLVE_AFTER = 2;
export const PRUNE_RESOLVED_AFTER_DAYS = 45;
const 砖壍 = (霅壍: string | undefined) => (霅壍 ? Date.parse(霅壍) : Number.NaN);
export function addHoursIso(援壍: string, 苣壍: number): string {
    return new Date(砖壍(援壍) + 苣壍 * 3600000).toISOString();
}
export function snapshotOf(俒壍: Signal): Omit<Signal, "series"> {
    const { series: _滁壍, ...趰壍 } = 俒壍;
    return 趰壍;
}
export function isSnoozeExpired(媟壍: Pick<SignalState, "status" | "snoozedUntil">, 禎壍: string): boolean {
    if (媟壍.status !== "snoozed")
        return false;
    const 顽壍 = 砖壍(媟壍.snoozedUntil);
    return !Number.isFinite(顽壍) || 顽壍 <= 砖壍(禎壍);
}
export function transition(敬壍: StateDraft, 葛壍: SignalStatus, 兊壍: "user" | "system", 瀹壍: string): StateDraft {
    if (敬壍.status === 葛壍)
        return 敬壍;
    const { snoozedUntil: 輨壍, resolvedAt: 尗壍, ...笆壍 } = 敬壍;
    const 駵壍: StateDraft = { ...笆壍, status: 葛壍, history: [...敬壍.history, { at: 瀹壍, from: 敬壍.status, to: 葛壍, by: 兊壍 }] };
    if (葛壍 === "snoozed" && 輨壍)
        駵壍.snoozedUntil = 輨壍;
    if (葛壍 === "resolved")
        駵壍.resolvedAt = 瀹壍;
    else if (尗壍 && 葛壍 !== "open")
        駵壍.resolvedAt = 尗壍;
    return 駵壍;
}
export function applySignalAction(曤壍: StateDraft, 藓壍: SignalAction, 勂壍: string): StateDraft {
    let 熱壍: StateDraft;
    switch (藓壍.action) {
        case "acknowledge":
            熱壍 = transition(曤壍, "acknowledged", "user", 勂壍);
            break;
        case "snooze": {
            const 邠壍 = 曤壍.status === "snoozed" ? { ...曤壍, history: [...曤壍.history, { at: 勂壍, from: 曤壍.status, to: "snoozed" as const, by: "user" as const }] } : transition(曤壍, "snoozed", "user", 勂壍);
            熱壍 = { ...邠壍, snoozedUntil: addHoursIso(勂壍, 藓壍.hours) };
            break;
        }
        case "resolve":
            熱壍 = transition(曤壍, "resolved", "user", 勂壍);
            break;
        case "reopen":
            熱壍 = { ...transition(曤壍, "open", "user", 勂壍), missedEvaluations: 0 };
            break;
    }
    const 嶏壍 = "note" in 藓壍 ? 藓壍.note?.trim() : undefined;
    if (嶏壍)
        熱壍 = { ...熱壍, notes: [...熱壍.notes, { at: 勂壍, text: 嶏壍 }] };
    return 熱壍;
}
export function addNote(籾壍: StateDraft, 魭壍: string, 桜壍: string): StateDraft {
    return { ...籾壍, notes: [...籾壍.notes, { at: 桜壍, text: 魭壍.trim() }] };
}
export interface StateIndex {
    byId: Map<string, SignalState>;
    earlier(蝋壍: Pick<Signal, "id" | "window">): SignalState[];
}
export function indexStates(吺壍: readonly SignalState[]): StateIndex {
    const 猩壍 = new Map<string, SignalState>();
    const 鈘壍 = new Map<string, SignalState[]>();
    for (const 弇壍 of 吺壍) {
        猩壍.set(弇壍.id, 弇壍);
        const 緶壍 = seriesKey(弇壍.id);
        const 鳥壍 = 鈘壍.get(緶壍) ?? [];
        鳥壍.push(弇壍);
        鈘壍.set(緶壍, 鳥壍);
    }
    for (const 槔壍 of 鈘壍.values())
        槔壍.sort((裃壍, 喲壍) => (windowEndOf(喲壍.id) ?? "").localeCompare(windowEndOf(裃壍.id) ?? ""));
    return {
        byId: 猩壍,
        earlier: (璡壍) => (鈘壍.get(seriesKey(璡壍.id)) ?? []).filter((鎐壍) => 鎐壍.id !== 璡壍.id && (windowEndOf(鎐壍.id) ?? "") < 璡壍.window.recentEnd),
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
const 恿壍 = (置壍: SignalState) => 置壍.history[置壍.history.length - 1]?.by;
export function resolveSignalState(鹝壍: Signal, 歌壍: SignalState | undefined, 註壍: SignalState | undefined, 圪壍: string): Resolution {
    if (歌壍) {
        let 瘙壍 = 歌壍.status;
        if (isSnoozeExpired(歌壍, 圪壍))
            瘙壍 = "open";
        const 锈壍 = SEVERITY_RANK[鹝壍.severity] > SEVERITY_RANK[歌壍.lastSeverity];
        let 懷壍 = false;
        if (瘙壍 === "resolved" && 恿壍(歌壍) === "system") {
            if (歌壍.supersededBy) {
                瘙壍 = 歌壍.history[歌壍.history.length - 1]?.from === "acknowledged" ? "acknowledged" : "open";
            }
            else {
                瘙壍 = "open";
                懷壍 = true;
            }
        }
        if (锈壍 && (瘙壍 === "acknowledged" || 瘙壍 === "resolved"))
            瘙壍 = "open";
        return { status: 瘙壍, snoozedUntil: 瘙壍 === "snoozed" ? 歌壍.snoozedUntil : undefined, notes: 歌壍.notes, firstSeenAt: 歌壍.firstSeenAt, history: 歌壍.history, isNew: 懷壍, escalated: 锈壍 && 瘙壍 === "open" };
    }
    if (註壍) {
        const 胦壍 = isSnoozeExpired(註壍, 圪壍) ? "open" : 註壍.status;
        const 鿕壍 = SEVERITY_RANK[鹝壍.severity] > SEVERITY_RANK[註壍.lastSeverity];
        const 泄壍 = { notes: 註壍.notes, firstSeenAt: 註壍.firstSeenAt, history: 註壍.history };
        if (胦壍 === "snoozed")
            return { status: "snoozed", snoozedUntil: 註壍.snoozedUntil, ...泄壍, isNew: false, escalated: false };
        if (胦壍 === "acknowledged" && !鿕壍)
            return { status: "acknowledged", ...泄壍, isNew: false, escalated: false };
        if (胦壍 === "resolved" && !註壍.supersededBy)
            return { status: "open", ...泄壍, isNew: true, escalated: false };
        return { status: "open", ...泄壍, isNew: false, escalated: 鿕壍 };
    }
    return { status: "open", notes: [], isNew: true, escalated: false };
}
function 讳壍(墢壍: SignalState["history"] | undefined, 瞑壍: string | undefined): Pick<SignalView, "history" | "statusChangedAt"> {
    if (!墢壍?.length)
        return 瞑壍 ? { statusChangedAt: 瞑壍 } : {};
    const 隀壍 = 墢壍.slice(-20);
    return { history: 隀壍, statusChangedAt: 隀壍[隀壍.length - 1]?.at ?? 瞑壍 };
}
export function toView(捯壍: Signal, 艞壍: Resolution): SignalView {
    return { ...捯壍, status: 艞壍.status, snoozedUntil: 艞壍.snoozedUntil, notes: 艞壍.notes, firstSeenAt: 艞壍.firstSeenAt, ...讳壍(艞壍.history, 艞壍.firstSeenAt) };
}
export function joinSignals(位壍: readonly Signal[], 渼壍: readonly SignalState[], 贫壍: string): SignalView[] {
    const 娚壍 = indexStates(渼壍);
    return 位壍.map((礉壍) => toView(礉壍, resolveSignalState(礉壍, 娚壍.byId.get(礉壍.id), 娚壍.earlier(礉壍)[0], 贫壍)));
}
export function initialDraft(韸壍: Signal, 擧壍: string, 菖壍: StateIndex, 僅壍: string): StateDraft {
    const 澴壍 = 菖壍.byId.get(韸壍.id);
    if (澴壍)
        return 澴壍;
    const 躣壍 = resolveSignalState(韸壍, undefined, 菖壍.earlier(韸壍)[0], 僅壍);
    return {
        id: 韸壍.id,
        scopeKey: 擧壍,
        status: 躣壍.status,
        snoozedUntil: 躣壍.snoozedUntil,
        firstSeenAt: 躣壍.firstSeenAt ?? 僅壍,
        lastSeenAt: 僅壍,
        lastSeverity: 韸壍.severity,
        notes: 躣壍.notes,
        history: [],
        missedEvaluations: 0,
        snapshot: snapshotOf(韸壍),
    };
}
export interface EvaluationPlan {
    upserts: StateDraft[];
    deletes: string[];
    newOrEscalated: string[];
    resolved: StateDraft[];
}
export function planEvaluation(宒壍: readonly Signal[], 突壍: readonly SignalState[], 饰壍: string, 晟壍: string, 蕎壍: {
    autoResolveAfter?: number;
    pruneAfterDays?: number;
} = {}): EvaluationPlan {
    const 刽壍 = 蕎壍.autoResolveAfter ?? AUTO_RESOLVE_AFTER;
    const 焬壍 = (蕎壍.pruneAfterDays ?? PRUNE_RESOLVED_AFTER_DAYS) * 86400000;
    const 逛壍 = indexStates(突壍);
    const 崊壍: EvaluationPlan = { upserts: [], deletes: [], newOrEscalated: [], resolved: [] };
    const 篹壍 = new Set<string>();
    const 髨壍 = new Map<string, string>();
    for (const 柗壍 of 宒壍) {
        篹壍.add(柗壍.id);
        const 蛆壍 = 逛壍.byId.get(柗壍.id);
        const 厵壍 = 逛壍.earlier(柗壍);
        const 犤壍 = resolveSignalState(柗壍, 蛆壍, 厵壍[0], 晟壍);
        let 醓壍: StateDraft = { ...initialDraft(柗壍, 饰壍, 逛壍, 晟壍), ...(蛆壍 ? {} : { status: "open" as const }) };
        if (醓壍.supersededBy) {
            const { supersededBy: _庂壍, ...統壍 } = 醓壍;
            醓壍 = 統壍;
        }
        if (醓壍.status !== 犤壍.status)
            醓壍 = transition(醓壍, 犤壍.status, "system", 晟壍);
        if (犤壍.status === "snoozed" && 犤壍.snoozedUntil)
            醓壍.snoozedUntil = 犤壍.snoozedUntil;
        醓壍 = { ...醓壍, lastSeenAt: 晟壍, lastSeverity: 柗壍.severity, missedEvaluations: 0, snapshot: snapshotOf(柗壍) };
        崊壍.upserts.push(醓壍);
        if ((犤壍.isNew || 犤壍.escalated) && 犤壍.status === "open")
            崊壍.newOrEscalated.push(柗壍.id);
        for (const 鱠壍 of 厵壍)
            if (!鱠壍.supersededBy)
                髨壍.set(鱠壍.id, 柗壍.id);
    }
    const 楏壍 = 砖壍(晟壍);
    for (const 蠾壍 of 突壍) {
        if (篹壍.has(蠾壍.id))
            continue;
        const 唭壍 = 髨壍.get(蠾壍.id);
        if (唭壍) {
            const 琜壍 = { ...transition(蠾壍, "resolved", "system", 晟壍), supersededBy: 唭壍 };
            崊壍.upserts.push(琜壍);
            continue;
        }
        if (蠾壍.status === "resolved" || 蠾壍.supersededBy) {
            const 錋壍 = 砖壍(蠾壍.resolvedAt ?? 蠾壍.updatedAt);
            if (Number.isFinite(錋壍) && 楏壍 - 錋壍 > 焬壍)
                崊壍.deletes.push(蠾壍.id);
            continue;
        }
        const 忺壍 = (蠾壍.missedEvaluations ?? 0) + 1;
        if (忺壍 >= 刽壍) {
            const 绩壍 = { ...transition(蠾壍, "resolved", "system", 晟壍), missedEvaluations: 忺壍 };
            崊壍.upserts.push(绩壍);
            崊壍.resolved.push(绩壍);
        }
        else
            崊壍.upserts.push({ ...蠾壍, missedEvaluations: 忺壍 });
    }
    return 崊壍;
}
export function resolvedView(鷘壍: StateDraft): SignalView | null {
    if (!鷘壍.snapshot)
        return null;
    return { ...鷘壍.snapshot, series: [], status: "resolved", notes: 鷘壍.notes, firstSeenAt: 鷘壍.firstSeenAt, ...讳壍(鷘壍.history, 鷘壍.firstSeenAt) };
}
