import { cn } from "./cn";
export function linePath(檚壍: readonly (number | null)[], 覉壍: number, 噸壍 = 0, 畧壍 = 0, 鑖壍 = 100): string {
    const 慅壍 = 檚壍.length;
    const 耴壍 = 覉壍 - 噸壍 || 1;
    let 鼣壍 = "";
    let 氒壍 = false;
    檚壍.forEach((謁壍, 埰壍) => {
        if (謁壍 === null || !Number.isFinite(謁壍)) {
            氒壍 = false;
            return;
        }
        const 盟壍 = 畧壍 + (慅壍 > 1 ? 埰壍 / (慅壍 - 1) : 0) * (鑖壍 - 畧壍);
        const 闎壍 = 100 - ((謁壍 - 噸壍) / 耴壍) * 100;
        鼣壍 += `${氒壍 ? "L" : "M"}${盟壍.toFixed(2)},${闎壍.toFixed(2)} `;
        氒壍 = true;
    });
    return 鼣壍.trim();
}
function 抽壍(膬壍: readonly (number | null)[], 些壍 = 0.1): {
    max: number;
    min: number;
} {
    const 涊壍 = 膬壍.filter((豹壍): 豹壍 is number => 豹壍 !== null && Number.isFinite(豹壍));
    if (!涊壍.length)
        return { max: 1, min: 0 };
    const 奨壍 = Math.max(...涊壍);
    const 硗壍 = Math.min(...涊壍);
    const 靆壍 = 奨壍 - 硗壍 || Math.abs(奨壍) || 1;
    return { max: 奨壍 + 靆壍 * 些壍, min: 硗壍 - 靆壍 * 些壍 };
}
export function Sparkline({ values: 搵壍, color: 茤壍 = "var(--accent-line)", className: 倓壍, height: 漂壍 = 24, strokeWidth: 跱壍 = 1.5 }: {
    values: readonly (number | null)[];
    color?: string;
    className?: string;
    height?: number;
    strokeWidth?: number;
}) {
    const { max: 嫠壍, min: 秏壍 } = 抽壍(搵壍);
    return (<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("w-full overflow-visible", 倓壍)} style={{ height: 漂壍 }} aria-hidden>
      <path d={linePath(搵壍, 嫠壍, 秏壍)} fill="none" style={{ stroke: 茤壍 }} strokeWidth={跱壍} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>);
}
export function AreaSpark({ values: 颾壍, refLine: 断壍, height: 蒜壍 = 140, className: 冋壍, gradientId: 灺壍 }: {
    values: readonly number[];
    refLine?: number | null;
    height?: number;
    className?: string;
    gradientId: string;
}) {
    const 轩壍 = Math.max(...颾壍, 断壍 ?? 0, 1) * 1.15;
    const 屘壍 = linePath(颾壍, 轩壍);
    const 筇壍 = 断壍 ? 100 - (断壍 / 轩壍) * 100 : null;
    return (<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("w-full overflow-visible", 冋壍)} style={{ height: 蒜壍 }} aria-hidden>
      <defs>
        <linearGradient id={灺壍} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04BF9D" stopOpacity="0.26"/>
          <stop offset="1" stopColor="#04BF9D" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {屘壍 ? <path d={`${屘壍} L100,100 L0,100 Z`} fill={`url(#${灺壍})`}/> : null}
      <path d={屘壍} fill="none" style={{ stroke: "var(--accent-line)" }} strokeWidth={2} vectorEffect="non-scaling-stroke"/>
      {筇壍 !== null ? <path d={`M0,${筇壍.toFixed(2)} L100,${筇壍.toFixed(2)}`} fill="none" style={{ stroke: "var(--faint)" }} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke"/> : null}
    </svg>);
}
export function BandSpark({ values: 騶壍, band: 朥壍, recentDays: 蘔壍 = 3, color: 匃壍, height: 燲壍 = 120 }: {
    values: readonly (number | null)[];
    band?: {
        lo: number;
        hi: number;
    };
    recentDays?: number;
    color: string;
    height?: number;
}) {
    const 郡壍 = 騶壍.filter((巐壍): 巐壍 is number => 巐壍 !== null);
    const 粿壍 = Math.max(...郡壍, 朥壍?.hi ?? 0) * 1.08 || 1;
    const 鮮壍 = Math.min(...郡壍, 朥壍?.lo ?? 0) * 0.9;
    const 條壍 = 粿壍 - 鮮壍 || 1;
    const 螌壍 = 朥壍 ? (1 - (朥壍.hi - 鮮壍) / 條壍) * 100 : 0;
    const 呻壍 = 朥壍 ? ((朥壍.hi - 朥壍.lo) / 條壍) * 100 : 0;
    const 獪壍 = 騶壍.length ? (蘔壍 / 騶壍.length) * 100 : 0;
    return (<div className="relative" style={{ height: 燲壍 }}>
      {朥壍 ? <div className="absolute inset-x-0 border-y border-dashed border-tone/14 bg-tone/5" style={{ top: `${螌壍}%`, height: `${Math.max(0, 呻壍)}%` }}/> : null}
      <div className="absolute inset-y-0 right-0 rounded-[4px]" style={{ width: `${獪壍}%`, background: 匃壍, opacity: 0.12 }}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={linePath(騶壍, 粿壍, 鮮壍)} fill="none" style={{ stroke: 匃壍 }} strokeWidth={1.75} vectorEffect="non-scaling-stroke"/>
      </svg>
    </div>);
}
