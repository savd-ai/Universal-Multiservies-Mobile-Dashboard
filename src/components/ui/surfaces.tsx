import { cn } from "./cn";
type DivProps = React.HTMLAttributes<HTMLDivElement>;
export function Card({ className, accent, flat, ...rest }: DivProps & {
    accent?: boolean;
    flat?: boolean;
}) {
    return (<div className={cn("rounded-card border p-[22px]", accent ? "border-teal/30 bg-card-accent" : "border-line bg-card", !flat && "shadow-card", className)} {...rest}/>);
}
export function MiniCard({ className, ...rest }: DivProps) {
    return <div className={cn("rounded-mini border border-tone/8 bg-fill p-3.5", className)} {...rest}/>;
}
export function DashedCard({ className, interactive, ...rest }: DivProps & {
    interactive?: boolean;
}) {
    return (<div className={cn("rounded-mini border border-dashed border-tone/14 p-3 text-center text-xs text-muted-3", interactive && "cursor-pointer transition-colors hover:border-teal/40 hover:text-accent", className)} {...rest}/>);
}
export function CardHeader({ title, sub, action, className }: {
    title: React.ReactNode;
    sub?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("flex items-center gap-3", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="font-display text-base font-semibold tracking-title">{title}</div>
        {sub ? <div className="meta">{sub}</div> : null}
      </div>
      {action}
    </div>);
}
export function TileGrid({ className, min = 150, ...rest }: DivProps & {
    min?: number;
}) {
    return <div className={cn("grid gap-px overflow-hidden rounded-mini bg-tone/8", className)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }} {...rest}/>;
}
export function StatTile({ label, value, children, className }: {
    label: React.ReactNode;
    value: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("flex min-w-0 flex-col gap-2.5 bg-surface px-[18px] py-4", className)}>
      <div className="label-mono">{label}</div>
      <div className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">{value}</div>
      {children}
    </div>);
}
export function StatCard({ label, value, caption, tone, className }: {
    label: React.ReactNode;
    value: React.ReactNode;
    caption?: React.ReactNode;
    tone?: "default" | "accent" | "warn" | "crit";
    className?: string;
}) {
    return (<div className={cn("flex flex-col gap-2.5 rounded-card border border-line bg-card p-5", className)}>
      <span className="label-mono">{label}</span>
      <span className={cn("font-display text-[32px] leading-none font-semibold tracking-[-0.02em]", tone === "accent" && "text-accent", tone === "warn" && "text-warn", tone === "crit" && "text-crit")}>{value}</span>
      {caption ? <span className="text-xs text-muted-3">{caption}</span> : null}
    </div>);
}
export function MetaStat({ label, value, tone, className }: {
    label: React.ReactNode;
    value: React.ReactNode;
    tone?: "accent" | "warn" | "crit";
    className?: string;
}) {
    return (<div className={cn("flex flex-col gap-1", className)}>
      <span className="font-mono text-micro tracking-label text-faint uppercase">{label}</span>
      <span className={cn("font-display text-[17px] font-semibold", tone === "accent" && "text-accent", tone === "warn" && "text-warn", tone === "crit" && "text-crit")}>{value}</span>
    </div>);
}
export function CodeBlock({ className, children }: {
    className?: string;
    children: React.ReactNode;
}) {
    return <pre className={cn("m-0 overflow-auto rounded-mini border border-line bg-deep p-5 font-mono text-xs leading-[1.7] whitespace-pre text-muted", className)}>{children}</pre>;
}
