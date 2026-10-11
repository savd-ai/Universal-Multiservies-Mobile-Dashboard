import { cn } from "./cn";
type DivProps = React.HTMLAttributes<HTMLDivElement>;
export function Card({ className: 濵壍, accent: 軤壍, flat: 寓壍, ...竂壍 }: DivProps & {
    accent?: boolean;
    flat?: boolean;
}) {
    return (<div className={cn("rounded-card border p-[22px]", 軤壍 ? "border-teal/30 bg-card-accent" : "border-line bg-card", !寓壍 && "shadow-card", 濵壍)} {...竂壍}/>);
}
export function MiniCard({ className: 馱壍, ...暠壍 }: DivProps) {
    return <div className={cn("rounded-mini border border-tone/8 bg-fill p-3.5", 馱壍)} {...暠壍}/>;
}
export function DashedCard({ className: 薏壍, interactive: 剾壍, ...煭壍 }: DivProps & {
    interactive?: boolean;
}) {
    return (<div className={cn("rounded-mini border border-dashed border-tone/14 p-3 text-center text-xs text-muted-3", 剾壍 && "cursor-pointer transition-colors hover:border-teal/40 hover:text-accent", 薏壍)} {...煭壍}/>);
}
export function CardHeader({ title: 遜壍, sub: 嵋壍, action: 簺壍, className: 鬩壍 }: {
    title: React.ReactNode;
    sub?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("flex items-center gap-3", 鬩壍)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="font-display text-base font-semibold tracking-title">{遜壍}</div>
        {嵋壍 ? <div className="meta">{嵋壍}</div> : null}
      </div>
      {簺壍}
    </div>);
}
export function TileGrid({ className: 栘壍, min: 蜇壍 = 150, ...叶壍 }: DivProps & {
    min?: number;
}) {
    return <div className={cn("grid gap-px overflow-hidden rounded-mini bg-tone/8", 栘壍)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${蜇壍}px, 1fr))` }} {...叶壍}/>;
}
export function StatTile({ label: 狥壍, value: 釔壍, children: 廃壍, className: 網壍 }: {
    label: React.ReactNode;
    value: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("flex min-w-0 flex-col gap-2.5 bg-surface px-[18px] py-4", 網壍)}>
      <div className="label-mono">{狥壍}</div>
      <div className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">{釔壍}</div>
      {廃壍}
    </div>);
}
export function StatCard({ label: 鲡壍, value: 榐壍, caption: 衿壍, tone: 啮壍, className: 瑝壍 }: {
    label: React.ReactNode;
    value: React.ReactNode;
    caption?: React.ReactNode;
    tone?: "default" | "accent" | "warn" | "crit";
    className?: string;
}) {
    return (<div className={cn("flex flex-col gap-2.5 rounded-card border border-line bg-card p-5", 瑝壍)}>
      <span className="label-mono">{鲡壍}</span>
      <span className={cn("font-display text-[32px] leading-none font-semibold tracking-[-0.02em]", 啮壍 === "accent" && "text-accent", 啮壍 === "warn" && "text-warn", 啮壍 === "crit" && "text-crit")}>{榐壍}</span>
      {衿壍 ? <span className="text-xs text-muted-3">{衿壍}</span> : null}
    </div>);
}
export function MetaStat({ label: 鍌壍, value: 总壍, tone: 缪壍, className: 鸙壍 }: {
    label: React.ReactNode;
    value: React.ReactNode;
    tone?: "accent" | "warn" | "crit";
    className?: string;
}) {
    return (<div className={cn("flex flex-col gap-1", 鸙壍)}>
      <span className="font-mono text-micro tracking-label text-faint uppercase">{鍌壍}</span>
      <span className={cn("font-display text-[17px] font-semibold", 缪壍 === "accent" && "text-accent", 缪壍 === "warn" && "text-warn", 缪壍 === "crit" && "text-crit")}>{总壍}</span>
    </div>);
}
export function CodeBlock({ className: 欈壍, children: 觷壍 }: {
    className?: string;
    children: React.ReactNode;
}) {
    return <pre className={cn("m-0 overflow-auto rounded-mini border border-line bg-deep p-5 font-mono text-xs leading-[1.7] whitespace-pre text-muted", 欈壍)}>{觷壍}</pre>;
}
