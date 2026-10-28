import { largestRemainder } from "../allocate";
import type { PlanLine } from "../contracts/budget";
import { dow, enumerate, monthEnd } from "../dates";
import type { CivilDate } from "../types";
export type FlightPattern = PlanLine["flighting"]["pattern"];
export const DEFAULT_DOW_FACTORS: number[] = (() => {
    const raw = [0.88, 1.02, 1.02, 1.02, 1.02, 1.02, 0.88];
    const m = raw.reduce((a, b) => a + b, 0) / 7;
    return raw.map((v) => v / m);
})();
export function flightWeights(pattern: FlightPattern, dates: readonly CivilDate[], dowFactors: readonly number[] = DEFAULT_DOW_FACTORS): number[] {
    const n = dates.length;
    return dates.map((d, i) => {
        const t = n > 1 ? i / (n - 1) : 0;
        switch (pattern) {
            case "even":
                return 1;
            case "front_loaded":
                return 1.3 - 0.6 * t;
            case "back_loaded":
                return 0.7 + 0.6 * t;
            case "dow_weighted":
                return Math.max(0, dowFactors[dow(d)] ?? 1);
        }
    });
}
export function dailySchedule(amount: number, month: string, pattern: FlightPattern, dowFactors?: readonly number[]): {
    date: CivilDate;
    amount: number;
}[] {
    const dates = enumerate(`${month}-01`, monthEnd(`${month}-01`));
    const parts = largestRemainder(amount, flightWeights(pattern, dates, dowFactors), 2);
    return dates.map((date, i) => ({ date, amount: parts[i] ?? 0 }));
}
export function planMonthSchedule(lines: readonly PlanLine[], month: string, dowFactors?: readonly number[]): {
    date: CivilDate;
    total: number;
    lines: Record<string, number>;
}[] {
    const dates = enumerate(`${month}-01`, monthEnd(`${month}-01`));
    const perLine = lines.map((l) => ({ id: l.id, days: dailySchedule(l.monthly[month] ?? 0, month, l.flighting.pattern, dowFactors) }));
    return dates.map((date, i) => {
        const byLine: Record<string, number> = {};
        let total = 0;
        for (const l of perLine) {
            const v = l.days[i]?.amount ?? 0;
            byLine[l.id] = v;
            total += v;
        }
        return { date, total: Math.round(total * 100) / 100, lines: byLine };
    });
}
