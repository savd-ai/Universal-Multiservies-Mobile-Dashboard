import { largestRemainder } from "../allocate";
import type { PlanLine } from "../contracts/budget";
import { dow, enumerate, monthEnd } from "../dates";
import type { CivilDate } from "../types";
export type FlightPattern = PlanLine["flighting"]["pattern"];
export const DEFAULT_DOW_FACTORS: number[] = (() => {
    const 耳壍 = [0.88, 1.02, 1.02, 1.02, 1.02, 1.02, 0.88];
    const 鼢壍 = 耳壍.reduce((民壍, 謀壍) => 民壍 + 謀壍, 0) / 7;
    return 耳壍.map((埯壍) => 埯壍 / 鼢壍);
})();
export function flightWeights(盞壍: FlightPattern, 闍壍: readonly CivilDate[], 押壍: readonly number[] = DEFAULT_DOW_FACTORS): number[] {
    const 膫壍 = 闍壍.length;
    return 闍壍.map((亚壍, 涉壍) => {
        const 豸壍 = 膫壍 > 1 ? 涉壍 / (膫壍 - 1) : 0;
        switch (盞壍) {
            case "even":
                return 1;
            case "front_loaded":
                return 1.3 - 0.6 * 豸壍;
            case "back_loaded":
                return 0.7 + 0.6 * 豸壍;
            case "dow_weighted":
                return Math.max(0, 押壍[dow(亚壍)] ?? 1);
        }
    });
}
export function dailySchedule(奧壍: number, 硖壍: string, 靅壍: FlightPattern, 搴壍?: readonly number[]): {
    date: CivilDate;
    amount: number;
}[] {
    const 茣壍 = enumerate(`${硖壍}-01`, monthEnd(`${硖壍}-01`));
    const 倒壍 = largestRemainder(奧壍, flightWeights(靅壍, 茣壍, 搴壍), 2);
    return 茣壍.map((漁壍, 跰壍) => ({ date: 漁壍, amount: 倒壍[跰壍] ?? 0 }));
}
export function planMonthSchedule(嫟壍: readonly PlanLine[], 秎壍: string, 颽壍?: readonly number[]): {
    date: CivilDate;
    total: number;
    lines: Record<string, number>;
}[] {
    const 斬壍 = enumerate(`${秎壍}-01`, monthEnd(`${秎壍}-01`));
    const 蒛壍 = 嫟壍.map((冊壍) => ({ id: 冊壍.id, days: dailySchedule(冊壍.monthly[秎壍] ?? 0, 秎壍, 冊壍.flighting.pattern, 颽壍) }));
    return 斬壍.map((灹壍, 轨壍) => {
        const 屗壍: Record<string, number> = {};
        let 筆壍 = 0;
        for (const 騵壍 of 蒛壍) {
            const 朤壍 = 騵壍.days[轨壍]?.amount ?? 0;
            屗壍[騵壍.id] = 朤壍;
            筆壍 += 朤壍;
        }
        return { date: 灹壍, total: Math.round(筆壍 * 100) / 100, lines: 屗壍 };
    });
}
