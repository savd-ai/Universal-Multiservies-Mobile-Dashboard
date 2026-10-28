import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addHoursIso, applySignalAction, joinSignals, planEvaluation, type StateDraft } from "@/lib/domain/anomaly/lifecycle";
import type { Signal, SignalState } from "@/lib/domain/contracts/anomaly";
import type { Severity } from "@/lib/domain/types";
import { applySignalAction as applyAction, evaluateAndPersist, listSignals, updateAnomalySettings, addSignalNote } from "@/lib/server/anomaly/service";
import { setClockForTests } from "@/lib/server/clock";
import { requestContext } from "@/lib/server/context";
import { NOW_ISO, resetServerState, restoreServerState } from "./helpers";
const SCOPE = "demo:acct";
function sig(id: string, severity: Severity = "warning", end = "2026-09-28"): Signal {
    return {
        id: `${id}:${end}`,
        accountId: "acct",
        mode: "live",
        scope: "campaign",
        entity: { id: id.split(":")[0] ?? "c1", name: "Campaign" },
        kind: "metric_deviation",
        detectors: ["zscore"],
        metric: "cpa",
        direction: "up",
        polarity: "bad",
        severity,
        score: 1,
        observed: 2,
        expected: 1,
        changePct: 1,
        window: { recentStart: "2026-09-26", recentEnd: end },
        series: [],
        title: "CPA up 100%",
        summary: "",
        recommendation: "",
        evidence: [],
        relatedChanges: [],
        format: "money",
        dataAsOf: end,
        detectedAt: NOW_ISO,
    };
}
function apply(states: SignalState[], plan: ReturnType<typeof planEvaluation>): SignalState[] {
    const map = new Map(states.map((s) => [s.id, s]));
    for (const d of plan.upserts) {
        const prev = map.get(d.id);
        map.set(d.id, { ...d, version: (prev?.version ?? 0) + 1, createdAt: prev?.createdAt ?? NOW_ISO, updatedAt: NOW_ISO } as SignalState);
    }
    for (const id of plan.deletes)
        map.delete(id);
    return [...map.values()];
}
const asState = (d: StateDraft): SignalState => ({ version: 1, createdAt: NOW_ISO, updatedAt: NOW_ISO, ...d }) as SignalState;
describe("lifecycle transitions (pure)", () => {
    const s = sig("c1:cpa:zscore");
    const fresh = (): StateDraft => ({ id: s.id, scopeKey: SCOPE, status: "open", firstSeenAt: NOW_ISO, lastSeenAt: NOW_ISO, lastSeverity: "warning", notes: [], history: [] });
    it("acknowledge / snooze / resolve / reopen with history and notes", () => {
        const ack = applySignalAction(fresh(), { action: "acknowledge", note: "on it" }, NOW_ISO);
        expect(ack.status).toBe("acknowledged");
        expect(ack.notes).toEqual([{ at: NOW_ISO, text: "on it" }]);
        expect(ack.history).toEqual([{ at: NOW_ISO, from: "open", to: "acknowledged", by: "user" }]);
        const snoozed = applySignalAction(ack, { action: "snooze", hours: 2 }, NOW_ISO);
        expect(snoozed).toMatchObject({ status: "snoozed", snoozedUntil: addHoursIso(NOW_ISO, 2) });
        const resolved = applySignalAction(snoozed, { action: "resolve" }, NOW_ISO);
        expect(resolved.status).toBe("resolved");
        expect(resolved.resolvedAt).toBe(NOW_ISO);
        expect(resolved.snoozedUntil).toBeUndefined();
        const reopened = applySignalAction(resolved, { action: "reopen" }, NOW_ISO);
        expect(reopened.status).toBe("open");
        expect(reopened.resolvedAt).toBeUndefined();
        expect(reopened.history.map((h) => h.to)).toEqual(["acknowledged", "snoozed", "resolved", "open"]);
    });
    it("snoozed signals become open again once the snooze expires", () => {
        const snoozed = asState(applySignalAction(fresh(), { action: "snooze", hours: 1 }, NOW_ISO));
        expect(joinSignals([s], [snoozed], addHoursIso(NOW_ISO, 0.5))[0]?.status).toBe("snoozed");
        expect(joinSignals([s], [snoozed], addHoursIso(NOW_ISO, 2))[0]).toMatchObject({ status: "open", snoozedUntil: undefined });
    });
    it("first evaluation reports everything as new; the second reports nothing", () => {
        const signals = [sig("c1:cpa:zscore"), sig("c2:ctr:zscore", "critical")];
        const p1 = planEvaluation(signals, [], SCOPE, NOW_ISO);
        expect(p1.newOrEscalated.sort()).toEqual(signals.map((x) => x.id).sort());
        const states = apply([], p1);
        expect(states.every((st) => st.firstSeenAt === NOW_ISO && st.snapshot && st.lastSeverity)).toBe(true);
        const p2 = planEvaluation(signals, states, SCOPE, addHoursIso(NOW_ISO, 1));
        expect(p2.newOrEscalated).toEqual([]);
        expect(apply(states, p2).find((st) => st.id === signals[0]!.id)?.lastSeenAt).toBe(addHoursIso(NOW_ISO, 1));
    });
    it("escalation reopens an acknowledged signal and makes it an alert candidate", () => {
        const warn = sig("c1:cpa:zscore", "warning");
        let states = apply([], planEvaluation([warn], [], SCOPE, NOW_ISO));
        states = states.map((st) => asState(applySignalAction(st, { action: "acknowledge" }, NOW_ISO)));
        expect(joinSignals([warn], states, NOW_ISO)[0]?.status).toBe("acknowledged");
        const crit = { ...warn, severity: "critical" as const };
        expect(joinSignals([crit], states, NOW_ISO)[0]?.status).toBe("open");
        const plan = planEvaluation([crit], states, SCOPE, NOW_ISO);
        expect(plan.newOrEscalated).toEqual([crit.id]);
        expect(apply(states, plan)[0]?.history.at(-1)).toMatchObject({ from: "acknowledged", to: "open", by: "system" });
    });
    it("auto-resolves after two evaluations without the signal, and reopens if it comes back", () => {
        const s1 = sig("c1:cpa:zscore");
        let states = apply([], planEvaluation([s1], [], SCOPE, NOW_ISO));
        const miss1 = planEvaluation([], states, SCOPE, NOW_ISO);
        expect(miss1.resolved).toEqual([]);
        states = apply(states, miss1);
        expect(states[0]?.missedEvaluations).toBe(1);
        const miss2 = planEvaluation([], states, SCOPE, NOW_ISO);
        expect(miss2.resolved.map((r) => r.id)).toEqual([s1.id]);
        states = apply(states, miss2);
        expect(states[0]).toMatchObject({ status: "resolved", resolvedAt: NOW_ISO });
        expect(states[0]?.history.at(-1)?.by).toBe("system");
        const back = planEvaluation([s1], states, SCOPE, NOW_ISO);
        expect(back.newOrEscalated).toEqual([s1.id]);
        expect(apply(states, back)[0]?.status).toBe("open");
    });
    it("a user-resolved signal stays resolved while it is still detected on the same data day", () => {
        const s1 = sig("c1:cpa:zscore");
        let states = apply([], planEvaluation([s1], [], SCOPE, NOW_ISO));
        states = states.map((st) => asState(applySignalAction(st, { action: "resolve" }, NOW_ISO)));
        const plan = planEvaluation([s1], states, SCOPE, NOW_ISO);
        expect(plan.newOrEscalated).toEqual([]);
        expect(apply(states, plan)[0]?.status).toBe("resolved");
    });
    it("carries acknowledgement and notes over to the next data window and supersedes the old state", () => {
        const day1 = sig("c1:cpa:zscore", "warning", "2026-09-27");
        let states = apply([], planEvaluation([day1], [], SCOPE, NOW_ISO));
        states = states.map((st) => asState(applySignalAction(st, { action: "acknowledge", note: "checked" }, NOW_ISO)));
        const day2 = sig("c1:cpa:zscore", "warning", "2026-09-28");
        const view = joinSignals([day2], states, NOW_ISO)[0];
        expect(view).toMatchObject({ status: "acknowledged", firstSeenAt: NOW_ISO });
        expect(view?.notes.map((n) => n.text)).toEqual(["checked"]);
        const plan = planEvaluation([day2], states, SCOPE, NOW_ISO);
        expect(plan.newOrEscalated).toEqual([]);
        expect(plan.resolved).toEqual([]);
        const after = apply(states, plan);
        expect(after.find((st) => st.id === day1.id)).toMatchObject({ status: "resolved", supersededBy: day2.id });
        expect(after.find((st) => st.id === day2.id)?.status).toBe("acknowledged");
        expect(joinSignals([{ ...day2, severity: "critical" }], states, NOW_ISO)[0]?.status).toBe("open");
    });
    it("carries an active snooze over to the next window", () => {
        const day1 = sig("c1:cpa:zscore", "warning", "2026-09-27");
        const snoozed = apply([], planEvaluation([day1], [], SCOPE, NOW_ISO)).map((st) => asState(applySignalAction(st, { action: "snooze", hours: 48 }, NOW_ISO)));
        const day2 = sig("c1:cpa:zscore", "critical", "2026-09-28");
        expect(joinSignals([day2], snoozed, NOW_ISO)[0]).toMatchObject({ status: "snoozed", snoozedUntil: addHoursIso(NOW_ISO, 48) });
        expect(planEvaluation([day2], snoozed, SCOPE, NOW_ISO).newOrEscalated).toEqual([]);
    });
});
describe("anomaly service with the in-memory store", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("evaluates, persists and joins lifecycle state", async () => {
        const ctx = await requestContext();
        expect(ctx.source.mode).toBe("live");
        const first = await evaluateAndPersist(ctx);
        expect(first.signals.length).toBeGreaterThan(5);
        expect(first.newOrEscalated.length).toBe(first.signals.length);
        const second = await evaluateAndPersist(ctx);
        expect(second.newOrEscalated).toEqual([]);
        expect(second.signals.every((s) => s.firstSeenAt)).toBe(true);
        const target = first.signals.find((s) => s.entity.id === "c8" && s.metric === "cpa");
        expect(target).toBeDefined();
        const res = await applyAction(ctx, target!.id, { action: "acknowledge", note: "reviewing" });
        expect(res.signal?.status).toBe("acknowledged");
        await addSignalNote(ctx, target!.id, "auction insights checked");
        const listed = (await listSignals(ctx)).find((s) => s.id === target!.id);
        expect(listed?.status).toBe("acknowledged");
        expect(listed?.notes.map((n) => n.text)).toEqual(["reviewing", "auction insights checked"]);
        expect((await listSignals(ctx, { includeInactive: false })).some((s) => s.id === target!.id)).toBe(false);
    });
    it("snooze expiry and auto-resolve through the service", async () => {
        const ctx = await requestContext();
        const { signals } = await evaluateAndPersist(ctx);
        const target = signals.find((s) => s.entity.id === "c5")!;
        await applyAction(ctx, target.id, { action: "snooze", hours: 1 });
        expect((await listSignals(ctx)).find((s) => s.id === target.id)?.status).toBe("snoozed");
        setClockForTests(() => new Date(addHoursIso(NOW_ISO, 3)));
        expect((await listSignals(ctx)).find((s) => s.id === target.id)?.status).toBe("open");
        await updateAnomalySettings({ zscore: { enabled: false } });
        const miss1 = await evaluateAndPersist(ctx);
        expect(miss1.resolved).toEqual([]);
        const miss2 = await evaluateAndPersist(ctx);
        expect(miss2.resolved.map((s) => s.id)).toContain(target.id);
        expect(miss2.resolved.every((s) => s.status === "resolved")).toBe(true);
        expect(miss2.signals.every((s) => s.detectors[0] !== "zscore")).toBe(true);
    });
    it("rejects unknown signal ids and accepts preview-only ids for the current data day", async () => {
        const ctx = await requestContext();
        await expect(applyAction(ctx, "nope", { action: "acknowledge" })).rejects.toMatchObject({ code: "NOT_FOUND" });
        const preview = await applyAction(ctx, `c2:cvr:zscore:${ctx.dataThrough}`, { action: "acknowledge" });
        expect(preview.state.status).toBe("acknowledged");
        expect(preview.signal).toBeNull();
    });
});
