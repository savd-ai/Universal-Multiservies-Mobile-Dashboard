import { cn } from "./cn";
export function linePath(vals: readonly (number | null)[], max: number, min = 0, x0 = 0, x1 = 100): string {
    const n = vals.length;
    const span = max - min || 1;
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) {
            pen = false;
            return;
        }
        const x = x0 + (n > 1 ? i / (n - 1) : 0) * (x1 - x0);
        const y = 100 - ((v - min) / span) * 100;
        d += `${pen ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
        pen = true;
    });
    return d.trim();
}
function bounds(vals: readonly (number | null)[], pad = 0.1): {
    max: number;
    min: number;
} {
    const nums = vals.filter((v): v is number => v !== null && Number.isFinite(v));
    if (!nums.length)
        return { max: 1, min: 0 };
    const mx = Math.max(...nums);
    const mn = Math.min(...nums);
    const r = mx - mn || Math.abs(mx) || 1;
    return { max: mx + r * pad, min: mn - r * pad };
}
export function Sparkline({ values, color = "var(--accent-line)", className, height = 24, strokeWidth = 1.5 }: {
    values: readonly (number | null)[];
    color?: string;
    className?: string;
    height?: number;
    strokeWidth?: number;
}) {
    const { max, min } = bounds(values);
    return (<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("w-full overflow-visible", className)} style={{ height }} aria-hidden>
      <path d={linePath(values, max, min)} fill="none" style={{ stroke: color }} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>);
}
export function AreaSpark({ values, refLine, height = 140, className, gradientId }: {
    values: readonly number[];
    refLine?: number | null;
    height?: number;
    className?: string;
    gradientId: string;
}) {
    const mx = Math.max(...values, refLine ?? 0, 1) * 1.15;
    const line = linePath(values, mx);
    const refY = refLine ? 100 - (refLine / mx) * 100 : null;
    return (<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("w-full overflow-visible", className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04BF9D" stopOpacity="0.26"/>
          <stop offset="1" stopColor="#04BF9D" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {line ? <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gradientId})`}/> : null}
      <path d={line} fill="none" style={{ stroke: "var(--accent-line)" }} strokeWidth={2} vectorEffect="non-scaling-stroke"/>
      {refY !== null ? <path d={`M0,${refY.toFixed(2)} L100,${refY.toFixed(2)}`} fill="none" style={{ stroke: "var(--faint)" }} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke"/> : null}
    </svg>);
}
export function BandSpark({ values, band, recentDays = 3, color, height = 120 }: {
    values: readonly (number | null)[];
    band?: {
        lo: number;
        hi: number;
    };
    recentDays?: number;
    color: string;
    height?: number;
}) {
    const nums = values.filter((v): v is number => v !== null);
    const max = Math.max(...nums, band?.hi ?? 0) * 1.08 || 1;
    const min = Math.min(...nums, band?.lo ?? 0) * 0.9;
    const span = max - min || 1;
    const bandTop = band ? (1 - (band.hi - min) / span) * 100 : 0;
    const bandH = band ? ((band.hi - band.lo) / span) * 100 : 0;
    const recentW = values.length ? (recentDays / values.length) * 100 : 0;
    return (<div className="relative" style={{ height }}>
      {band ? <div className="absolute inset-x-0 border-y border-dashed border-tone/14 bg-tone/5" style={{ top: `${bandTop}%`, height: `${Math.max(0, bandH)}%` }}/> : null}
      <div className="absolute inset-y-0 right-0 rounded-[4px]" style={{ width: `${recentW}%`, background: color, opacity: 0.12 }}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={linePath(values, max, min)} fill="none" style={{ stroke: color }} strokeWidth={1.75} vectorEffect="non-scaling-stroke"/>
      </svg>
    </div>);
}
