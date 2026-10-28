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
export function StepCard({ num, title, summary, hint, collapsed, onToggle, onRemove, removeLabel, aside, children, tone = "default" }: StepCardProps) {
    const bodyId = `step-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
    return (<section className={cn("rounded-card border bg-card shadow-card animate-fade-up", tone === "warn" ? "border-warn/40" : "border-line")} aria-label={title}>
      <div className="flex items-center gap-3 px-[18px] py-3.5">
        <span className="font-mono text-meta text-accent tabular" aria-hidden>
          {String(num).padStart(2, "0")}
        </span>
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-controls={bodyId} className="flex min-w-0 flex-1 items-baseline gap-3 text-left">
          <span className="shrink-0 font-display text-base font-semibold tracking-title">{title}</span>
          {collapsed ? <span className="min-w-0 truncate text-xs text-muted-3">{summary}</span> : hint ? <span className="min-w-0 truncate font-mono text-micro tracking-label text-faint uppercase">{hint}</span> : null}
        </button>
        {aside}
        <IconButton label={collapsed ? `Expand ${title}` : `Collapse ${title}`} onClick={onToggle}>
          <span aria-hidden className={cn("inline-block transition-transform", !collapsed && "rotate-180")}>
            ▾
          </span>
        </IconButton>
        {onRemove ? (<IconButton label={removeLabel ?? `Remove ${title}`} onClick={onRemove}>
            ×
          </IconButton>) : null}
      </div>
      {!collapsed ? (<div id={bodyId} className="flex flex-col gap-4 border-t border-line-soft px-[18px] pt-4 pb-[18px]">
          {children}
        </div>) : null}
    </section>);
}
type DraftInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: string;
    onCommit: (value: string) => void;
    delay?: number;
    variant?: "pill" | "field";
};
export const DraftInput = forwardRef<HTMLInputElement, DraftInputProps>(function DraftInput({ value, onCommit, delay = 500, variant = "field", onBlur, onFocus, onKeyDown, ...rest }, ref) {
    const [draft, setDraft] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (timer.current)
            clearTimeout(timer.current);
    }, []);
    const commit = (v: string) => {
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = null;
        if (v !== value)
            onCommit(v);
    };
    return (<Input ref={ref} variant={variant} value={draft ?? value} onFocus={(e) => {
            setDraft(value);
            onFocus?.(e);
        }} onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (timer.current)
                clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                timer.current = null;
                onCommit(v);
            }, delay);
        }} onBlur={(e) => {
            if (draft !== null)
                commit(draft);
            setDraft(null);
            onBlur?.(e);
        }} onKeyDown={(e) => {
            if (e.key === "Enter" && draft !== null)
                commit(draft);
            onKeyDown?.(e);
        }} {...rest}/>);
});
export function formatGlyph(format: string, currency = "USD"): string {
    switch (format as MetricFormat) {
        case "money":
            return currencySymbol(currency).trim();
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
export function OptionChip({ label, active, disabledReason, hint, title, onClick, className }: OptionChipProps) {
    const disabled = !!disabledReason && !active;
    const chip = (<button type="button" aria-pressed={!!active} aria-disabled={disabled || undefined} onClick={() => (disabled ? toast(disabledReason, { tone: "warn", ms: 3600 }) : onClick())} className={cn("inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs whitespace-nowrap transition-colors", active ? "border-accent bg-teal-t text-fg" : disabled ? "cursor-not-allowed border-line-soft text-faint" : "border-line text-muted hover:border-tone/25 hover:text-fg", className)}>
      <span className={cn(disabled && "line-through decoration-tone/30")}>{label}</span>
      {hint ? <span className={cn("font-mono text-micro", active ? "text-accent" : "text-faint")}>{hint}</span> : null}
      {active ? (<span aria-hidden className="text-[11px] leading-none text-accent">
          ✓
        </span>) : null}
    </button>);
    const tip = disabledReason && !active ? disabledReason : title;
    return tip ? <Tooltip content={tip}>{chip}</Tooltip> : chip;
}
export function SelectedPill({ label, hint, onRemove, onMoveLeft, warn, warnText }: {
    label: React.ReactNode;
    hint?: React.ReactNode;
    onRemove: () => void;
    onMoveLeft?: () => void;
    warn?: boolean;
    warnText?: string;
}) {
    const body = (<span className={cn("inline-flex items-center gap-1.5 rounded-pill border py-1 pr-1 pl-3 text-xs", warn ? "border-warn/50 bg-warn-t text-fg" : "border-teal/30 bg-teal/6 text-fg")}>
      {warn ? (<span aria-hidden className="text-[10px] text-warn">
          ▲
        </span>) : null}
      <span className="font-medium">{label}</span>
      {hint ? <span className="font-mono text-micro text-muted-3">{hint}</span> : null}
      {onMoveLeft ? (<button type="button" onClick={onMoveLeft} aria-label={`Move ${typeof label === "string" ? label : "item"} earlier`} className="grid size-5 place-items-center rounded-full text-[11px] text-muted-3 hover:bg-tone/8 hover:text-fg">
          ←
        </button>) : null}
      <button type="button" onClick={onRemove} aria-label={`Remove ${typeof label === "string" ? label : "item"}`} className="grid size-5 place-items-center rounded-full text-[13px] text-muted-3 hover:bg-tone/8 hover:text-fg">
        ×
      </button>
    </span>);
    return warnText ? <Tooltip content={warnText}>{body}</Tooltip> : body;
}
export function GroupLabel({ children, aside }: {
    children: React.ReactNode;
    aside?: React.ReactNode;
}) {
    return (<div className="flex items-center gap-3">
      <span className="label-mono">{children}</span>
      <span className="h-px flex-1 bg-line-soft" aria-hidden/>
      {aside}
    </div>);
}
export function AddRow({ children, onClick, disabled }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (<button type="button" onClick={onClick} disabled={disabled} className="self-start rounded-pill border border-dashed border-teal/30 px-3.5 py-1.5 text-xs text-accent transition-colors hover:border-teal/60 disabled:cursor-not-allowed disabled:opacity-40">
      + {children}
    </button>);
}
