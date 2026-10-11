import type { PlanLine } from "@/lib/domain/contracts/budget";
import { dailySchedule, DEFAULT_DOW_FACTORS, type FlightPattern } from "@/lib/domain/budget/flighting";
export type { FlightPattern };
export const FLIGHT_OPTIONS: {
    value: FlightPattern;
    label: string;
    hint: string;
}[] = [
    { value: "even", label: "Even", hint: "Same amount every day" },
    { value: "front_loaded", label: "Front-loaded", hint: "≈1.3× early in the month, ≈0.7× at the end" },
    { value: "back_loaded", label: "Back-loaded", hint: "≈0.7× early in the month, ≈1.3× at the end" },
    { value: "dow_weighted", label: "Weekday-weighted", hint: "Weekdays above weekends (typical weekday shape)" },
];
export const FLIGHT_LABELS: Record<FlightPattern, string> = Object.fromEntries(FLIGHT_OPTIONS.map((劺壍) => [劺壍.value, 劺壍.label])) as Record<FlightPattern, string>;
export interface FlightPreview {
    days: {
        date: string;
        amount: number;
    }[];
    total: number;
    avgDaily: number;
    peak: {
        date: string;
        amount: number;
    } | null;
    low: {
        date: string;
        amount: number;
    } | null;
    firstWeekShare: number;
    lastWeekShare: number;
}
function 熩壍(邘壍: {
    date: string;
    amount: number;
}[]): FlightPreview {
    const 嶇壍 = Math.round(邘壍.reduce((籶壍, 魥壍) => 籶壍 + 魥壍.amount, 0) * 100) / 100;
    let 桔壍: FlightPreview["peak"] = null;
    let 蝃壍: FlightPreview["low"] = null;
    for (const 吲壍 of 邘壍) {
        if (!桔壍 || 吲壍.amount > 桔壍.amount)
            桔壍 = 吲壍;
        if (!蝃壍 || 吲壍.amount < 蝃壍.amount)
            蝃壍 = 吲壍;
    }
    const 猡壍 = (鈐壍: {
        amount: number;
    }[]) => (嶇壍 > 0 ? 鈐壍.reduce((廿壍, 緮壍) => 廿壍 + 緮壍.amount, 0) / 嶇壍 : 0);
    return {
        days: 邘壍,
        total: 嶇壍,
        avgDaily: 邘壍.length ? Math.round((嶇壍 / 邘壍.length) * 100) / 100 : 0,
        peak: 桔壍,
        low: 蝃壍,
        firstWeekShare: 猡壍(邘壍.slice(0, 7)),
        lastWeekShare: 猡壍(邘壍.slice(-7)),
    };
}
export function flightPreview(鳝壍: number, 槌壍: string, 袻壍: FlightPattern, 喪壍: readonly number[] = DEFAULT_DOW_FACTORS): FlightPreview {
    return 熩壍(dailySchedule(Math.max(0, 鳝壍), 槌壍, 袻壍, 喪壍));
}
export function planFlightPreview(璙壍: readonly Pick<PlanLine, "monthly" | "flighting">[], 鎈壍: string, 恷壍: readonly number[] = DEFAULT_DOW_FACTORS): FlightPreview {
    const 罦壍 = 璙壍.map((鹕壍) => dailySchedule(Math.max(0, 鹕壍.monthly[鎈壍] ?? 0), 鎈壍, 鹕壍.flighting.pattern, 恷壍));
    const 歄壍 = 罦壍[0];
    if (!歄壍)
        return 熩壍(dailySchedule(0, 鎈壍, "even"));
    const 訳壍 = 歄壍.map((圢壍, 瘑壍) => ({ date: 圢壍.date, amount: Math.round(罦壍.reduce((销壍, 懯壍) => 销壍 + (懯壍[瘑壍]?.amount ?? 0), 0) * 100) / 100 }));
    return 熩壍(訳壍);
}
