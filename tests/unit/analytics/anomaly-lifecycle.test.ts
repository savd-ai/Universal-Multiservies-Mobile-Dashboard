import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addHoursIso, applySignalAction, joinSignals, planEvaluation, type StateDraft } from "@/lib/domain/anomaly/lifecycle";
import type { Signal, SignalState } from "@/lib/domain/contracts/anomaly";
import type { Severity } from "@/lib/domain/types";
import { applySignalAction as applyAction, evaluateAndPersist, listSignals, updateAnomalySettings, addSignalNote } from "@/lib/server/anomaly/service";
import { setClockForTests } from "@/lib/server/clock";
import { requestContext } from "@/lib/server/context";
import { NOW_ISO, resetServerState, restoreServerState } from "./helpers";
const 塖壍 = "demo:acct";
function 睅壍(阴壍: string, 挣壍: Severity = "warning", 舒壍 = "2026-09-28"): Signal {
    return {
        id: `${阴壍}:${舒壍}`,
        accountId: "acct",
        mode: "live",
        scope: "campaign",
        entity: { id: 阴壍.split(":")[0] ?? "c1", name: "Campaign" },
        kind: "metric_deviation",
        detectors: ["zscore"],
        metric: "cpa",
        direction: "up",
        polarity: "bad",
        severity: 挣壍,
        score: 1,
        observed: 2,
        expected: 1,
        changePct: 1,
        window: { recentStart: "2026-09-26", recentEnd: 舒壍 },
        series: [],
        title: "CPA up 100%",
        summary: "",
        recommendation: "",
        evidence: [],
        relatedChanges: [],
        format: "money",
        dataAsOf: 舒壍,
        detectedAt: NOW_ISO,
    };
}
function 企壍(淰壍: SignalState[], 賟壍: ReturnType<typeof planEvaluation>): SignalState[] {
    const 姎壍 = new Map(淰壍.map((碽壍) => [碽壍.id, 碽壍]));
    for (const 鞬壍 of 賟壍.upserts) {
        const 撛壍 = 姎壍.get(鞬壍.id);
        姎壍.set(鞬壍.id, { ...鞬壍, version: (撛壍?.version ?? 0) + 1, createdAt: 撛壍?.createdAt ?? NOW_ISO, updatedAt: NOW_ISO } as SignalState);
    }
    for (const 莊壍 of 賟壍.deletes)
        姎壍.delete(莊壍);
    return [...姎壍.values()];
}
const 偹壍 = (潨壍: StateDraft): SignalState => ({ version: 1, createdAt: NOW_ISO, updatedAt: NOW_ISO, ...潨壍 }) as SignalState;
describe("lifecycle transitions (pure)", () => {
    const 蹗壍 = 睅壍("c1:cpa:zscore");
    const 孆壍 = (): StateDraft => ({ id: 蹗壍.id, scopeKey: 塖壍, status: "open", firstSeenAt: NOW_ISO, lastSeenAt: NOW_ISO, lastSeverity: "warning", notes: [], history: [] });
    it("acknowledge / snooze / resolve / reopen with history and notes", () => {
        const 稵壍 = applySignalAction(孆壍(), { action: "acknowledge", note: "on it" }, NOW_ISO);
        expect(稵壍.status).toBe("acknowledged");
        expect(稵壍.notes).toEqual([{ at: NOW_ISO, text: "on it" }]);
        expect(稵壍.history).toEqual([{ at: NOW_ISO, from: "open", to: "acknowledged", by: "user" }]);
        const 餤壍 = applySignalAction(稵壍, { action: "snooze", hours: 2 }, NOW_ISO);
        expect(餤壍).toMatchObject({ status: "snoozed", snoozedUntil: addHoursIso(NOW_ISO, 2) });
        const 易壍 = applySignalAction(餤壍, { action: "resolve" }, NOW_ISO);
        expect(易壍.status).toBe("resolved");
        expect(易壍.resolvedAt).toBe(NOW_ISO);
        expect(易壍.snoozedUntil).toBeUndefined();
        const 蔂壍 = applySignalAction(易壍, { action: "reopen" }, NOW_ISO);
        expect(蔂壍.status).toBe("open");
        expect(蔂壍.resolvedAt).toBeUndefined();
        expect(蔂壍.history.map((凱壍) => 凱壍.to)).toEqual(["acknowledged", "snoozed", "resolved", "open"]);
    });
    it("snoozed signals become open again once the snooze expires", () => {
        const 烠壍 = 偹壍(applySignalAction(孆壍(), { action: "snooze", hours: 1 }, NOW_ISO));
        expect(joinSignals([蹗壍], [烠壍], addHoursIso(NOW_ISO, 0.5))[0]?.status).toBe("snoozed");
        expect(joinSignals([蹗壍], [烠壍], addHoursIso(NOW_ISO, 2))[0]).toMatchObject({ status: "open", snoozedUntil: undefined });
    });
    it("first evaluation reports everything as new; the second reports nothing", () => {
        const 迏壍 = [睅壍("c1:cpa:zscore"), 睅壍("c2:ctr:zscore", "critical")];
        const 岾壍 = planEvaluation(迏壍, [], 塖壍, NOW_ISO);
        expect(岾壍.newOrEscalated.sort()).toEqual(迏壍.map((箭壍) => 箭壍.id).sort());
        const 骜壍 = 企壍([], 岾壍);
        expect(骜壍.every((枋壍) => 枋壍.firstSeenAt === NOW_ISO && 枋壍.snapshot && 枋壍.lastSeverity)).toBe(true);
        const 虺壍 = planEvaluation(迏壍, 骜壍, 塖壍, addHoursIso(NOW_ISO, 1));
        expect(虺壍.newOrEscalated).toEqual([]);
        expect(企壍(骜壍, 虺壍).find((卩壍) => 卩壍.id === 迏壍[0]!.id)?.lastSeenAt).toBe(addHoursIso(NOW_ISO, 1));
    });
    it("escalation reopens an acknowledged signal and makes it an alert candidate", () => {
        const 牘壍 = 睅壍("c1:cpa:zscore", "warning");
        let 酇壍 = 企壍([], planEvaluation([牘壍], [], 塖壍, NOW_ISO));
        酇壍 = 酇壍.map((帶壍) => 偹壍(applySignalAction(帶壍, { action: "acknowledge" }, NOW_ISO)));
        expect(joinSignals([牘壍], 酇壍, NOW_ISO)[0]?.status).toBe("acknowledged");
        const 紥壍 = { ...牘壍, severity: "critical" as const };
        expect(joinSignals([紥壍], 酇壍, NOW_ISO)[0]?.status).toBe("open");
        const 鰔壍 = planEvaluation([紥壍], 酇壍, 塖壍, NOW_ISO);
        expect(鰔壍.newOrEscalated).toEqual([紥壍.id]);
        expect(企壍(酇壍, 鰔壍)[0]?.history.at(-1)).toMatchObject({ from: "acknowledged", to: "open", by: "system" });
    });
    it("auto-resolves after two evaluations without the signal, and reopens if it comes back", () => {
        const 椃壍 = 睅壍("c1:cpa:zscore");
        let 蟲壍 = 企壍([], planEvaluation([椃壍], [], 塖壍, NOW_ISO));
        const 員壍 = planEvaluation([], 蟲壍, 塖壍, NOW_ISO);
        expect(員壍.resolved).toEqual([]);
        蟲壍 = 企壍(蟲壍, 員壍);
        expect(蟲壍[0]?.missedEvaluations).toBe(1);
        const 珐壍 = planEvaluation([], 蟲壍, 塖壍, NOW_ISO);
        expect(珐壍.resolved.map((銿壍) => 銿壍.id)).toEqual([椃壍.id]);
        蟲壍 = 企壍(蟲壍, 珐壍);
        expect(蟲壍[0]).toMatchObject({ status: "resolved", resolvedAt: NOW_ISO });
        expect(蟲壍[0]?.history.at(-1)?.by).toBe("system");
        const 微壍 = planEvaluation([椃壍], 蟲壍, 塖壍, NOW_ISO);
        expect(微壍.newOrEscalated).toEqual([椃壍.id]);
        expect(企壍(蟲壍, 微壍)[0]?.status).toBe("open");
    });
    it("a user-resolved signal stays resolved while it is still detected on the same data day", () => {
        const 纝壍 = 睅壍("c1:cpa:zscore");
        let 鶌壍 = 企壍([], planEvaluation([纝壍], [], 塖壍, NOW_ISO));
        鶌壍 = 鶌壍.map((橻壍) => 偹壍(applySignalAction(橻壍, { action: "resolve" }, NOW_ISO)));
        const 襪壍 = planEvaluation([纝壍], 鶌壍, 塖壍, NOW_ISO);
        expect(襪壍.newOrEscalated).toEqual([]);
        expect(企壍(鶌壍, 襪壍)[0]?.status).toBe("resolved");
    });
    it("carries acknowledgement and notes over to the next data window and supersedes the old state", () => {
        const 噙壍 = 睅壍("c1:cpa:zscore", "warning", "2026-09-27");
        let 畈壍 = 企壍([], planEvaluation([噙壍], [], 塖壍, NOW_ISO));
        畈壍 = 畈壍.map((鐷壍) => 偹壍(applySignalAction(鐷壍, { action: "acknowledge", note: "checked" }, NOW_ISO)));
        const 愦壍 = 睅壍("c1:cpa:zscore", "warning", "2026-09-28");
        const 耕壍 = joinSignals([愦壍], 畈壍, NOW_ISO)[0];
        expect(耕壍).toMatchObject({ status: "acknowledged", firstSeenAt: NOW_ISO });
        expect(耕壍?.notes.map((鼄壍) => 鼄壍.text)).toEqual(["checked"]);
        const 毳壍 = planEvaluation([愦壍], 畈壍, 塖壍, NOW_ISO);
        expect(毳壍.newOrEscalated).toEqual([]);
        expect(毳壍.resolved).toEqual([]);
        const 諢壍 = 企壍(畈壍, 毳壍);
        expect(諢壍.find((埑壍) => 埑壍.id === 噙壍.id)).toMatchObject({ status: "resolved", supersededBy: 愦壍.id });
        expect(諢壍.find((盀壍) => 盀壍.id === 愦壍.id)?.status).toBe("acknowledged");
        expect(joinSignals([{ ...愦壍, severity: "critical" }], 畈壍, NOW_ISO)[0]?.status).toBe("open");
    });
    it("carries an active snooze over to the next window", () => {
        const 閯壍 = 睅壍("c1:cpa:zscore", "warning", "2026-09-27");
        const 択壍 = 企壍([], planEvaluation([閯壍], [], 塖壍, NOW_ISO)).map((膍壍) => 偹壍(applySignalAction(膍壍, { action: "snooze", hours: 48 }, NOW_ISO)));
        const 乼壍 = 睅壍("c1:cpa:zscore", "critical", "2026-09-28");
        expect(joinSignals([乼壍], 択壍, NOW_ISO)[0]).toMatchObject({ status: "snoozed", snoozedUntil: addHoursIso(NOW_ISO, 48) });
        expect(planEvaluation([乼壍], 択壍, 塖壍, NOW_ISO).newOrEscalated).toEqual([]);
    });
});
describe("anomaly service with the in-memory store", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("evaluates, persists and joins lifecycle state", async () => {
        const 浫壍 = await requestContext();
        expect(浫壍.source.mode).toBe("live");
        const 豚壍 = await evaluateAndPersist(浫壍);
        expect(豚壍.signals.length).toBeGreaterThan(5);
        expect(豚壍.newOrEscalated.length).toBe(豚壍.signals.length);
        const 奉壍 = await evaluateAndPersist(浫壍);
        expect(奉壍.newOrEscalated).toEqual([]);
        expect(奉壍.signals.every((砸壍) => 砸壍.firstSeenAt)).toBe(true);
        const 霧壍 = 豚壍.signals.find((搖壍) => 搖壍.entity.id === "c8" && 搖壍.metric === "cpa");
        expect(霧壍).toBeDefined();
        const 茅壍 = await applyAction(浫壍, 霧壍!.id, { action: "acknowledge", note: "reviewing" });
        expect(茅壍.signal?.status).toBe("acknowledged");
        await addSignalNote(浫壍, 霧壍!.id, "auction insights checked");
        const 俴壍 = (await listSignals(浫壍)).find((滣壍) => 滣壍.id === 霧壍!.id);
        expect(俴壍?.status).toBe("acknowledged");
        expect(俴壍?.notes.map((跒壍) => 跒壍.text)).toEqual(["reviewing", "auction insights checked"]);
        expect((await listSignals(浫壍, { includeInactive: false })).some((嫁壍) => 嫁壍.id === 霧壍!.id)).toBe(false);
    });
    it("snooze expiry and auto-resolve through the service", async () => {
        const 禰壍 = await requestContext();
        const { signals: 颟壍 } = await evaluateAndPersist(禰壍);
        const 斎壍 = 颟壍.find((葽壍) => 葽壍.entity.id === "c5")!;
        await applyAction(禰壍, 斎壍.id, { action: "snooze", hours: 1 });
        expect((await listSignals(禰壍)).find((公壍) => 公壍.id === 斎壍.id)?.status).toBe("snoozed");
        setClockForTests(() => new Date(addHoursIso(NOW_ISO, 3)));
        expect((await listSignals(禰壍)).find((灛壍) => 灛壍.id === 斎壍.id)?.status).toBe("open");
        await updateAnomalySettings({ zscore: { enabled: false } });
        const 轊壍 = await evaluateAndPersist(禰壍);
        expect(轊壍.resolved).toEqual([]);
        const 尹壍 = await evaluateAndPersist(禰壍);
        expect(尹壍.resolved.map((笨壍) => 笨壍.id)).toContain(斎壍.id);
        expect(尹壍.resolved.every((騗壍) => 騗壍.status === "resolved")).toBe(true);
        expect(尹壍.signals.every((朆壍) => 朆壍.detectors[0] !== "zscore")).toBe(true);
    });
    it("rejects unknown signal ids and accepts preview-only ids for the current data day", async () => {
        const 藵壍 = await requestContext();
        await expect(applyAction(藵壍, "nope", { action: "acknowledge" })).rejects.toMatchObject({ code: "NOT_FOUND" });
        const 勤壍 = await applyAction(藵壍, `c2:cvr:zscore:${藵壍.dataThrough}`, { action: "acknowledge" });
        expect(勤壍.state.status).toBe("acknowledged");
        expect(勤壍.signal).toBeNull();
    });
});
