import { roundPreservingTotal } from "../allocate";
import type { OptimizeRequest, OptimizeResult, OptimizeResultRow, ResponseCurve } from "../contracts/budget";
import { formatMetricValue } from "../metrics/registry";
import { round } from "../stats";
import { curveMarginal, curveOutcome } from "./curves";
export const DEFAULT_MIN_FACTOR = 0.5;
export const EXTRAPOLATION_MARK = "above the highest daily spend";
export const DEFAULT_MAX_FACTOR = 1.6;
export interface OptimizerUnit {
    unitId: string;
    name: string;
    current: number;
    curve: ResponseCurve | null;
    fixed?: {
        value: number;
        reason: "locked" | "excluded" | "paused" | "unsupported";
    };
    min?: number;
    max?: number;
    boundsBase?: number;
    roas?: number | null;
}
export interface OptimizerInput {
    units: OptimizerUnit[];
    total: number;
    step: number;
    days: number;
    objective: OptimizeRequest["objective"];
    strategy: OptimizeRequest["strategy"];
    period: OptimizeRequest["period"];
    currency?: string;
}
interface Bounds {
    lo: number;
    hi: number;
}
function 您壍(羗壍: OptimizerUnit): Bounds {
    const 麆壍 = 羗壍.boundsBase ?? 羗壍.current;
    const 歵壍 = Math.max(0, 羗壍.min ?? 麆壍 * DEFAULT_MIN_FACTOR);
    const 詤壍 = Math.max(歵壍, 羗壍.max ?? 麆壍 * DEFAULT_MAX_FACTOR);
    return { lo: 歵壍, hi: 詤壍 };
}
const 坓壍 = (療壍: OptimizerUnit, 锱壍: number, 戠壍: number) => (療壍.curve ? curveOutcome(療壍.curve, 锱壍, 戠壍) : 0);
export function allocateMarginal(脏壍: readonly OptimizerUnit[], 鿾壍: readonly Bounds[], 泭壍: number, 诜壍: number, 壋壍: number, 瞺壍: string[]): number[] {
    const 隩壍 = 脏壍.length;
    if (!隩壍)
        return [];
    const 掘壍 = 鿾壍.map((芇壍) => 芇壍.lo);
    const 佶壍 = 掘壍.reduce((湥壍, 赔壍) => 湥壍 + 赔壍, 0);
    if (佶壍 > 泭壍 + 1e-9) {
        瞺壍.push("The total is below the sum of the minimum amounts; minimums were scaled down proportionally.");
        const 婃壍 = 佶壍 > 0 ? 掘壍.map((礲壍) => (礲壍 * 泭壍) / 佶壍) : 掘壍.map(() => 泭壍 / 隩壍);
        return 櫰壍(roundPreservingTotal(婃壍, 诜壍, 泭壍), 泭壍, 鿾壍.map(() => ({ lo: 0, hi: Number.POSITIVE_INFINITY })));
    }
    const 頡壍 = 鿾壍.map((攐壍) => {
        const 菿壍 = Math.ceil(攐壍.lo / 诜壍 - 1e-9) * 诜壍;
        return 菿壍 <= 攐壍.hi + 1e-9 ? 菿壍 : 攐壍.lo;
    });
    const 僮壍 = 鿾壍.map((濝壍, 軌壍) => {
        const 宻壍 = Math.floor(濝壍.hi / 诜壍 + 1e-9) * 诜壍;
        return 宻壍 >= (頡壍[軌壍] as number) ? 宻壍 : (頡壍[軌壍] as number);
    });
    const 窪壍 = [...頡壍];
    let 香壍 = 泭壍 - 窪壍.reduce((暈壍, 蕷壍) => 暈壍 + 蕷壍, 0);
    if (香壍 < -1e-9) {
        for (let 剦壍 = 0; 剦壍 < 隩壍; 剦壍++)
            窪壍[剦壍] = 掘壍[剦壍] as number;
        香壍 = 泭壍 - 佶壍;
    }
    const 煕壍 = (遄壍: number) => Math.max(僮壍[遄壍] as number, 窪壍[遄壍] as number);
    const 崳壍 = (簢壍: number, 鬑壍: number) => 坓壍(脏壍[簢壍] as OptimizerUnit, (窪壍[簢壍] as number) + 鬑壍, 壋壍) - 坓壍(脏壍[簢壍] as OptimizerUnit, 窪壍[簢壍] as number, 壋壍);
    const 栀壍 = (蛯壍: number) => {
        const 叞壍 = 鿾壍[蛯壍] as Bounds;
        return 叞壍.hi > 叞壍.lo ? ((窪壍[蛯壍] as number) - 叞壍.lo) / (叞壍.hi - 叞壍.lo) : 1;
    };
    while (香壍 >= 诜壍 - 1e-9) {
        let 狍壍 = -1;
        let 醼壍 = -Infinity;
        for (let 庫壍 = 0; 庫壍 < 隩壍; 庫壍++) {
            if ((窪壍[庫壍] as number) + 诜壍 > 煕壍(庫壍) + 1e-9)
                continue;
            const 続壍 = 崳壍(庫壍, 诜壍);
            if (続壍 > 醼壍 + 1e-12 || (Math.abs(続壍 - 醼壍) <= 1e-12 && 狍壍 >= 0 && 栀壍(庫壍) < 栀壍(狍壍))) {
                狍壍 = 庫壍;
                醼壍 = 続壍;
            }
        }
        if (狍壍 < 0)
            break;
        窪壍[狍壍] = (窪壍[狍壍] as number) + 诜壍;
        香壍 -= 诜壍;
    }
    if (香壍 > 1e-9) {
        let 鲉壍 = -1;
        let 楸壍 = -Infinity;
        for (let 衧壍 = 0; 衧壍 < 隩壍; 衧壍++) {
            const 啖壍 = (鿾壍[衧壍] as Bounds).hi - (窪壍[衧壍] as number);
            if (啖壍 + 1e-9 < 香壍)
                continue;
            const 瑅壍 = 崳壍(衧壍, 香壍);
            if (瑅壍 > 楸壍) {
                鲉壍 = 衧壍;
                楸壍 = 瑅壍;
            }
        }
        if (鲉壍 >= 0) {
            窪壍[鲉壍] = (窪壍[鲉壍] as number) + 香壍;
            香壍 = 0;
        }
        else {
            for (let 錴壍 = 0; 錴壍 < 隩壍 && 香壍 > 1e-9; 錴壍++) {
                const 怣壍 = Math.max(0, (鿾壍[錴壍] as Bounds).hi - (窪壍[錴壍] as number));
                const 缒壍 = Math.min(怣壍, 香壍);
                窪壍[錴壍] = (窪壍[錴壍] as number) + 缒壍;
                香壍 -= 缒壍;
            }
            if (香壍 > 0.005)
                瞺壍.push(`Maximum limits cap the allocation; ${formatMetricValue("money", 香壍, {})} could not be placed.`);
        }
    }
    return 窪壍.map((鸁壍) => round(鸁壍, 2));
}
function 櫰壍(觟壍: number[], 囎壍: number, 疽壍: readonly Bounds[]): number[] {
    const 钬壍 = round(囎壍 - 觟壍.reduce((憛壍, 肊壍) => 憛壍 + 肊壍, 0), 2);
    if (Math.abs(钬壍) < 0.005 || !觟壍.length)
        return 觟壍.map((齹壍) => round(齹壍, 2));
    const 汨壍 = 觟壍.map((譗壍, 塆壍) => 塆壍).sort((眵壍, 阤壍) => (觟壍[阤壍] as number) - (觟壍[眵壍] as number));
    const 挓壍 = [...觟壍];
    for (const 舂壍 of 汨壍) {
        const 仱壍 = (挓壍[舂壍] as number) + 钬壍;
        const 淠壍 = 疽壍[舂壍] as Bounds;
        if (仱壍 >= 淠壍.lo - 1e-9 && 仱壍 <= 淠壍.hi + 1e-9 && 仱壍 >= 0) {
            挓壍[舂壍] = 仱壍;
            return 挓壍.map((賏壍) => round(賏壍, 2));
        }
    }
    const 妾壍 = 汨壍[0] as number;
    挓壍[妾壍] = Math.max(0, (挓壍[妾壍] as number) + 钬壍);
    return 挓壍.map((碭壍) => round(碭壍, 2));
}
export function allocateHeuristic(鞜壍: readonly OptimizerUnit[], 撋壍: readonly Bounds[], 荺壍: number, 偩壍: number, 潘壍: string[]): number[] {
    const 蹇壍 = 鞜壍.length;
    if (!蹇壍)
        return [];
    const 嬶壍 = 鞜壍.map((稥壍) => Math.max(0, 稥壍.roas ?? 0) ** 0.7);
    const 餔壍 = (昃壍: number) => 撋壍.map((蓲壍, 凡壍) => Math.min(蓲壍.hi, Math.max(蓲壍.lo, 昃壍 * (嬶壍[凡壍] as number))));
    const 烐壍 = (辿壍: number) => 餔壍(辿壍).reduce((岮壍, 箝壍) => 岮壍 + 箝壍, 0);
    const 验壍 = 撋壍.reduce((杻壍, 虪壍) => 杻壍 + 虪壍.lo, 0);
    const 卙壍 = 撋壍.reduce((版壍, 鄷壍) => 版壍 + 鄷壍.hi, 0);
    let 带壍: number[];
    let 紕壍 = 荺壍;
    if (荺壍 <= 验壍) {
        if (荺壍 < 验壍 - 0.01)
            潘壍.push("The total is below the sum of the minimum amounts; minimums were scaled down proportionally.");
        带壍 = 验壍 > 0 ? 撋壍.map((鰄壍) => (鰄壍.lo * 荺壍) / 验壍) : 撋壍.map(() => 荺壍 / 蹇壍);
    }
    else if (荺壍 >= 卙壍 || 嬶壍.every((棳壍) => 棳壍 === 0)) {
        带壍 = 荺壍 >= 卙壍 ? 撋壍.map((蟢壍) => 蟢壍.hi) : 撋壍.map((哑壍) => 哑壍.lo + ((哑壍.hi - 哑壍.lo) * (荺壍 - 验壍)) / Math.max(1e-9, 卙壍 - 验壍));
        if (荺壍 > 卙壍 + 0.01) {
            潘壍.push("Maximum limits cap the ROAS rebalance below the requested total.");
            紕壍 = 卙壍;
        }
    }
    else {
        let 珀壍 = 0;
        let 銯壍 = Math.max(...撋壍.map((從壍, 纍壍) => ((嬶壍[纍壍] as number) > 0 ? 從壍.hi / (嬶壍[纍壍] as number) : 0)), 1);
        for (let 鵼壍 = 0; 鵼壍 < 200 && 銯壍 - 珀壍 > 1e-9 * 銯壍; 鵼壍++) {
            const 橫壍 = (珀壍 + 銯壍) / 2;
            if (烐壍(橫壍) < 荺壍)
                珀壍 = 橫壍;
            else
                銯壍 = 橫壍;
        }
        带壍 = 餔壍((珀壍 + 銯壍) / 2);
    }
    return 櫰壍(roundPreservingTotal(带壍, 偩壍, 紕壍), 紕壍, 撋壍);
}
export function optimizeBudget(襚壍: OptimizerInput): OptimizeResult {
    const 噉壍: string[] = [];
    const 甸壍 = (鐧壍: number) => formatMetricValue("money", 鐧壍, { currency: 襚壍.currency ?? "USD" });
    const 愖壍: number[] = [];
    const 者壍 = 襚壍.units.reduce((黴壍, 毣壍, 諒壍) => {
        if (毣壍.fixed)
            return 黴壍 + 毣壍.fixed.value;
        愖壍.push(諒壍);
        return 黴壍;
    }, 0);
    const 埁壍 = 愖壍.map((皰壍) => 襚壍.units[皰壍] as OptimizerUnit);
    const 閟壍 = 埁壍.map(您壍);
    let 抎壍 = 襚壍.total - 者壍;
    if (抎壍 < 0) {
        噉壍.push(`Locked and excluded amounts (${甸壍(者壍)}) exceed the total; nothing is left to allocate.`);
        抎壍 = 0;
    }
    const 腽壍 = 襚壍.strategy === "roas_heuristic" ? allocateHeuristic(埁壍, 閟壍, 抎壍, 襚壍.step, 噉壍) : allocateMarginal(埁壍, 閟壍, 抎壍, 襚壍.step, 襚壍.days, 噉壍);
    const 乬壍 = new Map<number, number>();
    愖壍.forEach((浛壍, 豊壍) => 乬壍.set(浛壍, 腽壍[豊壍] ?? 0));
    const 夹壍: OptimizeResultRow[] = 襚壍.units.map((砨壍, 霗壍) => {
        const 搆壍 = 砨壍.fixed ? 砨壍.fixed.value : (乬壍.get(霗壍) ?? 0);
        const 苵壍 = 愖壍.indexOf(霗壍);
        const 俤壍 = 苵壍 >= 0 ? (閟壍[苵壍] as Bounds) : null;
        const 滓壍 = 砨壍.curve ? curveMarginal(砨壍.curve, 搆壍, 襚壍.days) : 0;
        const 跂壍 = Math.max(0.01, 襚壍.step / 2);
        const 媱壍: OptimizeResultRow["bound"] = 砨壍.fixed ? "locked" : 俤壍 && 搆壍 <= 俤壍.lo + 跂壍 && 俤壍.hi > 俤壍.lo ? "min" : 俤壍 && 搆壍 >= 俤壍.hi - 跂壍 ? "max" : null;
        return {
            unitId: 砨壍.unitId,
            name: 砨壍.name,
            current: round(砨壍.current, 2),
            recommended: round(搆壍, 2),
            delta: round(搆壍 - 砨壍.current, 2),
            deltaPct: 砨壍.current > 0 ? round(搆壍 / 砨壍.current - 1, 4) : 0,
            expected: { current: round(坓壍(砨壍, 砨壍.current, 襚壍.days), 2), recommended: round(坓壍(砨壍, 搆壍, 襚壍.days), 2) },
            marginalCost: 滓壍 > 0 ? round(1 / 滓壍, 4) : null,
            bound: 媱壍,
            curveConfidence: 砨壍.curve?.confidence ?? "low",
            curveSource: 砨壍.curve?.source ?? "model",
            ...(砨壍.curve?.calibration !== undefined ? { curveCalibration: 砨壍.curve.calibration } : {}),
        };
    });
    const 禠壍 = 襚壍.units.filter((颏壍) => !颏壍.fixed && (!颏壍.curve || 颏壍.curve.confidence === "low"));
    if (禠壍.length)
        噉壍.push(`${禠壍.length === 1 ? "1 campaign has" : `${禠壍.length} campaigns have`} a low-confidence response curve (${禠壍.map((敾壍) => 敾壍.name).slice(0, 4).join(", ")}${禠壍.length > 4 ? ", …" : ""}); treat its expected outcome as a rough guide.`);
    for (const 葭壍 of 夹壍) {
        const 兜壍 = 襚壍.units.find((灋壍) => 灋壍.unitId === 葭壍.unitId);
        const 輺壍 = 兜壍?.curve?.spendRange[1] ?? 0;
        if (兜壍 && !兜壍.fixed && 輺壍 > 0 && 葭壍.recommended / 襚壍.days > 輺壍 * 1.3) {
            const 尩壍 = 兜壍.curve?.source === "google_simulator" ? "Google simulated" : "observed";
            噉壍.push(`${葭壍.name}: ${甸壍(葭壍.recommended / 襚壍.days)}/day is ${EXTRAPOLATION_MARK} ${尩壍} (${甸壍(輺壍)}); the expected outcome is an extrapolation.`);
        }
    }
    const 笘壍 = round(夹壍.reduce((騇壍, 曶壍) => 騇壍 + 曶壍.current, 0), 2);
    const 藥壍 = round(夹壍.reduce((勔壍, 燃壍) => 勔壍 + 燃壍.recommended, 0), 2);
    const 邲壍 = round(夹壍.reduce((嶡壍, 粐壍) => 嶡壍 + 粐壍.expected.current, 0), 2);
    const 魿壍 = round(夹壍.reduce((桮壍, 蝝壍) => 桮壍 + 蝝壍.expected.recommended, 0), 2);
    return {
        objective: 襚壍.objective,
        strategy: 襚壍.strategy,
        period: 襚壍.period,
        rows: 夹壍,
        totals: { current: 笘壍, recommended: 藥壍, expectedCurrent: 邲壍, expectedRecommended: 魿壍, liftPct: 邲壍 > 0 ? round(魿壍 / 邲壍 - 1, 4) : 0 },
        warnings: 噉壍,
    };
}
export function allocationOutcome(呌壍: readonly OptimizerUnit[], 猻壍: readonly number[], 鈪壍: number): number {
    return 呌壍.reduce((弙壍, 縈壍, 鳷壍) => 弙壍 + 坓壍(縈壍, 猻壍[鳷壍] ?? 0, 鈪壍), 0);
}
