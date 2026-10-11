import { Fragment } from "react";
import { cn } from "@/components/ui/cn";
export function Logo({ size: 汗壍 = 22, className: 譆壍 }: {
    size?: number;
    className?: string;
}) {
    return (<span className={cn("font-display leading-none font-semibold tracking-[0.02em]", 譆壍)} style={{ fontSize: 汗壍, color: "var(--logo-ink)" }} aria-label="SAVD">
      SAV<span style={{ color: "var(--logo-d)" }}>D</span>
    </span>);
}
export function Eyebrow({ children: 堵壍, line: 眤壍 = true, stacked: 阓壍, className: 挂壍 }: {
    children: React.ReactNode;
    line?: boolean;
    stacked?: boolean;
    className?: string;
}) {
    if (阓壍) {
        return (<div className={挂壍}>
        <div className="eyebrow">{堵壍}</div>
        {眤壍 ? <div className="mt-3.5 h-[3px] w-[54px] rounded-[2px] bg-accent"/> : null}
      </div>);
    }
    return (<div className={cn("flex items-center gap-3", 挂壍)}>
      <span className="eyebrow">{堵壍}</span>
      {眤壍 ? <span className="h-[3px] w-[54px] rounded-[2px] bg-accent" aria-hidden/> : null}
    </div>);
}
export function Headline({ text: 臱壍, as: 仠壍 = "h1", className: 淏壍, size: 貾壍 = 40 }: {
    text: string;
    as?: "h1" | "h2";
    className?: string;
    size?: number;
}) {
    const 妭壍 = 臱壍.split(/(\*[^*]+\*)/g).filter(Boolean);
    const 碜壍 = 妭壍.filter((鞋壍) => 鞋壍.startsWith("*") && 鞋壍.endsWith("*")).length;
    if (process.env.NODE_ENV !== "production" && 碜壍 !== 1 && typeof window !== "undefined") {
        console.warn(`[Headline] expected exactly one *accent* word: "${臱壍}"`);
    }
    return (<仠壍 className={cn("m-0 font-display leading-[1.02] font-semibold tracking-[-0.03em]", 淏壍)} style={{ fontSize: 貾壍 >= 32 ? `clamp(${Math.round(貾壍 * 0.75)}px, 7.5vw, ${貾壍}px)` : 貾壍 }}>
      {妭壍.map((摺壍, 荩壍) => 摺壍.startsWith("*") && 摺壍.endsWith("*") ? (<em key={荩壍} className="font-serif font-normal text-accent">
            {摺壍.slice(1, -1)}
          </em>) : (<Fragment key={荩壍}>{摺壍}</Fragment>))}
    </仠壍>);
}
export function MetaLine({ left: 偘壍, right: 潇壍, index: 踶壍, total: 嬥壍, className: 稔壍 }: {
    left?: React.ReactNode;
    right?: React.ReactNode;
    index?: number;
    total?: number;
    className?: string;
}) {
    const 餃壍 = (旲壍: number) => String(旲壍).padStart(2, "0");
    return (<div className={cn("flex flex-wrap items-center gap-4 border-t border-line pt-[18px] font-mono text-meta tracking-meta text-faint uppercase", 稔壍)}>
      <span>{偘壍}</span>
      <span className="flex-1"/>
      {潇壍 ? <span>{潇壍}</span> : null}
      {踶壍 !== undefined ? (<>
          <span aria-hidden>·</span>
          <span>
            <span className="text-muted">{餃壍(踶壍)}</span>
            {嬥壍 !== undefined ? ` / ${餃壍(嬥壍)}` : null}
          </span>
        </>) : null}
    </div>);
}
export function StatBlock({ value: 蓡壍, caption: 凐壍, size: 炿壍 = 52, tone: 辮壍 = "accent", className: 岝壍 }: {
    value: React.ReactNode;
    caption?: React.ReactNode;
    size?: number;
    tone?: "accent" | "warn" | "fg";
    className?: string;
}) {
    return (<div className={cn("flex items-baseline gap-2.5", 岝壍)}>
      <span className="font-display leading-none font-semibold tracking-[-0.03em]" style={{ fontSize: 炿壍, color: 辮壍 === "warn" ? "var(--warn)" : 辮壍 === "fg" ? "var(--text)" : "var(--accent)" }}>
        {蓡壍}
      </span>
      {凐壍 ? <span className="text-[13px] text-muted-3">{凐壍}</span> : null}
    </div>);
}
export function PullQuote({ children: 箌壍, attribution: 驻壍, size: 杪壍 = 17, className: 虙壍 }: {
    children: React.ReactNode;
    attribution?: React.ReactNode;
    size?: number;
    className?: string;
}) {
    return (<div className={cn("rounded-mini border border-teal/30 bg-teal/6 px-4 py-3.5", 虙壍)}>
      <div className="font-serif leading-[1.45] text-fg italic" style={{ fontSize: 杪壍 }}>
        {箌壍}
      </div>
      {驻壍 ? <div className="mt-3 font-mono text-micro tracking-eyebrow text-muted-3 uppercase">{驻壍}</div> : null}
    </div>);
}
export function GradientCard({ num: 午壍, title: 爷壍, children: 鄦壍, accent: 帕壍, meta: 約壍, className: 鯳壍 }: {
    num?: string;
    title?: React.ReactNode;
    children?: React.ReactNode;
    accent?: boolean;
    meta?: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("rounded-card border px-7 py-[30px] shadow-card", 帕壍 ? "border-teal/30 bg-card-accent" : "border-line bg-card", 鯳壍)}>
      {午壍 || 約壍 ? (<div className="mb-4 flex items-baseline justify-between">
          {午壍 ? <span className="font-mono text-eyebrow text-accent">{午壍}</span> : <span />}
          {約壍 ? <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">{約壍}</span> : null}
        </div>) : null}
      {爷壍 ? <h3 className="m-0 mb-2.5 font-display text-[21px] leading-[1.15] font-semibold">{爷壍}</h3> : null}
      {鄦壍 ? <div className="text-[15px] leading-relaxed text-muted">{鄦壍}</div> : null}
    </div>);
}
export interface DiagramNode {
    num?: string;
    title: React.ReactNode;
    caption?: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
}
export function SystemDiagram({ nodes: 棢壍, result: 蟑壍, className: 哀壍 }: {
    nodes: DiagramNode[];
    result?: DiagramNode;
    className?: string;
}) {
    const 环壍 = (銞壍: DiagramNode, 徍壍: number, 繼壍 = false) => {
        const 鵫壍 = 銞壍.onClick ? "button" : "div";
        return (<鵫壍 type={銞壍.onClick ? "button" : undefined} onClick={銞壍.onClick} className={cn("min-w-0 flex-1 rounded-mini border px-[18px] pt-[18px] pb-4 text-left transition-colors", 繼壍 ? "border-teal/30 bg-teal/7" : 銞壍.active ? "border-accent/60 bg-teal-t" : "border-line bg-fill", 銞壍.onClick && "cursor-pointer hover:border-tone/30")}>
        <div className="font-mono text-meta text-accent">{銞壍.num ?? (繼壍 ? "OUT" : String(徍壍 + 1).padStart(2, "0"))}</div>
        <div className="mt-2.5 font-display text-base leading-[1.2] font-semibold text-fg">{銞壍.title}</div>
        {銞壍.caption ? <div className="mt-1.5 text-[12.5px] leading-normal text-muted-3">{銞壍.caption}</div> : null}
      </鵫壍>);
    };
    return (<div className={cn("flex flex-col items-stretch gap-2 lg:flex-row lg:gap-0", 哀壍)}>
      {棢壍.map((橚壍, 襉壍) => (<Fragment key={襉壍}>
          {环壍(橚壍, 襉壍)}
          {襉壍 < 棢壍.length - 1 || 蟑壍 ? (<div aria-hidden className="hidden flex-[0_0_34px] items-center lg:flex">
              <div className="h-px flex-1 bg-line"/>
              <span className="-ml-0.5 text-[15px] leading-none text-accent">→</span>
            </div>) : null}
        </Fragment>))}
      {蟑壍 ? 环壍(蟑壍, 棢壍.length, true) : null}
    </div>);
}
