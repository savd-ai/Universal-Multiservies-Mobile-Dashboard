import { cn } from "./cn";
export type Tone = "accent" | "warn" | "crit" | "muted" | "faint";
const TONE_COLOR: Record<Tone, string> = {
    accent: "var(--accent)",
    warn: "var(--warn)",
    crit: "var(--crit)",
    muted: "var(--muted)",
    faint: "var(--faint)",
};
const TONE_TINT: Record<Tone, string> = {
    accent: "var(--teal-t)",
    warn: "var(--warn-t)",
    crit: "var(--crit-t)",
    muted: "rgba(var(--fg-rgb),0.06)",
    faint: "rgba(var(--fg-rgb),0.05)",
};
export function Dot({ tone = "accent", halo, size = 8, className }: {
    tone?: Tone;
    halo?: boolean;
    size?: number;
    className?: string;
}) {
    return (<span aria-hidden className={cn("inline-block shrink-0 rounded-full", className)} style={{ width: size, height: size, background: TONE_COLOR[tone], boxShadow: halo ? `0 0 0 4px ${TONE_TINT[tone]}` : undefined }}/>);
}
export function Pill({ tone = "accent", solid, children, className }: {
    tone?: Tone;
    solid?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (<span className={cn("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] font-mono text-micro tracking-meta whitespace-nowrap uppercase", className)} style={solid ? { background: TONE_COLOR[tone], color: "var(--on-accent)" } : { background: TONE_TINT[tone], color: TONE_COLOR[tone] }}>
      {children}
    </span>);
}
export const SEVERITY_META = {
    critical: { tone: "crit" as Tone, label: "Critical", glyph: "▲" },
    warning: { tone: "warn" as Tone, label: "Warning", glyph: "▲" },
    info: { tone: "accent" as Tone, label: "Opportunity", glyph: "●" },
};
export function SeverityPill({ severity, className }: {
    severity: "critical" | "warning" | "info";
    className?: string;
}) {
    const m = SEVERITY_META[severity];
    return (<Pill tone={m.tone} className={className}>
      {m.label}
    </Pill>);
}
export function StatusPill({ on, children, onClick, title }: {
    on: boolean;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    title?: string;
}) {
    const Cmp = onClick ? "button" : "span";
    return (<Cmp type={onClick ? "button" : undefined} onClick={onClick} title={title} className={cn("justify-self-start rounded-pill border px-2.5 py-1 text-[11px] whitespace-nowrap", on ? "border-teal/30 text-accent" : "border-tone/12 text-muted-3", onClick && "cursor-pointer hover:border-tone/30")}>
      {children}
    </Cmp>);
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
export function Meter({ value, projected, marker, tone = "accent", height = 10, className, label }: MeterProps) {
    const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
    return (<div role="meter" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} className={cn("relative rounded-pill bg-tone/6", className)} style={{ height }}>
      {projected !== undefined ? <div className="absolute inset-y-0 left-0 rounded-pill" style={{ width: pct(projected), background: tone === "warn" ? "var(--warn-t)" : "rgba(4,191,157,0.25)" }}/> : null}
      <div className="absolute inset-y-0 left-0 rounded-pill" style={{ width: pct(value), background: tone === "warn" ? "var(--warn)" : "var(--accent)" }}/>
      {marker !== undefined ? <div className="absolute w-0.5 bg-fg" style={{ left: pct(marker), top: -4, bottom: -4 }} title="Today"/> : null}
    </div>);
}
export function Kbd({ children }: {
    children: React.ReactNode;
}) {
    return <kbd className="rounded-[5px] border border-line bg-fill px-1.5 py-px font-mono text-micro text-muted">{children}</kbd>;
}
export function CharCounter({ length, max }: {
    length: number;
    max: number;
}) {
    const over = length > max;
    const near = !over && length >= max * 0.9;
    return <span className={cn("font-mono text-micro tabular", over ? "text-crit" : near ? "text-warn" : "text-faint")}>{`${length}/${max}`}</span>;
}
export function DeltaText({ pct, sentiment, className }: {
    pct: string;
    sentiment: "good" | "bad" | null;
    className?: string;
}) {
    return (<span className={cn("font-mono text-meta whitespace-nowrap", sentiment === "good" ? "text-accent" : sentiment === "bad" ? "text-crit" : "text-muted", className)}>
      {sentiment === "good" ? "▲ " : sentiment === "bad" ? "▼ " : ""}
      {pct}
    </span>);
}
