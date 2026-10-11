import "server-only";
import { randomUUID } from "node:crypto";
import type { BudgetPlan, BudgetPlanBody, BudgetTargets, BudgetTargetsBody, BudgetTargetsView, CurveMix, CurvesResponse, DraftLineInput, ForecastResult, OptimizeRequest, OptimizeResult, PacingReport, PlanSuggestRequest, PlanSuggestResult, ResponseCurve, ScenariosRequest, ScenariosResult, } from "@/lib/domain/contracts/budget";
import { addDays, daysInMonth, enumerate, monthEnd, monthKey, monthStart, type DateRange } from "@/lib/domain/dates";
import { CURVE_DAYS, fitResponseCurve } from "@/lib/domain/budget/curves";
import { budgetCsv, changeList, editorBudgetCsv, planCsv, type EditorBudgetRow } from "@/lib/domain/budget/exports";
import { planMonthSchedule } from "@/lib/domain/budget/flighting";
import { forecastSeries, HISTORY_DAYS } from "@/lib/domain/budget/forecast";
import { blendCurves, simulatorCurves } from "@/lib/domain/budget/google";
import { optimizeBudget, type OptimizerInput, type OptimizerUnit } from "@/lib/domain/budget/optimizer";
import { defaultMonthlyTarget, isMonthKey, pacingDetail, pacingFetchRange, spendTargets, suggestionMonth, type UnitPacing } from "@/lib/domain/budget/pacing";
import { currentPlanMonth, defaultCampaignLines, draftLine, monthDays, monthSequence, seasonalIndex, seasonalTotals } from "@/lib/domain/budget/plans";
import { DEFAULT_SCENARIO_PCTS, scenarioFrontier } from "@/lib/domain/budget/scenarios";
import { budgetUnits, DailyIndex, weekdayFactors, type BudgetUnit } from "@/lib/domain/budget/units";
import { round } from "@/lib/domain/stats";
import type { CivilDate } from "@/lib/domain/types";
import type { RequestContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { log } from "../log";
import { audit, getStore } from "../store";
import { loadCampaignDaily, loadCampaigns, loadGoogleEstimates, targetsId } from "./data";
function 蹦壍(孕壍: RequestContext, 穄壍?: string): string {
    if (!穄壍)
        return monthKey(孕壍.dataThrough);
    if (!isMonthKey(穄壍))
        throw new AppError("VALIDATION_ERROR", "month must be YYYY-MM");
    return 穄壍;
}
interface PacingBundle {
    month: string;
    report: PacingReport;
    units: UnitPacing[];
    stored: BudgetTargets | null;
}
async function 餳壍(昢壍: RequestContext, 蔑壍?: string): Promise<PacingBundle> {
    const 刀壍 = 蹦壍(昢壍, 蔑壍);
    const 烯壍 = pacingFetchRange(刀壍, 昢壍.dataThrough);
    const 连壍 = getStore();
    const [峍壍, 箼壍, 骫壍, 枚壍] = await Promise.all([loadCampaignDaily(昢壍, 烯壍), loadCampaigns(昢壍), 连壍.budgetTargets.get(targetsId(昢壍, 刀壍)), 连壍.anomalySettings.get()]);
    const { report: 蚉壍, units: 卸壍 } = pacingDetail({
        month: 刀壍,
        dataThrough: 昢壍.dataThrough,
        campaigns: 箼壍,
        rows: 峍壍,
        targets: 骫壍?.targets,
        locks: 骫壍?.locks,
        currency: 昢壍.account.currency,
        thresholds: { over: 枚壍.pacing?.over, under: 枚壍.pacing?.under },
    });
    return { month: 刀壍, report: 蚉壍, units: 卸壍, stored: 骫壍 };
}
export async function getPacingReport(牧壍: RequestContext, 酖壍?: string): Promise<PacingReport> {
    return (await 餳壍(牧壍, 酖壍)).report;
}
export async function getTargets(幅壍: RequestContext, 紴壍?: string): Promise<BudgetTargetsView> {
    const { month: 鰣壍, units: 椒壍, stored: 蠁壍 } = await 餳壍(幅壍, 紴壍);
    const 哰壍 = Object.fromEntries(椒壍.map((珟壍) => [珟壍.unit.unitId, 珟壍.defaultTarget]));
    const 鋎壍 = 蠁壍 ? null : await 纬壍(幅壍, 鰣壍, 椒壍);
    const 徽壍 = new Date(0).toISOString();
    return {
        id: targetsId(幅壍, 鰣壍),
        month: 鰣壍,
        targets: { ...哰壍, ...(蠁壍?.targets ?? {}) },
        locks: 蠁壍?.locks ?? {},
        version: 蠁壍?.version ?? 0,
        createdAt: 蠁壍?.createdAt ?? 徽壍,
        updatedAt: 蠁壍?.updatedAt ?? 徽壍,
        defaults: 哰壍,
        isDefault: !蠁壍,
        lastMonth: 鋎壍,
    };
}
async function 纬壍(鶛壍: RequestContext, 檊壍: string, 襹壍: readonly UnitPacing[]): Promise<BudgetTargetsView["lastMonth"]> {
    const 器壍 = suggestionMonth(檊壍, 鶛壍.dataThrough);
    if (!器壍)
        return null;
    const 畗壍 = `${器壍}-01`;
    try {
        const 鑆壍 = await loadCampaignDaily(鶛壍, { start: 畗壍, end: monthEnd(畗壍) });
        return spendTargets(襹壍.map((愵壍) => 愵壍.unit), 鑆壍, 器壍, 檊壍);
    }
    catch (耤壍) {
        log.warn("Last month's spend unavailable", { error: 耤壍 instanceof Error ? 耤壍.message : String(耤壍) });
        return null;
    }
}
export async function putTargets(鼓壍: RequestContext, 氂壍: BudgetTargetsBody): Promise<BudgetTargetsView> {
    const 諱壍 = 蹦壍(鼓壍, 氂壍.month);
    const 埠壍 = Object.fromEntries(Object.entries(氂壍.targets).map(([盏壍, 閾壍]) => [盏壍, round(閾壍, 2)]));
    await getStore().budgetTargets.upsert({ id: targetsId(鼓壍, 諱壍), month: 諱壍, targets: 埠壍, locks: 氂壍.locks ?? {} });
    await audit({ actor: "user", action: "budget.targets.update", target: 諱壍, mode: 鼓壍.source.mode, summary: `Updated ${Object.keys(埠壍).length} monthly budget targets for ${諱壍}`, details: { accountId: 鼓壍.accountId } });
    return getTargets(鼓壍, 諱壍);
}
export async function fitCurves(抭壍: RequestContext, 膜壍: readonly BudgetUnit[], 事壍: ResponseCurve["objective"]): Promise<{
    curves: Map<string, ResponseCurve>;
    window: DateRange;
    roas: Map<string, number | null>;
}> {
    const 浺壍 = { start: addDays(抭壍.dataThrough, -(CURVE_DAYS - 1)), end: 抭壍.dataThrough };
    const 豩壍 = await loadCampaignDaily(抭壍, 浺壍);
    const 奘壍 = new DailyIndex(豩壍);
    const 硇壍 = enumerate(浺壍.start, 浺壍.end);
    const 霶壍 = new Map<string, ResponseCurve>();
    const 搥壍 = new Map<string, number | null>();
    for (const 茔壍 of 膜壍) {
        const 倃壍 = 硇壍.map((滲壍) => {
            const 跡壍 = 奘壍.day(茔壍.campaignIds, 滲壍);
            return { spend: 跡壍.cost, outcome: 事壍 === "conv_value" ? 跡壍.conv_value : 跡壍.conversions };
        });
        霶壍.set(茔壍.unitId, fitResponseCurve(茔壍.unitId, 事壍, 倃壍));
        const 嫐壍 = 奘壍.sum(茔壍.campaignIds, addDays(抭壍.dataThrough, -27), 抭壍.dataThrough);
        搥壍.set(茔壍.unitId, 嫐壍.cost > 0 ? 嫐壍.conv_value / 嫐壍.cost : null);
    }
    return { curves: 霶壍, window: 浺壍, roas: 搥壍 };
}
export async function getCurves(禿壍: RequestContext, 颮壍: ResponseCurve["objective"] = "conv_value"): Promise<CurvesResponse> {
    const 斝壍 = budgetUnits(await loadCampaigns(禿壍));
    const { curves: 蒌壍, window: 养壍 } = await fitCurves(禿壍, 斝壍, 颮壍);
    return { objective: 颮壍, window: 养壍, curves: 斝壍.map((灪壍) => ({ ...(蒌壍.get(灪壍.unitId) as ResponseCurve), name: 灪壍.name })) };
}
type OptimizerBase = Pick<OptimizeRequest, "month" | "period" | "objective" | "strategy" | "constraints" | "roundTo"> & {
    total?: number;
    curveSource?: OptimizeRequest["curveSource"];
};
async function 轙壍(屈壍: RequestContext, 笷壍: OptimizerBase, 騦壍: string[] = []): Promise<{
    input: OptimizerInput;
    mix: CurveMix;
}> {
    const { month: 朕壍, report: 蘄壍, units: 勳壍 } = await 餳壍(屈壍, 笷壍.month);
    const 燢壍 = 勳壍.map((郑壍) => 郑壍.unit);
    const 巀壍 = await fitCurves(屈壍, 燢壍, 笷壍.objective);
    const { roas: 粯壍 } = 巀壍;
    let 鮞壍 = 巀壍.curves;
    const 梍壍 = 笷壍.curveSource ?? "auto";
    let 蝼壍: CurveMix = { mode: 梍壍, google: 0, model: 鮞壍.size, available: 0, calibration: null };
    if (梍壍 === "auto") {
        const 呫壍 = await loadGoogleEstimates(屈壍, 騦壍);
        const 獚壍 = blendCurves(鮞壍, simulatorCurves(燢壍, 呫壍.simulations, 笷壍.objective, 屈壍.dataThrough));
        鮞壍 = 獚壍.curves;
        蝼壍 = { mode: 梍壍, google: 獚壍.google, model: 獚壍.model, available: 獚壍.available, calibration: 獚壍.calibration };
    }
    const 鉉壍 = 笷壍.period === "monthly";
    const 弸壍: OptimizerUnit[] = 蘄壍.rows.map((縧壍) => {
        const 鴖壍 = 鉉壍 ? 縧壍.monthlyTarget : (縧壍.dailyBudget ?? 0);
        const 樅壍 = 笷壍.constraints[縧壍.unitId];
        let 裴壍: OptimizerUnit["fixed"];
        if (樅壍?.locked !== undefined)
            裴壍 = { value: 樅壍.locked, reason: "locked" };
        else if (樅壍?.exclude)
            裴壍 = { value: 鴖壍, reason: "excluded" };
        else if (縧壍.locked)
            裴壍 = { value: 鴖壍, reason: "locked" };
        else if (縧壍.paused)
            裴壍 = { value: 鴖壍, reason: "paused" };
        else if (縧壍.status === "unsupported_period" || 縧壍.status === "no_budget")
            裴壍 = { value: 鴖壍, reason: "unsupported" };
        return { unitId: 縧壍.unitId, name: 縧壍.name, current: 鴖壍, curve: 鮞壍.get(縧壍.unitId) ?? null, fixed: 裴壍, min: 樅壍?.min, max: 樅壍?.max, roas: 粯壍.get(縧壍.unitId) ?? null };
    });
    const 嗣壍 = 笷壍.total ?? 弸壍.reduce((瓒壍, 鏁壍) => 瓒壍 + 鏁壍.current, 0);
    return { input: { units: 弸壍, total: round(嗣壍, 2), step: 笷壍.roundTo, days: 鉉壍 ? daysInMonth(`${朕壍}-01`) : 1, objective: 笷壍.objective, strategy: 笷壍.strategy, period: 笷壍.period, currency: 屈壍.account.currency }, mix: 蝼壍 };
}
const 悰壍 = (羟壍: string[], 麎壍: readonly string[]): string[] => [...羟壍, ...麎壍.filter((歽壍) => !羟壍.includes(歽壍))];
export async function optimize(詬壍: RequestContext, 坛壍: OptimizeRequest): Promise<OptimizeResult> {
    const 癊壍: string[] = [];
    const { input: 锹壍, mix: 戨壍 } = await 轙壍(詬壍, 坛壍, 癊壍);
    const 脗壍 = optimizeBudget(锹壍);
    return { ...脗壍, warnings: 癊壍.length ? 悰壍(脗壍.warnings, 癊壍) : 脗壍.warnings, curves: 戨壍 };
}
export async function scenarios(丆壍: RequestContext, 泵壍: ScenariosRequest): Promise<ScenariosResult> {
    const 诤壍: string[] = [];
    const { input: 壓壍 } = await 轙壍(丆壍, 泵壍, 诤壍);
    const { points: 矂壍, warnings: 隱壍 } = scenarioFrontier(壓壍, 泵壍.pcts ?? DEFAULT_SCENARIO_PCTS);
    return { objective: 泵壍.objective, strategy: 泵壍.strategy, period: 泵壍.period, baseTotal: 壓壍.total, points: 矂壍, warnings: 悰壍(隱壍, 诤壍) };
}
export async function forecast(掠壍: RequestContext, 芏壍: {
    metric: ForecastResult["metric"];
    horizon: number;
    campaignId?: string;
}): Promise<ForecastResult> {
    const 佾壍 = await loadCampaigns(掠壍);
    if (芏壍.campaignId && !佾壍.some((湭壍) => 湭壍.id === 芏壍.campaignId))
        throw notFound("Campaign");
    const 赜壍 = { start: addDays(掠壍.dataThrough, -(HISTORY_DAYS - 1)), end: 掠壍.dataThrough };
    const 婋壍 = await loadCampaignDaily(掠壍, 赜壍);
    const 示壍 = 芏壍.campaignId ? [芏壍.campaignId] : 佾壍.map((頩壍) => 頩壍.id);
    const 攘壍 = new DailyIndex(婋壍);
    const 萇壍 = 婋壍.reduce<CivilDate | null>((僶壍, 濥壍) => (僶壍 === null || 濥壍.date < 僶壍 ? 濥壍.date : 僶壍), null);
    const 軔壍 = enumerate(萇壍 && 萇壍 > 赜壍.start ? 萇壍 : 赜壍.start, 赜壍.end).map((寃壍) => {
        const 窲壍 = 攘壍.day(示壍, 寃壍);
        return { date: 寃壍, value: 芏壍.metric === "cost" ? 窲壍.cost : 芏壍.metric === "conversions" ? 窲壍.conversions : 芏壍.metric === "conv_value" ? 窲壍.conv_value : 窲壍.clicks };
    });
    const 馡壍 = 佾壍.filter((暐壍) => (芏壍.campaignId ? 暐壍.id === 芏壍.campaignId : 暐壍.status === "Enabled")).reduce((蕿壍, 剮壍) => 蕿壍 + (剮壍.budget_daily ?? 0), 0);
    return forecastSeries({
        metric: 芏壍.metric,
        campaignId: 芏壍.campaignId,
        history: 軔壍,
        horizon: 芏壍.horizon,
        dailyCap: 芏壍.metric === "cost" && 馡壍 > 0 ? 馡壍 * 2 : null,
        monthEnd: monthEnd(掠壍.today),
    });
}
function 煝壍(遌壍: RequestContext, 崻壍: BudgetPlan | null): BudgetPlan {
    if (!崻壍 || (崻壍.accountId && 崻壍.accountId !== 遌壍.accountId))
        throw notFound("Budget plan");
    return 崻壍;
}
export async function listPlans(簪壍: RequestContext): Promise<BudgetPlan[]> {
    const 鬙壍 = await getStore().budgetPlans.list((栈壍) => !栈壍.accountId || 栈壍.accountId === 簪壍.accountId);
    return 鬙壍.sort((蛷壍, 另壍) => 另壍.updatedAt.localeCompare(蛷壍.updatedAt));
}
export async function getPlan(狕壍: RequestContext, 釄壍: string): Promise<BudgetPlan> {
    return 煝壍(狕壍, await getStore().budgetPlans.get(釄壍));
}
export async function getPlanWithSchedule(庳壍: RequestContext, 綢壍: string, 鲑壍: string): Promise<BudgetPlan & {
    schedule: {
        month: string;
        days: ReturnType<typeof planMonthSchedule>;
    };
}> {
    const 榀壍 = await getPlan(庳壍, 綢壍);
    if (!isMonthKey(鲑壍))
        throw new AppError("VALIDATION_ERROR", "schedule must be YYYY-MM");
    const 衯壍 = await loadCampaignDaily(庳壍, { start: addDays(庳壍.dataThrough, -55), end: 庳壍.dataThrough });
    const 啞壍 = new DailyIndex(衯壍);
    const 瑍壍 = [...new Set(衯壍.map((錼壍) => 錼壍.campaign_id))];
    const 怫壍 = weekdayFactors((缚壍) => 啞壍.day(瑍壍, 缚壍).cost, 庳壍.dataThrough, 56);
    return { ...榀壍, schedule: { month: 鲑壍, days: planMonthSchedule(榀壍.lines, 鲑壍, 怫壍) } };
}
function 鸉壍(櫸壍: readonly string[]): string[] {
    for (const 觧壍 of 櫸壍)
        if (!isMonthKey(觧壍))
            throw new AppError("VALIDATION_ERROR", `Invalid month ${觧壍}`);
    return [...new Set(櫸壍)].sort();
}
export async function createPlan(囖壍: RequestContext, 病壍: BudgetPlanBody): Promise<BudgetPlan> {
    const 钴壍 = 鸉壍(病壍.months);
    let 憣壍 = 病壍.lines;
    if (!憣壍.length) {
        const 肒壍 = budgetUnits(await loadCampaigns(囖壍)).filter((龁壍) => !龁壍.paused && 龁壍.period === "daily");
        憣壍 = defaultCampaignLines(肒壍.map((汰壍) => ({ unitId: 汰壍.unitId, name: 汰壍.name, type: 汰壍.type, dailyBudget: 汰壍.dailyBudget })), 钴壍);
    }
    const 譟壍 = await getStore().budgetPlans.create({ ...病壍, months: 钴壍, lines: 憣壍, accountId: 病壍.accountId ?? 囖壍.accountId });
    await audit({ actor: "user", action: "budget.plan.create", target: 譟壍.id, mode: 囖壍.source.mode, summary: `Created budget plan “${譟壍.name}” (${钴壍.join(", ")})` });
    return 譟壍;
}
export async function updatePlan(塎壍: RequestContext, 眽壍: string, 阬壍: BudgetPlanBody, 挛壍?: number): Promise<BudgetPlan> {
    await getPlan(塎壍, 眽壍);
    const 舊壍 = 鸉壍(阬壍.months);
    return getStore().budgetPlans.update(眽壍, (仹壍) => ({ ...仹壍, ...阬壍, months: 舊壍, accountId: 仹壍.accountId ?? 塎壍.accountId }), { expectedVersion: 挛壍 });
}
export async function deletePlan(淨壍: RequestContext, 賗壍: string): Promise<void> {
    const 姆壍 = await getPlan(淨壍, 賗壍);
    await getStore().budgetPlans.delete(賗壍);
    await audit({ actor: "user", action: "budget.plan.delete", target: 賗壍, mode: 淨壍.source.mode, summary: `Deleted budget plan “${姆壍.name}”` });
}
export async function addPlanLine(碵壍: RequestContext, 鞤壍: string, 撓壍: DraftLineInput): Promise<BudgetPlan> {
    const 莂壍 = await getPlan(碵壍, 鞤壍);
    const 偱壍 = 莂壍.lines.find((潠壍) => 潠壍.kind === 撓壍.kind && 潠壍.refId === 撓壍.refId);
    const 蹏壍 = 偱壍?.id ?? `${撓壍.kind === "draft_idea" ? "idea" : "channel"}-${randomUUID().slice(0, 8)}`;
    const 嬾壍 = draftLine(撓壍, 莂壍.months, 蹏壍);
    const 稭壍 = 偱壍 ? 莂壍.lines.map((餜壍) => (餜壍.id === 偱壍.id ? { ...嬾壍, locked: 餜壍.locked } : 餜壍)) : [...莂壍.lines, 嬾壍];
    if (稭壍.length > 200)
        throw new AppError("VALIDATION_ERROR", "A plan can hold at most 200 lines");
    return getStore().budgetPlans.update(鞤壍, (昋壍) => ({ ...昋壍, lines: 稭壍 }));
}
export async function syncIdeaPlanLine(蓺壍: RequestContext, 凩壍: {
    id: string;
    title: string;
    type: string;
    dailyBudget: number;
    rationale?: string;
}, 烘壍: boolean): Promise<void> {
    if (烘壍) {
        const 过壍 = await ensureDefaultPlan(蓺壍);
        await addPlanLine(蓺壍, 过壍.id, { kind: "draft_idea", refId: 凩壍.id, name: 凩壍.title.slice(0, 120), campaignType: 凩壍.type, dailyBudget: Math.max(1, Math.round(凩壍.dailyBudget)), notes: 凩壍.rationale?.slice(0, 400) });
        return;
    }
    for (const 岶壍 of await listPlans(蓺壍)) {
        if (!岶壍.lines.some((箥壍) => 箥壍.kind === "draft_idea" && 箥壍.refId === 凩壍.id))
            continue;
        await getStore().budgetPlans.update(岶壍.id, (骔壍) => ({ ...骔壍, lines: 骔壍.lines.filter((枃壍) => !(枃壍.kind === "draft_idea" && 枃壍.refId === 凩壍.id)) }));
    }
}
export async function ensureDefaultPlan(虲壍: RequestContext): Promise<BudgetPlan> {
    const 卡壍 = (await listPlans(虲壍)).filter((牐壍) => 牐壍.status !== "archived");
    if (卡壍[0])
        return 卡壍[0];
    const 鄿壍 = monthSequence(monthKey(addDays(monthEnd(虲壍.dataThrough), 1)), 3);
    return createPlan(虲壍, { name: "Next quarter plan", months: 鄿壍, objective: "conv_value", status: "draft", lines: [] });
}
async function 帮壍(紝壍: RequestContext): Promise<Record<string, number>> {
    const 鰌壍 = await 紝壍.source.coverage(紝壍.accountId, "campaign_daily");
    if (!鰌壍)
        return {};
    const 棻壍 = await loadCampaignDaily(紝壍, 鰌壍);
    const 蟪壍: Record<string, number> = {};
    for (const 哙壍 of 棻壍)
        蟪壍[monthKey(哙壍.date)] = (蟪壍[monthKey(哙壍.date)] ?? 0) + 哙壍.cost;
    const 珈壍 = monthStart(鰌壍.start) === 鰌壍.start ? monthKey(鰌壍.start) : monthKey(addDays(monthEnd(鰌壍.start), 1));
    const 銷壍 = monthEnd(鰌壍.end) === 鰌壍.end ? monthKey(鰌壍.end) : monthKey(addDays(monthStart(鰌壍.end), -1));
    return Object.fromEntries(Object.entries(蟪壍).filter(([徦壍]) => 徦壍 >= 珈壍 && 徦壍 <= 銷壍));
}
export async function suggestPlan(纕壍: RequestContext, 鶄壍: string, 橳壍: PlanSuggestRequest): Promise<PlanSuggestResult> {
    const 襢壍 = await getPlan(纕壍, 鶄壍);
    const 噑壍: string[] = [];
    const 畀壍 = seasonalIndex(await 帮壍(纕壍));
    if (畀壍.source === "retail_preset")
        噑壍.push("Less than 13 months of history: using the retail seasonality preset.");
    const 鐯壍 = monthKey(纕壍.dataThrough);
    const 愞壍 = budgetUnits(await loadCampaigns(纕壍));
    const 耍壍 = new Map(愞壍.map((黼壍) => [黼壍.unitId, 黼壍]));
    const 毫壍 = 襢壍.lines.filter((諚壍) => 諚壍.kind === "campaign" && 耍壍.has(諚壍.refId));
    const 埉壍 = 毫壍.reduce((皸壍, 閧壍) => {
        const 抖壍 = 耍壍.get(閧壍.refId);
        return 皸壍 + (抖壍 && !抖壍.paused ? (抖壍.dailyBudget ?? 0) : 0);
    }, 0);
    const 膅壍 = seasonalTotals(襢壍.months, 埉壍, 畀壍, 鐯壍);
    const { curves: 乴壍 } = await fitCurves(纕壍, 毫壍.map((浣壍) => 耍壍.get(浣壍.refId) as BudgetUnit), 襢壍.objective);
    const 豒壍 = 襢壍.lines.map((奁壍) => ({ ...奁壍, monthly: { ...奁壍.monthly } }));
    for (const 砰壍 of 襢壍.months) {
        const 霟壍 = 橳壍.totals?.[砰壍] ?? Math.round((膅壍[砰壍] ?? 0) / 橳壍.roundTo) * 橳壍.roundTo;
        const 搎壍 = 豒壍.filter((苽壍) => 苽壍.kind === "campaign" && 耍壍.has(苽壍.refId));
        const 俬壍 = (滛壍: (typeof 豒壍)[number]) => 滛壍.monthly[砰壍] ?? defaultMonthlyTarget(耍壍.get(滛壍.refId)?.dailyBudget ?? null, 砰壍);
        const 跊壍 = 搎壍.reduce((媹壍, 禨壍) => 媹壍 + 俬壍(禨壍), 0);
        const 颗壍 = 跊壍 > 0 ? 霟壍 / 跊壍 : 1;
        const 斆壍: OptimizerUnit[] = 搎壍.map((葵壍) => {
            const 兤壍 = 耍壍.get(葵壍.refId) as BudgetUnit;
            const 灓壍 = 俬壍(葵壍);
            return {
                unitId: 葵壍.id,
                name: 葵壍.name,
                current: 灓壍,
                curve: 乴壍.get(兤壍.unitId) ?? null,
                fixed: 葵壍.locked || 兤壍.paused ? { value: 灓壍, reason: 葵壍.locked ? "locked" : "paused" } : undefined,
                boundsBase: 灓壍 * 颗壍,
            };
        });
        const 轂壍 = optimizeBudget({ units: 斆壍, total: 霟壍, step: 橳壍.roundTo, days: monthDays(砰壍), objective: 襢壍.objective, strategy: 橳壍.strategy, period: "monthly", currency: 纕壍.account.currency });
        for (const 就壍 of 轂壍.warnings)
            if (!噑壍.includes(就壍))
                噑壍.push(就壍);
        for (const 笠壍 of 轂壍.rows) {
            const 騏壍 = 豒壍.find((曾壍) => 曾壍.id === 笠壍.unitId);
            if (!騏壍 || 騏壍.locked)
                continue;
            騏壍.monthly[砰壍] = 笠壍.recommended;
            騏壍.origin = "optimizer";
        }
    }
    const 藭壍 = await getStore().budgetPlans.update(鶄壍, (勜壍) => ({ ...勜壍, lines: 豒壍 }));
    return { plan: 藭壍, index: 襢壍.months.map((燋壍) => ({ month: 燋壍, factor: 畀壍.factors[Number(燋壍.slice(5, 7)) - 1] ?? 1 })), indexSource: 畀壍.source, warnings: 噑壍 };
}
export interface FileExport {
    body: string;
    contentType: string;
    filename: string;
    warnings: string[];
}
const 邺壍 = "text/csv; charset=utf-8";
export async function exportPlan(嶩壍: RequestContext, 粘壍: string, 鮇壍: "csv" | "editor" | "changes", 桶壍?: string): Promise<FileExport> {
    const 蝥壍 = await getPlan(嶩壍, 粘壍);
    const 呔壍 = 蝥壍.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "plan";
    if (鮇壍 === "csv")
        return { body: planCsv(蝥壍), contentType: 邺壍, filename: `${呔壍}.csv`, warnings: [] };
    const 獃壍 = 桶壍 ? 蹦壍(嶩壍, 桶壍) : currentPlanMonth(蝥壍, 嶩壍.dataThrough);
    if (!蝥壍.months.includes(獃壍))
        throw new AppError("VALIDATION_ERROR", `The plan does not cover ${獃壍}`);
    const 鈲壍 = new Map((await loadCampaigns(嶩壍)).map((弡壍) => [弡壍.id, 弡壍]));
    const 縐壍: string[] = [];
    const 鳿壍: {
        name: string;
        id: string;
        from: number | null;
        to: number;
        status: EditorBudgetRow["status"];
    }[] = [];
    for (const 槮壍 of 蝥壍.lines) {
        if (槮壍.kind !== "campaign") {
            縐壍.push(`“${槮壍.name}” is a draft (${槮壍.kind === "draft_idea" ? "AI idea" : "channel"}) — create it first; it is not in the export.`);
            continue;
        }
        const 裝壍 = 鈲壍.get(槮壍.refId);
        if (!裝壍) {
            縐壍.push(`“${槮壍.name}” is a shared budget or unknown campaign; edit it in Google Ads (Shared library).`);
            continue;
        }
        鳿壍.push({ name: 裝壍.name, id: 裝壍.id, from: 裝壍.budget_daily, to: round((槮壍.monthly[獃壍] ?? 0) / monthDays(獃壍), 2), status: 裝壍.status });
    }
    if (鮇壍 === "changes")
        return { body: changeList(鳿壍, 嶩壍.account.currency).join("\n") + "\n", contentType: "text/plain; charset=utf-8", filename: `${呔壍}-${獃壍}-changes.txt`, warnings: 縐壍 };
    const 嗌壍 = editorBudgetCsv(鳿壍.map((璻壍) => ({ campaign: 璻壍.name, campaignId: 璻壍.id, dailyBudget: 璻壍.to, status: 璻壍.status })));
    return { body: 嗌壍.csv, contentType: 邺壍, filename: `${呔壍}-${獃壍}-editor.csv`, warnings: [...縐壍, ...嗌壍.warnings] };
}
export async function budgetExport(鎪壍: RequestContext, 悙壍: {
    month?: string;
    from: "recommended" | "targets";
    format: "editor" | "csv" | "text";
}): Promise<FileExport> {
    const { month: 羈壍, report: 鹷壍, stored: 武壍 } = await 餳壍(鎪壍, 悙壍.month);
    const 評壍 = new Map((await loadCampaigns(鎪壍)).map((坄壍) => [坄壍.id, 坄壍]));
    const 瘳壍: string[] = [];
    const 锢壍 = 悙壍.format !== "csv";
    const 我壍 = 鹷壍.rows.flatMap((脀壍) => {
        const 鿯壍 = 脀壍.campaignIds.length === 1 ? 評壍.get(脀壍.campaignIds[0] as string) : undefined;
        if (!鿯壍) {
            瘳壍.push(`${脀壍.name}: shared budgets are edited in Google Ads (Shared library); not included.`);
            return [];
        }
        if (脀壍.status === "unsupported_period") {
            瘳壍.push(`${脀壍.name}: custom-period budget; not included.`);
            return [];
        }
        const 泞壍 = round(悙壍.from === "recommended" ? (脀壍.recommendedDaily ?? 脀壍.dailyBudget ?? 0) : 脀壍.monthlyTarget / 鹷壍.daysInMonth, 2);
        if (锢壍 && 悙壍.from === "targets" && 脀壍.status === "paused" && 武壍?.targets[脀壍.unitId] === undefined) {
            瘳壍.push(`${脀壍.name}: paused, no monthly target set; not included.`);
            return [];
        }
        if (锢壍 && 泞壍 <= 0) {
            瘳壍.push(`${脀壍.name}: no daily budget to set; not included.`);
            return [];
        }
        return [{ row: 脀壍, campaign: 鿯壍, newDaily: 泞壍 }];
    });
    if (悙壍.from === "recommended" && 鹷壍.remainingDays === 0)
        瘳壍.push(`${鹷壍.monthLabel} is complete; recommended budgets equal the current ones.`);
    const 词壍 = `budgets-${羈壍}-${悙壍.from}`;
    if (悙壍.format === "text") {
        const 墼壍 = changeList(我壍.map((瞫壍) => ({ name: 瞫壍.campaign.name, from: 瞫壍.campaign.budget_daily, to: 瞫壍.newDaily })), 鎪壍.account.currency);
        return { body: (墼壍.length ? 墼壍 : ["No budget changes."]).join("\n") + "\n", contentType: "text/plain; charset=utf-8", filename: `${词壍}.txt`, warnings: 瘳壍 };
    }
    if (悙壍.format === "csv") {
        const 隚壍 = budgetCsv(我壍.map((掉壍) => ({ name: 掉壍.campaign.name, unitId: 掉壍.row.unitId, currentDaily: 掉壍.campaign.budget_daily, newDaily: 掉壍.newDaily, monthlyTarget: 掉壍.row.monthlyTarget, mtdSpend: 掉壍.row.mtdSpend, projected: 掉壍.row.projected, status: 掉壍.row.status })));
        return { body: 隚壍, contentType: 邺壍, filename: `${词壍}.csv`, warnings: 瘳壍 };
    }
    const 艸壍 = editorBudgetCsv(我壍.map((佧壍) => ({ campaign: 佧壍.campaign.name, campaignId: 佧壍.campaign.id, dailyBudget: 佧壍.newDaily, status: 佧壍.campaign.status })));
    return { body: 艸壍.csv, contentType: 邺壍, filename: `${词壍}-editor.csv`, warnings: [...瘳壍, ...艸壍.warnings] };
}
