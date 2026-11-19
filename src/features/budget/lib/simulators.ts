import { SIMULATION_LABELS } from "@/lib/domain/budget/google";
import type { EstimateCampaignView, RecommendationImpact, SimulationDayPoint, SimulationType, SimulationView } from "@/lib/domain/contracts/estimates";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { moneyExact, perDay } from "./money";

// Simulators tab shaping: labels for simulated settings, the points table (CPA and ROAS as ratios of each point's
// sums), the campaign picker's availability line, the default selection and a recommendation's weekly deltas.

export const SIMULATION_KEYS = ["budget", "target_cpa", "target_roas"] as const;
export type SimulationKey = (typeof SIMULATION_KEYS)[number];

const TYPE_OF_KEY: Record<SimulationKey, SimulationType> = { budget: "BUDGET", target_cpa: "TARGET_CPA", target_roas: "TARGET_ROAS" };
export const typeOfKey = (k: SimulationKey): SimulationType => TYPE_OF_KEY[k];
export const keyOfType = (t: SimulationType): SimulationKey => (t === "BUDGET" ? "budget" : t === "TARGET_CPA" ? "target_cpa" : "target_roas");

/** "$420/day" (daily budget) · "$42.00" (target CPA) · "4.00x" (target ROAS) */
export function settingLabel(type: SimulationType, value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (type === "BUDGET") return perDay(value, currency);
  if (type === "TARGET_CPA") return formatMetricValue("money", value, { currency, compact: false, decimals: value < 100 ? 2 : 0 });
  return formatMetricValue("ratio", value);
}

export interface PointRow extends SimulationDayPoint {
  cpa: number | null;
  roas: number | null;
  /** the point at the campaign's current setting */
  current: boolean;
}

/** Google's per-day points with CPA and ROAS; the point at the current setting (±0.5 %) is marked. */
export function pointRows(view: Pick<SimulationView, "perDay" | "current">): PointRow[] {
  const cur = view.current;
  return view.perDay.map((p) => ({
    ...p,
    cpa: p.conversions > 0 ? p.cost / p.conversions : null,
    roas: p.cost > 0 ? p.convValue / p.cost : null,
    current: cur !== null && cur > 0 && Math.abs(p.value / cur - 1) <= 0.005,
  }));
}

/** The picker's second line: the simulation types Google returned, or why there are none. */
export function availabilityLabel(c: Pick<EstimateCampaignView, "simulations" | "type">): string {
  if (c.simulations.length) return c.simulations.map((s) => SIMULATION_LABELS[s.type]).join(" · ");
  return "No simulations from Google";
}

/** First campaign with a budget simulation, else the first with any simulation, else the first campaign. */
export function defaultCampaign<T extends Pick<EstimateCampaignView, "simulations">>(campaigns: readonly T[]): T | null {
  return campaigns.find((c) => c.simulations.some((s) => s.type === "BUDGET")) ?? campaigns.find((c) => c.simulations.length > 0) ?? campaigns[0] ?? null;
}

export interface WeeklyDelta {
  conversions: number | null;
  convValue: number | null;
  cost: number | null;
  clicks: number | null;
}

/** potential − base for each metric Google reported (weekly figures). */
export function weeklyDelta(impact: RecommendationImpact | null): WeeklyDelta | null {
  if (!impact) return null;
  const d = (base: number | null, potential: number | null) => (base === null || potential === null ? null : potential - base);
  const out: WeeklyDelta = {
    conversions: d(impact.base.conversions, impact.potential.conversions),
    convValue: d(impact.base.convValue, impact.potential.convValue),
    cost: d(impact.base.cost, impact.potential.cost),
    clicks: d(impact.base.clicks, impact.potential.clicks),
  };
  return Object.values(out).some((v) => v !== null) ? out : null;
}

const signed = (v: number, body: string) => `${v < 0 ? "−" : "+"}${body}`;

/** "+124 conv. · +$10,650 value · +$927 cost" (only the metrics Google reported). */
export function weeklyImpactLine(delta: WeeklyDelta | null, currency: string): string | null {
  if (!delta) return null;
  const parts: string[] = [];
  if (delta.conversions !== null) parts.push(`${signed(delta.conversions, formatMetricValue("decimal", Math.abs(delta.conversions)))} conv.`);
  if (delta.convValue !== null) parts.push(`${signed(delta.convValue, moneyExact(Math.abs(delta.convValue), currency))} value`);
  if (delta.cost !== null) parts.push(`${signed(delta.cost, moneyExact(Math.abs(delta.cost), currency))} cost`);
  if (!parts.length && delta.clicks !== null) parts.push(`${signed(delta.clicks, formatMetricValue("number", Math.abs(delta.clicks)))} clicks`);
  return parts.length ? parts.join(" · ") : null;
}
