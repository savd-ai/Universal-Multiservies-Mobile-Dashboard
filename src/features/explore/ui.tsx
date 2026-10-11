"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/inputs";
import { Tooltip } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { currencySymbol } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
interface StepCardProps {
    num: number;
    title: string;
    summary: string;
    hint?: React.ReactNode;
    collapsed: boolean;
    onToggle: () => void;
    onRemove?: () => void;
    removeLabel?: string;
    aside?: React.ReactNode;
    children: React.ReactNode;
    tone?: "default" | "warn";
}
export function StepCard({ num: 鄤壍, title: 帓壍, summary: 紂壍, hint: 鯱壍, collapsed: 棠壍, onToggle: 蟏壍, onRemove: 咾壍, removeLabel: 玭壍, aside: 銜壍, children: 律壍, tone: 繺壍 = "default" }: StepCardProps) {
    const 鵩壍 = `step-${帓壍.toLowerCase().replace(/[^a-z]+/g, "-")}`;
    return (<section className={cn("rounded-card border bg-card shadow-card animate-fade-up", 繺壍 === "warn" ? "border-warn/40" : "border-line")} aria-label={帓壍}>
      <div className="flex items-center gap-3 px-[18px] py-3.5">
        <span className="font-mono text-meta text-accent tabular" aria-hidden>
          {String(鄤壍).padStart(2, "0")}
        </span>
        <button type="button" onClick={蟏壍} aria-expanded={!棠壍} aria-controls={鵩壍} className="flex min-w-0 flex-1 items-baseline gap-3 text-left">
          <span className="shrink-0 font-display text-base font-semibold tracking-title">{帓壍}</span>
          {棠壍 ? <span className="min-w-0 truncate text-xs text-muted-3">{紂壍}</span> : 鯱壍 ? <span className="min-w-0 truncate font-mono text-micro tracking-label text-faint uppercase">{鯱壍}</span> : null}
        </button>
        {銜壍}
        <IconButton label={棠壍 ? `Expand ${帓壍}` : `Collapse ${帓壍}`} onClick={蟏壍}>
          <span aria-hidden className={cn("inline-block transition-transform", !棠壍 && "rotate-180")}>
            ▾
          </span>
        </IconButton>
        {咾壍 ? (<IconButton label={玭壍 ?? `Remove ${帓壍}`} onClick={咾壍}>
            ×
          </IconButton>) : null}
      </div>
      {!棠壍 ? (<div id={鵩壍} className="flex flex-col gap-4 border-t border-line-soft px-[18px] pt-4 pb-[18px]">
          {律壍}
        </div>) : null}
    </section>);
}
type DraftInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: string;
    onCommit: (橘壍: string) => void;
    delay?: number;
    variant?: "pill" | "field";
};
export const DraftInput = forwardRef<HTMLInputElement, DraftInputProps>(function DraftInput({ value: 襇壍, onCommit: 嘶壍, delay: 甥壍 = 500, variant: 鐔壍 = "field", onBlur: 愃壍, onFocus: 翲壍, onKeyDown: 黡壍, ...毐壍 }, 調壍) {
    const [垮壍, 皝壍] = useState<string | null>(null);
    const 閌壍 = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (閌壍.current)
            clearTimeout(閌壍.current);
    }, []);
    const 扻壍 = (腪壍: string) => {
        if (閌壍.current)
            clearTimeout(閌壍.current);
        閌壍.current = null;
        if (腪壍 !== 襇壍)
            嘶壍(腪壍);
    };
    return (<Input ref={調壍} variant={鐔壍} value={垮壍 ?? 襇壍} onFocus={(乙壍) => {
            皝壍(襇壍);
            翲壍?.(乙壍);
        }} onChange={(浈壍) => {
            const 谷壍 = 浈壍.target.value;
            皝壍(谷壍);
            if (閌壍.current)
                clearTimeout(閌壍.current);
            閌壍.current = setTimeout(() => {
                閌壍.current = null;
                嘶壍(谷壍);
            }, 甥壍);
        }} onBlur={(夦壍) => {
            if (垮壍 !== null)
                扻壍(垮壍);
            皝壍(null);
            愃壍?.(夦壍);
        }} onKeyDown={(砕壍) => {
            if (砕壍.key === "Enter" && 垮壍 !== null)
                扻壍(垮壍);
            黡壍?.(砕壍);
        }} {...毐壍}/>);
});
export function formatGlyph(霄壍: string, 揳壍 = "USD"): string {
    switch (霄壍 as MetricFormat) {
        case "money":
            return currencySymbol(揳壍).trim();
        case "percent":
            return "%";
        case "ratio":
            return "x";
        case "decimal":
            return "0.0";
        default:
            return "#";
    }
}
interface OptionChipProps {
    label: React.ReactNode;
    active?: boolean;
    disabledReason?: string;
    hint?: React.ReactNode;
    title?: string;
    onClick: () => void;
    className?: string;
}
export function OptionChip({ label: 苢壍, active: 俑壍, disabledReason: 滀壍, hint: 趯壍, title: 媞壍, onClick: 禍壍, className: 顼壍 }: OptionChipProps) {
    const 敫壍 = !!滀壍 && !俑壍;
    const 葚壍 = (<button type="button" aria-pressed={!!俑壍} aria-disabled={敫壍 || undefined} onClick={() => (敫壍 ? toast(滀壍, { tone: "warn", ms: 3600 }) : 禍壍())} className={cn("inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs whitespace-nowrap transition-colors", 俑壍 ? "border-accent bg-teal-t text-fg" : 敫壍 ? "cursor-not-allowed border-line-soft text-faint" : "border-line text-muted hover:border-tone/25 hover:text-fg", 顼壍)}>
      <span className={cn(敫壍 && "line-through decoration-tone/30")}>{苢壍}</span>
      {趯壍 ? <span className={cn("font-mono text-micro", 俑壍 ? "text-accent" : "text-faint")}>{趯壍}</span> : null}
      {俑壍 ? (<span aria-hidden className="text-[11px] leading-none text-accent">
          ✓
        </span>) : null}
    </button>);
    const 光壍 = 滀壍 && !俑壍 ? 滀壍 : 媞壍;
    return 光壍 ? <Tooltip content={光壍}>{葚壍}</Tooltip> : 葚壍;
}
export function SelectedPill({ label: 瀸壍, hint: 輧壍, onRemove: 尖壍, onMoveLeft: 笅壍, warn: 駴壍, warnText: 曣壍 }: {
    label: React.ReactNode;
    hint?: React.ReactNode;
    onRemove: () => void;
    onMoveLeft?: () => void;
    warn?: boolean;
    warnText?: string;
}) {
    const 藒壍 = (<span className={cn("inline-flex items-center gap-1.5 rounded-pill border py-1 pr-1 pl-3 text-xs", 駴壍 ? "border-warn/50 bg-warn-t text-fg" : "border-teal/30 bg-teal/6 text-fg")}>
      {駴壍 ? (<span aria-hidden className="text-[10px] text-warn">
          ▲
        </span>) : null}
      <span className="font-medium">{瀸壍}</span>
      {輧壍 ? <span className="font-mono text-micro text-muted-3">{輧壍}</span> : null}
      {笅壍 ? (<button type="button" onClick={笅壍} aria-label={`Move ${typeof 瀸壍 === "string" ? 瀸壍 : "item"} earlier`} className="grid size-5 place-items-center rounded-full text-[11px] text-muted-3 hover:bg-tone/8 hover:text-fg">
          ←
        </button>) : null}
      <button type="button" onClick={尖壍} aria-label={`Remove ${typeof 瀸壍 === "string" ? 瀸壍 : "item"}`} className="grid size-5 place-items-center rounded-full text-[13px] text-muted-3 hover:bg-tone/8 hover:text-fg">
        ×
      </button>
    </span>);
    return 曣壍 ? <Tooltip content={曣壍}>{藒壍}</Tooltip> : 藒壍;
}
export function GroupLabel({ children: 勁壍, aside: 熰壍 }: {
    children: React.ReactNode;
    aside?: React.ReactNode;
}) {
    return (<div className="flex items-center gap-3">
      <span className="label-mono">{勁壍}</span>
      <span className="h-px flex-1 bg-line-soft" aria-hidden/>
      {熰壍}
    </div>);
}
export function AddRow({ children: 邟壍, onClick: 嶎壍, disabled: 籽壍 }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (<button type="button" onClick={嶎壍} disabled={籽壍} className="self-start rounded-pill border border-dashed border-teal/30 px-3.5 py-1.5 text-xs text-accent transition-colors hover:border-teal/60 disabled:cursor-not-allowed disabled:opacity-40">
      + {邟壍}
    </button>);
}
