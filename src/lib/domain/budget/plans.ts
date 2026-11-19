import type { BudgetPlan, PlanLine } from "../contracts/budget";
import { addMonths, daysInMonth, parts } from "../dates";
import { round } from "../stats";
import type { CivilDate } from "../types";

// Multi-month plans: default campaign lines from current daily budgets, seasonal month totals (last year's
// monthly spend when ≥ 13 months of history exist, else a retail preset) and AI-idea draft lines
// (daily × days in each month — never a hard-coded 31).

/** Retail seasonality preset by calendar month (Jan … Dec). */
export const RETAIL_PRESET = [0.85, 0.85, 0.95, 0.95, 1.0, 0.95, 0.95, 1.0, 1.0, 1.05, 1.35, 1.25] as const;

export const monthDays = (month: string) => daysInMonth(`${month}-01`);
const monthNo = (month: string) => parts(`${month}-01`).m;

/** Consecutive months starting at `start` ("YYYY-MM"). */
export function monthSequence(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(`${start}-01`, i).slice(0, 7));
}

export interface SeasonalIndex {
  /** factor per calendar month, index 0 = January (mean ≈ 1) */
  factors: number[];
  source: "history" | "retail_preset";
}

/**
 * `monthlySpend` holds complete calendar months only ("YYYY-MM" → spend). 13 months of history always contain 12
 * complete months: those give the index (spend per day ÷ their mean); with less history the retail preset is used.
 */
export function seasonalIndex(monthlySpend: Readonly<Record<string, number>>): SeasonalIndex {
  const months = Object.keys(monthlySpend).sort();
  if (months.length >= 12) {
    const last12 = months.slice(-12);
    const values = last12.map((m) => monthlySpend[m] ?? 0);
    // Normalise by days so short months (February) don't read as low season.
    const perDay = last12.map((m, i) => (values[i] as number) / monthDays(m));
    const avg = perDay.reduce((a, b) => a + b, 0) / 12;
    if (avg > 0) {
      const factors = new Array<number>(12).fill(1);
      last12.forEach((m, i) => (factors[monthNo(m) - 1] = round((perDay[i] as number) / avg, 4)));
      return { factors, source: "history" };
    }
  }
  return { factors: [...RETAIL_PRESET], source: "retail_preset" };
}

/** Month totals following the index, anchored so the anchor month keeps its current daily run rate. */
export function seasonalTotals(months: readonly string[], dailyTotal: number, index: SeasonalIndex, anchorMonth: string): Record<string, number> {
  const anchor = index.factors[monthNo(anchorMonth) - 1] ?? 1;
  const out: Record<string, number> = {};
  for (const m of months) {
    const f = index.factors[monthNo(m) - 1] ?? 1;
    out[m] = round(dailyTotal * monthDays(m) * (anchor > 0 ? f / anchor : f), 2);
  }
  return out;
}

export interface CampaignLineSource {
  unitId: string;
  name: string;
  type: string;
  dailyBudget: number | null;
}

export function defaultCampaignLines(units: readonly CampaignLineSource[], months: readonly string[]): PlanLine[] {
  return units.map((u) => ({
    id: `line-${u.unitId.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 64),
    kind: "campaign" as const,
    refId: u.unitId,
    name: u.name.slice(0, 120),
    campaignType: u.type.slice(0, 40),
    monthly: Object.fromEntries(months.map((m) => [m, u.dailyBudget ? round(u.dailyBudget * monthDays(m), 2) : 0])),
    flighting: { pattern: "even" as const },
    origin: "manual" as const,
  }));
}

export interface DraftSource {
  kind?: "draft_idea" | "plugin_channel";
  refId: string;
  name: string;
  campaignType?: string;
  dailyBudget: number;
  notes?: string;
}

/** An AI idea (or a plugin channel) as a plan line: daily budget × the real number of days in each month. */
export function draftLine(src: DraftSource, months: readonly string[], id: string): PlanLine {
  return {
    id,
    kind: src.kind ?? "draft_idea",
    refId: src.refId,
    name: src.name.slice(0, 120),
    campaignType: src.campaignType?.slice(0, 40),
    monthly: Object.fromEntries(months.map((m) => [m, round(src.dailyBudget * monthDays(m), 2)])),
    flighting: { pattern: "even" },
    origin: src.kind === "plugin_channel" ? "manual" : "ai_idea",
    notes: src.notes,
  };
}

export function planMonthTotal(plan: Pick<BudgetPlan, "lines">, month: string): number {
  return round(plan.lines.reduce((s, l) => s + (l.monthly[month] ?? 0), 0), 2);
}

/** The first plan month that is not in the past relative to `dataThrough` (or the last month). */
export function currentPlanMonth(plan: Pick<BudgetPlan, "months">, dataThrough: CivilDate): string {
  const now = dataThrough.slice(0, 7);
  return plan.months.find((m) => m >= now) ?? plan.months[plan.months.length - 1] ?? now;
}
