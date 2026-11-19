import type { PlanLine } from "@/lib/domain/contracts/budget";
import { dailySchedule, DEFAULT_DOW_FACTORS, type FlightPattern } from "@/lib/domain/budget/flighting";

// Flighting previews for the plan grid: how a line's monthly amount spreads over the days of a month (the same
// largest-remainder schedule the server uses), plus the few numbers the preview caption needs.

export type { FlightPattern };

export const FLIGHT_OPTIONS: { value: FlightPattern; label: string; hint: string }[] = [
  { value: "even", label: "Even", hint: "Same amount every day" },
  { value: "front_loaded", label: "Front-loaded", hint: "≈1.3× early in the month, ≈0.7× at the end" },
  { value: "back_loaded", label: "Back-loaded", hint: "≈0.7× early in the month, ≈1.3× at the end" },
  { value: "dow_weighted", label: "Weekday-weighted", hint: "Weekdays above weekends (typical weekday shape)" },
];

export const FLIGHT_LABELS: Record<FlightPattern, string> = Object.fromEntries(FLIGHT_OPTIONS.map((o) => [o.value, o.label])) as Record<FlightPattern, string>;

export interface FlightPreview {
  days: { date: string; amount: number }[];
  total: number;
  avgDaily: number;
  peak: { date: string; amount: number } | null;
  low: { date: string; amount: number } | null;
  /** share of the month's amount in its first / last 7 days */
  firstWeekShare: number;
  lastWeekShare: number;
}

function summarise(days: { date: string; amount: number }[]): FlightPreview {
  const total = Math.round(days.reduce((s, d) => s + d.amount, 0) * 100) / 100;
  let peak: FlightPreview["peak"] = null;
  let low: FlightPreview["low"] = null;
  for (const d of days) {
    if (!peak || d.amount > peak.amount) peak = d;
    if (!low || d.amount < low.amount) low = d;
  }
  const share = (xs: { amount: number }[]) => (total > 0 ? xs.reduce((s, d) => s + d.amount, 0) / total : 0);
  return {
    days,
    total,
    avgDaily: days.length ? Math.round((total / days.length) * 100) / 100 : 0,
    peak,
    low,
    firstWeekShare: share(days.slice(0, 7)),
    lastWeekShare: share(days.slice(-7)),
  };
}

/** One amount over one month with a pattern (weekday factors default to the typical weekday/weekend shape). */
export function flightPreview(amount: number, month: string, pattern: FlightPattern, dowFactors: readonly number[] = DEFAULT_DOW_FACTORS): FlightPreview {
  return summarise(dailySchedule(Math.max(0, amount), month, pattern, dowFactors));
}

/** Sum of several lines' schedules for a month (each line keeps its own pattern). */
export function planFlightPreview(lines: readonly Pick<PlanLine, "monthly" | "flighting">[], month: string, dowFactors: readonly number[] = DEFAULT_DOW_FACTORS): FlightPreview {
  const perLine = lines.map((l) => dailySchedule(Math.max(0, l.monthly[month] ?? 0), month, l.flighting.pattern, dowFactors));
  const first = perLine[0];
  if (!first) return summarise(dailySchedule(0, month, "even"));
  const days = first.map((d, i) => ({ date: d.date, amount: Math.round(perLine.reduce((s, l) => s + (l[i]?.amount ?? 0), 0) * 100) / 100 }));
  return summarise(days);
}
