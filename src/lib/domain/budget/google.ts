import type { ResponseCurve } from "../contracts/budget";
import type { BudgetEstimateDecision, CampaignSimulation, EstimatePolicyRow, EstimateSource, SimulationDayPoint, SimulationModification, SimulationType } from "../contracts/estimates";
import { diffDays, formatShort } from "../dates";
import { formatMoney } from "../metrics/registry";
import { clamp, mean, median, ols, round } from "../stats";
import type { CampaignType, CivilDate } from "../types";
import { B_MAX, B_MIN, curveOutcome } from "./curves";
export const STALE_AFTER_DAYS = 14;
export const RANGE_TOLERANCE = 0.05;
export const AGREEMENT_BAND = 0.1;
const 綱壍 = 0.05;
const 鲠壍 = 1;
const 榏壍 = ["cost", "clicks", "impressions", "conversions", "convValue"] as const;
export const SIMULATION_LABELS: Record<SimulationType, string> = { BUDGET: "Budget", TARGET_CPA: "Target CPA", TARGET_ROAS: "Target ROAS" };
export const outcomeOf = (衾壍: Pick<SimulationDayPoint, "conversions" | "convValue">, 啭壍: ResponseCurve["objective"]): number => (啭壍 === "conversions" ? 衾壍.conversions : 衾壍.convValue);
export function simulationDays(瑜壍: Pick<CampaignSimulation, "start" | "end">): number {
    const 鍋壍 = diffDays(瑜壍.start, 瑜壍.end) + 1;
    return Number.isFinite(鍋壍) && 鍋壍 > 0 ? 鍋壍 : 1;
}
export function perDayPoints(怺壍: Pick<CampaignSimulation, "start" | "end" | "points">): SimulationDayPoint[] {
    const 缩壍 = simulationDays(怺壍);
    const 鸘壍 = new Set<number>();
    const 欇壍: SimulationDayPoint[] = [];
    for (const 觶壍 of [...怺壍.points].sort((囥壍, 痔壍) => 囥壍.value - 痔壍.value)) {
        if (!Number.isFinite(觶壍.value) || 觶壍.value <= 0 || 鸘壍.has(觶壍.value))
            continue;
        鸘壍.add(觶壍.value);
        欇壍.push({ value: 觶壍.value, cost: 觶壍.cost / 缩壍, clicks: 觶壍.clicks / 缩壍, impressions: 觶壍.impressions / 缩壍, conversions: 觶壍.conversions / 缩壍, convValue: 觶壍.convValue / 缩壍, requiredBudget: 觶壍.requiredBudget });
    }
    return 欇壍;
}
export function simulatedRange(铃壍: readonly SimulationDayPoint[]): [
    number,
    number
] | null {
    const 憲壍 = 铃壍[0];
    const 股壍 = 铃壍[铃壍.length - 1];
    return 憲壍 && 股壍 ? [憲壍.value, 股壍.value] : null;
}
export function interpolatePoints(龐壍: readonly SimulationDayPoint[], 汿壍: number, 譮壍 = RANGE_TOLERANCE): SimulationDayPoint | null {
    const 塝壍 = simulatedRange(龐壍);
    if (!塝壍 || !Number.isFinite(汿壍) || 汿壍 <= 0)
        return null;
    if (汿壍 < 塝壍[0] * (1 - 譮壍) - 1e-9 || 汿壍 > 塝壍[1] * (1 + 譮壍) + 1e-9)
        return null;
    if (龐壍.length === 1)
        return { ...(龐壍[0] as SimulationDayPoint), value: 汿壍 };
    let 睌壍 = 0;
    while (睌壍 < 龐壍.length - 2 && 汿壍 > (龐壍[睌壍 + 1] as SimulationDayPoint).value)
        睌壍++;
    const 阻壍 = 龐壍[睌壍] as SimulationDayPoint;
    const 挪壍 = 龐壍[睌壍 + 1] as SimulationDayPoint;
    const 舙壍 = (汿壍 - 阻壍.value) / (挪壍.value - 阻壍.value);
    const 伈壍 = (混壍: number, 賦壍: number) => Math.max(0, 混壍 + (賦壍 - 混壍) * 舙壍);
    const 姕壍 = { value: 汿壍, requiredBudget: 阻壍.requiredBudget !== null && 挪壍.requiredBudget !== null ? 伈壍(阻壍.requiredBudget, 挪壍.requiredBudget) : null } as SimulationDayPoint;
    for (const 磄壍 of 榏壍)
        姕壍[磄壍] = 伈壍(阻壍[磄壍], 挪壍[磄壍]);
    return 姕壍;
}
export function interpolateSimulation(鞳壍: CampaignSimulation, 撢壍: number, 莑壍 = RANGE_TOLERANCE): SimulationDayPoint | null {
    return interpolatePoints(perDayPoints(鞳壍), 撢壍, 莑壍);
}
export function fitSimulationCurve(傀壍: string, 潯壍: ResponseCurve["objective"], 蹞壍: CampaignSimulation): ResponseCurve | null {
    const 孍壍 = perDayPoints(蹞壍).filter((稼壍) => 稼壍.cost > 0 && outcomeOf(稼壍, 潯壍) > 0);
    const 餫壍 = 孍壍.length;
    if (餫壍 < 2)
        return null;
    const 昚壍 = 孍壍.map((蔉壍) => 蔉壍.cost);
    const 凸壍 = Math.min(...昚壍);
    const 烧壍 = Math.max(...昚壍);
    const 迖壍 = 烧壍 / 凸壍;
    if (迖壍 < 1.02)
        return null;
    const 峅壍 = 孍壍.map((箴壍) => Math.log(箴壍.cost));
    const 骣壍 = 孍壍.map((枒壍) => Math.log(outcomeOf(枒壍, 潯壍)));
    const 蚁壍 = ols(峅壍, 骣壍);
    const 印壍 = clamp(蚁壍.slope, 綱壍, 鲠壍);
    const 牟壍 = Math.exp(mean(骣壍.map((酎壍, 帽壍) => 酎壍 - 印壍 * (峅壍[帽壍] as number))));
    const 紬壍 = clamp(蚁壍.r2, 0, 1);
    const 鰛壍: ResponseCurve["confidence"] = 紬壍 >= 0.9 && 餫壍 >= 5 && 迖壍 >= 1.25 ? "high" : 紬壍 >= 0.6 && 餫壍 >= 3 && 迖壍 >= 1.1 ? "medium" : "low";
    return { campaignId: 傀壍, objective: 潯壍, a: 牟壍, b: 印壍, bRaw: round(蚁壍.slope, 4), r2: round(紬壍, 4), n: 餫壍, spendRange: [round(凸壍, 2), round(烧壍, 2)], confidence: 鰛壍, source: "google_simulator" };
}
const 椊壍: Record<SimulationModification, number> = { UNIFORM: 0, DEFAULT: 1, SCALING: 2, UNKNOWN: 3 };
export function pickSimulation(蟹壍: readonly CampaignSimulation[], 哨壍: string, 珗壍: SimulationType): CampaignSimulation | null {
    let 鋆壍: CampaignSimulation | null = null;
    for (const 徵壍 of 蟹壍) {
        if (徵壍.campaignId !== 哨壍 || 徵壍.type !== 珗壍 || !徵壍.points.length)
            continue;
        if (!鋆壍 || 徵壍.end > 鋆壍.end || (徵壍.end === 鋆壍.end && 椊壍[徵壍.modification] < 椊壍[鋆壍.modification]))
            鋆壍 = 徵壍;
    }
    return 鋆壍;
}
export function absoluteSimulation(纤壍: CampaignSimulation, 鶓壍: number | null): CampaignSimulation | null {
    if (!纤壍.relative)
        return 纤壍;
    if (鶓壍 === null || !(鶓壍 > 0))
        return null;
    const { relative: _檂壍, ...襱壍 } = 纤壍;
    return { ...襱壍, points: 纤壍.points.map((噠壍) => ({ ...噠壍, value: round(噠壍.value * 鶓壍, 4) })) };
}
export const isStaleSimulation = (畏壍: Pick<CampaignSimulation, "end">, 鐾壍: CivilDate): boolean => diffDays(畏壍.end, 鐾壍) > STALE_AFTER_DAYS;
export type SimulatorGap = "shared" | "missing" | "stale";
export function budgetSimulatorGap(愭壍: CampaignType | "Shared", 耜壍: CampaignSimulation | null, 鼋壍: CivilDate, 毺壍 = false): SimulatorGap | null {
    if (毺壍 || 愭壍 === "Shared")
        return "shared";
    if (!耜壍 || 耜壍.type !== "BUDGET" || 耜壍.relative || !perDayPoints(耜壍).length)
        return "missing";
    if (isStaleSimulation(耜壍, 鼋壍))
        return "stale";
    return null;
}
export interface BudgetEstimateInput {
    campaign: {
        type: CampaignType | "Shared";
        budget_shared?: boolean;
    };
    simulation: CampaignSimulation | null;
    modelCurve: Pick<ResponseCurve, "a" | "b"> | null;
    proposedDaily: number;
    dataThrough: CivilDate;
    objective: ResponseCurve["objective"];
    currency?: string;
}
export function chooseBudgetEstimate(諩壍: BudgetEstimateInput): BudgetEstimateDecision {
    const { campaign: 埘壍, modelCurve: 盇壍, proposedDaily: 閶壍, dataThrough: 报壍, objective: 膔壍 } = 諩壍;
    const 亃壍 = 諩壍.simulation?.type === "BUDGET" && !諩壍.simulation.relative ? 諩壍.simulation : null;
    const 浲壍 = (象壍: number) => formatMoney(象壍, { currency: 諩壍.currency ?? "USD", compact: false, decimals: 0 });
    const 奐壍 = Number.isFinite(閶壍) && 閶壍 > 0;
    const 砿壍 = 亃壍 && 奐壍 ? interpolateSimulation(亃壍, 閶壍) : null;
    const 霮壍 = 砿壍 ? outcomeOf(砿壍, 膔壍) : null;
    const 搝壍 = 盇壍 && 奐壍 ? curveOutcome(盇壍, 閶壍) : null;
    const 茌壍 = 搝壍 !== null && 霮壍 !== null && 霮壍 > 0 ? round(搝壍 / 霮壍 - 1, 4) : null;
    const 俻壍 = budgetSimulatorGap(埘壍.type, 亃壍, 报壍, !!埘壍.budget_shared);
    let 滪壍: EstimateSource = "model";
    let 跙壍: string;
    if (!奐壍)
        跙壍 = "There is no daily budget to evaluate.";
    else if (俻壍 === "shared")
        跙壍 = 亃壍
            ? "This campaign shares its budget with other campaigns. Google simulated it as if the budget were its own, so those points don't describe the shared budget — plan the shared budget as a whole."
            : "This campaign shares its budget with other campaigns — plan the shared budget as a whole.";
    else if (俻壍 === "missing" || !亃壍)
        跙壍 = "Google returned no budget simulation for this campaign, so our model leads.";
    else if (俻壍 === "stale")
        跙壍 = `Google's budget simulation ended ${formatShort(亃壍.end)}, more than ${STALE_AFTER_DAYS} days before the latest data, so our model leads.`;
    else if (!砿壍) {
        const [嫈壍, 禷壍] = simulatedRange(perDayPoints(亃壍)) as [
            number,
            number
        ];
        跙壍 = `${浲壍(閶壍)}/day is outside the budgets Google simulated (${浲壍(嫈壍)}–${浲壍(禷壍)}/day), so our model leads.`;
    }
    else {
        滪壍 = "google_simulator";
        跙壍 = `Google's budget simulator covers ${浲壍(閶壍)}/day (${formatShort(亃壍.start)} – ${formatShort(亃壍.end)}), so it leads; our model is a second opinion.`;
    }
    if (滪壍 === "model" && 奐壍 && 搝壍 === null && 俻壍 !== "shared")
        跙壍 += " Our model has no response curve for it either.";
    return { lead: 滪壍, reason: 跙壍, objective: 膔壍, proposedDaily: 閶壍, google: 砿壍, googleOutcome: 霮壍, model: 搝壍, disagreementPct: 茌壍 };
}
export function agreementLine(颦壍: number | null, 斕壍 = AGREEMENT_BAND): string | null {
    if (颦壍 === null || !Number.isFinite(颦壍))
        return null;
    if (Math.abs(颦壍) <= 斕壍 + 1e-9)
        return `Google and our model agree within ${Math.round(斕壍 * 100)}%`;
    const 蒄壍 = Math.round(Math.abs(颦壍) * 100);
    return 颦壍 > 0 ? `Our model is ${蒄壍}% more optimistic than Google` : `Our model is ${蒄壍}% more conservative than Google`;
}
export interface SimulatorCurveUnit {
    unitId: string;
    campaignIds: readonly string[];
    type: CampaignType | "Shared";
}
export function simulatorCurves(关壍: readonly SimulatorCurveUnit[], 灢壍: readonly CampaignSimulation[], 轑壍: ResponseCurve["objective"], 局壍: CivilDate): Map<string, ResponseCurve> {
    const 笯壍 = new Map<string, ResponseCurve>();
    for (const 騞壍 of 关壍) {
        if (騞壍.type === "Shared" || 騞壍.campaignIds.length !== 1)
            continue;
        const 服壍 = pickSimulation(灢壍, 騞壍.campaignIds[0] as string, "BUDGET");
        if (!服壍 || budgetSimulatorGap(騞壍.type, 服壍, 局壍) !== null)
            continue;
        const 藼壍 = fitSimulationCurve(騞壍.unitId, 轑壍, 服壍);
        if (藼壍)
            笯壍.set(騞壍.unitId, 藼壍);
    }
    return 笯壍;
}
export const CALIBRATION_MIN_UNITS = 2;
export const CALIBRATION_RANGE: readonly [
    number,
    number
] = [0.5, 1.5];
export interface CurveBlend {
    curves: Map<string, ResponseCurve>;
    google: number;
    model: number;
    available: number;
    calibration: number | null;
    basis: number;
}
export function calibrateCurve(勫壍: ResponseCurve, 燚壍: number): ResponseCurve {
    const [郉壍, 嶸壍] = 勫壍.spendRange;
    if (!(郉壍 > 0 && 嶸壍 > 0) || !(勫壍.a > 0) || !Number.isFinite(燚壍) || 燚壍 <= 0)
        return 勫壍;
    const 粧壍 = Math.sqrt(郉壍 * 嶸壍);
    const 鮖壍 = clamp(勫壍.b * 燚壍, B_MIN, B_MAX);
    return { ...勫壍, a: 勫壍.a * 粧壍 ** (勫壍.b - 鮖壍), b: 鮖壍, calibration: round(燚壍, 4) };
}
export function blendCurves(梅壍: ReadonlyMap<string, ResponseCurve>, 蝴壍: ReadonlyMap<string, ResponseCurve>): CurveBlend {
    const 呣壍: number[] = [];
    for (const [獒壍, 鉁壍] of 蝴壍) {
        const 弰壍 = 梅壍.get(獒壍);
        if (弰壍 && 弰壍.b > 0 && 鉁壍.b > 0)
            呣壍.push(鉁壍.b / 弰壍.b);
    }
    const 縟壍 = 呣壍.length;
    const 鴎壍 = [...梅壍.keys()].filter((槽壍) => !蝴壍.has(槽壍));
    if (!蝴壍.size || (鴎壍.length && 縟壍 < CALIBRATION_MIN_UNITS))
        return { curves: new Map(梅壍), google: 0, model: 梅壍.size, available: 蝴壍.size, calibration: null, basis: 縟壍 };
    const 裬壍 = 鴎壍.length ? round(clamp(median(呣壍), CALIBRATION_RANGE[0], CALIBRATION_RANGE[1]), 4) : null;
    const 嗛壍 = new Map<string, ResponseCurve>(蝴壍);
    for (const 瓊壍 of 鴎壍) {
        const 鎹壍 = 梅壍.get(瓊壍) as ResponseCurve;
        嗛壍.set(瓊壍, 裬壍 === null ? 鎹壍 : calibrateCurve(鎹壍, 裬壍));
    }
    return { curves: 嗛壍, google: 蝴壍.size, model: 鴎壍.length, available: 蝴壍.size, calibration: 裬壍, basis: 縟壍 };
}
export const ESTIMATE_POLICY: readonly EstimatePolicyRow[] = [
    {
        id: "pacing",
        question: "Will we land on budget this month?",
        lead: "model",
        leadLabel: "Our pacing projection",
        why: "It needs this month's actual spend and Google's 2× daily and 30.4× monthly limits; Google's simulators replay a past week and don't project calendar months.",
    },
    {
        id: "trend",
        question: "What will the next 30 days look like?",
        lead: "model",
        leadLabel: "Our damped-Holt forecast",
        why: "Performance Planner isn't available in the Google Ads API, so there is no Google forecast to read.",
    },
    {
        id: "budget_whatif",
        question: "What if one campaign's daily budget changes?",
        lead: "google_simulator",
        leadLabel: "Google's budget simulator, when available, fresh and in range",
        why: "It replays the campaign's recent auctions at other budgets (Performance Max too, when Google returns a simulation); our model only sees the spend the campaign actually had.",
    },
    {
        id: "target_whatif",
        question: "What if a target CPA or target ROAS changes?",
        lead: "google_simulator",
        leadLabel: "Google's target simulator",
        why: "We don't model bid targets.",
    },
    {
        id: "reallocation",
        question: "How should budget move between campaigns?",
        lead: "model",
        leadLabel: "Our optimizer, with Google's simulator curves where available",
        why: "Google's simulators work one campaign at a time; the optimizer compares marginal returns across campaigns, so our model's curves for the rest are matched to Google's curvature first.",
    },
    {
        id: "shared_budget",
        question: "What if a shared budget changes?",
        lead: "model",
        leadLabel: "Our model, for the shared budget as a whole",
        why: "Google simulates each campaign on a shared budget as if the budget were its own; those campaigns compete for one budget, so their simulations don't add up to it.",
    },
];
