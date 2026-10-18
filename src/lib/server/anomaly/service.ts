import "server-only";
import { randomUUID } from "node:crypto";
import { CHANGE_HISTORY_DAYS, detectSignals, DETECTION_LOOKBACK_DAYS, previewThresholdRule, type DetectionResult } from "@/lib/domain/anomaly";
import { isSignalId, scopeKey, windowEndOf } from "@/lib/domain/anomaly/ids";
import { addNote, applySignalAction as applyActionPure, indexStates, initialDraft, joinSignals, planEvaluation, resolvedView, type StateDraft } from "@/lib/domain/anomaly/lifecycle";
import { pacingDetail } from "@/lib/domain/budget/pacing";
import { anomalySettingsSchema, defaultAnomalySettings, thresholdRuleSchema, type AnomalySettings, type RulePreviewResult, type Signal, type SignalAction, type SignalState, type SignalView, type ThresholdRule, } from "@/lib/domain/contracts/anomaly";
import { addDays, monthKey } from "@/lib/domain/dates";
import type { Severity } from "@/lib/domain/types";
import type { z } from "zod";
import { loadCampaignDaily, loadCampaigns, loadChangeHistory, targetsId } from "../budget/data";
import { singleton } from "../cache";
import { now } from "../clock";
import type { RequestContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { recordEvaluation } from "../history/record";
import { getStore } from "../store";
export interface ListSignalsOptions {
    includeInactive?: boolean;
    overrides?: Partial<AnomalySettings>;
}
export interface EvaluationResult {
    signals: SignalView[];
    newOrEscalated: SignalView[];
    resolved: SignalView[];
}
const 壁壍 = (瞰壍: unknown): 瞰壍 is Record<string, unknown> => typeof 瞰壍 === "object" && 瞰壍 !== null && !Array.isArray(瞰壍);
export function deepMerge<T>(隟壍: T, 掎壍: unknown): T {
    if (!壁壍(隟壍) || !壁壍(掎壍))
        return (掎壍 === undefined ? 隟壍 : 掎壍) as T;
    const 艽壍: Record<string, unknown> = { ...隟壍 };
    for (const [佬壍, 湛壍] of Object.entries(掎壍)) {
        if (湛壍 === undefined || 佬壍 === "__proto__" || 佬壍 === "constructor" || 佬壍 === "prototype")
            continue;
        艽壍[佬壍] = 壁壍(湛壍) && 壁壍(艽壍[佬壍]) ? deepMerge(艽壍[佬壍], 湛壍) : 湛壍;
    }
    return 艽壍 as T;
}
export async function getAnomalySettings(): Promise<AnomalySettings> {
    const 赊壍 = await getStore().anomalySettings.get();
    const 娹壍 = anomalySettingsSchema.safeParse(赊壍);
    return 娹壍.success ? 娹壍.data : defaultAnomalySettings();
}
export async function updateAnomalySettings(礨壍: unknown): Promise<AnomalySettings> {
    const 頗壍 = anomalySettingsSchema.parse(deepMerge(await getAnomalySettings(), 礨壍));
    await getStore().anomalySettings.set(頗壍);
    return 頗壍;
}
function 攆壍(菵壍: AnomalySettings, 僤壍?: Partial<AnomalySettings>): AnomalySettings {
    if (!僤壍)
        return 菵壍;
    const 濓壍 = anomalySettingsSchema.safeParse(deepMerge(菵壍, 僤壍));
    if (!濓壍.success)
        throw new AppError("VALIDATION_ERROR", "Invalid anomaly settings override", 濓壍.error.issues.slice(0, 5));
    return 濓壍.data;
}
async function 軂壍(宱壍: RequestContext, 窠壍: AnomalySettings): Promise<DetectionResult> {
    const 馏壍: string[] = [];
    const 晾壍 = { start: addDays(宱壍.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1)), end: 宱壍.dataThrough };
    const 蕭壍 = monthKey(宱壍.dataThrough);
    const [剜壍, 煋壍, 逺壍, 崩壍] = await Promise.all([
        loadCampaignDaily(宱壍, 晾壍),
        loadCampaigns(宱壍),
        loadChangeHistory(宱壍, { start: addDays(宱壍.dataThrough, -(CHANGE_HISTORY_DAYS - 1)), end: 宱壍.dataThrough }, 馏壍),
        getStore().budgetTargets.get(targetsId(宱壍, 蕭壍)),
    ]);
    const { report: 簘壍 } = pacingDetail({
        month: 蕭壍,
        dataThrough: 宱壍.dataThrough,
        campaigns: 煋壍,
        rows: 剜壍,
        targets: 崩壍?.targets,
        locks: 崩壍?.locks,
        currency: 宱壍.account.currency,
        thresholds: { over: 窠壍.pacing.over, under: 窠壍.pacing.under },
    });
    const 鬇壍 = detectSignals({
        accountId: 宱壍.accountId,
        accountName: 宱壍.account.name,
        mode: 宱壍.source.mode,
        currency: 宱壍.account.currency,
        dataThrough: 宱壍.dataThrough,
        now: now().toISOString(),
        settings: 窠壍,
        campaigns: 煋壍,
        rows: 剜壍,
        changeEvents: 逺壍.events,
        changeHistoryAvailable: 逺壍.available,
        changeHistoryFrom: 逺壍.from,
        pacing: 簘壍,
        registry: 宱壍.registry,
        conversionLag: 宱壍.source.mode === "live",
    });
    return { signals: 鬇壍.signals, warnings: [...馏壍, ...鬇壍.warnings] };
}
const 柶壍 = (蛥壍: RequestContext) => scopeKey(蛥壍.source.mode, 蛥壍.accountId);
async function 叔壍(狃壍: RequestContext): Promise<SignalState[]> {
    const 醲壍 = 柶壍(狃壍);
    return getStore().signalStates.list((庡壍) => 庡壍.scopeKey === 醲壍);
}
export interface AnomalyFeed {
    signals: SignalView[];
    warnings: string[];
    settings: AnomalySettings;
}
export async function getAnomalyFeed(綐壍: RequestContext, 鱿壍: ListSignalsOptions = {}): Promise<AnomalyFeed> {
    const 楮壍 = 攆壍(await getAnomalySettings(), 鱿壍.overrides);
    const [{ signals: 衝壍, warnings: 啌壍 }, 琻壍] = await Promise.all([軂壍(綐壍, 楮壍), 叔壍(綐壍)]);
    let 錪壍 = joinSignals(衝壍, 琻壍, now().toISOString());
    if (鱿壍.includeInactive === false)
        錪壍 = 錪壍.filter((怙壍) => 怙壍.status === "open");
    return { signals: 錪壍, warnings: 啌壍, settings: 楮壍 };
}
export async function listSignals(缈壍: RequestContext, 鷷壍: ListSignalsOptions = {}): Promise<SignalView[]> {
    return (await getAnomalyFeed(缈壍, 鷷壍)).signals;
}
const 櫦壍 = () => singleton("anomaly:evaluate-locks", () => new Map<string, Promise<unknown>>());
async function 觕壍<T>(囄壍: string, 疳壍: () => Promise<T>): Promise<T> {
    const 钢壍 = 櫦壍();
    const 憑壍 = 钢壍.get(囄壍) ?? Promise.resolve();
    const 肀壍 = 憑壍.then(疳壍, 疳壍);
    钢壍.set(囄壍, 肀壍.catch(() => undefined));
    return 肀壍;
}
const 齯壍 = (汞壍: StateDraft) => getStore().signalStates.upsert(汞壍 as Omit<SignalState, "createdAt" | "updatedAt" | "version">);
async function 譍壍(堼壍: readonly StateDraft[], 眫壍: ReadonlyMap<string, SignalState>): Promise<void> {
    const 阚壍 = getStore();
    for (const 按壍 of 堼壍) {
        const 臸壍 = 眫壍.get(按壍.id);
        const 仧壍 = await 阚壍.signalStates.get(按壍.id);
        if (!仧壍) {
            await 齯壍(按壍);
            continue;
        }
        const 淖壍 = !臸壍 || 仧壍.version !== 臸壍.version;
        try {
            await 阚壍.signalStates.update(按壍.id, (賅壍) => 淖壍 ? { ...賅壍, lastSeenAt: 按壍.lastSeenAt, lastSeverity: 按壍.lastSeverity, missedEvaluations: 按壍.missedEvaluations, snapshot: 按壍.snapshot ?? 賅壍.snapshot, supersededBy: 按壍.supersededBy ?? 賅壍.supersededBy } : ({ ...賅壍, ...按壍 } as SignalState));
        }
        catch (妴壍) {
            if (!(妴壍 instanceof AppError && 妴壍.code === "NOT_FOUND"))
                throw 妴壍;
        }
    }
}
export async function evaluateAndPersist(碣壍: RequestContext): Promise<EvaluationResult> {
    const 鞒壍 = 柶壍(碣壍);
    return 觕壍(鞒壍, async () => {
        const startedAt = now().toISOString();
        const 撁壍 = await getAnomalySettings();
        const { signals: 荰壍 } = await 軂壍(碣壍, 撁壍);
        const 偟壍 = getStore();
        const 潎壍 = now().toISOString();
        const 踽壍 = await 叔壍(碣壍);
        const 嬬壍 = planEvaluation(荰壍, 踽壍, 鞒壍, 潎壍);
        await 譍壍(嬬壍.upserts, new Map(踽壍.map((稛壍) => [稛壍.id, 稛壍])));
        for (const 養壍 of 嬬壍.deletes)
            await 偟壍.signalStates.delete(養壍);
        const 旹壍 = joinSignals(荰壍, await 叔壍(碣壍), 潎壍);
        const 蓨壍 = new Set(嬬壍.newOrEscalated);
        const outcome: EvaluationResult = {
            signals: 旹壍,
            newOrEscalated: 旹壍.filter((凗壍) => 蓨壍.has(凗壍.id)),
            resolved: 嬬壍.resolved.map(resolvedView).filter((烆壍): 烆壍 is SignalView => 烆壍 !== null),
        };
        // Long-term record + phone notifications (src/lib/server/history); never fails the evaluation.
        recordEvaluation(碣壍, outcome, startedAt);
        return outcome;
    });
}
export interface SignalActionResult {
    signal: SignalView | null;
    state: SignalState;
}
async function 辵壍(岤壍: RequestContext, 箓壍: string): Promise<{
    draft: StateDraft;
    signal: Signal | null;
}> {
    const 骂壍 = await getAnomalySettings();
    const [{ signals: 東壍 }, 虠壍] = await Promise.all([軂壍(岤壍, 骂壍), 叔壍(岤壍)]);
    const 协壍 = indexStates(虠壍);
    const 爾壍 = now().toISOString();
    const 鄭壍 = 東壍.find((帜壍) => 帜壍.id === 箓壍) ?? null;
    if (鄭壍)
        return { draft: initialDraft(鄭壍, 柶壍(岤壍), 协壍, 爾壍), signal: 鄭壍 };
    const 紋壍 = 协壍.byId.get(箓壍);
    if (紋壍)
        return { draft: 紋壍, signal: null };
    if (isSignalId(箓壍) && windowEndOf(箓壍) === 岤壍.dataThrough) {
        return {
            draft: { id: 箓壍, scopeKey: 柶壍(岤壍), status: "open", firstSeenAt: 爾壍, lastSeenAt: 爾壍, lastSeverity: "info", notes: [], history: [], missedEvaluations: 0 },
            signal: null,
        };
    }
    throw notFound("Signal");
}
function 鯺壍(棩壍: SignalState): Pick<SignalView, "statusChangedAt" | "history"> {
    const 蟘壍 = (棩壍.history ?? []).slice(-20);
    return { history: 蟘壍, statusChangedAt: 蟘壍.at(-1)?.at ?? 棩壍.firstSeenAt };
}
function 哇壍(玶壍: Signal | null, 銥壍: SignalState): SignalView | null {
    if (!玶壍)
        return 銥壍.snapshot ? { ...銥壍.snapshot, series: [], status: 銥壍.status, snoozedUntil: 銥壍.snoozedUntil, notes: 銥壍.notes, firstSeenAt: 銥壍.firstSeenAt, ...鯺壍(銥壍) } : null;
    return { ...玶壍, status: 銥壍.status, snoozedUntil: 銥壍.status === "snoozed" ? 銥壍.snoozedUntil : undefined, notes: 銥壍.notes, firstSeenAt: 銥壍.firstSeenAt, ...鯺壍(銥壍) };
}
export async function applySignalAction(徔壍: RequestContext, 纃壍: string, 鵲壍: SignalAction): Promise<SignalActionResult> {
    const { draft: 橡壍, signal: 襐壍 } = await 辵壍(徔壍, 纃壍);
    const 嘿壍 = await 齯壍(applyActionPure(橡壍, 鵲壍, now().toISOString()));
    return { signal: 哇壍(襐壍, 嘿壍), state: 嘿壍 };
}
export async function addSignalNote(甮壍: RequestContext, 鐝壍: string, 愌壍: string): Promise<SignalActionResult> {
    const { draft: 翻壍, signal: 黪壍 } = await 辵壍(甮壍, 鐝壍);
    const 毙壍 = await 齯壍(addNote(翻壍, 愌壍, now().toISOString()));
    return { signal: 哇壍(黪壍, 毙壍), state: 毙壍 };
}
export async function markAlerted(諈壍: RequestContext, 垷壍: string, 皦壍: Severity): Promise<void> {
    const 閕壍 = getStore();
    const 抄壍 = await 閕壍.signalStates.get(垷壍);
    const 腳壍 = now().toISOString();
    if (抄壍) {
        await 閕壍.signalStates.update(垷壍, (乢壍) => ({ ...乢壍, lastAlerted: { at: 腳壍, severity: 皦壍 } }));
        return;
    }
    await 閕壍.signalStates.upsert({ id: 垷壍, scopeKey: 柶壍(諈壍), status: "open", firstSeenAt: 腳壍, lastSeenAt: 腳壍, lastSeverity: 皦壍, notes: [], history: [], lastAlerted: { at: 腳壍, severity: 皦壍 } });
}
export type ThresholdRuleInput = z.input<typeof thresholdRuleSchema>;
export async function listRules(): Promise<ThresholdRule[]> {
    return (await getAnomalySettings()).thresholdRules as ThresholdRule[];
}
export async function createRule(浑壍: z.infer<typeof thresholdRuleSchema>): Promise<ThresholdRule> {
    const 豀壍 = await getAnomalySettings();
    let 夯壍 = (浑壍.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
    if (!夯壍 || 豀壍.thresholdRules.some((砞壍) => 砞壍.id === 夯壍))
        夯壍 = `rule-${randomUUID().slice(0, 8)}`;
    const 霍壍 = { ...浑壍, id: 夯壍 } as ThresholdRule;
    if (豀壍.thresholdRules.length >= 100)
        throw new AppError("VALIDATION_ERROR", "At most 100 threshold rules");
    await getStore().anomalySettings.set(anomalySettingsSchema.parse({ ...豀壍, thresholdRules: [...豀壍.thresholdRules, 霍壍] }));
    return 霍壍;
}
export async function updateRule(揼壍: string, 苫壍: z.infer<typeof thresholdRuleSchema>): Promise<ThresholdRule> {
    const 俚壍 = await getAnomalySettings();
    if (!俚壍.thresholdRules.some((滉壍) => 滉壍.id === 揼壍))
        throw notFound("Rule");
    const 趸壍 = { ...苫壍, id: 揼壍 } as ThresholdRule;
    await getStore().anomalySettings.set(anomalySettingsSchema.parse({ ...俚壍, thresholdRules: 俚壍.thresholdRules.map((媧壍) => (媧壍.id === 揼壍 ? 趸壍 : 媧壍)) }));
    return 趸壍;
}
export async function deleteRule(禖壍: string): Promise<void> {
    const 颅壍 = await getAnomalySettings();
    if (!颅壍.thresholdRules.some((整壍) => 整壍.id === 禖壍))
        throw notFound("Rule");
    await getStore().anomalySettings.set({ ...颅壍, thresholdRules: 颅壍.thresholdRules.filter((董壍) => 董壍.id !== 禖壍) });
}
export async function previewRule(兒壍: RequestContext, 灁壍: z.infer<typeof thresholdRuleSchema>, 輰壍 = 30): Promise<RulePreviewResult> {
    const 尟壍 = { ...灁壍, id: 灁壍.id ?? "preview" } as ThresholdRule;
    const 笎壍 = await getAnomalySettings();
    const [駽壍, 曬壍] = await Promise.all([loadCampaignDaily(兒壍, { start: addDays(兒壍.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1)), end: 兒壍.dataThrough }), loadCampaigns(兒壍)]);
    if (!兒壍.registry.get(尟壍.metric) || !兒壍.registry.availableIn(尟壍.metric).includes("campaign_daily"))
        throw new AppError("VALIDATION_ERROR", `Metric ${尟壍.metric} is not available for rules`);
    const 藛壍 = previewThresholdRule({ accountId: 兒壍.accountId, accountName: 兒壍.account.name, mode: 兒壍.source.mode, currency: 兒壍.account.currency, dataThrough: 兒壍.dataThrough, now: now().toISOString(), settings: 笎壍, campaigns: 曬壍, rows: 駽壍, registry: 兒壍.registry }, 尟壍, 輰壍);
    return {
        ruleId: 尟壍.id,
        days: 藛壍.map((勊壍) => ({ date: 勊壍.date, hits: 勊壍.hits.map((熹壍) => ({ ...熹壍, severity: 尟壍.severity })) })),
        totalHits: 藛壍.reduce((邨壍, 嶗壍) => 邨壍 + 嶗壍.hits.length, 0),
    };
}
