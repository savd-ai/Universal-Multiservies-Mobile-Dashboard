import { Fragment } from "react";
import { cn } from "@/components/ui/cn";
export function Logo({ size = 22, className }: {
    size?: number;
    className?: string;
}) {
    return (<span className={cn("font-display leading-none font-semibold tracking-[0.02em]", className)} style={{ fontSize: size, color: "var(--logo-ink)" }} aria-label="SAVD">
      SAV<span style={{ color: "var(--logo-d)" }}>D</span>
    </span>);
}
export function Eyebrow({ children, line = true, stacked, className }: {
    children: React.ReactNode;
    line?: boolean;
    stacked?: boolean;
    className?: string;
}) {
    if (stacked) {
        return (<div className={className}>
        <div className="eyebrow">{children}</div>
        {line ? <div className="mt-3.5 h-[3px] w-[54px] rounded-[2px] bg-accent"/> : null}
      </div>);
    }
    return (<div className={cn("flex items-center gap-3", className)}>
      <span className="eyebrow">{children}</span>
      {line ? <span className="h-[3px] w-[54px] rounded-[2px] bg-accent" aria-hidden/> : null}
    </div>);
}
export function Headline({ text, as: Tag = "h1", className, size = 40 }: {
    text: string;
    as?: "h1" | "h2";
    className?: string;
    size?: number;
}) {
    const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
    const accents = parts.filter((p) => p.startsWith("*") && p.endsWith("*")).length;
    if (process.env.NODE_ENV !== "production" && accents !== 1 && typeof window !== "undefined") {
        console.warn(`[Headline] expected exactly one *accent* word: "${text}"`);
    }
    return (<Tag className={cn("m-0 font-display leading-[1.02] font-semibold tracking-[-0.03em]", className)} style={{ fontSize: size >= 32 ? `clamp(${Math.round(size * 0.75)}px, 7.5vw, ${size}px)` : size }}>
      {parts.map((p, i) => p.startsWith("*") && p.endsWith("*") ? (<em key={i} className="font-serif font-normal text-accent">
            {p.slice(1, -1)}
          </em>) : (<Fragment key={i}>{p}</Fragment>))}
    </Tag>);
}
export function MetaLine({ left, right, index, total, className }: {
    left?: React.ReactNode;
    right?: React.ReactNode;
    index?: number;
    total?: number;
    className?: string;
}) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (<div className={cn("flex flex-wrap items-center gap-4 border-t border-line pt-[18px] font-mono text-meta tracking-meta text-faint uppercase", className)}>
      <span>{left}</span>
      <span className="flex-1"/>
      {right ? <span>{right}</span> : null}
      {index !== undefined ? (<>
          <span aria-hidden>·</span>
          <span>
            <span className="text-muted">{pad(index)}</span>
            {total !== undefined ? ` / ${pad(total)}` : null}
          </span>
        </>) : null}
    </div>);
}
export function StatBlock({ value, caption, size = 52, tone = "accent", className }: {
    value: React.ReactNode;
    caption?: React.ReactNode;
    size?: number;
    tone?: "accent" | "warn" | "fg";
    className?: string;
}) {
    return (<div className={cn("flex items-baseline gap-2.5", className)}>
      <span className="font-display leading-none font-semibold tracking-[-0.03em]" style={{ fontSize: size, color: tone === "warn" ? "var(--warn)" : tone === "fg" ? "var(--text)" : "var(--accent)" }}>
        {value}
      </span>
      {caption ? <span className="text-[13px] text-muted-3">{caption}</span> : null}
    </div>);
}
export function PullQuote({ children, attribution, size = 17, className }: {
    children: React.ReactNode;
    attribution?: React.ReactNode;
    size?: number;
    className?: string;
}) {
    return (<div className={cn("rounded-mini border border-teal/30 bg-teal/6 px-4 py-3.5", className)}>
      <div className="font-serif leading-[1.45] text-fg italic" style={{ fontSize: size }}>
        {children}
      </div>
      {attribution ? <div className="mt-3 font-mono text-micro tracking-eyebrow text-muted-3 uppercase">{attribution}</div> : null}
    </div>);
}
export function GradientCard({ num, title, children, accent, meta, className }: {
    num?: string;
    title?: React.ReactNode;
    children?: React.ReactNode;
    accent?: boolean;
    meta?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("rounded-card border px-7 py-[30px] shadow-card", accent ? "border-teal/30 bg-card-accent" : "border-line bg-card", className)}>
      {num || meta ? (<div className="mb-4 flex items-baseline justify-between">
          {num ? <span className="font-mono text-eyebrow text-accent">{num}</span> : <span />}
          {meta ? <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">{meta}</span> : null}
        </div>) : null}
      {title ? <h3 className="m-0 mb-2.5 font-display text-[21px] leading-[1.15] font-semibold">{title}</h3> : null}
      {children ? <div className="text-[15px] leading-relaxed text-muted">{children}</div> : null}
    </div>);
}
export interface DiagramNode {
    num?: string;
    title: React.ReactNode;
    caption?: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
}
export function SystemDiagram({ nodes, result, className }: {
    nodes: DiagramNode[];
    result?: DiagramNode;
    className?: string;
}) {
    const cell = (n: DiagramNode, i: number, isResult = false) => {
        const Cmp = n.onClick ? "button" : "div";
        return (<Cmp type={n.onClick ? "button" : undefined} onClick={n.onClick} className={cn("min-w-0 flex-1 rounded-mini border px-[18px] pt-[18px] pb-4 text-left transition-colors", isResult ? "border-teal/30 bg-teal/7" : n.active ? "border-accent/60 bg-teal-t" : "border-line bg-fill", n.onClick && "cursor-pointer hover:border-tone/30")}>
        <div className="font-mono text-meta text-accent">{n.num ?? (isResult ? "OUT" : String(i + 1).padStart(2, "0"))}</div>
        <div className="mt-2.5 font-display text-base leading-[1.2] font-semibold text-fg">{n.title}</div>
        {n.caption ? <div className="mt-1.5 text-[12.5px] leading-normal text-muted-3">{n.caption}</div> : null}
      </Cmp>);
    };
    return (<div className={cn("flex flex-col items-stretch gap-2 lg:flex-row lg:gap-0", className)}>
      {nodes.map((n, i) => (<Fragment key={i}>
          {cell(n, i)}
          {i < nodes.length - 1 || result ? (<div aria-hidden className="hidden flex-[0_0_34px] items-center lg:flex">
              <div className="h-px flex-1 bg-line"/>
              <span className="-ml-0.5 text-[15px] leading-none text-accent">→</span>
            </div>) : null}
        </Fragment>))}
      {result ? cell(result, nodes.length, true) : null}
    </div>);
}
