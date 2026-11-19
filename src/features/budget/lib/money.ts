import { formatMoney } from "@/lib/domain/metrics/registry";

// Money helpers for planning amounts: the $50 grid shared by the sliders, the optimizer and the plan grid,
// tolerant parsing of typed amounts, and monthly → daily conversion (Google Ads budgets are daily).

/** Planning grid: sliders, typed targets and the optimizer all land on multiples of this. */
export const MONEY_STEP = 50;

/** Round to the nearest `step` (half up), never below 0; the result is clean to the cent. */
export function roundMoney(value: number, step = MONEY_STEP): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const s = step > 0 ? step : 1;
  return Math.round(Math.round(value / s) * s * 100) / 100;
}

/** Round, then clamp into [min, max] (a slider's range). */
export function snapToRange(value: number, min: number, max: number, step = MONEY_STEP): number {
  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(lo, max);
  return Math.min(hi, Math.max(lo, roundMoney(value, step)));
}

/** Parse a typed amount: "$12,345.60", "12.5k", "1.2m", "13 000". Returns null for anything that isn't ≥ 0. */
export function parseMoney(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[\s,_]/g, "").replace(/^[^\d.\-−]+/, "");
  const m = /^([\d.]+)([km])?$/.exec(s);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const mult = m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1;
  return Math.round(n * mult * 100) / 100;
}

/** Daily budget that spends `monthly` evenly over `days`, to the cent. */
export function dailyFromMonthly(monthly: number, days: number): number {
  if (!(days > 0) || !Number.isFinite(monthly)) return 0;
  return Math.round((monthly / days) * 100) / 100;
}

/** Display money; compact above 10K like the prototype ("$136.5K"). */
export function money(v: number | null | undefined, currency: string, opts: { compact?: boolean; decimals?: number } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return formatMoney(v, { currency, compact: opts.compact, decimals: opts.decimals });
}

/** Exact whole-unit money for inputs and notes ("$12,600"). */
export function moneyExact(v: number | null | undefined, currency: string): string {
  return money(v, currency, { compact: false, decimals: 0 });
}

/** "$586/day" */
export function perDay(v: number | null | undefined, currency: string): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${moneyExact(v, currency)}/day`;
}
