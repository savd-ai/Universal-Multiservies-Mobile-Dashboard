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
function resolveMonth(ctx: RequestContext, month?: string): string {
    if (!month)
        return monthKey(ctx.dataThrough);
    if (!isMonthKey(month))
        throw new AppError("VALIDATION_ERROR", "month must be YYYY-MM");
    return month;
}
interface PacingBundle {
    month: string;
    report: PacingReport;
    units: UnitPacing[];
    stored: BudgetTargets | null;
}
async function pacingBundle(ctx: RequestContext, month?: string): Promise<PacingBundle> {
    const m = resolveMonth(ctx, month);
    const range = pacingFetchRange(m, ctx.dataThrough);
    const store = getStore();
    const [rows, campaigns, stored, settings] = await Promise.all([loadCampaignDaily(ctx, range), loadCampaigns(ctx), store.budgetTargets.get(targetsId(ctx, m)), store.anomalySettings.get()]);
    const { report, units } = pacingDetail({
        month: m,
        dataThrough: ctx.dataThrough,
        campaigns,
        rows,
        targets: stored?.targets,
        locks: stored?.locks,
        currency: ctx.account.currency,
        thresholds: { over: settings.pacing?.over, under: settings.pacing?.under },
    });
    return { month: m, report, units, stored };
}
export async function getPacingReport(ctx: RequestContext, month?: string): Promise<PacingReport> {
    return (await pacingBundle(ctx, month)).report;
}
export async function getTargets(ctx: RequestContext, month?: string): Promise<BudgetTargetsView> {
    const { month: m, units, stored } = await pacingBundle(ctx, month);
    const defaults = Object.fromEntries(units.map((u) => [u.unit.unitId, u.defaultTarget]));
    const lastMonth = stored ? null : await lastMonthSpend(ctx, m, units);
    const nowIso = new Date(0).toISOString();
    return {
        id: targetsId(ctx, m),
        month: m,
        targets: { ...defaults, ...(stored?.targets ?? {}) },
        locks: stored?.locks ?? {},
        version: stored?.version ?? 0,
        createdAt: stored?.createdAt ?? nowIso,
        updatedAt: stored?.updatedAt ?? nowIso,
        defaults,
        isDefault: !stored,
        lastMonth,
    };
}
async function lastMonthSpend(ctx: RequestContext, month: string, units: readonly UnitPacing[]): Promise<BudgetTargetsView["lastMonth"]> {
    const source = suggestionMonth(month, ctx.dataThrough);
    if (!source)
        return null;
    const start = `${source}-01`;
    try {
        const rows = await loadCampaignDaily(ctx, { start, end: monthEnd(start) });
        return spendTargets(units.map((u) => u.unit), rows, source, month);
    }
    catch (err) {
        log.warn("Last month's spend unavailable", { error: err instanceof Error ? err.message : String(err) });
        return null;
    }
}
export async function putTargets(ctx: RequestContext, body: BudgetTargetsBody): Promise<BudgetTargetsView> {
    const m = resolveMonth(ctx, body.month);
    const clean = Object.fromEntries(Object.entries(body.targets).map(([k, v]) => [k, round(v, 2)]));
    await getStore().budgetTargets.upsert({ id: targetsId(ctx, m), month: m, targets: clean, locks: body.locks ?? {} });
    await audit({ actor: "user", action: "budget.targets.update", target: m, mode: ctx.source.mode, summary: `Updated ${Object.keys(clean).length} monthly budget targets for ${m}`, details: { accountId: ctx.accountId } });
    return getTargets(ctx, m);
}
export async function fitCurves(ctx: RequestContext, units: readonly BudgetUnit[], objective: ResponseCurve["objective"]): Promise<{
    curves: Map<string, ResponseCurve>;
    window: DateRange;
    roas: Map<string, number | null>;
}> {
    const window = { start: addDays(ctx.dataThrough, -(CURVE_DAYS - 1)), end: ctx.dataThrough };
    const rows = await loadCampaignDaily(ctx, window);
    const idx = new DailyIndex(rows);
    const dates = enumerate(window.start, window.end);
    const curves = new Map<string, ResponseCurve>();
    const roas = new Map<string, number | null>();
    for (const u of units) {
        const points = dates.map((d) => {
            const f = idx.day(u.campaignIds, d);
            return { spend: f.cost, outcome: objective === "conv_value" ? f.conv_value : f.conversions };
        });
        curves.set(u.unitId, fitResponseCurve(u.unitId, objective, points));
        const last28 = idx.sum(u.campaignIds, addDays(ctx.dataThrough, -27), ctx.dataThrough);
        roas.set(u.unitId, last28.cost > 0 ? last28.conv_value / last28.cost : null);
    }
    return { curves, window, roas };
}
export async function getCurves(ctx: RequestContext, objective: ResponseCurve["objective"] = "conv_value"): Promise<CurvesResponse> {
    const units = budgetUnits(await loadCampaigns(ctx));
    const { curves, window } = await fitCurves(ctx, units, objective);
    return { objective, window, curves: units.map((u) => ({ ...(curves.get(u.unitId) as ResponseCurve), name: u.name })) };
}
type OptimizerBase = Pick<OptimizeRequest, "month" | "period" | "objective" | "strategy" | "constraints" | "roundTo"> & {
    total?: number;
    curveSource?: OptimizeRequest["curveSource"];
};
async function optimizerInput(ctx: RequestContext, req: OptimizerBase, notes: string[] = []): Promise<{
    input: OptimizerInput;
    mix: CurveMix;
}> {
    const { month, report, units } = await pacingBundle(ctx, req.month);
    const planUnits = units.map((u) => u.unit);
    const fitted = await fitCurves(ctx, planUnits, req.objective);
    const { roas } = fitted;
    let curves = fitted.curves;
    const mode = req.curveSource ?? "auto";
    let mix: CurveMix = { mode, google: 0, model: curves.size, available: 0, calibration: null };
    if (mode === "auto") {
        const estimates = await loadGoogleEstimates(ctx, notes);
        const blend = blendCurves(curves, simulatorCurves(planUnits, estimates.simulations, req.objective, ctx.dataThrough));
        curves = blend.curves;
        mix = { mode, google: blend.google, model: blend.model, available: blend.available, calibration: blend.calibration };
    }
    const monthly = req.period === "monthly";
    const optUnits: OptimizerUnit[] = report.rows.map((row) => {
        const current = monthly ? row.monthlyTarget : (row.dailyBudget ?? 0);
        const c = req.constraints[row.unitId];
        let fixed: OptimizerUnit["fixed"];
        if (c?.locked !== undefined)
            fixed = { value: c.locked, reason: "locked" };
        else if (c?.exclude)
            fixed = { value: current, reason: "excluded" };
        else if (row.locked)
            fixed = { value: current, reason: "locked" };
        else if (row.paused)
            fixed = { value: current, reason: "paused" };
        else if (row.status === "unsupported_period" || row.status === "no_budget")
            fixed = { value: current, reason: "unsupported" };
        return { unitId: row.unitId, name: row.name, current, curve: curves.get(row.unitId) ?? null, fixed, min: c?.min, max: c?.max, roas: roas.get(row.unitId) ?? null };
    });
    const total = req.total ?? optUnits.reduce((s, u) => s + u.current, 0);
    return { input: { units: optUnits, total: round(total, 2), step: req.roundTo, days: monthly ? daysInMonth(`${month}-01`) : 1, objective: req.objective, strategy: req.strategy, period: req.period, currency: ctx.account.currency }, mix };
}
const withNotes = (warnings: string[], notes: readonly string[]): string[] => [...warnings, ...notes.filter((n) => !warnings.includes(n))];
export async function optimize(ctx: RequestContext, req: OptimizeRequest): Promise<OptimizeResult> {
    const notes: string[] = [];
    const { input, mix } = await optimizerInput(ctx, req, notes);
    const result = optimizeBudget(input);
    return { ...result, warnings: notes.length ? withNotes(result.warnings, notes) : result.warnings, curves: mix };
}
export async function scenarios(ctx: RequestContext, req: ScenariosRequest): Promise<ScenariosResult> {
    const notes: string[] = [];
    const { input: base } = await optimizerInput(ctx, req, notes);
    const { points, warnings } = scenarioFrontier(base, req.pcts ?? DEFAULT_SCENARIO_PCTS);
    return { objective: req.objective, strategy: req.strategy, period: req.period, baseTotal: base.total, points, warnings: withNotes(warnings, notes) };
}
export async function forecast(ctx: RequestContext, q: {
    metric: ForecastResult["metric"];
    horizon: number;
    campaignId?: string;
}): Promise<ForecastResult> {
    const campaigns = await loadCampaigns(ctx);
    if (q.campaignId && !campaigns.some((c) => c.id === q.campaignId))
        throw notFound("Campaign");
    const window = { start: addDays(ctx.dataThrough, -(HISTORY_DAYS - 1)), end: ctx.dataThrough };
    const rows = await loadCampaignDaily(ctx, window);
    const ids = q.campaignId ? [q.campaignId] : campaigns.map((c) => c.id);
    const idx = new DailyIndex(rows);
    const first = rows.reduce<CivilDate | null>((m, r) => (m === null || r.date < m ? r.date : m), null);
    const history = enumerate(first && first > window.start ? first : window.start, window.end).map((date) => {
        const f = idx.day(ids, date);
        return { date, value: q.metric === "cost" ? f.cost : q.metric === "conversions" ? f.conversions : q.metric === "conv_value" ? f.conv_value : f.clicks };
    });
    const budgets = campaigns.filter((c) => (q.campaignId ? c.id === q.campaignId : c.status === "Enabled")).reduce((s, c) => s + (c.budget_daily ?? 0), 0);
    return forecastSeries({
        metric: q.metric,
        campaignId: q.campaignId,
        history,
        horizon: q.horizon,
        dailyCap: q.metric === "cost" && budgets > 0 ? budgets * 2 : null,
        monthEnd: monthEnd(ctx.today),
    });
}
function ownPlan(ctx: RequestContext, p: BudgetPlan | null): BudgetPlan {
    if (!p || (p.accountId && p.accountId !== ctx.accountId))
        throw notFound("Budget plan");
    return p;
}
export async function listPlans(ctx: RequestContext): Promise<BudgetPlan[]> {
    const plans = await getStore().budgetPlans.list((p) => !p.accountId || p.accountId === ctx.accountId);
    return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getPlan(ctx: RequestContext, id: string): Promise<BudgetPlan> {
    return ownPlan(ctx, await getStore().budgetPlans.get(id));
}
export async function getPlanWithSchedule(ctx: RequestContext, id: string, month: string): Promise<BudgetPlan & {
    schedule: {
        month: string;
        days: ReturnType<typeof planMonthSchedule>;
    };
}> {
    const plan = await getPlan(ctx, id);
    if (!isMonthKey(month))
        throw new AppError("VALIDATION_ERROR", "schedule must be YYYY-MM");
    const rows = await loadCampaignDaily(ctx, { start: addDays(ctx.dataThrough, -55), end: ctx.dataThrough });
    const idx = new DailyIndex(rows);
    const ids = [...new Set(rows.map((r) => r.campaign_id))];
    const factors = weekdayFactors((d) => idx.day(ids, d).cost, ctx.dataThrough, 56);
    return { ...plan, schedule: { month, days: planMonthSchedule(plan.lines, month, factors) } };
}
function normaliseMonths(months: readonly string[]): string[] {
    for (const m of months)
        if (!isMonthKey(m))
            throw new AppError("VALIDATION_ERROR", `Invalid month ${m}`);
    return [...new Set(months)].sort();
}
export async function createPlan(ctx: RequestContext, body: BudgetPlanBody): Promise<BudgetPlan> {
    const months = normaliseMonths(body.months);
    let lines = body.lines;
    if (!lines.length) {
        const units = budgetUnits(await loadCampaigns(ctx)).filter((u) => !u.paused && u.period === "daily");
        lines = defaultCampaignLines(units.map((u) => ({ unitId: u.unitId, name: u.name, type: u.type, dailyBudget: u.dailyBudget })), months);
    }
    const plan = await getStore().budgetPlans.create({ ...body, months, lines, accountId: body.accountId ?? ctx.accountId });
    await audit({ actor: "user", action: "budget.plan.create", target: plan.id, mode: ctx.source.mode, summary: `Created budget plan “${plan.name}” (${months.join(", ")})` });
    return plan;
}
export async function updatePlan(ctx: RequestContext, id: string, body: BudgetPlanBody, version?: number): Promise<BudgetPlan> {
    await getPlan(ctx, id);
    const months = normaliseMonths(body.months);
    return getStore().budgetPlans.update(id, (prev) => ({ ...prev, ...body, months, accountId: prev.accountId ?? ctx.accountId }), { expectedVersion: version });
}
export async function deletePlan(ctx: RequestContext, id: string): Promise<void> {
    const plan = await getPlan(ctx, id);
    await getStore().budgetPlans.delete(id);
    await audit({ actor: "user", action: "budget.plan.delete", target: id, mode: ctx.source.mode, summary: `Deleted budget plan “${plan.name}”` });
}
export async function addPlanLine(ctx: RequestContext, id: string, input: DraftLineInput): Promise<BudgetPlan> {
    const plan = await getPlan(ctx, id);
    const existing = plan.lines.find((l) => l.kind === input.kind && l.refId === input.refId);
    const lineId = existing?.id ?? `${input.kind === "draft_idea" ? "idea" : "channel"}-${randomUUID().slice(0, 8)}`;
    const line = draftLine(input, plan.months, lineId);
    const lines = existing ? plan.lines.map((l) => (l.id === existing.id ? { ...line, locked: l.locked } : l)) : [...plan.lines, line];
    if (lines.length > 200)
        throw new AppError("VALIDATION_ERROR", "A plan can hold at most 200 lines");
    return getStore().budgetPlans.update(id, (prev) => ({ ...prev, lines }));
}
export async function syncIdeaPlanLine(ctx: RequestContext, idea: {
    id: string;
    title: string;
    type: string;
    dailyBudget: number;
    rationale?: string;
}, inPlan: boolean): Promise<void> {
    if (inPlan) {
        const plan = await ensureDefaultPlan(ctx);
        await addPlanLine(ctx, plan.id, { kind: "draft_idea", refId: idea.id, name: idea.title.slice(0, 120), campaignType: idea.type, dailyBudget: Math.max(1, Math.round(idea.dailyBudget)), notes: idea.rationale?.slice(0, 400) });
        return;
    }
    for (const plan of await listPlans(ctx)) {
        if (!plan.lines.some((l) => l.kind === "draft_idea" && l.refId === idea.id))
            continue;
        await getStore().budgetPlans.update(plan.id, (prev) => ({ ...prev, lines: prev.lines.filter((l) => !(l.kind === "draft_idea" && l.refId === idea.id)) }));
    }
}
export async function ensureDefaultPlan(ctx: RequestContext): Promise<BudgetPlan> {
    const plans = (await listPlans(ctx)).filter((p) => p.status !== "archived");
    if (plans[0])
        return plans[0];
    const months = monthSequence(monthKey(addDays(monthEnd(ctx.dataThrough), 1)), 3);
    return createPlan(ctx, { name: "Next quarter plan", months, objective: "conv_value", status: "draft", lines: [] });
}
async function monthlySpendHistory(ctx: RequestContext): Promise<Record<string, number>> {
    const cov = await ctx.source.coverage(ctx.accountId, "campaign_daily");
    if (!cov)
        return {};
    const rows = await loadCampaignDaily(ctx, cov);
    const out: Record<string, number> = {};
    for (const r of rows)
        out[monthKey(r.date)] = (out[monthKey(r.date)] ?? 0) + r.cost;
    const firstFull = monthStart(cov.start) === cov.start ? monthKey(cov.start) : monthKey(addDays(monthEnd(cov.start), 1));
    const lastFull = monthEnd(cov.end) === cov.end ? monthKey(cov.end) : monthKey(addDays(monthStart(cov.end), -1));
    return Object.fromEntries(Object.entries(out).filter(([m]) => m >= firstFull && m <= lastFull));
}
export async function suggestPlan(ctx: RequestContext, id: string, req: PlanSuggestRequest): Promise<PlanSuggestResult> {
    const plan = await getPlan(ctx, id);
    const warnings: string[] = [];
    const index = seasonalIndex(await monthlySpendHistory(ctx));
    if (index.source === "retail_preset")
        warnings.push("Less than 13 months of history: using the retail seasonality preset.");
    const anchorMonth = monthKey(ctx.dataThrough);
    const units = budgetUnits(await loadCampaigns(ctx));
    const unitById = new Map(units.map((u) => [u.unitId, u]));
    const campaignLines = plan.lines.filter((l) => l.kind === "campaign" && unitById.has(l.refId));
    const dailyTotal = campaignLines.reduce((s, l) => {
        const u = unitById.get(l.refId);
        return s + (u && !u.paused ? (u.dailyBudget ?? 0) : 0);
    }, 0);
    const seasonal = seasonalTotals(plan.months, dailyTotal, index, anchorMonth);
    const { curves } = await fitCurves(ctx, campaignLines.map((l) => unitById.get(l.refId) as BudgetUnit), plan.objective);
    const lines = plan.lines.map((l) => ({ ...l, monthly: { ...l.monthly } }));
    for (const m of plan.months) {
        const total = req.totals?.[m] ?? Math.round((seasonal[m] ?? 0) / req.roundTo) * req.roundTo;
        const optLines = lines.filter((l) => l.kind === "campaign" && unitById.has(l.refId));
        const currentOf = (l: (typeof lines)[number]) => l.monthly[m] ?? defaultMonthlyTarget(unitById.get(l.refId)?.dailyBudget ?? null, m);
        const sumCurrent = optLines.reduce((s, l) => s + currentOf(l), 0);
        const scale = sumCurrent > 0 ? total / sumCurrent : 1;
        const optUnits: OptimizerUnit[] = optLines.map((l) => {
            const u = unitById.get(l.refId) as BudgetUnit;
            const current = currentOf(l);
            return {
                unitId: l.id,
                name: l.name,
                current,
                curve: curves.get(u.unitId) ?? null,
                fixed: l.locked || u.paused ? { value: current, reason: l.locked ? "locked" : "paused" } : undefined,
                boundsBase: current * scale,
            };
        });
        const res = optimizeBudget({ units: optUnits, total, step: req.roundTo, days: monthDays(m), objective: plan.objective, strategy: req.strategy, period: "monthly", currency: ctx.account.currency });
        for (const w of res.warnings)
            if (!warnings.includes(w))
                warnings.push(w);
        for (const row of res.rows) {
            const line = lines.find((l) => l.id === row.unitId);
            if (!line || line.locked)
                continue;
            line.monthly[m] = row.recommended;
            line.origin = "optimizer";
        }
    }
    const saved = await getStore().budgetPlans.update(id, (prev) => ({ ...prev, lines }));
    return { plan: saved, index: plan.months.map((m) => ({ month: m, factor: index.factors[Number(m.slice(5, 7)) - 1] ?? 1 })), indexSource: index.source, warnings };
}
export interface FileExport {
    body: string;
    contentType: string;
    filename: string;
    warnings: string[];
}
const csvType = "text/csv; charset=utf-8";
export async function exportPlan(ctx: RequestContext, id: string, format: "csv" | "editor" | "changes", month?: string): Promise<FileExport> {
    const plan = await getPlan(ctx, id);
    const slug = plan.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "plan";
    if (format === "csv")
        return { body: planCsv(plan), contentType: csvType, filename: `${slug}.csv`, warnings: [] };
    const m = month ? resolveMonth(ctx, month) : currentPlanMonth(plan, ctx.dataThrough);
    if (!plan.months.includes(m))
        throw new AppError("VALIDATION_ERROR", `The plan does not cover ${m}`);
    const campaigns = new Map((await loadCampaigns(ctx)).map((c) => [c.id, c]));
    const warnings: string[] = [];
    const changes: {
        name: string;
        id: string;
        from: number | null;
        to: number;
        status: EditorBudgetRow["status"];
    }[] = [];
    for (const l of plan.lines) {
        if (l.kind !== "campaign") {
            warnings.push(`“${l.name}” is a draft (${l.kind === "draft_idea" ? "AI idea" : "channel"}) — create it first; it is not in the export.`);
            continue;
        }
        const c = campaigns.get(l.refId);
        if (!c) {
            warnings.push(`“${l.name}” is a shared budget or unknown campaign; edit it in Google Ads (Shared library).`);
            continue;
        }
        changes.push({ name: c.name, id: c.id, from: c.budget_daily, to: round((l.monthly[m] ?? 0) / monthDays(m), 2), status: c.status });
    }
    if (format === "changes")
        return { body: changeList(changes, ctx.account.currency).join("\n") + "\n", contentType: "text/plain; charset=utf-8", filename: `${slug}-${m}-changes.txt`, warnings };
    const editor = editorBudgetCsv(changes.map((c) => ({ campaign: c.name, campaignId: c.id, dailyBudget: c.to, status: c.status })));
    return { body: editor.csv, contentType: csvType, filename: `${slug}-${m}-editor.csv`, warnings: [...warnings, ...editor.warnings] };
}
export async function budgetExport(ctx: RequestContext, q: {
    month?: string;
    from: "recommended" | "targets";
    format: "editor" | "csv" | "text";
}): Promise<FileExport> {
    const { month, report, stored } = await pacingBundle(ctx, q.month);
    const campaigns = new Map((await loadCampaigns(ctx)).map((c) => [c.id, c]));
    const warnings: string[] = [];
    const forGoogle = q.format !== "csv";
    const rows = report.rows.flatMap((r) => {
        const c = r.campaignIds.length === 1 ? campaigns.get(r.campaignIds[0] as string) : undefined;
        if (!c) {
            warnings.push(`${r.name}: shared budgets are edited in Google Ads (Shared library); not included.`);
            return [];
        }
        if (r.status === "unsupported_period") {
            warnings.push(`${r.name}: custom-period budget; not included.`);
            return [];
        }
        const next = round(q.from === "recommended" ? (r.recommendedDaily ?? r.dailyBudget ?? 0) : r.monthlyTarget / report.daysInMonth, 2);
        if (forGoogle && q.from === "targets" && r.status === "paused" && stored?.targets[r.unitId] === undefined) {
            warnings.push(`${r.name}: paused, no monthly target set; not included.`);
            return [];
        }
        if (forGoogle && next <= 0) {
            warnings.push(`${r.name}: no daily budget to set; not included.`);
            return [];
        }
        return [{ row: r, campaign: c, newDaily: next }];
    });
    if (q.from === "recommended" && report.remainingDays === 0)
        warnings.push(`${report.monthLabel} is complete; recommended budgets equal the current ones.`);
    const base = `budgets-${month}-${q.from}`;
    if (q.format === "text") {
        const lines = changeList(rows.map((x) => ({ name: x.campaign.name, from: x.campaign.budget_daily, to: x.newDaily })), ctx.account.currency);
        return { body: (lines.length ? lines : ["No budget changes."]).join("\n") + "\n", contentType: "text/plain; charset=utf-8", filename: `${base}.txt`, warnings };
    }
    if (q.format === "csv") {
        const body = budgetCsv(rows.map((x) => ({ name: x.campaign.name, unitId: x.row.unitId, currentDaily: x.campaign.budget_daily, newDaily: x.newDaily, monthlyTarget: x.row.monthlyTarget, mtdSpend: x.row.mtdSpend, projected: x.row.projected, status: x.row.status })));
        return { body, contentType: csvType, filename: `${base}.csv`, warnings };
    }
    const editor = editorBudgetCsv(rows.map((x) => ({ campaign: x.campaign.name, campaignId: x.campaign.id, dailyBudget: x.newDaily, status: x.campaign.status })));
    return { body: editor.csv, contentType: csvType, filename: `${base}-editor.csv`, warnings: [...warnings, ...editor.warnings] };
}
