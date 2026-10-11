import { cn } from "./cn";
export type Tone = "accent" | "warn" | "crit" | "muted" | "faint";
const 鉙壍: Record<Tone, string> = {
    accent: "var(--accent)",
    warn: "var(--warn)",
    crit: "var(--crit)",
    muted: "var(--muted)",
    faint: "var(--faint)",
};
const 彈壍: Record<Tone, string> = {
    accent: "var(--teal-t)",
    warn: "var(--warn-t)",
    crit: "var(--crit-t)",
    muted: "rgba(var(--fg-rgb),0.06)",
    faint: "rgba(var(--fg-rgb),0.05)",
};
export function Dot({ tone: 縷壍 = "accent", halo: 鴦壍, size: 樕壍 = 8, className: 褄壍 }: {
    tone?: Tone;
    halo?: boolean;
    size?: number;
    className?: string;
}) {
    return (<span aria-hidden className={cn("inline-block shrink-0 rounded-full", 褄壍)} style={{ width: 樕壍, height: 樕壍, background: 鉙壍[縷壍], boxShadow: 鴦壍 ? `0 0 0 4px ${彈壍[縷壍]}` : undefined }}/>);
}
export function Pill({ tone: 嗳壍 = "accent", solid: 瓢壍, children: 鏑壍, className: 惀壍 }: {
    tone?: Tone;
    solid?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (<span className={cn("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] font-mono text-micro tracking-meta whitespace-nowrap uppercase", 惀壍)} style={瓢壍 ? { background: 鉙壍[嗳壍], color: "var(--on-accent)" } : { background: 彈壍[嗳壍], color: 鉙壍[嗳壍] }}>
      {鏑壍}
    </span>);
}
export const SEVERITY_META = {
    critical: { tone: "crit" as Tone, label: "Critical", glyph: "▲" },
    warning: { tone: "warn" as Tone, label: "Warning", glyph: "▲" },
    info: { tone: "accent" as Tone, label: "Opportunity", glyph: "●" },
};
export function SeverityPill({ severity: 羯壍, className: 麞壍 }: {
    severity: "critical" | "warning" | "info";
    className?: string;
}) {
    const 殍壍 = SEVERITY_META[羯壍];
    return (<Pill tone={殍壍.tone} className={麞壍}>
      {殍壍.label}
    </Pill>);
}
export function StatusPill({ on: 詼壍, children: 坫壍, onClick: 癚壍, title: 镉壍 }: {
    on: boolean;
    children: React.ReactNode;
    onClick?: (戸壍: React.MouseEvent) => void;
    title?: string;
}) {
    const 脧壍 = 癚壍 ? "button" : "span";
    return (<脧壍 type={癚壍 ? "button" : undefined} onClick={癚壍} title={镉壍} className={cn("justify-self-start rounded-pill border px-2.5 py-1 text-[11px] whitespace-nowrap", 詼壍 ? "border-teal/30 text-accent" : "border-tone/12 text-muted-3", 癚壍 && "cursor-pointer hover:border-tone/30")}>
      {坫壍}
    </脧壍>);
}
interface MeterProps {
    value: number;
    projected?: number;
    marker?: number;
    tone?: "accent" | "warn";
    height?: number;
    className?: string;
    label?: string;
}
export function Meter({ value: 世壍, projected: 洅壍, marker: 说壍, tone: 壣壍 = "accent", height: 矒壍 = 10, className: 雁壍, label: 掰壍 }: MeterProps) {
    const 芟壍 = (侎壍: number) => `${Math.max(0, Math.min(1, 侎壍)) * 100}%`;
    return (<div role="meter" aria-label={掰壍} aria-valuenow={Math.round(世壍 * 100)} aria-valuemin={0} aria-valuemax={100} className={cn("relative rounded-pill bg-tone/6", 雁壍)} style={{ height: 矒壍 }}>
      {洅壍 !== undefined ? <div className="absolute inset-y-0 left-0 rounded-pill" style={{ width: 芟壍(洅壍), background: 壣壍 === "warn" ? "var(--warn-t)" : "rgba(4,191,157,0.25)" }}/> : null}
      <div className="absolute inset-y-0 left-0 rounded-pill" style={{ width: 芟壍(世壍), background: 壣壍 === "warn" ? "var(--warn)" : "var(--accent)" }}/>
      {说壍 !== undefined ? <div className="absolute w-0.5 bg-fg" style={{ left: 芟壍(说壍), top: -4, bottom: -4 }} title="Today"/> : null}
    </div>);
}
export function Kbd({ children: 湽壍 }: {
    children: React.ReactNode;
}) {
    return <kbd className="rounded-[5px] border border-line bg-fill px-1.5 py-px font-mono text-micro text-muted">{湽壍}</kbd>;
}
export function CharCounter({ length: 赬壍, max: 婛壍 }: {
    length: number;
    max: number;
}) {
    const 祊壍 = 赬壍 > 婛壍;
    const 頹壍 = !祊壍 && 赬壍 >= 婛壍 * 0.9;
    return <span className={cn("font-mono text-micro tabular", 祊壍 ? "text-crit" : 頹壍 ? "text-warn" : "text-faint")}>{`${赬壍}/${婛壍}`}</span>;
}
export function DeltaText({ pct: 攨壍, sentiment: 萗壍, className: 儆壍 }: {
    pct: string;
    sentiment: "good" | "bad" | null;
    className?: string;
}) {
    return (<span className={cn("font-mono text-meta whitespace-nowrap", 萗壍 === "good" ? "text-accent" : 萗壍 === "bad" ? "text-crit" : "text-muted", 儆壍)}>
      {萗壍 === "good" ? "▲ " : 萗壍 === "bad" ? "▼ " : ""}
      {攨壍}
    </span>);
}
